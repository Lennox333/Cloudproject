import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authenticateToken } from "../../middleware/authentication.js";

import { fetchVideos } from "../../utils/videos.js";

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

// ALB sever health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

//##### ENDPOINTS ####

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
