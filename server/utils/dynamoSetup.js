// dynamoSetup.js
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import * as DynamoDBLib from "@aws-sdk/lib-dynamodb";
import { config } from "./secretManager.js"; // Import the config object

// DynamoDB clients
const dynamo = new DynamoDBClient({ region: config.AWS_REGION });
export const docClient =
  DynamoDBLib.DynamoDBDocumentClient.from(dynamo);

// Ensure table exists
export async function ensureUserVideosTable() {
  try {
    await dynamo.send(new DescribeTableCommand({ TableName: config.DYNAMO_TABLE }));
    console.log(`Table ${config.DYNAMO_TABLE} already exists`);
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      console.log(`Creating table ${config.DYNAMO_TABLE}...`);

      const createCmd = new CreateTableCommand({
        TableName: config.DYNAMO_TABLE,
        AttributeDefinitions: [
          { AttributeName: "user_id", AttributeType: "S" },
          { AttributeName: "video_id", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "user_id", KeyType: "HASH" },
          { AttributeName: "video_id", KeyType: "RANGE" },
        ],
        BillingMode: "PAY_PER_REQUEST",
        GlobalSecondaryIndexes: [
          {
            IndexName: "VideoIdIndex",
            KeySchema: [{ AttributeName: "video_id", KeyType: "HASH" }],
            Projection: { ProjectionType: "ALL" },
          },
        ],
      });

      const response = await dynamo.send(createCmd);
      console.log(`Table ${config.DYNAMO_TABLE} created`, response);
    } else {
      console.error("Error checking/creating table:", err);
    }
  }
}