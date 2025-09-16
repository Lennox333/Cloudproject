import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import { pool_setup } from "./database.js";
import { uploadToS3 } from "./s3";

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET_NAME;

const s3 = new S3Client({ region: REGION });
const pool = await pool_setup();

async function generateThumbnailFromStream(inputStream, videoId) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-ss", "00:00:01",
      "-vframes", "1",
      "-f", "image2",
      "pipe:1",
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", (data) => console.error(data.toString()));

    uploadToS3(ffmpeg.stdout, `thumbnails/${videoId}.jpg`, "image/jpeg")
      .then(() => resolve(`thumbnails/${videoId}.jpg`))
      .catch(reject);

    inputStream.pipe(ffmpeg.stdin, { end: true });
  });
}

async function transcodeResolution(inputStream, s3Key, scale) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-vf", `scale=${scale}`,
      "-c:v", "libx264",
      "-crf", "23",
      "-preset", "medium",
      "-c:a", "aac",
      "-f", "mp4",
      "pipe:1",
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", (data) => console.error(data.toString()));

    uploadToS3(ffmpeg.stdout, s3Key, "video/mp4")
      .then(resolve)
      .catch(reject);

    inputStream.pipe(ffmpeg.stdin, { end: true });
  });
}

async function transcodeAndUpload(videoId, s3KeyOriginal) {
  let conn;
  try {
    conn = await pool.getConnection();

    // Thumbnail
    const originalStream = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3KeyOriginal })).then(res => res.Body);
    const thumbnailKey = await generateThumbnailFromStream(originalStream, videoId);

    //  Transcode
    const resolutions = [
      { name: `${videoId}_360p.mp4`, scale: "640:360" },
      { name: `${videoId}_480p.mp4`, scale: "854:480" },
      { name: `${videoId}_720p.mp4`, scale: "1280:720" },
    ];

    const transcodePromises = resolutions.map(async ({ name, scale }) => {
      const stream = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3KeyOriginal })).then(res => res.Body);
      return transcodeResolution(stream, `videos/${name}`, scale);
    });

    await Promise.all(transcodePromises);

    // Update DB
    await conn.query(
      "UPDATE user_videos SET status = ?, thumbnail = ? WHERE video_id = ?",
      ["processed", thumbnailKey, videoId]
    );

    console.log(`Video ${videoId} processed and uploaded successfully`);
  } catch (err) {
    console.error("Transcoding failed for videoId:", videoId, err);
    if (conn) await conn.query("UPDATE user_videos SET status = ? WHERE video_id = ?", ["failed", videoId]);
  } finally {
    if (conn) conn.release();
  }
}

export default transcodeAndUpload;
