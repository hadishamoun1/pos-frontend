import React, { useEffect, useRef, useState } from "react";
import "../login/login.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const FACE_MODELS_URL = `${window.location.origin}/models`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SignupPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Face enrollment (optional)
  const [enableFaceEnroll, setEnableFaceEnroll] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const [faceEmbedding, setFaceEmbedding] = useState(null);

  // Liveness state
  const [livenessBusy, setLivenessBusy] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceapiRef = useRef(null);

  // ✅ Better readable UI message colors
  const uiMsgStyles = {
    error: {
      marginTop: 10,
      color: "#fecaca",
      background: "rgba(127, 29, 29, 0.35)",
      border: "1px solid rgba(248, 113, 113, 0.35)",
      padding: "8px 10px",
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 1.35,
      textAlign: "left",
    },
    liveness: {
      marginTop: 8,
      color: "#fde68a",
      background: "rgba(120, 53, 15, 0.28)",
      border: "1px solid rgba(251, 191, 36, 0.28)",
      padding: "8px 10px",
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 1.35,
      textAlign: "left",
    },
    faceInfo: {
      marginTop: 8,
      color: "#bae6fd",
      background: "rgba(7, 89, 133, 0.25)",
      border: "1px solid rgba(56, 189, 248, 0.25)",
      padding: "8px 10px",
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 1.35,
      textAlign: "left",
    },
    success: {
      marginTop: 6,
      color: "#bbf7d0",
      background: "rgba(20, 83, 45, 0.28)",
      border: "1px solid rgba(74, 222, 128, 0.25)",
      padding: "8px 10px",
      borderRadius: 8,
      fontSize: 12,
      lineHeight: 1.35,
      textAlign: "left",
    },
    tip: {
      marginTop: 8,
      color: "#e5e7eb",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "8px 10px",
      borderRadius: 8,
      fontSize: 12,
      lineHeight: 1.35,
      opacity: 0.95,
      textAlign: "left",
    },
  };

  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    streamRef.current = null;
    setCameraReady(false);
  };

  const loadFaceModels = async () => {
    if (modelsReady) return;

    setErr("");
    setFaceStatus("Loading face models...");

    const base = FACE_MODELS_URL;
    console.log("[Face] Loading models from:", base);

    try {
      // Optional checks for easier debugging
      const checks = [
        `${base}/tiny_face_detector_model-weights_manifest.json`,
        `${base}/face_landmark_68_model-weights_manifest.json`,
        `${base}/face_recognition_model-weights_manifest.json`,
        `${base}/tiny_face_detector_model-shard1`,
        `${base}/face_landmark_68_model-shard1`,
        `${base}/face_recognition_model-shard1`,
        `${base}/face_recognition_model-shard2`,
      ];

      for (const url of checks) {
        const r = await fetch(url);
        console.log("[Face] fetch", url, "=>", r.status, r.headers.get("content-type"));
        if (!r.ok) throw new Error(`Model file not reachable: ${url} (${r.status})`);
      }

      if (!faceapiRef.current) {
        faceapiRef.current = await import("face-api.js");
      }
      const faceapi = faceapiRef.current;

      await faceapi.nets.tinyFaceDetector.loadFromUri(base);
      console.log("[Face] tinyFaceDetector loaded");

      await faceapi.nets.faceLandmark68Net.loadFromUri(base);
      console.log("[Face] faceLandmark68 loaded");

      await faceapi.nets.faceRecognitionNet.loadFromUri(base);
      console.log("[Face] faceRecognition loaded");

      setModelsReady(true);
      setFaceStatus("Face models loaded ✅");
    } catch (e) {
      console.error("[Face] loadFaceModels error:", e);
      setErr(e?.message || "Failed to load face models");
      setFaceStatus("");
      throw e;
    }
  };

  const startCamera = async () => {
    setErr("");
    try {
      if (!modelsReady) {
        await loadFaceModels();
      }

      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
      setFaceStatus((prev) => prev || "Camera ready");
    } catch (e) {
      console.error("[Face] startCamera error:", e);
      setErr(e?.message || "Could not access camera");
    }
  };

  useEffect(() => {
    if (!enableFaceEnroll) {
      stopCamera();
      setFaceStatus("");
      setFaceEmbedding(null);
      setLivenessPassed(false);
      setLivenessStatus("");
      return;
    }

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableFaceEnroll]);

  // ✅ Liveness check: ask user to turn head left
  const runTurnHeadLeftChallenge = async () => {
    if (!videoRef.current) throw new Error("Camera not ready");
    if (!cameraReady) throw new Error("Camera is not ready");
    if (!modelsReady) throw new Error("Face models are not ready yet");
    const faceapi = faceapiRef.current;

    setLivenessBusy(true);
    setLivenessPassed(false);
    setLivenessStatus("Liveness check: look straight at the camera...");

    try {
      let baseline = null;
      let tries = 0;

      while (!baseline && tries < 20) {
        tries++;
        const d = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.5,
            })
          )
          .withFaceLandmarks();

        if (d?.detection?.box) {
          const box = d.detection.box;
          baseline = {
            centerX: box.x + box.width / 2,
            width: box.width,
          };
        } else {
          setLivenessStatus("No face detected. Look straight at the camera...");
          await wait(120);
        }
      }

      if (!baseline) {
        throw new Error("Could not detect face for liveness check");
      }

      setLivenessStatus("Turn your head LEFT now");

      let passed = false;
      const startedAt = Date.now();

      while (Date.now() - startedAt < 4000) {
        const d = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.5,
            })
          )
          .withFaceLandmarks();

        if (!d?.detection?.box) {
          await wait(80);
          continue;
        }

        const box = d.detection.box;
        const currentCenterX = box.x + box.width / 2;
        const deltaX = (currentCenterX - baseline.centerX) / Math.max(baseline.width, 1);

        // webcam preview may be mirrored -> accept clear horizontal movement
        if (Math.abs(deltaX) > 0.12) {
          passed = true;
          break;
        }

        await wait(80);
      }

      if (!passed) {
        throw new Error("Liveness failed. Please turn your head left more clearly.");
      }

      setLivenessPassed(true);
      setLivenessStatus("Liveness passed ✅");
      return true;
    } finally {
      setLivenessBusy(false);
    }
  };

  const scanFace = async () => {
    console.log("[Face] scanFace clicked");
    console.log("[Face] enableFaceEnroll:", enableFaceEnroll);
    console.log("[Face] modelsReady:", modelsReady);
    console.log("[Face] cameraReady:", cameraReady);
    console.log("[Face] videoRef exists:", !!videoRef.current);

    if (!enableFaceEnroll) {
      console.log("[Face] skipped: face enroll not enabled");
      return;
    }
    if (!modelsReady) {
      setErr("Face models are not ready yet. Click Start Camera first.");
      console.log("[Face] models not ready");
      return;
    }
    if (!cameraReady || !videoRef.current) {
      setErr("Camera is not ready. Click Start Camera first.");
      console.log("[Face] camera not ready");
      return;
    }

    setErr("");
    setFaceBusy(true);
    setFaceEmbedding(null);
    setLivenessPassed(false);
    setFaceStatus("Starting liveness check...");
    console.log("[Face] starting liveness + detectSingleFace...");
    const faceapi = faceapiRef.current;

    try {
      // ✅ liveness before enrollment scan
      await runTurnHeadLeftChallenge();

      // Give user time to re-center after head-turn liveness challenge
      setFaceStatus("✅ Liveness passed — now look straight at the camera...");
      await wait(1800);

      // Retry up to 5 times so a brief delay doesn't fail enrollment
      setFaceStatus("Scanning face...");
      let detection = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detection?.descriptor) break;
        await wait(400);
      }

      console.log("[Face] detection result:", detection);

      if (!detection?.descriptor) {
        throw new Error("No face detected. Look straight at the camera in good lighting.");
      }

      const embedding = Array.from(detection.descriptor);
      console.log("[Face] embedding length:", embedding.length);

      setFaceEmbedding(embedding);
      setFaceStatus("Face captured successfully ✅");
    } catch (e) {
      console.error("[Face] scan error:", e);
      setFaceEmbedding(null);
      setFaceStatus("");
      setLivenessPassed(false);
      setLivenessStatus("");
      setErr(e?.message || "Face scan failed");
    } finally {
      setFaceBusy(false);
      console.log("[Face] scan finished");
    }
  };

  const enrollMyFace = async (token, embedding) => {
    const res = await fetch(`${API_BASE}/auth/face/enroll-me`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ embedding }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        (Array.isArray(data?.message) ? data.message.join(", ") : data?.message) ||
        "Face enrollment failed";
      throw new Error(msg);
    }

    return data;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setErr("");

    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }

    if (enableFaceEnroll && !faceEmbedding) {
      setErr("Please scan your face first, or turn off face enrollment");
      return;
    }

    if (enableFaceEnroll && !livenessPassed) {
      setErr("Please complete liveness check first");
      return;
    }

    setLoading(true);

    try {
      // 1) Signup
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

      if (!data?.access_token) {
        throw new Error("Signup succeeded but no token returned");
      }

      // Save token (user is now logged in)
      sessionStorage.setItem("token", data.access_token);

      // 2) Optional self face enrollment
      if (enableFaceEnroll && faceEmbedding) {
        setFaceStatus("Saving face profile...");
        await enrollMyFace(data.access_token, faceEmbedding);
        setFaceStatus("Face enrolled successfully ✅");
      }

      window.location.href = "/";
    } catch (e2) {
      console.error("[Signup] error:", e2);
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

          {/* Optional face enrollment */}
          <div
            style={{
              marginTop: 12,
              marginBottom: 10,
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
              textAlign: "left",
            }}
          >
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={enableFaceEnroll}
                onChange={(e) => {
                  setEnableFaceEnroll(e.target.checked);
                  setFaceEmbedding(null);
                  setFaceStatus("");
                  setErr("");
                  setLivenessPassed(false);
                  setLivenessStatus("");
                }}
              />
              <span>Enroll face now (optional)</span>
            </label>

            {enableFaceEnroll ? (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "#111",
                    marginBottom: 8,
                  }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      maxHeight: 220,
                      objectFit: "cover",
                      display: "block",
                      background: "#111",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={loading || faceBusy || livenessBusy}
                    style={{ flex: 1 }}
                  >
                    {cameraReady ? "Restart Camera" : "Start Camera"}
                  </button>

                  <button
                    type="button"
                    onClick={scanFace}
                    disabled={
                      loading ||
                      faceBusy ||
                      livenessBusy ||
                      !cameraReady ||
                      !modelsReady
                    }
                    style={{ flex: 1 }}
                  >
                    {faceBusy || livenessBusy ? "Scanning..." : "Scan Face"}
                  </button>
                </div>

                {livenessStatus ? <div style={uiMsgStyles.liveness}>{livenessStatus}</div> : null}

                {faceStatus ? <div style={uiMsgStyles.faceInfo}>{faceStatus}</div> : null}

                {faceEmbedding ? (
                  <div style={uiMsgStyles.success}>
                    Face captured and ready for enrollment.
                  </div>
                ) : null}

                <div style={uiMsgStyles.tip}>
                  1) Click Start Camera → 2) Click Scan Face → 3) Turn head left when asked → 4) Click Sign Up
                </div>
              </div>
            ) : null}
          </div>

          {err ? <div style={uiMsgStyles.error}>{err}</div> : null}

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