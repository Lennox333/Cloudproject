import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import { addVideoThumbnail, updateVideoStatus } from "./videos.js";
import { uploadToS3 } from "./s3.js";
import { AWS_REGION } from "./secretManager.js";



const s3 = new S3Client({ region: AWS_REGION });

async function generateThumbnailFromStream(inputStream, videoId) {
  const thumbnailKey = `thumbnails/${videoId}.jpg`; 
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      "pipe:0",
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

    inputStream.pipe(ffmpeg.stdin, { end: true });
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
    const originalStream = await s3
      .send(new GetObjectCommand({ Bucket: BUCKET, Key: s3KeyOriginal }))
      .then(res => res.Body);


    // Transcode resolutions
    const resolutions = [
      { name: `${videoId}_360p.mp4`, scale: "640:360" },
      { name: `${videoId}_480p.mp4`, scale: "854:480" },
      { name: `${videoId}_720p.mp4`, scale: "1280:720" },
    ];

    // Thumbnail
    await generateThumbnailFromStream(originalStream, videoId);

    // Videos
    await Promise.all(resolutions.map(async ({ name, scale }) => {
      const stream = await s3
        .send(new GetObjectCommand({ Bucket: BUCKET, Key: s3KeyOriginal }))
        .then(res => res.Body);
      return transcodeResolution(stream, `videos/${name}`, scale);
    }));

    await updateVideoStatus(videoId, "processed");
    console.log(`Video ${videoId} processed successfully`);
  } catch (err) {
    console.error("Transcoding failed for videoId:", videoId, err);
    await updateVideoStatus(videoId, "failed");
  }
}
