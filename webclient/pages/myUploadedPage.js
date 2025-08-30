import { MyVideoItem } from "../components/MyVideoItem";
import { checkLogin } from "../utils/checkLogin.js";
import { SERVER, serverReady } from "../utils/globals.js";

export const renderMyUploads = async () => {
  const container = document.querySelector("#my-uploads");
  if (!container) return;

  // Check if user is logged in
  const userId = await checkLogin();
  if (!userId) {
    container.innerHTML = "<p>Please log in to view your uploads.</p>";
    return;
  }

  try {
    await serverReady;
    const res = await fetch(`${SERVER}/videos/${userId}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch videos");
    const { videos } = await res.json();

    // Render each video using the template
    container.innerHTML = videos.length
      ? `<ul class="video-list">${videos.map(MyVideoItem).join("")}</ul>`
      : "<p>You have no uploaded videos.</p>";

    // Attach delete listeners
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        // find the closest li.video-item
        const parent = e.target.closest(".video-item");
        if (!parent) return; // safety check

        const videoId = parent.querySelector(".video-thumb").dataset.id;

        if (!confirm("Are you sure you want to delete this video?")) return;

        try {
          const delRes = await fetch(`${SERVER}/video/${videoId}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (delRes.ok) parent.remove();
          else {
            const data = await delRes.json();
            alert(`Failed to delete: ${data.error}`);
          }
        } catch (err) {
          console.error(err);
          alert("Network error, could not delete video.");
        }
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Failed to load your uploads.</p>";
  }
};
