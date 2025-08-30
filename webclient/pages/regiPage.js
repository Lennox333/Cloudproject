import { SERVER, serverReady } from "../utils/globals";

export const bindRegisterForm = () => {
  const form = document.querySelector("#register-form");
  const messageDiv = document.querySelector("#register-message");

  if (!form) return; // in case HTML not loaded yet

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      username: form.username.value.trim(),
      //   email: form.email.value.trim(),
      password: form.password.value,
    };

    try {
      await serverReady;
      const res = await fetch(`${SERVER}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (res.ok) {
        messageDiv.textContent = "Registration successful!";
        messageDiv.style.color = "green";
        form.reset();
      } else {
        messageDiv.textContent = result.error || "Registration failed";
        messageDiv.style.color = "red";
      }
    } catch (err) {
      console.error(err);
      messageDiv.textContent = "Network error";
      messageDiv.style.color = "red";
    }
  });
};
