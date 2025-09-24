import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { config } from "./secretManager.js";

export const cognitoClient = new CognitoIdentityProviderClient({ region: config.AWS_REGION });