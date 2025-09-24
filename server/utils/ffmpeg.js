import { GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import { addVideoThumbnail, updateVideoStatus } from "./videos.js";
import { getPresignedUrl, s3, uploadToS3 } from "./s3.js";
import { config } from "./secretManager.js";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from "stream";
import { tmpdir } from "os";
import { join } from "path";
import axios from "axios";
import fs from "fs";

async function generateThumbnailFromStream(s3Url, videoId) {
  const thumbnailKey = `thumbnails/${videoId}.jpg`;
  const tmpFile = join(tmpdir(), `${videoId}.mp4`);

  // 1️⃣ Download video
  const writer = fs.createWriteStream(tmpFile);
  const response = await axios.get(s3Url, { responseType: "stream" });
  response.data.pipe(writer);
  await new Promise((resolve, reject) =>
    writer.on("finish", resolve).on("error", reject)
  );

  // 2️⃣ Spawn ffmpeg on local file
  const ffmpeg = spawn("ffmpeg", [
    "-ss",
    "00:00:01",
    "-i",
    tmpFile,
    "-frames:v",
    "1",
    "-f",
    "image2",
    "-update",
    "1",
    "-vsync",
    "0",
    "pipe:1",
  ]);

  const pass = new PassThrough();
  ffmpeg.stdout.pipe(pass);
  ffmpeg.stderr.on("data", (d) => console.error(`[FFmpeg] ${d.toString()}`));
  ffmpeg.on("error", (err) => console.error(`[FFmpeg] Error: ${err}`));

  // 3️⃣ Upload thumbnail to S3
  await uploadToS3(pass, thumbnailKey, "image/jpeg");
  console.log(`[Thumbnail] Upload successful: ${thumbnailKey}`);

  fs.unlinkSync(tmpFile);
  return thumbnailKey;
}

async function generateThumbnailMultipart(s3Url, videoId) {
  const thumbnailKey = `thumbnails/${videoId}.jpg`;

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      s3Url,
      "-ss",
      "00:00:01",
      "-vframes",
      "1",
      "-f",
      "image2",
      "-update",
      "1",
      "pipe:1",
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", (data) => console.error(data.toString()));

    const upload = new Upload({
      client: s3, // Assuming `s3` is the client you need
      params: {
        Bucket: config.BUCKET,
        Key: thumbnailKey,
        Body: ffmpeg.stdout,
        ContentType: "image/jpeg",
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
    });

    upload
      .done()
      .then(async () => {
        resolve(thumbnailKey);
      })
      .catch(reject);
  });
}

async function generateThumbnailLocal(s3Url, videoId) {
  const thumbnailDir = path.resolve("./thumbnails");
  if (!fs.existsSync(thumbnailDir))
    fs.mkdirSync(thumbnailDir, { recursive: true });

  const thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      s3Url,
      "-ss",
      "00:00:01",
      "-vframes",
      "1",
      thumbnailPath,
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", (data) => console.error(data.toString()));

    ffmpeg.on("close", async (code) => {
      if (code === 0) {
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
    console.log(s3Url);

    await generateThumbnailFromStream(s3Url, videoId);

    // Videos
    // await Promise.all(resolutions.map(async ({ name, scale }) => {
    //   const stream = await s3
    //     .send(new GetObjectCommand({ Bucket: config.BUCKET, Key: s3KeyOriginal }))
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