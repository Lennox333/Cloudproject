import {
  SSMClient,
  GetParametersByPathCommand
} from "@aws-sdk/client-ssm";
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from "@aws-sdk/client-secrets-manager";

// Define the region and base path, fallback to hardcoded if environment variable is not available
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-2";
const PARAMETER_STORE_PATH = `/n11772891/`;
const SECRETS_MANAGER_NAME = `n11772891-cognito-secrets`;

// AWS SDK Clients
const ssmClient = new SSMClient({
  region: AWS_REGION
});
const secretsManagerClient = new SecretsManagerClient({
  region: AWS_REGION
});

// A single object to hold all configurations and secrets
const config = {};

// The main async function to load all configurations
export async function initConfig() {
  if (Object.keys(config).length > 0) {
    return config;
  }
  
  try {
    // Fetch from Secrets Manager
    const secretCommand = new GetSecretValueCommand({ SecretId: SECRETS_MANAGER_NAME });
    const { SecretString } = await secretsManagerClient.send(secretCommand);
    const secrets = JSON.parse(SecretString);
    Object.assign(config, secrets); // Add all secrets to the config object

    // Fetch from Parameter Store
    const paramCommand = new GetParametersByPathCommand({
      Path: PARAMETER_STORE_PATH,
      Recursive: true,
      WithDecryption: true,
    });
    const { Parameters } = await ssmClient.send(paramCommand);

    if (Parameters) {
      Parameters.forEach((param) => {
        const key = param.Name.split('/').pop().toUpperCase();
        config[key] = param.Value; // Add all parameters to the config object
      });
    }

    // Add derived constants
    config.DYNAMO_TABLE = `${config.QUT_USERNAME}-user_videos`;
    config.USER_KEY = `${config.QUT_USERNAME}-user_id`;
    config.VIDEO_KEY = `${config.QUT_USERNAME}-video_id`;

    console.log("Configuration and secrets loaded successfully.");
    return config;
  } catch (err) {
    console.error("Error loading configurations:", err);
    throw err;
  }
}

// Export the config object for other files to use
export { config };