import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
// import { ECSClient, ListTasksCommand } from "@aws-sdk/client-ecs";

const REGION = "ap-southeast-2";
// Initialize SQS client
// const CLUSTER_NAME = process.env.ECS_CLUSTER_NAME || "gr24-a3"; // set in Lambda env vars
// const ecsClient = new ECSClient({ region: REGION });
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || REGION,
});

const QUEUE_URL =
  "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11772891-video-queue";

// async function fargateTaskExists() {
//   try {
//     const command = new ListTasksCommand({
//       cluster: CLUSTER_NAME,
//       desiredStatus: "RUNNING",
//     });
//     const response = await ecsClient.send(command);
//     console.log(`Running Fargate tasks: ${response.taskArns.length}`);
//     return response.taskArns.length > 0;
//   } catch (err) {
//     console.error("Error checking Fargate tasks:", err);
//     // Fail-safe: assume running to prevent over-trigger
//     return true;
//   }
// }

export const handler = async (event) => {
  console.log("S3 Event:", JSON.stringify(event, null, 2));

  try {
    // const fargateRunning = await fargateTaskExists();

    // if (fargateRunning) {
    //   console.log(
    //     "[Lambda] Fargate task is already running — skipping job enqueue."
    //   );
    //   return {
    //     statusCode: 200,
    //     body: JSON.stringify({
    //       message: "Skipped: Fargate task already running.",
    //     }),
    //   };
    // }

    // Process each S3 record (there can be multiple)
    const results = [];

    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      console.log(`Processing: Bucket=${bucket}, Key=${key}`);

      // Only process files in videos/ folder (raw uploads)
      // Skip transcoded files (those with _360p, _480p, _720p suffixes)
      if (!key.startsWith("videos/")) {
        console.log(`Skipping - not in videos/ folder: ${key}`);
        continue;
      }

      if (key.match(/_\d{3,4}p\.mp4$/)) {
        console.log(`Skipping - already transcoded file: ${key}`);
        continue;
      }

      // Extract videoId from the key
      // Expected format: videos/{videoId} or videos/{videoId}.mp4
      const videoId = key.replace("videos/", "").replace(/\.\w+$/, "");
      console.log(`Extracted videoId: ${videoId}`);

      // Define the transcoding jobs
      const resolutions = [
        { name: "360p", scale: "640:360" },
        { name: "480p", scale: "854:480" },
        { name: "720p", scale: "1280:720" },
      ];

      // Send transcoding jobs to SQS
      for (const resolution of resolutions) {
        const jobMessage = {
          jobType: "transcode",
          videoId: videoId,
          s3Key: key,
          bucket: bucket,
          resolution: resolution.name,
          scale: resolution.scale,
          outputKey: `videos/${videoId}_${resolution.name}.mp4`,
          timestamp: new Date().toISOString(),
        };

        const sqsParams = {
          QueueUrl: QUEUE_URL,
          MessageBody: JSON.stringify(jobMessage),
          MessageAttributes: {
            jobType: {
              DataType: "String",
              StringValue: "transcode",
            },
            resolution: {
              DataType: "String",
              StringValue: resolution.name,
            },
            videoId: {
              DataType: "String",
              StringValue: videoId,
            },
          },
        };

        const sqsResult = await sqsClient.send(
          new SendMessageCommand(sqsParams)
        );
        console.log(
          `✓ Enqueued transcode job: ${videoId} @ ${resolution.name} - MessageId: ${sqsResult.MessageId}`
        );
      }

      // Send thumbnail generation job to SQS
      const thumbnailJob = {
        jobType: "thumbnail",
        videoId: videoId,
        s3Key: key,
        bucket: bucket,
        outputKey: `thumbnails/${videoId}.jpg`,
        timestamp: new Date().toISOString(),
      };

      const thumbnailSqsParams = {
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(thumbnailJob),
        MessageAttributes: {
          jobType: {
            DataType: "String",
            StringValue: "thumbnail",
          },
          videoId: {
            DataType: "String",
            StringValue: videoId,
          },
        },
      };

      const thumbnailResult = await sqsClient.send(
        new SendMessageCommand(thumbnailSqsParams)
      );
      console.log(
        `✓ Enqueued thumbnail job: ${videoId} - MessageId: ${thumbnailResult.MessageId}`
      );

      results.push({
        videoId: videoId,
        bucket: bucket,
        key: key,
        jobsEnqueued: 4, // 3 transcoding + 1 thumbnail
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successfully processed S3 events and enqueued jobs",
        processed: results,
        totalJobs: results.length * 4,
      }),
    };
  } catch (err) {
    console.error("Error processing S3 event:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error processing file",
        error: err.message,
      }),
    };
  }
};
