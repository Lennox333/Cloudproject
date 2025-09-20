import { 
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  ScanCommand
} from "@aws-sdk/client-dynamodb";
import { DYNAMO_USER_VIDEOS_TABLE } from "./secretManager.js";
import { dynamo } from "./dynamoSetup.js";
import { deleteVideoFiles } from "./s3.js";




async function saveUserVideo({
  userId,
  videoId,
  title,
  description = null,
  status = "processing",
  thumbnailKey = null,
}) {
  try {
    const putCmd = new PutItemCommand({
      TableName: DYNAMO_USER_VIDEOS_TABLE,
      Item: {
        video_id: { S: videoId },
        user_id: { S: userId },
        video_title: { S: title },
        description: description ? { S: description } : { NULL: true },
        status: { S: status },
        thumbnail_key: thumbnailKey ? { S: thumbnailKey } : { NULL: true },
        created_at: { S: new Date().toISOString() },
      },
    });

    await dynamo.send(putCmd);
    return { message: "Video metadata saved", videoId };
  } catch (err) {
    console.error("DynamoDB error:", err);
    return { error: "Failed to save video metadata" };
  }
}


async function getVideoById(videoId) {
  try {
    const result = await dynamo.send(
      new GetItemCommand({
        TableName: DYNAMO_USER_VIDEOS_TABLE,
        Key: { video_id: { S: videoId } },
      })
    );

    if (!result.Item) return { error: "Video not found" };

    return {
      videoId: result.Item.video_id.S,
      userId: result.Item.user_id.S,
      title: result.Item.video_title.S,
      description: result.Item.description?.S || null,
      status: result.Item.status.S,
      thumbnailKey: result.Item.thumbnail_key?.S || null,
      createdAt: result.Item.created_at.S,
    };
  } catch (err) {
    console.error("DynamoDB error:", err);
    return { error: "Database error" };
  }
}


async function addVideoThumbnail(videoId, thumbnailKey) {
  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: DYNAMO_USER_VIDEOS_TABLE,
        Key: { video_id: { S: videoId } },
        UpdateExpression: "SET thumbnail_key = :thumbnail",
        ExpressionAttributeValues: {
          ":thumbnail": { S: thumbnailKey },
        },
      })
    );

    return { message: "Thumbnail updated successfully" };
  } catch (err) {
    console.error("Error updating thumbnail:", err);
    return { error: "Failed to update thumbnail" };
  }
}


async function updateVideoStatus(videoId, status) {
  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: DYNAMO_USER_VIDEOS_TABLE,
        Key: { video_id: { S: videoId } },
        UpdateExpression: "SET #st = :status",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":status": { S: status } },
      })
    );
  } catch (err) {
    console.error(`Failed to update status for ${videoId}`, err);
  }
}


async function fetchVideos({ userId, upld_before, upld_after, page = 1, limit = 10 }) {
  const params = {
    TableName: DYNAMO_USER_VIDEOS_TABLE,
    Limit: limit,
    FilterExpression: "#st = :processed", // Only processed videos
    ExpressionAttributeNames: { "#st": "status" },
    ExpressionAttributeValues: { ":processed": { S: "processed" } },
  };

  // Add user filter if needed
  if (userId) {
    params.FilterExpression += " AND user_id = :uid";
    params.ExpressionAttributeValues[":uid"] = { S: userId };
  }

  // Add date filters if provided
  if (upld_before) {
    params.FilterExpression += " AND created_at <= :before";
    params.ExpressionAttributeValues[":before"] = { S: upld_before };
  }
  if (upld_after) {
    params.FilterExpression += " AND created_at >= :after";
    params.ExpressionAttributeValues[":after"] = { S: upld_after };
  }

  try {
    const result = await dynamo.send(new ScanCommand(params));
    const items = result.Items || [];

    const videos = items.map((item) => ({
      videoId: item.video_id.S,
      userId: item.user_id.S,
      title: item.video_title.S,
      description: item.description?.S || null,
      status: item.status.S,
      thumbnailKey: item.thumbnail_key?.S || null,
      createdAt: item.created_at.S,
    }));

    return { videos, total: videos.length, page, limit };
  } catch (err) {
    console.error("DynamoDB fetchVideos error:", err);
    return { error: "Failed to fetch videos" };
  }
}

async function deleteUserVideo(videoId) {
  try {
    const deleteCmd = new DeleteItemCommand({
      TableName: DYNAMO_USER_VIDEOS_TABLE,
      Key: {
        video_id: { S: videoId },
      },
    });

    await dynamo.send(deleteCmd);
    return { success: true, message: `Deleted ${videoId}` };
  } catch (err) {
    console.error("Delete video DB error", err);
    return { error: "Failed to delete video" };
  }
}


async function deleteVideo(video) {
  try {
    // Delete from DynamoDB
    const dbResult = await deleteUserVideo(video.videoId);
    if (dbResult.error) {
      return { success: false, error: "Failed to delete video from database" };
    }

    // Delete associated S3 files
    await deleteVideoFiles(video);

    console.log("Deleted video:", video.videoId);
    return { success: true };
  } catch (err) {
    console.error("Error deleting video:", err);
    return { success: false, error: "Database or file deletion error" };
  }
}

export { saveUserVideo, getVideoById, addVideoThumbnail, updateVideoStatus, deleteVideo, fetchVideos };
