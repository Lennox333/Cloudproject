import {
  GlobalSignOutCommand,
  SignUpCommand,
  InitiateAuthCommand,
  AdminListGroupsForUserCommand,
  ConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { COGNITO_CLIENT_ID, USER_POOL_ID, COGNITO_CLIENT_SECRET } from "./secretManager.js";
import { cognitoClient } from "./cognitoClient.js";
import { createHmac } from "crypto"; // Import crypto library


// Setup DynamoDB client

function calculateSecretHash(username) {
  const message = username + COGNITO_CLIENT_ID;
  const hmac = createHmac("sha256", COGNITO_CLIENT_SECRET);
  hmac.update(message);
  return hmac.digest("base64");
}

async function registerUser(username, password, email) {
  try {
    const secretHash = calculateSecretHash(username);

    const command = new SignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      SecretHash: secretHash, // Added SecretHash
      Username: username,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    });

    const response = await cognitoClient.send(command);
    return { message: "User registered. Confirm email to activate.", response };
  } catch (err) {
    console.error("Cognito error:", err);
    return { error: err.message };
  }
}

async function loginUser(username, password) {
  const secretHash = calculateSecretHash(username);

  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: secretHash, // Added SecretHash
    },
  });

  const response = await cognitoClient.send(command);

  return {
    idToken: response.AuthenticationResult.IdToken,
    accessToken: response.AuthenticationResult.AccessToken,
    refreshToken: response.AuthenticationResult.RefreshToken,
  };
}

async function logoutUser(accessToken) {
  try {
    await cognitoClient.send(
      new GlobalSignOutCommand({ AccessToken: accessToken })
    );
    return { success: true };
  } catch (err) {
    console.error("Cognito logout error:", err);
    return { error: err.message };
  }
}

async function isAdmin(user) {
  try {
    const command = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: user.username,
    });

    const response = await cognitoClient.send(command);
    const groups = response.Groups.map(g => g.GroupName);

    if (groups.includes("Admin")) {
      return { success: true };
    } else {
      return { success: false, error: "Admin access required" };
    }
  } catch (err) {
    console.error("Error checking admin group:", err);
    return { success: false, error: "Server error" };
  }
}

async function confirmRegistration(username, confirmationCode) {
  try {
    const secretHash = calculateSecretHash(username);
    
    const command = new ConfirmSignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      SecretHash: secretHash, // Added SecretHash
      Username: username,
      ConfirmationCode: confirmationCode,
    });
    
    const response = await cognitoClient.send(command);
    return { message: "User registration confirmed successfully.", response };
  } catch (err) {
    console.error("Cognito error:", err);
    return { error: err.message };
  }
}

export { registerUser, loginUser, logoutUser, isAdmin, confirmRegistration };