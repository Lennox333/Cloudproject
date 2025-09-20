import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

import {
  CognitoIdentityProviderClient,
  AdminListGroupsForUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, DYNAMO_TABLE } from "./secretManager.js";


const cognito = new CognitoIdentityProviderClient({ region: AWS_REGION });

// Setup DynamoDB client
const dynamo = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function registerUser(username, password) {
  if (!username || !password) {
    return { error: "Username and password required" };
  }

  try {
    // Check if username already exists
    const getUserCmd = new GetItemCommand({
      TableName: DYNAMO_TABLE,
      Key: {
        username: { S: username }, // username is primary key
      },
    });

    const existingUser = await dynamo.send(getUserCmd);
    if (existingUser.Item) {
      return { error: "Username already exists" };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate UUID for user id
    const userId = randomUUID();

    // Insert user
    const putUserCmd = new PutItemCommand({
      TableName: DYNAMO_TABLE,
      Item: {
        user_id: { S: userId },
        username: { S: username },
        password_hash: { S: passwordHash },
      },
    });

    await dynamo.send(putUserCmd);

    return { message: "User registered successfully", userId };
  } catch (err) {
    console.error("DynamoDB error:", err);
    return { error: "Database error" };
  }
}


// Middleware to check if user is Admin
async function isAdmin(req, res, next) {
  try {
    const username = req.user.username; // set by authenticateToken
    const command = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });
    const response = await cognito.send(command);
    const groups = response.Groups.map((g) => g.GroupName);

    if (groups.includes("Admin")) {
      next(); // user is admin
    } else {
      res.status(403).json({ error: "Admin access required" });
    }
  } catch (err) {
    console.error("Error checking admin group:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export { registerUser, isAdmin };
