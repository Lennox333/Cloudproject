import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { randomUUID } from "crypto";
import { authenticateToken } from "./middleware/authentication.js";
import { transcodeAndUpload } from "./utils/ffmpeg.js";
import { createIfNotExist, getPresignedUrl } from "./utils/s3.js";
import {
  isAdmin,
  loginUser,
  logoutUser,
  registerUser,
  confirmRegistration,
} from "./utils/users.js";
import {
  deleteVideo,
  fetchVideos,
  getVideoById,
  saveUserVideo,
} from "./utils/videos.js";
import { ensureUserVideosTable } from "./utils/dynamoSetup.js";

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
  const { username, password, email } = req.body; // Fixed: Added email to the destructured object.
  const result = await registerUser(username, password, email);

  if (result.error) {
    return res.status(400).json(result);
  }

  res.status(200).json(result);
});

app.post("/confirm-registration", async (req, res) => {
  const { username, confirmationCode } = req.body;

  if (!username || !confirmationCode) {
    return res
      .status(400)
      .json({ error: "Username and confirmation code are required." });
  }

  try {
    const result = await confirmRegistration(username, confirmationCode);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res
      .status(200)
      .json({ message: result.message, response: result.response });
  } catch (err) {
    console.error("Endpoint error:", err);
    res.status(500).json({ error: "Server error" });
  }
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
  const s3Key = `videos/${videoId}`;

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

app.get("/get-video-url-test", async (req, res) => {
  const { videoId, resolution = "720p" } = req.query; // get from query string
  if (!videoId) return res.status(400).json({ error: "videoId is required" });

  const s3Key = `videos/${videoId}`;

  try {
    const url = await getPresignedUrl(s3Key, 3600, "getObject"); // generate download URL
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate pre-signed URL" });
  }
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

app.post("/transcodetest", async (req, res) => {
  const { videoId, s3Key, title, description } = req.body;
  if (!videoId || !s3Key || !title)
    return res.status(400).json({ error: "Missing data" });

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
  if (video.status !== "processed") {
    return res.status(400).json({ error: "Thumbnail not available" });
  }
  const thumbnailKey = `thumbnails/${videoId}.jpg`;
  const thumbnailUrl = await getPresignedUrl(thumbnailKey, 3600, "getObject");
  res.status(200).redirect({ thumbnailUrl });
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
  const { upld_before, upld_after, limit, lastKey } = req.query;

  const data = await fetchVideos({
    upld_before,
    upld_after,
    limit,
    lastKey: lastKey ? JSON.parse(lastKey) : null,
  });

  if (data.error) return res.status(500).json({ error: data.error });

  // filter only processed videos for public view
  const publicVideos = data.videos.filter((v) => v.status === "processed");

  res.status(200).json({
    videos: publicVideos,
    total: publicVideos.length,
    lastKey: data.lastKey,
    limit: data.limit,
  });
});

app.get("/videos/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  if (req.user.userId !== userId)
    return res.status(403).json({ error: "Forbidden" });

  const { upld_before, upld_after, limit, lastKey } = req.query;
  const data = await fetchVideos({
    userId,
    upld_before,
    upld_after,
    limit,
    lastKey: lastKey ? JSON.parse(lastKey) : null,
  });
  if (data.error) return res.status(500).json({ error: data.error });

  res.status(200).json(data);
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

app.post("/create-bucket", async (req, res) => {
  const result = await createIfNotExist();
  if (result.error) return res.status(500).json(result);
  res.status(200).json(result);
});

app.get("/create-user-videos-table", async (req, res) => {
  try {
    await ensureUserVideosTable();
    res.status(200).json({ message: `Table user_videos ensured` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to ensure table" });
  }
});

//##### ENDPOINTS ####

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// app.get("/get-video-url-test", async (req, res) => {
//   const s3Key = "videos/539be652-087a-407a-b117-884e8b2f0dea-example.mp4";

//   try {
//     const url = await getPresignedUrl(s3Key, 3600, "getObject"); // generate download URL
//     res.json({ url });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to generate pre-signed URL" });
//   }
// });
