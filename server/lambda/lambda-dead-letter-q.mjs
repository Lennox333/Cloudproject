import { updateVideoStatus } from "./lambda-dead-letter-q-helper.mjs";

export const handler = async (event, context) => {
  console.log(`[DLQ Lambda] Received ${event.Records.length} message(s)`);

  for (const record of event.Records) {
    try {
      const job = JSON.parse(record.body);
      console.log(
        `[DLQ Lambda] Processing failed job for videoId: ${job.videoId}`
      );
      await updateVideoStatus(job.videoId, "failed");
    } catch (err) {
      console.error("[DLQ Lambda] Error processing message:", err);
    }
  }

  console.log("[DLQ Lambda] Batch complete");
};
