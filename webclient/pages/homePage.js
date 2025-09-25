import { SERVER } from "../utils/globals";

export const pageSize = 5;
let currentLastKey = null; // store lastKey for pagination
let currentVideoId = null; // store currently playing video

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

export const renderVideos = async () => {
  const { videos, total, lastKey } = await fetchVideos(
    pageSize,
    currentLastKey
  );
  currentLastKey = lastKey; // update lastKey for next page

  const videoList = videos
    .map(
      (v) => `
        <li class="video-item">
          <img class="video-thumb" 
               src="${SERVER}/thumbnails/${v.thumbnail}" 
               alt="${v.video_title}"
               data-id="${v.video_id}" />
          <p>${v.video_title}</p>
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
    qualitySelector.addEventListener("change", (e) => {
      const res = e.target.value;
      if (currentVideoId) {
        playVideo(currentVideoId, res);
      }
    });
  }

  // thumbnails -> load video in player
  document.querySelectorAll(".video-thumb").forEach((thumb) => {
    thumb.addEventListener("click", (e) => {
      const videoId = e.target.dataset.id;
      const res = qualitySelector ? qualitySelector.value : "720";
      currentVideoId = videoId;
      playVideo(videoId, res);
    });
  });
};

// helper function to play video
const playVideo = (videoId, res = "720") => {
  const player = document.querySelector("#video-player");
  const source = document.querySelector("#video-source");
  source.src = `${SERVER}/video/${videoId}?res=${res}`;
  player.load();
  player.play();
};
