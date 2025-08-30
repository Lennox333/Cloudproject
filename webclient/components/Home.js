export const Home = `
<h2>My Homepage</h2>
<div id="video-player-container">
  <video id="video-player" controls width="640" height="360">
    <source id="video-source" src="" type="video/mp4" />
    Your browser does not support the video tag.
  </video>

  <label for="quality-selector">Quality:</label>
  <select id="quality-selector">
    <option value="360">360p</option>
    <option value="480">480p</option>
    <option value="720" selected>720p</option>
  </select>
</div>

<ul id="home-video-list" class="video-list"></ul>
<div id="pagination"></div>
`;
