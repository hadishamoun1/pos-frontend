import React, { useState } from "react";
import "./login.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setErr("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (Array.isArray(data?.message) ? data.message.join(", ") : data?.message) ||
          "Login failed";
        throw new Error(msg);
      }

      if (!data?.access_token) throw new Error("No token returned from server");

      sessionStorage.setItem("token", data.access_token);

      window.location.href = "/dashboard"; // change if needed
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="welcome-text">Welcome to Shamoun Co.</div>
        <h2>Login</h2>

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
            autoComplete="current-password"
          />

          {err ? <div style={{ marginTop: 10, color: "salmon" }}>{err}</div> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
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
