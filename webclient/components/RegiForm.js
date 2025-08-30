export const RegisterForm = `
  <h2>Register</h2>
  <form id="register-form">
    <div>
      <label for="username">Username:</label>
      <input type="text" id="username" name="username" required />
    </div>
    <div>
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required />
    </div>
    <button type="submit">Register</button>
  </form>
  <div id="register-message"></div>
`;
