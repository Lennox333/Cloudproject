import { checkLogin } from "../utils/checkLogin";
import { SERVER } from "../utils/globals";


export const  bindUploadForm =  async () => {
  const form = document.querySelector("#video-upload-form");
  const messageDiv = document.querySelector("#upload-message");

  if (!form) return;
  const loggedIn = await checkLogin();
  // Check auth state
  if (!loggedIn) {
    form.style.display = "none";
    messageDiv.textContent = "You must be logged in to upload videos.";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.querySelector("#video-title").value.trim();
    const videoFile = document.querySelector("#video-file").files[0];

    if (!title || !videoFile) {
      messageDiv.textContent = "Title and video file are required.";
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("video", videoFile);

    try {
      const res = await fetch(`http://${SERVER}:5000/upload`, {
        method: "POST",
        body: formData,
        credentials: "include", // sends cookies if using cookie auth
      });

      const data = await res.json();
      if (res.ok) {
        messageDiv.textContent = "Upload successful!";
        form.reset();
      } else {
        messageDiv.textContent = `Upload failed: ${data.error || "Unknown error"}`;
      }
    } catch (err) {
      console.error(err);
      messageDiv.textContent = "Upload failed: Network error";
    }
  });
};
