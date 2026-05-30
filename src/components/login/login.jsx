import React, { lazy, Suspense, useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { preloadFaceModels } from "./faceApiCache";
import "./login.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

const FaceLoginSection = lazy(() => import("./FaceLoginSection"));

const LoginPage = () => {
  const { setLanguage } = useLanguage();

  const [mode, setMode] = useState("face");
  const [screen, setScreen] = useState("login"); // "login" | "signup"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const errorStyle = {
    marginTop: 10, color: "white", background: "#9b0000",
    border: "1px solid rgba(248,113,113,0.35)", padding: "8px 10px",
    borderRadius: 8, fontSize: 13, lineHeight: 1.35, textAlign: "left",
  };

  // Silently preload face models in the background while user fills password form
  useEffect(() => {
    preloadFaceModels().catch(() => {});
  }, []);

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

  const handleSignup = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr("");
    if (password !== confirmPassword) { setErr("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((Array.isArray(data?.message) ? data.message.join(", ") : data?.message) || "Sign up failed");
      if (!data?.access_token) throw new Error("No token returned from server");
      sessionStorage.setItem("token", data.access_token);
      if (data?.user?.language) setLanguage(data.user.language);
      window.location.href = "/dashboard";
    } catch (e) {
      setErr(e?.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const switchScreen = (s) => { setErr(""); setUsername(""); setPassword(""); setConfirmPassword(""); setScreen(s); };

  const handleFaceSuccess = (data) => {
    sessionStorage.setItem("token", data.access_token);
    if (data?.user?.language) setLanguage(data.user.language);
    window.location.href = "/dashboard";
  };

  return (
    <div className="auth-container" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/assets/background.png)` }}>
      <div className="auth-form">
        <div className="welcome-text">Welcome to Shamoun Co.</div>
        <h2>{screen === "login" ? "Login" : "Sign Up"}</h2>

        {screen === "login" && (
          <>
            {/* Face login */}
            <Suspense fallback={<p style={{ color: "white", textAlign: "center" }}>Loading face login...</p>}>
              <FaceLoginSection onLogin={handleFaceSuccess} />
            </Suspense>

            {/* Username / Password form */}
            <form onSubmit={handleNormalLogin} style={{ marginTop: 16 }}>
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

            <div className="create-acc">
              Don't have an account?{" "}
              <span className="link-login-signup" style={{ cursor: "pointer" }} onClick={() => switchScreen("signup")}>
                Sign Up
              </span>
            </div>
          </>
        )}

        {screen === "signup" && (
          <form onSubmit={handleSignup} style={{ marginTop: 16 }}>
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
              autoComplete="new-password"
              required
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            {err ? <div style={errorStyle}>{err}</div> : null}
            <button type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </button>

            <div className="create-acc">
              Already have an account?{" "}
              <span className="link-login-signup" style={{ cursor: "pointer" }} onClick={() => switchScreen("login")}>
                Login
              </span>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default LoginPage;
