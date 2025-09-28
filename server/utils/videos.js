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
async function saveUserVideo({
  userId,
  videoId,
  title,
  description = null,
  status = "processing",
}) {
  try {
    const params = {
      TableName: DYNAMO_TABLE,
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
  limit = Number(limit) || 10;
  try {
    const params = {
      TableName: DYNAMO_TABLE,
      Limit: limit,
      ExclusiveStartKey: lastKey || undefined,
    };

    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (userId) {
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

    // Use Query if userId exists, else Scan for public fetch
    const command = userId
      ? new QueryCommand(params)
      : new ScanCommand(params);

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
    // First, query the GSI to find which user owns this video
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: DYNAMO_TABLE,
        IndexName: "VideoIdIndex",
        KeyConditionExpression: "video_id = :videoId",
        ExpressionAttributeValues: {
          ":videoId": videoId
        }
      })
    );
    
    if (queryResult.Items.length === 0) {
      return { error: "Video not found" };
    }
    
    // Get the user_id from the query result
    const userId = queryResult.Items[0].user_id;
    
    // Now delete with both keys
    await docClient.send(
      new DeleteCommand({
        TableName: DYNAMO_TABLE,
        Key: { 
          user_id: userId,
          video_id: videoId
        },
      })
    );
    
    return { success: true, message: `Deleted video ${videoId}` };
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
