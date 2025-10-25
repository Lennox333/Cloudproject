import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { spawn } from "child_process";
import { PassThrough } from "stream";
import { getPresignedUrl, uploadToS3Multipart } from "./utils/s3.js";
import { updateVideoStatus } from "./utils/videos.js";


const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const QUEUE_URL = process.env.SQS_QUEUE_URL;
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_CONCURRENT_JOBS = 1; // Limit concurrent transcoding jobs

let activeJobs = 0;
let isShuttingDown = false;
const videoJobTracker = new Map(); // Track jobs per video

/**
 * Transcode video to specific resolution
 */
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

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    console.log(`[Transcode] Uploading to S3: ${outputKey}`);
    uploadToS3Multipart(pass, outputKey, "video/mp4")
      .then(() => {
        console.log(`[Transcode] Upload successful: ${outputKey}`);
        resolve(outputKey);
      })
      .catch(reject);
  });
}

/**
 * Generate thumbnail from video
 */
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
        "-update",
        "1",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    ffmpeg.stdout.pipe(pass);

    ffmpeg.stderr.on("data", (data) => {
      console.error(`[FFmpeg Thumbnail] ${data.toString()}`);
    });

    ffmpeg.on("error", (err) => {
      console.error(`[FFmpeg] Spawn error: ${err}`);
      reject(err);
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    console.log(`[Thumbnail] Uploading to S3: ${outputKey}`);
    uploadToS3Multipart(pass, outputKey, "image/jpeg")
      .then(() => {
        console.log(`[Thumbnail] Upload successful: ${outputKey}`);
        resolve(outputKey);
      })
      .catch(reject);
  });
}

/**
 * Track job completion for a video
 */
function trackJobCompletion(videoId, jobType) {
  if (!videoJobTracker.has(videoId)) {
    videoJobTracker.set(videoId, {
      thumbnail: false,
      "360p": false,
      "480p": false,
      "720p": false,
    });
  }

  const tracker = videoJobTracker.get(videoId);
  
  if (jobType === "thumbnail") {
    tracker.thumbnail = true;
  } else {
    tracker[jobType] = true;
  }

  // Check if all jobs are complete
  const allComplete = Object.values(tracker).every((status) => status === true);
  
  if (allComplete) {
    console.log(`[Worker] All jobs complete for video ${videoId}`);
    videoJobTracker.delete(videoId);
    return true;
  }
  
  return false;
}

/**
 * Process a single job from SQS
 */
async function processJob(job, receiptHandle) {
  activeJobs++;
  console.log(`[Worker] Processing job: ${job.jobType} for ${job.videoId} (${job.resolution || 'N/A'})`);

  try {
    // Get presigned URL for input video
    const s3Url = await getPresignedUrl(job.s3Key, 3600, "getObject");

    if (job.jobType === "transcode") {
      await transcodeVideo(s3Url, job.outputKey, job.scale);
      console.log(
        `[Worker] Transcode complete: ${job.videoId} at ${job.resolution}`
      );
    } else if (job.jobType === "thumbnail") {
      await generateThumbnail(s3Url, job.outputKey);
      console.log(`[Worker] Thumbnail complete: ${job.videoId}`);
    }

    // Track completion
    const allJobsComplete = trackJobCompletion(
      job.videoId, 
      job.jobType === "thumbnail" ? "thumbnail" : job.resolution
    );

    // Update video status if all jobs are complete
    if (allJobsComplete) {
      await updateVideoStatus(job.videoId, "processed");
      console.log(`[Worker] Video ${job.videoId} marked as processed`);
    }

    // Delete message from queue after successful processing
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: receiptHandle,
      })
    );

    console.log(`[Worker] Job completed and removed from queue`);
    return { success: true };
  } catch (error) {
    console.error(`[Worker] Job failed:`, error);
    // Message will return to queue after visibility timeout
    await updateVideoStatus(job.videoId, "failed");
    return { success: false, error: error.message };
  } finally {
    activeJobs--;
  }
}

/**
 * Poll SQS for messages
 */
async function pollQueue() {
  if (isShuttingDown) {
    console.log("[Worker] Shutting down, no longer polling");
    return;
  }

  // Don't poll if at max capacity
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    console.log(
      `[Worker] At capacity (${activeJobs}/${MAX_CONCURRENT_JOBS}), waiting...`
    );
    setTimeout(pollQueue, POLLING_INTERVAL);
    return;
  }

  try {
    const receiveParams = {
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: Math.min(10, MAX_CONCURRENT_JOBS - activeJobs),
      WaitTimeSeconds: 20, // Long polling
      MessageAttributeNames: ["All"],
    };

    const data = await sqsClient.send(
      new ReceiveMessageCommand(receiveParams)
    );

    if (data.Messages && data.Messages.length > 0) {
      console.log(`[Worker] Received ${data.Messages.length} message(s)`);

      // Process messages in parallel (up to MAX_CONCURRENT_JOBS)
      const processingPromises = data.Messages.map((message) => {
        const job = JSON.parse(message.Body);
        return processJob(job, message.ReceiptHandle);
      });

      await Promise.allSettled(processingPromises);
    } else {
      console.log("[Worker] No messages available");
    }
  } catch (error) {
    console.error("[Worker] Error polling queue:", error);
  }

  // Continue polling
  setTimeout(pollQueue, POLLING_INTERVAL);
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  process.on("SIGTERM", async () => {
    console.log("[Worker] SIGTERM received, shutting down gracefully...");
    isShuttingDown = true;

    const shutdownTimeout = setTimeout(() => {
      console.log("[Worker] Shutdown timeout, forcing exit");
      process.exit(1);
    }, 300000); // 5 minutes

    const checkInterval = setInterval(() => {
      console.log(`[Worker] Waiting for ${activeJobs} active jobs to complete`);
      if (activeJobs === 0) {
        clearInterval(checkInterval);
        clearTimeout(shutdownTimeout);
        console.log("[Worker] All jobs complete, shutting down");
        process.exit(0);
      }
    }, 5000);
  });

  process.on("SIGINT", () => {
    console.log("[Worker] SIGINT received, shutting down immediately");
    process.exit(0);
  });
}

/**
 * Start the worker
 */
function startWorker() {
  console.log("[Worker] Starting SQS worker...");
  console.log(`[Worker] Queue URL: ${QUEUE_URL}`);
  console.log(`[Worker] Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);

  setupGracefulShutdown();
  pollQueue();

  console.log("[Worker] Worker started successfully");
}

// Start the worker
startWorker();