import { SERVER } from "../utils/globals";

export const MyVideoItem = (video) => `
  <li class="video-item" data-id="${video.video_id}">
    <img 
      class="video-thumb" 
      src="${SERVER}/thumbnails/${video.video_id}.jpg" 
      alt="${video.video_title}" 
      data-id="${video.video_id}"
    />
    <p>${video.video_title}</p>
    <button class="delete-btn">Delete</button>
  </li>
`;