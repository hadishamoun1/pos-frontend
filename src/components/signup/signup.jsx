import React from "react";
import "../login/login.css";

const SignupPage = () => {
  return (
    <div className="auth-container">
      <div className="welcome-text">Welcome to Shamun Co.</div>
      <div className="auth-form">
        <h2>Sign Up</h2>
        <form>
          <input type="text" placeholder="Username" required />
          <input type="email" placeholder="Email" required />
          <input type="password" placeholder="Password" required />
          <button type="submit">Sign Up</button>
        </form>
       
      </div>
    </div>
  );
};

export default SignupPage;
