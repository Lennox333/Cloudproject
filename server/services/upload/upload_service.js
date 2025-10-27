import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { randomUUID } from "crypto";
import { authenticateToken } from "../../middleware/authentication.js";
import { getPresignedUrl } from "../../utils/s3.js";
import { isAdmin } from "../../utils/users.js";
import {
  deleteVideo,
  fetchVideos,
  getVideoById,
  saveUserVideo,
} from "../../utils/videos.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:1234"], // frontend URL
    credentials: true, // allow cookies/auth headers
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//##### ENDPOINTS ####

// ## VIDEOS

app.post("/upload/get-url", authenticateToken, async (req, res) => {
  const videoId = randomUUID();
  const s3Key = `videos/${videoId}`;

  const { title, description } = req.body;
  if (!videoId || !s3Key || !title)
    return res.status(400).json({ error: "Missing data" });

  try {
    const uploadUrl = await getPresignedUrl(s3Key, 3600, "putObject");

    // Save initial video entry as "unprocessed"
    const result = await saveUserVideo({
      userId: req.user.userId,
      videoId,
      title: title,
      description: description, // optional description
      status: "unprocessed",
    });

    if (result.error) {
      return res.status(500).json({ error: "Failed to save video metadata" });
    }

    res.status(200).json({ uploadUrl, videoId, s3Key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }

  //   // Frontend example
  // await fetch(uploadUrl, {
  //   method: "PUT",
  //   body: file,
  //   headers: { "Content-Type": file.type }
  // });

  // once client uploaded they can start the /upload
});

// // Save video to Database, done by client. Will be moved to worker.
// app.post("/upload/save-video", authenticateToken, async (req, res) => {
//   const { videoId, s3Key, title, description } = req.body;
//   if (!videoId || !s3Key || !title)
//     return res.status(400).json({ error: "Missing data" });

//   const result = await saveUserVideo({
//     userId: req.user.userId,
//     videoId,
//     title,
//     description: description || null,
//     status: "processed",
//   });

//   if (result.error) {
//     return res.status(500).json(result);
//   }

//   // No longer calling transcodeAndUpload here!
//   // The Lambda function will detect the S3 upload and trigger processing automatically

//   res.status(200).json({
//     message: `Video saved.`,
//     videoId,
//   });
// });

// ALB sever health check
app.get("/upload/health", (req, res) => {
  res.status(200).send("OK");
});

//##### ENDPOINTS ####

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
