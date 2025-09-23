import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { AWS_REGION, USER_POOL_ID } from "../utils/secretManager.js";

const client = jwksClient({
  jwksUri: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
});

// Get key from Cognito
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

function authenticateToken(req, res, next) {
  const token =
    req.cookies?.token || req.headers["authorization"]?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Token required" });

  jwt.verify(
    token,
    getKey,
    {
      algorithms: ["RS256"],
      issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`,
    },
    (err, decoded) => {
      if (err) return res.status(403).json({ error: "Invalid token" });
      req.user = {
        userId: decoded.sub, // '49ae94e8-e011-70c9-a924-f6eadfd2ff5f'
        username: decoded.username, // optional
      };

      console.log(req.user) // to be removed
      next();
    }
  );
}

export { authenticateToken };
