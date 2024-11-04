import React from "react";
import "./login.css";

const LoginPage = () => {
  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="welcome-text">Welcome to Shamoun Co.</div>
        <h2>Login</h2>
        <form>
          <input type="text" placeholder="Username" required />
          <input type="password" placeholder="Password" required />

          <button type="submit">Login</button>
        </form>
        <div className="create-acc">
          Don't have an account?{" "}
          <a className="link-login-signup" href="/Signup">
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
