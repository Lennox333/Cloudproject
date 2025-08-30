import fs from "fs";
import path from "path";
import multer from "multer";
import { getDirname } from "./getDirname.js"; // one-line __dirname utility

// Project root
const projectRoot = path.resolve(getDirname(import.meta.url), "..");

// Temporary upload folder
const tempUploadDir = path.join(projectRoot, "temp_uploads");
if (!fs.existsSync(tempUploadDir)) fs.mkdirSync(tempUploadDir, { recursive: true });

// Multer disk storage
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempUploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

// Export multer instance
const upload = multer({ storage: diskStorage });

export default upload;
