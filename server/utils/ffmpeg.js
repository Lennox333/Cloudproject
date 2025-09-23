import { GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import { addVideoThumbnail, updateVideoStatus } from "./videos.js";
import { getPresignedUrl, s3, uploadToS3 } from "./s3.js";
import { BUCKET } from "./secretManager.js";
import { Upload } from "@aws-sdk/lib-storage";


async function generateThumbnailFromStream(s3Url, videoId) {
  const thumbnailKey = `thumbnails/${videoId}.jpg`;
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      s3Url, // feed ffmpeg the presigned URL directly
      "-ss",
      "00:00:01",
      "-vframes",
      "1",
      "-f",
      "image2",
      "pipe:1",
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", (data) => console.error(data.toString()));

    uploadToS3(ffmpeg.stdout, thumbnailKey, "image/jpeg")
      .then(async () => {
        await addVideoThumbnail(videoId, thumbnailKey); // add thumbnailkey later to ensure thumbnail exist before referencing it
        resolve(thumbnailKey);
      })
      .catch(reject);

  });
}



async function generateThumbnailMultipart(s3Url, videoId) {
  const thumbnailKey = `thumbnails/${videoId}.jpg`;

  return new Promise((resolve, reject) => {
    // Spawn ffmpeg to grab a single frame at 1s
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      s3Url,       // Input video URL
      "-ss",
      "00:00:01",  // Seek to 1 second
      "-vframes",
      "1",         // Only one frame
      "-f",
      "image2",
      "pipe:1",    // Output to stdout
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", (data) => console.error(data.toString()));

    // Multipart upload via AWS SDK v3
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET,
        Key: thumbnailKey,
        Body: ffmpeg.stdout,
        ContentType: "image/jpeg",
      },
      queueSize: 4,     // concurrency
      partSize: 5 * 1024 * 1024, // 5MB per part
    });

    upload.done()
      .then(async () => {
        await addVideoThumbnail(videoId, thumbnailKey);
        resolve(thumbnailKey);
      })
      .catch(reject);
  });
}



import fs from "fs";
import path from "path";
async function generateThumbnailLocal(s3Url, videoId) {
  const thumbnailDir = path.resolve("./thumbnails");
  if (!fs.existsSync(thumbnailDir)) fs.mkdirSync(thumbnailDir, { recursive: true });

  const thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      s3Url,          // Input video URL (can be presigned)
      "-ss",
      "00:00:01",     // Seek to 1 second
      "-vframes",
      "1",            // Take only one frame
      thumbnailPath,  // Output file path
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", (data) => console.error(data.toString()));

    ffmpeg.on("close", async (code) => {
      if (code === 0) {
        // Optional: upload to S3 here
        // await uploadToS3(fs.createReadStream(thumbnailPath), `thumbnails/${videoId}.jpg`, "image/jpeg");
        resolve(thumbnailPath);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}


async function transcodeResolution(inputStream, s3Key, scale) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      "pipe:0",
      "-vf",
      `scale=${scale}`,
      "-c:v",
      "libx264",
      "-crf",
      "23",
      "-preset",
      "medium",
      "-c:a",
      "aac",
      "-f",
      "mp4",
      "pipe:1",
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", (data) => console.error(data.toString()));

    uploadToS3(ffmpeg.stdout, s3Key, "video/mp4").then(resolve).catch(reject);

    inputStream.pipe(ffmpeg.stdin, { end: true });
  });
}

export async function transcodeAndUpload(videoId, s3KeyOriginal) {
  try {
    const s3Url = await getPresignedUrl(s3KeyOriginal);
    console.log(s3Url)
    // Transcode resolutions
    const resolutions = [
      { name: `${videoId}_360p.mp4`, scale: "640:360" },
      { name: `${videoId}_480p.mp4`, scale: "854:480" },
      { name: `${videoId}_720p.mp4`, scale: "1280:720" },
    ];

    // Thumbnail
    await generateThumbnailFromStream(s3Url, videoId);

    // await generateThumbnailLocal(s3Url, videoId);

    // await generateThumbnailMultipart(s3Url, videoId);
    // Videos
    // await Promise.all(resolutions.map(async ({ name, scale }) => {
    //   const stream = await s3
    //     .send(new GetObjectCommand({ Bucket: BUCKET, Key: s3KeyOriginal }))
    //     .then(res => res.Body);
    //   return transcodeResolution(stream, `videos/${name}`, scale);
    // }));

    // await updateVideoStatus(videoId, "processed");
    console.log(`Video ${videoId} processed successfully`);
  } catch (err) {
    console.error("Transcoding failed for videoId:", videoId, err);
    await updateVideoStatus(videoId, "failed");
  }
}
