import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({ region: "ap-southeast-2" });

async function receiveMessages() {
  const params = {
    QueueUrl: "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11772891-video-processing-queue",
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 20,
    WaitTimeSeconds: 10, // ✅ wait up to 10s for messages
  };

  const command = new ReceiveMessageCommand(params);
  const response = await sqsClient.send(command);

  console.log("Raw Response:", response);
  if (!response.Messages) {
    console.log("⚠️ No messages available in the queue right now.");
    return;
  }

  for (const message of response.Messages) {
    console.log("📩 Received Message:", message.Body);
  }
}

receiveMessages().catch(console.error);
