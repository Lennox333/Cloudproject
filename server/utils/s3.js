import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  PutBucketTaggingCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getConfig } from "./secretManager.js"; // Use config object
import { Upload } from "@aws-sdk/lib-storage";

const { S3_BUCKET, AWS_REGION, QUT_USERNAME, PURPOSE } = await getConfig();
// const s3 = new S3Client({
//   region: AWS_REGION,
//   credentials: fromCognitoIdentityPool({
//     client: new CognitoIdentityClient({ region: AWS_REGION }),
//     identityPoolId: process.env.COGNITO_IDENTITY_POOL_ID,
//   }),
// });

export const s3 = new S3Client({
  region: AWS_REGION,
});

// Create / Tag Bucket
async function createIfNotExist() {
  const tagCommand = new PutBucketTaggingCommand({
    Bucket: S3_BUCKET,
    Tagging: {
      TagSet: [
        { Key: "qut-username", Value: QUT_USERNAME },
        { Key: "purpose", Value: PURPOSE },
      ],
    },
  });

  try {
    // Check bucket exists
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`Bucket "${S3_BUCKET}" exists.`);

    // Apply tags
    const response = await s3.send(tagCommand);
    console.log("Bucket tagged:", response);
    return { success: true };
  } catch (err) {
    if (err.name === "NotFound") {
      console.error(`Bucket "${S3_BUCKET}" does not exist.`);
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
    command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  } else if (operation === "putObject") {
    command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key });
  } else {
    throw new Error("Invalid operation");
  }

  return getSignedUrl(s3, command, { expiresIn });
}

// Upload buffer to S3
async function uploadToS3(buffer, key, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

async function uploadToS3Multipart(body, key, contentType) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
    queueSize: 4, // concurrency
    partSize: 5 * 1024 * 1024, // 5MB per part
  });

  return upload.done();
}

// Delete video files (all resolutions + thumbnail)
async function deleteVideoFiles(videoId) {
  try {
    const keysToDelete = [
      `videos/${videoId}_360p.mp4`,
      `videos/${videoId}_480p.mp4`,
      `videos/${videoId}_720p.mp4`,
      `thumbnails/${videoId}.jpg/`,
    ];

    for (const key of keysToDelete) {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      console.log("Deleted S3 object:", key);
    }

    return { success: true };
  } catch (err) {
    console.error("Error deleting S3 files:", err);
    return { error: "Failed to delete S3 files" };
  }
}

export {
  getPresignedUrl,
  uploadToS3,
  uploadToS3Multipart,
  createIfNotExist,
  deleteVideoFiles,
};
