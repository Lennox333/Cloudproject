import {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const VIDEO_JOB_TABLE = "n11772891-videojob";
const TTL_SECONDS = 3 * 24 * 60 * 60; // 3 days

export async function ensureVideoJobTable() {
  try {
    await dbClient.send(new DescribeTableCommand({ TableName: VIDEO_JOB_TABLE }));
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      console.log(`[DynamoDB] Creating table ${VIDEO_JOB_TABLE}...`);
      await dbClient.send(
        new CreateTableCommand({
          TableName: VIDEO_JOB_TABLE,
          AttributeDefinitions: [{ AttributeName: "videoId", AttributeType: "S" }],
          KeySchema: [{ AttributeName: "videoId", KeyType: "HASH" }],
          BillingMode: "PAY_PER_REQUEST",
        })
      );
      console.log(`[DynamoDB] Created table ${VIDEO_JOB_TABLE}`);

      // Enable TTL
      await dbClient.send(
        new UpdateTimeToLiveCommand({
          TableName: VIDEO_JOB_TABLE,
          TimeToLiveSpecification: {
            AttributeName: "expiresAt",
            Enabled: true,
          },
        })
      );
      console.log(`[DynamoDB] TTL enabled on ${VIDEO_JOB_TABLE} for 'expiresAt'`);
    } else {
      throw err;
    }
  }
}

export async function markResolutionDone(videoId, jobType) {
  const resolution = jobType === "thumbnail" ? "thumbnail" : jobType;

  const record = await dbClient.send(
    new GetItemCommand({
      TableName: VIDEO_JOB_TABLE,
      Key: { videoId: { S: videoId } },
    })
  );

  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  if (!record.Item) {
    const newItem = {
      videoId: { S: videoId },
      thumbnail: { BOOL: resolution === "thumbnail" },
      "360p": { BOOL: resolution === "360p" },
      "480p": { BOOL: resolution === "480p" },
      "720p": { BOOL: resolution === "720p" },
      expiresAt: { N: `${ttl}` },
    };
    await dbClient.send(
      new PutItemCommand({ TableName: VIDEO_JOB_TABLE, Item: newItem })
    );
    console.log(`[DynamoDB] Created record for ${videoId} (${resolution} done)`);
  } else {
    await dbClient.send(
      new UpdateItemCommand({
        TableName: VIDEO_JOB_TABLE,
        Key: { videoId: { S: videoId } },
        UpdateExpression: `SET #r = :true, expiresAt = :ttl`,
        ExpressionAttributeNames: { "#r": resolution },
        ExpressionAttributeValues: { ":true": { BOOL: true }, ":ttl": { N: `${ttl}` } },
      })
    );
    console.log(`[DynamoDB] Updated ${videoId}: ${resolution}=true`);
  }

  const updated = await dbClient.send(
    new GetItemCommand({ TableName: VIDEO_JOB_TABLE, Key: { videoId: { S: videoId } } })
  );

  const item = updated.Item;
  const allDone =
    item["thumbnail"]?.BOOL &&
    item["360p"]?.BOOL &&
    item["480p"]?.BOOL &&
    item["720p"]?.BOOL;

  return allDone;
}
