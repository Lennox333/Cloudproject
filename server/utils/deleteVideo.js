import path from "path";
import fs from "fs/promises";
import { getDirname } from "./getDirname.js";

const dirname = getDirname(import.meta.url);

export const deleteVideoFiles = async (videoId) => {
  // Delete thumbnail
  const thumbnailPath = path.join(dirname, "../uploads/thumbnails", videoId);
  await fs.unlink(thumbnailPath).catch(() => {}); // ignore if missing

  // Delete transcoded videos
  const uploadsDir = path.join(dirname, "../uploads/videos");
  const files = await fs.readdir(uploadsDir);
  const relatedFiles = files.filter((f) => f.startsWith(videoId));
  await Promise.all(
    relatedFiles.map((file) =>
      fs.unlink(path.join(uploadsDir, file)).catch(() => {})
    )
  );
};
