import { Home } from "./components/Home";
import { LoginForm } from "./components/LogiForm";
import { MyUploads } from "./components/MyUploads";
import { RegisterForm } from "./components/RegiForm";
import { UploadForm } from "./components/UploadForm";

export const routes = {
  "/": {
    linkLabel: "Home",
    content: Home
  },
  "/upload": {
    linkLabel: "Upload",
    content: UploadForm
  },  
  "/my-uploads": {
    linkLabel: "My Uploads",
    content: MyUploads
  },
  "/register": {
    linkLabel: "Register",
    content: RegisterForm
  },
    "/login": {
    linkLabel: "Login",
    content: LoginForm
  }

};