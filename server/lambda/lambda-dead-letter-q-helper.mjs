import { DynamoDBClient } from "@aws-sdk/client-dynamodb"; 
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const AWS_REGION = "ap-southeast-2";
const DYNAMO_TABLE = process.env.DYNAMO_TABLE;

// DynamoDB clients
const dynamo = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamo);

// Update video status
async function updateVideoStatus(videoId, status) {
  try {
    const video = await getVideoById(videoId);
    if (!video || !video.user_id) return { error: "Video not found" };

    const params = {
      TableName: DYNAMO_TABLE,
      Key: { user_id: video.user_id, video_id: video.video_id },
      UpdateExpression: "SET #st = :status",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":status": status },
    };

    await docClient.send(new UpdateCommand(params));
    return { message: "Status updated successfully" };
  } catch (err) {
    console.error(`DynamoDB updateVideoStatus error for ${videoId}:`, err);
    return { error: "Failed to update status" };
  }
}

// Get video by ID using GSI
async function getVideoById(videoId) {
  try {
    const params = {
      TableName: DYNAMO_TABLE,
      IndexName: "VideoIdIndex",
      KeyConditionExpression: "#vid = :vid",
      ExpressionAttributeNames: { "#vid": "video_id" },
      ExpressionAttributeValues: { ":vid": videoId },
      Limit: 1,
    };

    const result = await docClient.send(new QueryCommand(params));
    return result.Items?.[0];
  } catch (err) {
    console.error("DynamoDB getVideoById error:", err);
    return { error: "Database error" };
  }
}

export { updateVideoStatus };
