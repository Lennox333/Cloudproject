import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

// AWS region
// const AWS_REGION = "ap-southeast-2";

// Parameter names (const outside the function)
// const PARAMETERS = {
//   PURPOSE: "/n11772891/purpose",
//   QUT_USERNAME: "/n11772891/qut_username",
//   S3_BUCKET: "/n11772891/s3_bucket",
//   USER_POOL_ID: "/n11772891/user_pool_id",
//   DYNAMO_TABLE: "n11772891/dynamo_table"
// };

// // Secrets Manager name
// const SECRETS_MANAGER_NAME = "n11772891-cognito-secrets";

// Load config from environment variables
const PARAMETERS = {
  PURPOSE: process.env.PURPOSE_PARAM,
  QUT_USERNAME: process.env.QUT_USERNAME_PARAM,
  S3_BUCKET: process.env.S3_BUCKET_PARAM,
  USER_POOL_ID: process.env.USER_POOL_ID_PARAM,
  DYNAMO_TABLE: process.env.DYNAMO_TABLE,
  MEMECACHE: process.env.MEMECACHE_PARAM
};

// Secrets Manager name from env
const SECRETS_MANAGER_NAME = process.env.COGNITO_SECRET_NAME;

// AWS region from env
const AWS_REGION = process.env.AWS_REGION;

// AWS SDK Clients
const ssmClient = new SSMClient({ region: AWS_REGION });
const secretsManagerClient = new SecretsManagerClient({ region: AWS_REGION });

// Helper to fetch a single parameter
async function fetchParameter(name) {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value;
}

// Main function to fetch all config + secrets
export async function getConfig() {
  try {
    const config = {};

    // Fetch Secrets Manager values
    const secretCommand = new GetSecretValueCommand({
      SecretId: SECRETS_MANAGER_NAME,
    });
    const { SecretString } = await secretsManagerClient.send(secretCommand);
    Object.assign(config, JSON.parse(SecretString));

    // Fetch parameters individually
    for (const [key, path] of Object.entries(PARAMETERS)) {
      const value = await fetchParameter(path);
      config[key] = value;
    }

    // Add derived values
    config.AWS_REGION = AWS_REGION;

    return config;
  } catch (err) {
    console.error("Error loading configuration:", err);
    throw err;
  }
}
