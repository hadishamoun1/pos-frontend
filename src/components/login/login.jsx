import React, { lazy, Suspense, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import "./login.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

const FaceLoginSection = lazy(() => import("./FaceLoginSection"));

const LoginPage = () => {
  const { setLanguage } = useLanguage();

  const [mode, setMode] = useState("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const errorStyle = {
    marginTop: 10, color: "white", background: "#9b0000",
    border: "1px solid rgba(248,113,113,0.35)", padding: "8px 10px",
    borderRadius: 8, fontSize: 13, lineHeight: 1.35, textAlign: "left",
  };

  const handleNormalLogin = async (e) => {
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
      if (!res.ok) throw new Error((Array.isArray(data?.message) ? data.message.join(", ") : data?.message) || "Login failed");
      if (!data?.access_token) throw new Error("No token returned from server");
      sessionStorage.setItem("token", data.access_token);
      if (data?.user?.language) setLanguage(data.user.language);
      window.location.href = "/dashboard";
    } catch (e) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFaceSuccess = (data) => {
    sessionStorage.setItem("token", data.access_token);
    if (data?.user?.language) setLanguage(data.user.language);
    window.location.href = "/dashboard";
  };

  return (
    <div className="auth-container" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/assets/background.png)` }}>
      <div className="auth-form">
        <div className="welcome-text">Welcome to Shamoun Co.</div>
        <h2>Login</h2>

        {/* Mode toggle */}
        <div style={{ display: "flex", marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
          <button
            type="button"
            onClick={() => { setErr(""); setMode("password"); }}
            style={{
              flex: 1, padding: "8px 0",
              background: mode === "password" ? "rgba(255,255,255,0.18)" : "transparent",
              color: "white", border: "none", cursor: "pointer",
              fontWeight: mode === "password" ? 700 : 400,
              borderRight: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            Username / Password
          </button>
          <button
            type="button"
            onClick={() => { setErr(""); setMode("face"); }}
            style={{
              flex: 1, padding: "8px 0",
              background: mode === "face" ? "rgba(255,255,255,0.18)" : "transparent",
              color: "white", border: "none", cursor: "pointer",
              fontWeight: mode === "face" ? 700 : 400,
            }}
          >
            Face Login
          </button>
        </div>

        {/* Username / Password form */}
        {mode === "password" && (
          <form onSubmit={handleNormalLogin}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {err ? <div style={errorStyle}>{err}</div> : null}
            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        )}

        {/* Face login — only loaded when user clicks Face Login */}
        {mode === "face" && (
          <Suspense fallback={<p style={{ color: "white", textAlign: "center" }}>Loading face login...</p>}>
            <FaceLoginSection onLogin={handleFaceSuccess} />
          </Suspense>
        )}

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
