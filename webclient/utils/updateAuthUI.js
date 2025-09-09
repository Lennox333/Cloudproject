import { renderContent } from "..";
import { checkLogin } from "./checkLogin";
import { SERVER } from "./globals";


// change login button to logout if logged in
export const updateAuthUI = async () => {
  const loginLink = document.querySelector('a[href="/login"]');
  if (!loginLink) return;

  const loggedIn = await checkLogin();

  if (loggedIn) {
    // then log out shown
    loginLink.textContent = "Logout"; // change button text
    loginLink.onclick = async (e) => { // listener for the button
      e.preventDefault();
      await fetch(`${SERVER}/logout`, {
        method: "POST",
        credentials: "include",
      });
      loginLink.textContent = "Login";
      loginLink.href = "/login";
      renderContent("/"); // go home
      updateAuthUI(); // update state again
    };
  } else {
    // Not logged in
    loginLink.textContent = "Login";
    loginLink.href = "/login";
    loginLink.onclick = (e) => {
      e.preventDefault();
      renderContent("/login");
    };
  }
};

