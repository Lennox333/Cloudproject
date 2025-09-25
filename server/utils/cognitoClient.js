import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { getConfig } from "./envManager.js";

const { AWS_REGION } = await getConfig();
export const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
});
