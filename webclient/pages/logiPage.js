import { renderContent } from "..";
import { SERVER } from "../utils/globals";
import { updateAuthUI } from "../utils/updateAuthUI";



export const bindLoginForm = () => {
  const form = document.querySelector("#login-form");
  const messageDiv = document.querySelector("#login-message");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      username: form.username.value.trim(),
      password: form.password.value,
    };

    try {
      const res = await fetch(`${SERVER}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include", // include cookies
      });

      const result = await res.json();
      if (res.ok) {
        messageDiv.textContent = "Login successful!";
        messageDiv.style.color = "green";
        form.reset();

        // Update login link to logout
        updateAuthUI();
        
        // Navigate to home
        window.history.pushState({}, "", "/");
        renderContent("/");
      } else {
        messageDiv.textContent = result.error || "Login failed";
        messageDiv.style.color = "red";
      }
    } catch (err) {
      console.error(err);
      messageDiv.textContent = "Network error";
      messageDiv.style.color = "red";
    }
  });
};


