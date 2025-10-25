import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authenticateToken } from "../../middleware/authentication.js";
import { getPresignedUrl } from "../../utils/s3.js";
import { isAdmin } from "../../utils/users.js";
import { deleteVideo, getVideoById } from "../../utils/videos.js";

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

app.get("/video/thumbnail/:videoId", async (req, res) => {
  const { videoId } = req.params;

  const video = await getVideoById(videoId);
  if (video.error) return res.status(404).json({ error: video.error });

  // Only allow access if processed
  if (video.status !== "processed") {
    return res.status(400).json({ error: "Thumbnail not available" });
  }
  const thumbnailKey = `thumbnails/${videoId}.jpg`;
  const thumbnailUrl = await getPresignedUrl(thumbnailKey, 3600, "getObject");
  res.status(200).json({ thumbnailUrl });
});

app.get("/video/:id/stream", async (req, res) => {
  const { id } = req.params;
  const { res: resolution = "360" } = req.query;
  const allowedRes = ["360", "480", "720"];

  if (!allowedRes.includes(resolution)) {
    return res.status(400).json({ error: "Invalid resolution" });
  }

  const video = await getVideoById(id);
  if (video.error) return res.status(404).json({ error: video.error });

  if (video.status !== "processed") {
    return res.status(400).json({ error: "Video is not ready for streaming" });
  }

  const key = `videos/${id}_${resolution}p.mp4`;
  const url = await getPresignedUrl(key, 3600, "getObject");
  res.status(200).json({ videoUrl: url });
});

app.get("/video/:id/status", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const video = await getVideoById(id);

  if (video.error) return res.status(404).json({ error: video.error });

  res.status(200).json({ videoId: id, status: video.status });
});

app.delete("/video/:videoId", authenticateToken, async (req, res) => {
  const { videoId } = req.params;

  try {
    const video = await getVideoById(videoId);
    if (!video || video.error)
      return res.status(404).json({ error: "Video not found" });

    // Owner check
    if (req.user.userId !== video.userId) {
      // Not owner -> check admin
      const adminCheck = await isAdmin(req.user);
      if (!adminCheck.success) {
        return res.status(403).json({ error: adminCheck.error });
      }
    }

    const result = await deleteVideo(video.videoId);
    if (result.error) return res.status(500).json({ error: result.error });

    res
      .status(200)
      .json({ success: true, message: `Deleted ${video.videoId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ALB sever health check
app.get("/video/health", (req, res) => {
  res.status(200).send("OK");
});

//##### ENDPOINTS ####

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
