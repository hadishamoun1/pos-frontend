import React from "react";
import "../login/login.css";

const SignupPage = () => {
  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="welcome-text">Welcome to Shamoun Co.</div>
        <h2>Sign Up</h2>
        <form>
          <input type="text" placeholder="Username" required />

          <input type="password" placeholder="Password" required />
          <button type="submit">Sign Up</button>
        </form>
        <div className="create-acc">
          already have an account?{" "}
          <a className="link-login-signup" href="/">
            Log in
          </a>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
