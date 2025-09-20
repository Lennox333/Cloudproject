import express from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import {
  authenticateToken,
  generateToken,
} from "./middleware/authentication.js";
import { transcodeAndUpload } from "./utils/ffmpeg.js";
import cors from "cors";
import { createIfNotExist, deleteVideoFiles, getPresignedUrl } from "./utils/s3.js";
import { registerUser } from "./utils/users.js";
import { deleteUserVideo, fetchVideos, getVideoById, saveUserVideo } from "./utils/videos.js";

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
  const result = await registerUser(username, password);

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

  let conn;
  try {
    conn = await pool.getConnection();
    // Find user
    const rows = await conn.query(
      "SELECT user_id, password_hash FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const user = rows[0];

    // Compare passwords
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    // Create JWT payload
    const payload = { userId: user.user_id, username };
    const token = generateToken(payload);

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true, // not accessible via JS
      secure: false,
      maxAge: 3 * 60 * 60 * 1000, // 3 hours
    });

    res.status(200)({ message: "Login successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (conn) conn.release(); // release back to pool
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token"); // clear the login cookie
  res.status(200).json({ message: "Logged out successfully" });
});

app.get("/profile", authenticateToken, (req, res) => {
  res.status(200)({
    message: `Hello ${req.user.username}`,
    userId: req.user.userId,
  });
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
  if (req.user.userId !== userId) return res.status(403).json({ error: "Forbidden" });

  const { upld_before, upld_after, page, limit } = req.query;
  const data = await fetchVideos({ userId, upld_before, upld_after, page, limit });
  if (data.error) return res.status(500).json({ error: data.error });

  res.status(200).json(data);
});


app.delete("/video/:videoId", authenticateToken, async (req, res) => {
  const { videoId } = req.params;

  try {
    const video = await getVideoById(videoId);

    if (!video || video.error) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Check ownership
    if (req.user.userId !== video.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Delete from DynamoDB
    const result = await deleteUserVideo(videoId);
    if (result.error) {
      return res.status(500).json({ error: "Failed to delete video" });
    }

    // Delete S3 files
    await deleteVideoFiles(video);

    console.log("Deleted ", videoId);
    res.status(200).json({ success: true, message: `Deleted ${videoId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database or file deletion error" });
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


// import { deleteVideoFiles, getVideoById, deleteUserVideo } from "./utils/videos.js";

// app.delete("/video/:videoId", authenticateToken, async (req, res, next) => {
//   const { videoId } = req.params;

//   try {
//     const video = await getVideoById(videoId);
//     if (!video || video.error) return res.status(404).json({ error: "Video not found" });

//     // Allow deletion if the user owns the video OR is admin
//     const username = req.user.username;
//     const userId = req.user.userId;

//     const isOwner = userId === video.userId;
    
//     // Check admin only if not owner
//     if (!isOwner) {
//       const command = new AdminListGroupsForUserCommand({
//         UserPoolId: process.env.COGNITO_USER_POOL_ID,
//         Username: username,
//       });
//       const response = await cognito.send(command);
//       const groups = response.Groups.map(g => g.GroupName);
//       if (!groups.includes("Admin")) {
//         return res.status(403).json({ error: "Forbidden: not owner or admin" });
//       }
//     }

//     // Delete from DynamoDB
//     const result = await deleteUserVideo(videoId);
//     if (result.error) return res.status(500).json({ error: "Failed to delete video" });

//     // Delete S3 files
//     await deleteVideoFiles(video);

//     res.status(200).json({ success: true, message: `Deleted ${videoId}` });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Database or file deletion error" });
//   }
// });
