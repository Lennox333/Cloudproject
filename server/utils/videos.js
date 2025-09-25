import {
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

import { docClient } from "./dynamoSetup.js";
import { deleteVideoFiles } from "./s3.js";
import { getConfig } from "./envManager.js"; // Use config object

const { DYNAMO_TABLE } = await getConfig();
// Save a new video for a user
export async function fetchVideos({
  userId = null,
  upld_before,
  upld_after,
  limit = 10,
  lastKey = null,
}) {
  limit = Number(limit) || 10; // ensure number
  const params = {
    TableName: DYNAMO_TABLE,
    Limit: limit,
    ExclusiveStartKey: lastKey || undefined,
  };

  const filterExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  if (userId) {
    // Query by user_id
    params.KeyConditionExpression = "#uid = :uid";
    expressionAttributeNames["#uid"] = "user_id";
    expressionAttributeValues[":uid"] = userId;
  }

  if (upld_before) {
    filterExpressions.push("created_at <= :before");
    expressionAttributeValues[":before"] = upld_before;
  }
  if (upld_after) {
    filterExpressions.push("created_at >= :after");
    expressionAttributeValues[":after"] = upld_after;
  }

  if (filterExpressions.length) {
    params.FilterExpression = filterExpressions.join(" AND ");
  }
  if (Object.keys(expressionAttributeNames).length) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }
  if (Object.keys(expressionAttributeValues).length) {
    params.ExpressionAttributeValues = expressionAttributeValues;
  }

  try {
    let result;
    if (userId) {
      result = await docClient.send(new QueryCommand(params));
    } else {
      result = await docClient.send(new ScanCommand(params));
    }

    const videos = (result.Items || []).map((item) => ({
      videoId: item.video_id,
      userId: item.user_id,
      title: item.video_title,
      description: item.description || null,
      status: item.status,
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

// Get a video by its videoId (using GSI)
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
    const video = result.Items?.[0];

    if (!video) return { error: "Video not found" };

    return {
      videoId: video.video_id,
      userId: video.user_id,
      title: video.video_title,
      description: video.description || null,
      status: video.status,
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
      TableName: DYNAMO_TABLE,
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
      TableName: DYNAMO_TABLE,
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
  userId = null,
  upld_before,
  upld_after,
  limit = 10,
  lastKey = null,
}) {
  limit = Number(limit) || 10; // ensure it's a number
  try {
    const params = {
      TableName: DYNAMO_TABLE,
      Limit: Number(limit) || 10,
      ExclusiveStartKey: lastKey || undefined,
    };

    if (userId) {
      params.KeyConditionExpression = "#uid = :uid";
      params.ExpressionAttributeNames = { "#uid": "user_id" };
      params.ExpressionAttributeValues = { ":uid": userId };
    }

    // Filters
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

    // Execute
    const result = await docClient.send(command);

    const videos = (result.Items || []).map((item) => ({
      videoId: item.video_id,
      userId: item.user_id,
      title: item.video_title,
      description: item.description || null,
      status: item.status,
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
        TableName: DYNAMO_TABLE,
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
