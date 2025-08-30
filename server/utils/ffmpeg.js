import { exec, spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { getDirname } from "./getDirname.js";

const __dirname = getDirname(import.meta.url);


async function generateThumbnail(videoPath, videoId) {
  const thumbnailsDir = path.join(__dirname, "../uploads/thumbnails");
  await fs.mkdir(thumbnailsDir, { recursive: true });
  const thumbnailName = `${videoId}.jpg`;
  const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 "${thumbnailPath}"`;
    exec(cmd, (err) => {
      if (err) return reject(err);
      resolve(thumbnailName);
    });
  });
}

async function transcodeVideo(videoPath, videoId) {
  const uploadsDir = path.join(__dirname, "../uploads/videos");
  await fs.mkdir(uploadsDir, { recursive: true });

  const resolutions = [
    // { name: `${videoId}_360p.mp4`, scale: "640:360" },
    // { name: `${videoId}_480p.mp4`, scale: "854:480" },
    { name: `${videoId}_720p.mp4`, scale: "1280:720" },
  ];

  // Wrap all ffmpeg processes in Promises
  const transcodePromises = resolutions.map(
    ({ name, scale }) =>
      new Promise((resolve, reject) => {
        const outputPath = path.join(uploadsDir, name);
        const cmd = `ffmpeg -i "${videoPath}" -vf scale=${scale} -c:v libx264 -crf 28 -preset veryfast -c:a aac -strict -2 "${outputPath}"`;

        exec(cmd, (err) => {
          if (err) {
            console.error(`Error transcoding ${scale}:`, err);
            reject(err);
          } else {
            console.log(`Created ${outputPath}`);
            resolve(outputPath);
          }
        });
      })
  );

  await Promise.all(transcodePromises);

  // Delete source file after transcoding regardless of successful
  try {
    await fs.unlink(videoPath);
    console.log("Deleted temp upload:", videoPath);
  } catch (err) {
    console.error("Failed to delete temp file:", err);
  }
}


export { generateThumbnail, transcodeVideo }