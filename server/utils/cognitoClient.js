// utils/cognitoClient.js
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { AWS_REGION } from "./secretManager.js";

export const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
});
