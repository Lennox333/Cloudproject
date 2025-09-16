import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = "ap-southeast-2";
const BUCKET = process.env.S3_BUCKET_NAME;

const s3 = new S3Client({ region: REGION });



// Generate pre-signed URL
async function getPresignedUrl(key, expiresIn = 3600, operation = "getObject") {
  let command;
  if (operation === "getObject") {
    command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  } else if (operation === "putObject") {
    command = new PutObjectCommand({ Bucket: BUCKET, Key: key });
  } else throw new Error("Invalid operation");

  return getSignedUrl(s3, command, { expiresIn });
}

// Upload buffer to S3 (used for thumbnails/transcoded files)
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

async function downloadFromS3(s3Key, localPath) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  });
  const response = await s3.send(command);
  const stream = response.Body;
  const writeStream = fs.createWriteStream(localPath);
  return new Promise((resolve, reject) => {
    stream.pipe(writeStream).on("finish", resolve).on("error", reject);
  });
}

export { getPresignedUrl, uploadToS3, downloadFromS3 };
