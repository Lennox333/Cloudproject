import "./styles.css";
import { routes } from "./routes.js";
import { renderVideos } from "./pages/homePage.js";
import { bindLoginForm } from "./pages/logiPage.js";
import { bindRegisterForm } from "./pages/regiPage.js";
import { bindUploadForm } from "./pages/uploadPage.js";
import { renderMyUploads } from "./pages/myUploadedPage.js";
import { updateAuthUI } from "./utils/updateAuthUI.js";

const nav = document.querySelector("#nav");
const app = document.querySelector("#app");


// credit for routing : https://dev.to/rohanbagchi/how-to-write-a-vanillajs-router-hk3


export const renderContent = (route) => {
  const routeObj = routes[route];
  if (!routeObj) {
    app.innerHTML = "<h2>Page not found</h2>";
    return;
  }

  // inject the static container first
  app.innerHTML = routeObj.content;
  // now the DOM exists, safe to render videos
  // bind function exist because if not the event listeners will listen to non rendered DOM (null)
  // only add eventlisteners after the html of the specific page has been rendered
  if (route === "/") renderVideos();
  if (route === "/register") bindRegisterForm();
  if (route === "/login") bindLoginForm();
  if (route === "/upload") bindUploadForm();
  if (route === "/my-uploads") renderMyUploads();
  // always check auth state after rendering
  updateAuthUI();

};

const navigate = (e) => {
  const route = e.target.pathname;
  window.history.pushState({}, "", route);
  renderContent(route);
};

const registerNavLinks = () => {
  nav.addEventListener("click", (e) => {
    e.preventDefault();
    if (!e.target.href) return;
    navigate(e);
  });
};

const renderNavlinks = () => {
  const navFragment = document.createDocumentFragment();
  Object.keys(routes).forEach((route) => {
    const { linkLabel } = routes[route];
    const linkElement = document.createElement("a");
    linkElement.href = route;
    linkElement.textContent = linkLabel;
    linkElement.className = "nav-link";
    navFragment.appendChild(linkElement);
  });
  nav.append(navFragment);
};

const registerBrowserBackAndForth = () => {
  window.onpopstate = () => renderContent(window.location.pathname);
};

const renderInitialPage = () => renderContent(window.location.pathname);

(function bootup() {
  renderNavlinks();
  registerNavLinks();
  registerBrowserBackAndForth();
  renderInitialPage();
})();
