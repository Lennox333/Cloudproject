// users.js
import {
  GlobalSignOutCommand,
  SignUpCommand,
  InitiateAuthCommand,
  AdminListGroupsForUserCommand,
  ConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { config } from "./secretManager.js"; // Import the config object
import { cognitoClient } from "./cognitoClient.js";
import { createHmac } from "crypto";

function calculateSecretHash(username) {
  const message = username + config.COGNITO_CLIENT_ID;
  const hmac = createHmac("sha256", config.COGNITO_CLIENT_SECRET);
  hmac.update(message);
  return hmac.digest("base64");
}

async function registerUser(username, password, email) {
  try {
    const secretHash = calculateSecretHash(username);
    const command = new SignUpCommand({
      ClientId: config.COGNITO_CLIENT_ID,
      SecretHash: secretHash,
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
    ClientId: config.COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: secretHash,
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
      UserPoolId: config.USER_POOL_ID,
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
      ClientId: config.COGNITO_CLIENT_ID,
      SecretHash: secretHash,
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