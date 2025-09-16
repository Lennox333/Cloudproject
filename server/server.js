import express from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import {
  authenticateToken,
  generateToken,
} from "./middleware/authentication.js";
import { transcodeAndUpload } from "./utils/ffmpeg.js";
import { pool_setup } from "./utils/database.js";
import cors from "cors";
import { fetchVideos } from "./utils/fetchVideos.js";
import { deleteVideoFiles } from "./utils/deleteVideo.js";
import { getPresignedUrl } from "./utils/s3.js";

const app = express();
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-2";
const PORT = process.env.PORT || 5000;
const pool = await pool_setup();
app.use(
  cors({
    origin: [ "http://localhost:1234"], // frontend URL
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

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    // Check if username exists
    const existingUsers = await conn.query(
      "SELECT user_id FROM users WHERE username = ?",
      [username]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate a UUID for user id
    const userId = randomUUID();

    // Insert user into DB
    await conn.query(
      "INSERT INTO users (user_id, username, password_hash) VALUES (?, ?, ?)",
      [userId, username, passwordHash]
    );

    res.status(200).json({ message: "User registered successfully", userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (conn) conn.release(); // release back to pool
  }
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
app.get("/thumbnails/:videoId", async (req, res) => {
  const { videoId } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      "SELECT thumbnail FROM user_videos WHERE video_id = ?",
      [videoId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Thumbnail not found" });

    const s3Key = `thumbnails/${rows[0].thumbnail}`;
    
    // For public S3 bucket, just construct URL
    const url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    
    res.status(200).json({ thumbnailUrl: url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database/S3 error" });
  } finally {
    if (conn) conn.release();
  }
});



app.post("/get-upload-url", authenticateToken, async (req, res) => {
  const { filename, title } = req.body;

  if (!filename || !title) return res.status(400).json({ error: "Filename and title required" });

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

});



app.post("/upload", authenticateToken, async (req, res) => {
  const { videoId, s3Key, title, description } = req.body;
  if (!videoId || !s3Key || !title)
    return res.status(400).json({ error: "Missing data" });

  let conn;
  try {
    conn = await pool.getConnection();

    // Save metadata with initial status
    await conn.query(
      "INSERT INTO user_videos (user_id, video_id, video_title, description, s3_key, status) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.userId, videoId, title, description || null, s3Key, "processing"]
    );

    // Respond immediately
    res.status(200).json({ message: "Upload confirmed, transcoding started", videoId });

    // Start background transcoding
    transcodeAndUpload(videoId, s3Key);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/video/:id/stream", async (req, res) => {
  const { id } = req.params;
  const { res: resolution = "360" } = req.query; // default to 360p
  const allowedRes = ["360", "480", "720"];

  if (!allowedRes.includes(resolution)) {
    return res.status(400).json({ error: "Invalid resolution" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // Fetch S3 key for the video
    const rows = await conn.query(
      "SELECT s3_key FROM user_videos WHERE video_id = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Video not found" });

    const originalKey = rows[0].s3_key;
    const extension = originalKey.split(".").pop();
    const resolutionKey = `videos/${id}_${resolution}p.${extension}`;

    // Construct public URL
    const videoUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${resolutionKey}`;

    res.status(200).json({ videoUrl });
  } catch (err) {
    console.error("Streaming error:", err);
    res.status(500).json({ error: "Database/S3 error" });
  } finally {
    if (conn) conn.release();
  }
});



app.get("/videos/:id/status", authenticateToken, async (req, res) => {
  const { id } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      "SELECT status FROM user_videos WHERE video_id = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Video not found" });
    res.status(200).json({ videoId: id, status: rows[0].status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (conn) conn.release();
  }
});


app.get("/videos", async (req, res) => {
  const { upld_before, upld_after, page, limit } = req.query;

  let conn;
  try {
    conn = await pool.getConnection();
    const data = await fetchVideos({
      conn,
      upld_before,
      upld_after,
      page,
      limit,
    });
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/videos/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { page, limit, upld_before, upld_after } = req.query;

  // Only allow self
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const data = await fetchVideos({
      conn,
      userId,
      upld_before,
      upld_after,
      page,
      limit,
    });
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/video/:id", async (req, res) => {
  const { id } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      "SELECT s3_key FROM user_videos WHERE video_id = ?",
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Video not found" });

    const videoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${rows[0].s3_key}`;

    res.status(200).json({ videoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database/S3 error" });
  } finally {
    if (conn) conn.release();
  }
});


app.delete("/video/:videoId", authenticateToken, async (req, res) => {
  const { videoId } = req.params;
  let conn;

  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      "SELECT user_id, thumbnail FROM user_videos WHERE video_id = ?",
      [videoId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    const video = rows[0];

    if (req.user.userId !== video.user_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Delete from DB
    await conn.query("DELETE FROM user_videos WHERE video_id = ?", [videoId]);

    // Delete files
    await deleteVideoFiles(videoId);

    console.log("Deleted ", videoId);
    res.status(200).json({ success: true, message: `Deleted ${videoId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database or file deletion error" });
  } finally {
    if (conn) conn.release();
  }
});

//##### ENDPOINTS ####

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
