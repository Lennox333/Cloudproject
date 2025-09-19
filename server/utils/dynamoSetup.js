import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { dynamo } from "./dynamoSetup.js";
export const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
