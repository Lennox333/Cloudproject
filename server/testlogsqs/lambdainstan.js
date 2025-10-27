import { ECSClient, ListTasksCommand, RunTaskCommand } from "@aws-sdk/client-ecs";

const ecsClient = new ECSClient({ region: "ap-southeast-2" });

// Update these to match your ECS setup
const CLUSTER_NAME = "gr24-a3";
const TASK_DEFINITION = "n11772891-video-processor";
const SUBNETS = ["subnet-xxxxxx"]; // Replace with your subnet IDs
const SECURITY_GROUPS = ["sg-xxxxxx"]; // Replace with your security group IDs

export const handler = async () => {
  try {
    console.log("Checking for running Fargate tasks...");

    // 1️⃣ List running tasks
    const listParams = { cluster: CLUSTER_NAME, desiredStatus: "RUNNING" };
    const { taskArns } = await ecsClient.send(new ListTasksCommand(listParams));

    if (taskArns && taskArns.length > 0) {
      console.log(` Found ${taskArns.length} running Fargate task(s):`, taskArns);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Fargate already running, no new task started.",
          runningTasks: taskArns,
        }),
      };
    }

    console.log("No running Fargate tasks found. Starting a new one...");

    // 2️⃣ Start a new Fargate task
    const runParams = {
      cluster: CLUSTER_NAME,
      taskDefinition: TASK_DEFINITION,
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: SUBNETS,
          securityGroups: SECURITY_GROUPS,
          assignPublicIp: "ENABLED",
        },
      },
    };

    const result = await ecsClient.send(new RunTaskCommand(runParams));
    console.log("🚀 Fargate task started:", JSON.stringify(result, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "New Fargate task started.",
        taskArn: result.tasks?.[0]?.taskArn,
      }),
    };
  } catch (err) {
    console.error("❌ Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
