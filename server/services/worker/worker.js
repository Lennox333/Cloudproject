import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from "@aws-sdk/client-sqs";
import { spawn } from "child_process";
import { PassThrough } from "stream";
import { getPresignedUrl, uploadToS3Multipart } from "../../utils/s3.js";
import { updateVideoStatus } from "../../utils/videos.js";
import { ensureVideoJobTable, markResolutionDone } from "./dynamo.js";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const QUEUE_URL = process.env.SQS_QUEUE_URL;
const POLLING_INTERVAL = 5000;
const MAX_CONCURRENT_JOBS = 1;
const EXTEND_TIME = 300;
const EXTEND_INTERVAL = 240 * 1000;

let activeJobs = 0;
let isShuttingDown = false;

async function extendVisibility(receiptHandle, extraSeconds) {
  try {
    await sqsClient.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: extraSeconds,
      })
    );
    console.log(
      "[Worker] Extend visibility"
    );
  } catch (err) {
    if (err.Code === "InvalidParameterValue") {
      console.warn(
        "[Worker] Cannot extend visibility, message may be deleted or expired."
      );
    } else {
      throw err;
    }
  }
}
// Video transcoding
async function transcodeVideo(s3Url, outputKey, scale) {
  return new Promise((resolve, reject) => {
    const pass = new PassThrough();
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-i",
        s3Url,
        "-vf",
        `scale=${scale}`,
        "-c:v",
        "libx264",
        "-crf",
        "23",
        "-r",
        "30",
        "-preset",
        "medium",
        "-c:a",
        "aac",
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    ffmpeg.stdout.pipe(pass);

    ffmpeg.stderr.on("data", (data) => {
      console.error(`[FFmpeg] ${data.toString()}`);
    });

    ffmpeg.on("error", (err) => {
      console.error(`[FFmpeg] Spawn error: ${err}`);
      reject(err);
    });

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
        return;
      }
      try {
        console.log(`[Transcode] Uploading to S3: ${outputKey}`);
        await uploadToS3Multipart(pass, outputKey, "video/mp4");
        console.log(`[Transcode] Upload successful: ${outputKey}`);
        resolve(outputKey);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Thumbnail generation
async function generateThumbnail(s3Url, outputKey) {
  return new Promise((resolve, reject) => {
    const pass = new PassThrough();
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-i",
        s3Url,
        "-ss",
        "00:00:01",
        "-vframes",
        "1",
        "-f",
        "image2",
        // "-update",
        // "1",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    ffmpeg.stdout.pipe(pass);

    ffmpeg.stderr.on("data", (data) =>
      console.error(`[FFmpeg Thumbnail] ${data.toString()}`)
    );
    ffmpeg.on("error", (err) => reject(err));

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
        return;
      }
      try {
        console.log(`[Thumbnail] Uploading to S3: ${outputKey}`);
        await uploadToS3Multipart(pass, outputKey, "image/jpeg");
        console.log(`[Thumbnail] Upload successful: ${outputKey}`);
        resolve(outputKey);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function processJob(job, receiptHandle) {
  activeJobs++;
  const interval = setInterval(
    () => extendVisibility(receiptHandle, EXTEND_TIME),
    EXTEND_INTERVAL
  );

  try {
    const s3Url = await getPresignedUrl(job.s3Key, 3600, "getObject");

    if (job.jobType === "transcode")
      await transcodeVideo(s3Url, job.outputKey, job.scale);
    else if (job.jobType === "thumbnail")
      await generateThumbnail(s3Url, job.outputKey);

    const allJobsComplete = await markResolutionDone(
      job.videoId,
      job.jobType === "thumbnail" ? "thumbnail" : job.resolution
    );

    if (allJobsComplete) {
      await updateVideoStatus(job.videoId, "processed");
      console.log(`[Worker] Video ${job.videoId} marked as processed`);
    }
  } catch (error) {
    console.error(`[Worker] Job failed:`, error);
    await updateVideoStatus(job.videoId, "failed");
  } finally {
    clearInterval(interval);
    activeJobs--;
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: receiptHandle,
      })
    );
    console.log(`[Worker] Job completed and removed from queue`);
  }
}

async function pollQueue() {
  if (isShuttingDown) return;

  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    setTimeout(pollQueue, POLLING_INTERVAL);
    return;
  }

  try {
    const data = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: MAX_CONCURRENT_JOBS,
        WaitTimeSeconds: 20,
        MessageAttributeNames: ["All"],
      })
    );

    if (data.Messages?.length) {
      await Promise.allSettled(
        data.Messages.map((msg) =>
          processJob(JSON.parse(msg.Body), msg.ReceiptHandle)
        )
      );
    }
  } catch (err) {
    console.error("[Worker] Error polling queue:", err);
  }

  setTimeout(pollQueue, POLLING_INTERVAL);
}

function setupGracefulShutdown() {
  process.on("SIGTERM", () => {
    /* same as before */
  });
  process.on("SIGINT", () => {
    process.exit(0);
  });
}

async function startWorker() {
  setupGracefulShutdown();
  await ensureVideoJobTable();
  pollQueue();
}

startWorker();
