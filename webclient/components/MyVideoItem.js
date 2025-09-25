import { SERVER } from "../utils/globals";

export const MyVideoItem = (video) => `
  <li class="video-item" data-id="${video.videoId}">
    <img 
      class="video-thumb" 
      src="${SERVER}/thumbnails/${video.videoId}" 
      alt="${video.title}" 
      data-id="${video.videoId}"
    />
    <p>${video.title}</p>
    <p>Status: ${video.status}</p>
    <button class="delete-btn">Delete</button>
  </li>
`;
