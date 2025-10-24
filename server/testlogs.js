import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({ region: "ap-southeast-2" });

const receiveMessages = async () => {
  const params = {
    QueueUrl: "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11772891-video-processing-queue",
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 10,
  };

  const command = new ReceiveMessageCommand(params);
  const response = await sqsClient.send(command);
  console.log("Messages:", response.Messages);
};

receiveMessages();
