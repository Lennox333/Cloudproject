import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware for verifying tokens
function authenticateToken(req, res, next) {
  const token = req.cookies?.token; // read from cookie
  if (!token) return res.status(401).json({ error: "Token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// Helper function for creating tokens
function generateToken(payload, expiresIn = "1h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export { authenticateToken, generateToken };
