import express from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import {
  authenticateToken,
  generateToken,
} from "./middleware/authentication.js";
import { generateThumbnail, transcodeVideo } from "./utils/ffmpeg.js";
import upload from "./utils/storage.js";
import { pool_setup } from "./utils/database.js";
import { getVideoPath, fileExists, streamVideo } from "./utils/streamfile.js";
import { getDirname } from "./utils/getDirname.js";
import cors from "cors";
import { fetchVideos } from "./utils/fetchVideos.js";
import { deleteVideoFiles } from "./utils/deleteVideo.js";

const app = express();

const dirname = getDirname(import.meta.url);
const PORT = process.env.PORT || 5000;
const pool = await pool_setup();
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:8080", // frontend URL
    credentials: true, // allow cookies/auth headers
  })
);

console.log("CORS allowed origin:", process.env.FRONTEND_ORIGIN);

// Serve thumbnails
app.use("/thumbnails", express.static(`${dirname}/uploads/thumbnails`));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//##### ENDPOINTS ####

app.get("/me", (req, res) => {
  res.send("hello world");
});

app.post(
  "/upload",
  authenticateToken,
  upload.single("video"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { title, description } = req.body;
    const videoId = randomUUID();

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Video title is required" });
    }

    let conn;
    try {
      // Generate thumbnail
      const thumbnailName = await generateThumbnail(req.file.path, videoId);

      // Save video info to DB using user-provided title
      conn = await pool.getConnection();
      await conn.query(
        "INSERT INTO user_videos (user_id, video_id, video_title, description, thumbnail) VALUES (?, ?, ?, ?, ?)",
        [
          req.user.userId,
          videoId,
          title.trim(), // use user input
          description || null,
          thumbnailName,
        ]
      );

      await transcodeVideo(req.file.path, videoId);

      res.json({
        message: "Upload successful, transcoding started",
        videoId,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    } finally {
      if (conn) conn.release();
    }
  }
);

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

    res.json({ message: "User registered successfully", userId });
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

    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (conn) conn.release(); // release back to pool
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token"); // clear the login cookie
  res.json({ message: "Logged out successfully" });
});

app.get("/profile", authenticateToken, (req, res) => {
  res.json({
    message: `Hello ${req.user.username}`,
    userId: req.user.userId,
  });
});

// ## VIDEOS
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
    res.json(data);
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
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/video/:id", (req, res) => {
  const { id } = req.params;
  const resolution = req.query.res || "360";
  const allowedRes = ["360", "480", "720"];

  if (!allowedRes.includes(resolution))
    return res.status(400).json({ error: "Invalid resolution" });

  const videoPath = getVideoPath(id, resolution);

  if (!fileExists(videoPath))
    return res.status(404).json({ error: "Video not found" });

  streamVideo(videoPath, req, res);
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
    res.json({ success: true, message: `Deleted ${videoId}` });
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
