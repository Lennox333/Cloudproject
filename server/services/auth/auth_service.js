import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authenticateToken } from "../../middleware/authentication.js";
import {
  loginUser,
  logoutUser,
  registerUser,
  confirmRegistration,
  confirmEmailMfa,
} from "../../utils/users.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:1234"], // frontend URL
    credentials: true, // allow cookies/auth headers
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//##### ENDPOINTS ####

//## USER

app.post("/auth/register", async (req, res) => {
  const { username, password, email } = req.body; // Fixed: Added email to the destructured object.
  const result = await registerUser(username, password, email);

  if (result.error) {
    return res.status(400).json(result);
  }

  res.status(200).json(result);
});

app.post("/auth/confirm-registration", async (req, res) => {
  const { username, confirmationCode } = req.body;

  if (!username || !confirmationCode) {
    return res
      .status(400)
      .json({ error: "Username and confirmation code are required." });
  }

  try {
    const result = await confirmRegistration(username, confirmationCode);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res
      .status(200)
      .json({ message: result.message, response: result.response });
  } catch (err) {
    console.error("Endpoint error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/auth/confirm-login", async (req, res) => {
  const { username, code, session } = req.body;

  console.log(session);
  if (!username || !code || !session) {
    return res
      .status(400)
      .json({ error: "Username, code, and session are required" });
  }

  try {
    const response = await confirmEmailMfa(username, code, session);
    console.log(response);

    res.cookie("token", response.AuthenticationResult.AccessToken, {
      httpOnly: true,
      secure: false,
      maxAge: 3 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Email MFA confirmed",
      idToken: response.AuthenticationResult.IdToken,
      accessToken: response.AuthenticationResult.AccessToken,
      refreshToken: response.AuthenticationResult.RefreshToken,
    });
  } catch (err) {
    console.error("Email MFA confirm error:", err);
    res.status(400).json({ error: "Invalid email code or session expired" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const result = await loginUser(username, password);

    res.cookie("token", result.accessToken, {
      httpOnly: true,
      secure: false, // set true if using HTTPS
      maxAge: 3 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      idToken: result.idToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    console.error("Cognito login error:", err);
    res.status(400).json({ error: "Invalid username or password" });
  }
});


app.post("/auth/logout", async (req, res) => {
  try {
    const token = req.cookies?.token;
    1;
    if (!token)
      return res.status(400).json({ error: "Token required for logout" });

    const result = await logoutUser(token);
    if (result.error)
      return res.status(500).json({ error: "Failed to log out" });

    // Clear cookie
    res.clearCookie("token", { httpOnly: true, secure: false });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Failed to log out" });
  }
});

app.get("/auth/profile", authenticateToken, async (req, res) => {
  res.status(200).json({
    userId: req.user.userId,
    username: req.user.username,
  });
});

// ALB sever health check
app.get("/auth/health", (req, res) => {
  res.status(200).send("OK");
});

//##### ENDPOINTS ####

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
