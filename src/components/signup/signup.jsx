import React, { useState } from "react";
import "../login/login.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

const SignupPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setErr("");

    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (Array.isArray(data?.message) ? data.message.join(", ") : data?.message) ||
          "Signup failed";
        throw new Error(msg);
      }

      if (data?.access_token) {
        sessionStorage.setItem("token", data.access_token);
      }

      window.location.href = "/"; // change if needed
    } catch (e2) {
      setErr(e2?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="welcome-text">Welcome to Shamoun Co.</div>
        <h2>Sign Up</h2>

        <form onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />

          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <input
            type="password"
            placeholder="Confirm Password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />

          {err ? <div style={{ marginTop: 10, color: "salmon" }}>{err}</div> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Sign Up"}
          </button>
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
