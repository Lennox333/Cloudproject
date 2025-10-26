// import {
//   SQSClient,
//   ReceiveMessageCommand,
//   DeleteMessageCommand,
// } from "@aws-sdk/client-sqs";

// const sqsClient = new SQSClient({ region: "ap-southeast-2" });
// const QUEUE_URL =
//   "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11772891-video-queue";

// const receiveMessages = async () => {
//   try {
//     const params = {
//       QueueUrl: QUEUE_URL,
//       MaxNumberOfMessages: 10,
//       WaitTimeSeconds: 20, // enable long polling
//       MessageAttributeNames: ["All"],
//     };

//     const command = new ReceiveMessageCommand(params);
//     const response = await sqsClient.send(command);

//     console.log(response);
//     if (!response.Messages || response.Messages.length === 0) {
//       console.log("No messages available in queue.");
//       return;
//     }

//     for (const msg of response.Messages) {
//       console.log("📩 Message received:");
//       console.log("MessageId:", msg.MessageId);
//       console.log("Body:", msg.Body);
//       console.log("ReceiptHandle:", msg.ReceiptHandle);

//       // Delete message after processing
//       // await sqsClient.send(
//       //   new DeleteMessageCommand({
//       //     QueueUrl: QUEUE_URL,
//       //     ReceiptHandle: msg.ReceiptHandle,
//       //   })
//       // );
//       // console.log(`✅ Deleted message ${msg.MessageId}`);
//     }
//   } catch (err) {
//     console.error("Error receiving messages:", err);
//   }
// };

// receiveMessages();

import { SQSClient, ReceiveMessageCommand, ChangeMessageVisibilityCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({ region: "ap-southeast-2" });
const QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11772891-video-queue";

const extendVisibility = async (receiptHandle, extraSeconds) => {
  try {
    await sqsClient.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: extraSeconds, // e.g., 300 for 5 minutes
      })
    );
    console.log(`✅ Visibility extended for ${extraSeconds} seconds`);
  } catch (err) {
    console.error("Error extending visibility:", err);
  }
};

const receiveAndExtend = async () => {
  try {
    const params = {
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1, // pick only 1
      WaitTimeSeconds: 20,
      MessageAttributeNames: ["All"],
    };

    const response = await sqsClient.send(new ReceiveMessageCommand(params));

    if (!response.Messages || response.Messages.length === 0) {
      console.log("No messages available in queue.");
      return;
    }

    const msg = response.Messages[0];
    console.log("📩 Message received:");
    console.log("MessageId:", msg.MessageId);
    console.log("ReceiptHandle:", msg.ReceiptHandle);
    console.log("Body:", msg.Body);

    // Extend visibility for 5 minutes (300 seconds)
    await extendVisibility(msg.ReceiptHandle, 300);

  } catch (err) {
    console.error("Error receiving or extending message:", err);
  }
};

receiveAndExtend();
