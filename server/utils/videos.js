import {
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamoSetup.js";
import { deleteVideoFiles } from "./s3.js";
import { config } from "./secretManager.js"; // Use config object

// Save a new video for a user
async function saveUserVideo({
  userId,
  videoId,
  title,
  description = null,
  status = "processing",
}) {
  try {
    const params = {
      TableName: config.DYNAMO_TABLE,
      Item: {
        user_id: userId,
        video_id: videoId,
        video_title: title,
        description,
        status,
        created_at: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(#vid)",
      ExpressionAttributeNames: { "#vid": "video_id" },
    };

    await docClient.send(new PutCommand(params));
    return { message: "Video metadata saved", videoId };
  } catch (err) {
    console.error("DynamoDB saveUserVideo error:", err);
    return { error: "Failed to save video metadata" };
  }
}


// Get a video by its videoId (using GSI)
async function getVideoById(videoId) {
  try {
    const params = {
      TableName: config.DYNAMO_TABLE,
      IndexName: "VideoIdIndex",
      KeyConditionExpression: "#vid = :vid",
      ExpressionAttributeNames: { "#vid": "video_id" },
      ExpressionAttributeValues: { ":vid": videoId },
      Limit: 1,
    };

    const result = await docClient.send(new QueryCommand(params));
    const video = result.Items?.[0];

    if (!video) return { error: "Video not found" };

    return {
      videoId: video.video_id,
      userId: video.user_id,
      title: video.video_title,
      description: video.description || null,
      status: video.status,
      thumbnailKey: video.thumbnail_key || null,
      createdAt: video.created_at,
    };
  } catch (err) {
    console.error("DynamoDB getVideoById error:", err);
    return { error: "Database error" };
  }
}

// Add or update video thumbnail
async function addVideoThumbnail(videoId, thumbnailKey) {
  try {
    const video = await getVideoById(videoId);
    if (!video || !video.userId) return { error: "Video not found" };

    const params = {
      TableName: config.DYNAMO_TABLE,
      Key: { user_id: video.userId, video_id: video.videoId },
      UpdateExpression: "SET thumbnail_key = :thumbnail",
      ExpressionAttributeValues: { ":thumbnail": thumbnailKey },
    };

    await docClient.send(new UpdateCommand(params));
    return { message: "Thumbnail updated successfully" };
  } catch (err) {
    console.error("DynamoDB addVideoThumbnail error:", err);
    return { error: "Failed to update thumbnail" };
  }
}

// Update video status
async function updateVideoStatus(videoId, status) {
  try {
    const video = await getVideoById(videoId);
    if (!video || !video.userId) return { error: "Video not found" };

    const params = {
      TableName: config.DYNAMO_TABLE,
      Key: { user_id: video.userId, video_id: video.videoId },
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

// Fetch videos for a user with optional date filters and pagination
async function fetchVideos({
  userId,
  upld_before,
  upld_after,
  limit = 10,
  lastKey = null,
}) {
  if (!userId) return { error: "User ID is required for query" };

  try {
    const params = {
      TableName: config.DYNAMO_TABLE,
      KeyConditionExpression: "#uid = :uid",
      ExpressionAttributeNames: { "#uid": "user_id" },
      ExpressionAttributeValues: { ":uid": userId },
      Limit: limit,
      ExclusiveStartKey: lastKey || undefined,
    };

    const filterExpressions = [];
    if (upld_before) {
      filterExpressions.push("created_at <= :before");
      params.ExpressionAttributeValues[":before"] = upld_before;
    }
    if (upld_after) {
      filterExpressions.push("created_at >= :after");
      params.ExpressionAttributeValues[":after"] = upld_after;
    }
    if (filterExpressions.length) {
      params.FilterExpression = filterExpressions.join(" AND ");
    }

    const result = await docClient.send(new QueryCommand(params));
    const videos = (result.Items || []).map((item) => ({
      videoId: item.video_id,
      userId: item.user_id,
      title: item.video_title,
      description: item.description || null,
      status: item.status,
      thumbnailKey: item.thumbnail_key || null,
      createdAt: item.created_at,
    }));

    return {
      videos,
      total: videos.length,
      lastKey: result.LastEvaluatedKey || null,
      limit,
    };
  } catch (err) {
    console.error("DynamoDB fetchVideos error:", err);
    return { error: "Failed to fetch videos" };
  }
}

// Delete a video from DynamoDB
async function deleteUserVideo(videoId) {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: config.DYNAMO_TABLE,
        Key: { video_id: videoId },
      })
    );
    return { success: true, message: `Deleted ${videoId}` };
  } catch (err) {
    console.error("DynamoDB deleteUserVideo error:", err);
    return { error: "Failed to delete video" };
  }
}

// Delete video from Dynamo and associated S3 files
async function deleteVideo(videoId) {
  try {
    const dbResult = await deleteUserVideo(videoId);
    if (dbResult.error)
      return { success: false, error: "Failed to delete video from database" };

    await deleteVideoFiles(videoId);

    console.log("Deleted video:", videoId);
    return { success: true };
  } catch (err) {
    console.error("DynamoDB deleteVideo error:", err);
    return { success: false, error: "Database or file deletion error" };
  }
}

export {
  saveUserVideo,
  getVideoById,
  addVideoThumbnail,
  updateVideoStatus,
  deleteVideo,
  fetchVideos,
};