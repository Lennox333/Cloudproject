import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";


const DYNAMO_TABLE = process.env.DYNAMO_TABLE

// Setup DynamoDB client
const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
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

export { registerUser };
