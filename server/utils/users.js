import {
  GlobalSignOutCommand,
  SignUpCommand,
  InitiateAuthCommand,
  AdminListGroupsForUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { COGNITO_CLIENT_ID, USER_POOL_ID } from "./secretManager.js";
import { cognitoClient } from "./cognitoClient.js";


// Setup DynamoDB client

async function registerUser(username, password, email) {
  try {
    const command = new SignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
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
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
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

    const response = await cognito.send(command);
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


export { registerUser, loginUser, logoutUser, isAdmin };
