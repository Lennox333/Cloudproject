import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import * as DynamoDBLib from "@aws-sdk/lib-dynamodb";
import { getConfig } from "./envManager.js"; 

const {AWS_REGION, DYNAMO_TABLE} = await getConfig()
// DynamoDB clients
const dynamo = new DynamoDBClient({ region: AWS_REGION });
export const docClient =
  DynamoDBLib.DynamoDBDocumentClient.from(dynamo);

// Ensure table exists
export async function ensureUserVideosTable() {
  try {
    await dynamo.send(new DescribeTableCommand({ TableName: DYNAMO_TABLE }));
    console.log(`Table ${DYNAMO_TABLE} already exists`);
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      console.log(`Creating table ${DYNAMO_TABLE}...`);

      const createCmd = new CreateTableCommand({
        TableName: DYNAMO_TABLE,
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
      console.log(`Table ${DYNAMO_TABLE} created`, response);
    } else {
      console.error("Error checking/creating table:", err);
    }
  }
}