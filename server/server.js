import express from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import { authenticateToken } from "./middleware/authentication.js";
import { transcodeAndUpload } from "./utils/ffmpeg.js";
import cors from "cors";
import { createIfNotExist, getPresignedUrl } from "./utils/s3.js";
import { isAdmin, loginUser, logoutUser, registerUser } from "./utils/users.js";
import {
  deleteVideo,
  fetchVideos,
  getVideoById,
  saveUserVideo,
} from "./utils/videos.js";


const app = express();
const PORT = process.env.PORT || 5000;

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

//## USER

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const result = await registerUser(username, password, email);

  if (result.error) {
    return res.status(400).json(result);
  }

  res.status(200).json(result);
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    // Authenticate with Cognito
    const tokens = await loginUser(username, password);

    res.cookie("token", tokens.accessToken, {
      httpOnly: true,
      secure: false,
      maxAge: 3 * 60 * 60 * 1000, // 3 hours
    });

    res.status(200).json({
      message: "Login successful",
      ...tokens, // idToken, accessToken, refreshToken
    });
  } catch (err) {
    console.error("Cognito login error:", err);
    res.status(400).json({ error: "Invalid username or password" });
  }
});

app.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.token;
    1;
    if (!token)
      return res.status(400).json({ error: "Token required for logout" });

    const result = await logoutUser(token);
    if (result.error)
      return res.status(500).json({ error: "Failed to log out" });

    // Clear cookie
    res.clearCookie("token", { httpOnly: true, secure: false });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Failed to log out" });
  }
});
// ## VIDEOS

app.post("/get-upload-url", authenticateToken, async (req, res) => {
  const { filename, title } = req.body;

  if (!filename || !title)
    return res.status(400).json({ error: "Filename and title required" });

  const videoId = randomUUID();
  const s3Key = `videos/${videoId}-${filename}`;

  try {
    const uploadUrl = await getPresignedUrl(s3Key, 3600, "putObject");
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

app.post("/start-encode", authenticateToken, async (req, res) => {
  const { videoId, s3Key, title, description } = req.body;
  if (!videoId || !s3Key || !title)
    return res.status(400).json({ error: "Missing data" });

  const result = await saveUserVideo({
    userId: req.user.userId,
    videoId,
    title,
    description: description || null,
  });

  if (result.error) {
    return res.status(500).json(result);
  }

  res.status(200).json({
    message: "Upload confirmed, transcoding started",
    videoId,
  });

  transcodeAndUpload(videoId, s3Key); // async background task
});

app.get("/thumbnails/:videoId", async (req, res) => {
  const { videoId } = req.params;

  const video = await getVideoById(videoId);
  if (video.error) return res.status(404).json({ error: video.error });

  // Only allow access if processed
  if (video.status !== "processed" || !video.thumbnailKey) {
    return res.status(400).json({ error: "Thumbnail not available" });
  }

  const thumbnailUrl = await getPresignedUrl(
    video.thumbnailKey,
    3600,
    "getObject"
  );
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

app.get("/videos/:id/status", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const video = await getVideoById(id);

  if (video.error) return res.status(404).json({ error: video.error });

  res.status(200).json({ videoId: id, status: video.status });
});

app.get("/videos", async (req, res) => {
  const { upld_before, upld_after, page, limit } = req.query;

  const data = await fetchVideos({ upld_before, upld_after, page, limit });
  if (data.error) return res.status(500).json({ error: data.error });

  res.status(200).json(data);
});

app.get("/videos/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  if (req.user.userId !== userId)
    return res.status(403).json({ error: "Forbidden" });

  const { upld_before, upld_after, page, limit } = req.query;
  const data = await fetchVideos({
    userId,
    upld_before,
    upld_after,
    page,
    limit,
  });
  if (data.error) return res.status(500).json({ error: data.error });

  res.status(200).json(data);
});



app.delete("/video/:videoId", authenticateToken, async (req, res) => {
  const { videoId } = req.params;

  try {
    const video = await getVideoById(videoId);
    if (!video || video.error) return res.status(404).json({ error: "Video not found" });

    // Owner check
    if (req.user.userId !== video.userId) {
      // Not owner → check admin
      const adminCheck = await isAdmin(req.user);
      if (!adminCheck.success) {
        return res.status(403).json({ error: adminCheck.error });
      }
    }

    const result = await deleteVideo(video);
    if (result.error) return res.status(500).json({ error: result.error });

    res.status(200).json({ success: true, message: `Deleted ${video.videoId}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


app.post("/create-bucket", async (req, res) => {
  const result = await createIfNotExist();
  if (result.error) return res.status(500).json(result);
  res.status(200).json(result);
});

//##### ENDPOINTS ####

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
