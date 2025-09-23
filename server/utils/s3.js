// utils/s3.js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  PutBucketTaggingCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  AWS_REGION,
  BUCKET,
  PURPOSE,
  QUT_USERNAME,
} from "./secretManager.js";

export const s3 = new S3Client({ region: AWS_REGION });

// Create / Tag Bucket
async function createIfNotExist() {
  const tagCommand = new PutBucketTaggingCommand({
    Bucket: BUCKET,
    Tagging: {
      TagSet: [
        { Key: "qut-username", Value: QUT_USERNAME },
        { Key: "purpose", Value: PURPOSE },
      ],
    },
  });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" exists.`);
    const response = await s3.send(tagCommand);
    console.log("Bucket tagged:", response);
    return { success: true };
  } catch (err) {
    if (err.name === "NotFound") {
      console.error(`Bucket "${BUCKET}" does not exist.`);
      return { error: "Bucket not found" };
    } else {
      console.error("Error checking bucket:", err);
      return { error: err.message };
    }
  }
}

// Generate pre-signed URL
async function getPresignedUrl(key, expiresIn = 3600, operation = "getObject") {
  let command;
  if (operation === "getObject") {
    command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  } else if (operation === "putObject") {
    command = new PutObjectCommand({ Bucket: BUCKET, Key: key });
  } else {
    throw new Error("Invalid operation");
  }

  return getSignedUrl(s3, command, { expiresIn });
}

// Upload buffer to S3
async function uploadToS3(buffer, key, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

// Delete video files (all resolutions + thumbnail)
async function deleteVideoFiles(video) {
  try {
    const keysToDelete = [
      `videos/${video.videoId}_360p.mp4`,
      `videos/${video.videoId}_480p.mp4`,
      `videos/${video.videoId}_720p.mp4`,
    ];
    if (video.thumbnailKey) keysToDelete.push(video.thumbnailKey);

    for (const key of keysToDelete) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      console.log("Deleted S3 object:", key);
    }

    return { success: true };
  } catch (err) {
    console.error("Error deleting S3 files:", err);
    return { error: "Failed to delete S3 files" };
  }
}

export { getPresignedUrl, uploadToS3, createIfNotExist, deleteVideoFiles };
