import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

// AWS region
const AWS_REGION = "ap-southeast-2";

// Parameter names (const outside the function)
const PARAMETERS = {
  PURPOSE: "/n11772891/purpose",
  QUT_USERNAME: "/n11772891/qut_username",
  S3_BUCKET: "/n11772891/s3_bucket",
  USER_POOL_ID: "/n11772891/user_pool_id",
};

// Secrets Manager name
const SECRETS_MANAGER_NAME = "n11772891-cognito-secrets";

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
    const secretCommand = new GetSecretValueCommand({ SecretId: SECRETS_MANAGER_NAME });
    const { SecretString } = await secretsManagerClient.send(secretCommand);
    Object.assign(config, JSON.parse(SecretString));

    // Fetch parameters individually
    for (const [key, path] of Object.entries(PARAMETERS)) {
      const value = await fetchParameter(path);
      config[key] = value;
    }

    // Add derived values
    config.DYNAMO_TABLE = `${config.QUT_USERNAME}-user_videos`;
    config.AWS_REGION = AWS_REGION;

    return config;
  } catch (err) {
    console.error("Error loading configuration:", err);
    throw err;
  }
}
