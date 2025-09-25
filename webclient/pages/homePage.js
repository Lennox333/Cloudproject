import { SERVER } from "../utils/globals";

export const pageSize = 5;
let currentLastKey = null; // store lastKey for pagination
let currentVideoId = null; // store currently playing video
const videoPresignedUrls = {}; // store presigned URLs per video and resolution

export const fetchVideos = async (limit = pageSize, lastKey = null) => {
  try {
    const params = new URLSearchParams({ limit });
    if (lastKey) params.append("lastKey", JSON.stringify(lastKey));

    const res = await fetch(`${SERVER}/videos?${params.toString()}`);
    const data = await res.json(); // { videos: [...], total, lastKey }
    return data;
  } catch (err) {
    console.error(err);
    return { videos: [], total: 0, lastKey: null };
  }
};

// helper to fetch presigned URL
const fetchPresignedUrl = async (videoId, res = "720") => {
  try {
    const urlRes = await fetch(`${SERVER}/video/${videoId}/stream?res=${res}`);
    const data = await urlRes.json();
    if (data.error) {
      console.error(`Video ${videoId} not ready:`, data.error);
      return null;
    }
    return data.videoUrl;
  } catch (err) {
    console.error("Failed to fetch presigned URL:", err);
    return null;
  }
};

export const renderVideos = async () => {
  const { videos, total, lastKey } = await fetchVideos(
    pageSize,
    currentLastKey
  );
  currentLastKey = lastKey; // update lastKey for next page

  // Pre-fetch presigned URLs for 720p
  await Promise.all(
    videos.map(async (v) => {
      const url = await fetchPresignedUrl(v.videoId, "480");
      videoPresignedUrls[v.videoId] = { 720: url };
    })
  );
  const videoList = videos
    .map(
      (v) => `
      <li class="video-item">
        <img class="video-thumb" 
             src="${SERVER}/thumbnails/${v.videoId}" 
             alt="${v.title}"
             data-id="${v.videoId}" />
        <p>${v.title}</p>
      </li>
    `
    )
    .join("");

  const totalPages = Math.ceil(total / pageSize);
  const pagination = Array.from(
    { length: totalPages },
    (_, i) => `<button class="page-btn" data-page="${i + 1}">${i + 1}</button>`
  ).join("");

  document.querySelector("#home-video-list").innerHTML = videoList;
  document.querySelector("#pagination").innerHTML = pagination;

  // pagination buttons
  document.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      currentPage = Number(e.target.dataset.page);
      renderVideos();
    });
  });

  // quality selector
  const qualitySelector = document.querySelector("#quality-selector");
  if (qualitySelector) {
    qualitySelector.addEventListener("change", async (e) => {
      const res = e.target.value;
      if (currentVideoId) {
        // fetch presigned URL if not already cached
        if (!videoPresignedUrls[currentVideoId]?.[res]) {
          const url = await fetchPresignedUrl(currentVideoId, res);
          videoPresignedUrls[currentVideoId] = {
            ...videoPresignedUrls[currentVideoId],
            [res]: url,
          };
        }
        playVideo(currentVideoId, res);
      }
    });
  }

  // thumbnails -> load video in player
  document.querySelectorAll(".video-thumb").forEach((thumb) => {
    thumb.addEventListener("click", async (e) => {
      const videoId = e.target.dataset.id;
      const res = qualitySelector ? qualitySelector.value : "720";
      currentVideoId = videoId;

      // fetch presigned URL if not already cached
      if (!videoPresignedUrls[videoId]?.[res]) {
        const url = await fetchPresignedUrl(videoId, res);
        videoPresignedUrls[videoId] = {
          ...videoPresignedUrls[videoId],
          [res]: url,
        };
      }

      playVideo(videoId, res);
    });
  });
};

// helper function to play video using cached presigned URL
const playVideo = (videoId, res = "720") => {
  const player = document.querySelector("#video-player");
  const source = document.querySelector("#video-source");
  source.src = videoPresignedUrls[videoId]?.[res] || "";
  player.load();
  player.play();
};
