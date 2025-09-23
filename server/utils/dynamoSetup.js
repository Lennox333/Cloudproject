import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import * as DynamoDBLib from "@aws-sdk/lib-dynamodb";
import { AWS_REGION, DYNAMO_TABLE, USER_KEY, VIDEO_KEY,  } from "./secretManager.js";


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
          { AttributeName: USER_KEY, AttributeType: "S" },
          { AttributeName: VIDEO_KEY, AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: USER_KEY, KeyType: "HASH" },
          { AttributeName: VIDEO_KEY, KeyType: "RANGE" },
        ],
        BillingMode: "PAY_PER_REQUEST",
        GlobalSecondaryIndexes: [
          {
            IndexName: "VideoIdIndex",
            KeySchema: [{ AttributeName: VIDEO_KEY, KeyType: "HASH" }],
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
