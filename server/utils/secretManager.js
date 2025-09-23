// utils/secretManager.js
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let AWS_REGION;
let BUCKET;
let PURPOSE;
let QUT_USERNAME;
let DYNAMO_TABLE;
let USER_KEY;
let VIDEO_KEY;
let USER_POOL_ID;
let COGNITO_CLIENT_ID;
let COGNITO_CLIENT_SECRET;

export async function initConfig() {
  AWS_REGION = process.env.AWS_REGION || "ap-southeast-2";

  const ssmClient = new SSMClient({ region: AWS_REGION });
  const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

  async function getParam(name) {
    const cmd = new GetParameterCommand({ Name: name, WithDecryption: false });
    const res = await ssmClient.send(cmd);
    return res.Parameter.Value;
  }

  try {
    // ---- Load from SSM ----
    AWS_REGION = await getParam("/n11772891/aws_region");
    PURPOSE = await getParam("/n11772891/purpose");
    QUT_USERNAME = await getParam("/n11772891/qut_username");
    BUCKET = await getParam("/n11772891/s3_bucket");
    USER_POOL_ID = await getParam("/n11772891/user_pool_id");

    // ---- Load Cognito secrets ----
    const secretRes = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: "n11772891-cognito-secrets" })
    );
    const secretJson = JSON.parse(secretRes.SecretString);

    COGNITO_CLIENT_ID = secretJson.COGNITO_CLIENT_ID;
    COGNITO_CLIENT_SECRET = secretJson.COGNITO_CLIENT_SECRET;

    // ---- Derived ----
    DYNAMO_TABLE = `${QUT_USERNAME}-user_videos`;
    USER_KEY = `${QUT_USERNAME}-user_id`;
    VIDEO_KEY = `${QUT_USERNAME}-video_id`;

    console.log("✅ Config and secrets loaded successfully");
  } catch (err) {
    console.error("❌ Failed to initialize config:", err);
    throw err;
  }
}

export {
  AWS_REGION,
  BUCKET,
  PURPOSE,
  QUT_USERNAME,
  USER_POOL_ID,
  DYNAMO_TABLE,
  USER_KEY,
  VIDEO_KEY,
  COGNITO_CLIENT_ID,
  COGNITO_CLIENT_SECRET,
};
