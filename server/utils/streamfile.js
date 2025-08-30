import fs from "fs";
import path from "path";
import { getDirname } from "./getDirname.js";

const __dirname = getDirname(import.meta.url);


function getVideoPath(id, resolution) {
  return path.join(__dirname, "../uploads/videos", `${id}_${resolution}p.mp4`);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function streamVideo(filePath, req, res) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const file = fs.createReadStream(filePath);
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    };
    res.writeHead(200, head);
    file.pipe(res);
  }
}

export { getVideoPath, streamVideo, fileExists };
