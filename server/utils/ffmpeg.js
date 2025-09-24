import { GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import { addVideoThumbnail, updateVideoStatus } from "./videos.js";
import { getPresignedUrl, s3, uploadToS3, uploadToS3Multipart } from "./s3.js";

import { PassThrough } from "stream";

// async function generateThumbnailFromStream(s3Url, videoId) {
//   const thumbnailKey = `thumbnails/${videoId}.jpg`;
//   return new Promise((resolve, reject) => {
//     const ffmpeg = spawn("ffmpeg", [
//       "-i",
//       s3Url, // input video
//       "-ss",
//       "00:00:01", // seek to 1 second
//       "-frames:v",
//       "1", // capture only 1 frame
//       "-f",
//       "image2", // image format
//       "-update",
//       "1", // IMPORTANT: allows single image to pipe
//       "-vsync",
//       "0", // optional: avoid framerate warnings
//       "pipe:1", // output to stdout
//     ]);
//     const pass = new PassThrough();
//     ffmpeg.stdout.pipe(pass); // ensures ffmpeg stdout is read continuously
//     ffmpeg.stderr.on("data", (data) => {
//       console.error(`[FFmpeg] ${data.toString()}`);
//     });
//     ffmpeg.on("error", reject);

//     ffmpeg.stderr.on("data", (data) => console.error(data.toString()));
//     console.log(`[Thumbnail] Uploading thumbnail to S3: ${thumbnailKey}`);
//     uploadToS3(pass, thumbnailKey, "image/jpeg")
//       .then(async () => {
//         console.log(`[Thumbnail] Upload successful: ${thumbnailKey}`);
//         // await addVideoThumbnail(videoId, thumbnailKey); // add thumbnailkey later to ensure thumbnail exist before referencing it
//         resolve(thumbnailKey);
//       })
//       .catch(reject);
//   });
// }

// async function generateThumbnailFromStream(s3Url, videoId) {
//   const thumbnailKey = `thumbnails/${videoId}.jpg`;
//   const tmpFile = join(tmpdir(), `${videoId}.mp4`);

//   // 1️⃣ Download video
//   const writer = fs.createWriteStream(tmpFile);
//   const response = await axios.get(s3Url, { responseType: "stream" });
//   response.data.pipe(writer);
//   await new Promise((resolve, reject) =>
//     writer.on("finish", resolve).on("error", reject)
//   );

//   // 2️⃣ Spawn ffmpeg on local file
//   const ffmpeg = spawn("ffmpeg", [
//     "-ss",
//     "00:00:01", // seek first
//     "-i",
//     tmpFile, // local file
//     "-frames:v",
//     "1", // single frame
//     "-f",
//     "image2",
//     "-update",
//     "1",
//     "-vsync",
//     "0",
//     "pipe:1",
//   ]);

//   const pass = new PassThrough();
//   ffmpeg.stdout.pipe(pass);
//   ffmpeg.stderr.on("data", (d) => console.error(`[FFmpeg] ${d.toString()}`));
//   ffmpeg.on("error", (err) => console.error(`[FFmpeg] Error: ${err}`));

//   // 3️⃣ Upload thumbnail to S3
//   await uploadToS3(pass, thumbnailKey, "image/jpeg");
//   console.log(`[Thumbnail] Upload successful: ${thumbnailKey}`);

//   fs.unlinkSync(tmpFile); // cleanup
//   return thumbnailKey;
// }

async function generateThumbnail(s3Url, videoId) {
  const thumbnailKey = `thumbnails/${videoId}.jpg`;
  const pass = new PassThrough();
  const ffmpeg = spawn(
    "ffmpeg",
    [
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
    ],
    {
      stdio: ["pipe", "pipe", "pipe"], // pipe stdout & stderr
    }
  );
  return new Promise((resolve, reject) => {
    ffmpeg.stdout.pipe(pass);

    ffmpeg.on("error", (err) => console.error(`[FFmpeg] Spawn error: ${err}`));
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    console.log(`[Thumbnail] Uploading thumbnail to S3: ${thumbnailKey}`);
    uploadToS3Multipart(pass, thumbnailKey, "image/jpeg")
      .then(async () => {
        console.log(`[Thumbnail] Upload successful: ${thumbnailKey}`);
        resolve(thumbnailKey);
      })
      .catch(reject);
  });
}

async function transcodeVideo(s3Url, s3Key, scale) {
  const pass = new PassThrough();
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-i",
      s3Url,
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
    ],
    {
      stdio: ["pipe", "pipe", "pipe"], // pipe stdout & stderr
    }
  );

  return new Promise((resolve, reject) => {
    ffmpeg.stdout.pipe(pass);

    ffmpeg.stderr.on("data", (data) => {
      console.error(`[FFmpeg] ${data.toString()}`); // only log errors/warnings
    });

    ffmpeg.on("error", (err) => console.error(`[FFmpeg] Spawn error: ${err}`));

    ffmpeg.on("close", (code) => {
      if (code !== 0) reject(new Error(`FFmpeg exited with code ${code}`));
    });

    console.log(`[Transcode] Uploading transcoded video to S3: ${s3Key}`);
    uploadToS3Multipart(pass, s3Key, "video/mp4")
      .then(() => {
        console.log(`[Transcode] Upload successful: ${s3Key}`);
        resolve(s3Key);
      })
      .catch(reject);
  });
}

async function transcodeAllResolutions(s3Url, videoId) {
  const resolutions = [
    { name: `${videoId}_360p.mp4`, scale: "640:360" },
    // { name: `${videoId}_480p.mp4`, scale: "854:480" },
    // { name: `${videoId}_720p.mp4`, scale: "1280:720" },
  ];

  // map each resolution to a transcodeVideo promise
  const transcodePromises = resolutions.map((r) =>
    transcodeVideo(s3Url, r.name, r.scale)
  );

  try {
    // wait for all to complete
    const results = await Promise.all(transcodePromises);
    console.log(`[Transcode] All resolutions uploaded successfully:`, results);
    return results; // array of S3 keys
  } catch (err) {
    console.error(`[Transcode] Error in one of the resolutions:`, err);
    throw err;
  }
}

export async function transcodeAndUpload(videoId, s3KeyOriginal) {
  try {
    const s3Url = await getPresignedUrl(s3KeyOriginal);

    console.log(s3Url)
    // Thumbnail
    await generateThumbnail(s3Url, videoId);

    // Videos

    await transcodeAllResolutions(s3Url, videoId);
  } catch (err) {
    console.error("[Video] Transcoding failed for videoId:", videoId, err);
    await updateVideoStatus(videoId, "failed");
  }
}
