import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import "./login.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const FACE_MODELS_URL = "/models";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const LoginPage = () => {
  const { setLanguage } = useLanguage();

  const [facePassword, setFacePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Face login state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceapiRef = useRef(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const [faceEmbedding, setFaceEmbedding] = useState(null);
  const [identifiedUser, setIdentifiedUser] = useState(null);

  // Liveness state
  const [livenessBusy, setLivenessBusy] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState("");

  // ✅ Better readable UI message colors
  const uiMsgStyles = {
    error: {
      marginTop: 10,
      color: "white",
      background: "#9b0000",
      border: "1px solid rgba(248, 113, 113, 0.35)",
      padding: "8px 10px",
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 1.35,
      textAlign: "left",
    },
    liveness: {
      marginTop: 8,
      color: "white",
      background: "#eb9d00",
      border: "1px solid rgba(247, 177, 1, 0.28)",
      padding: "8px 10px",
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 1.35,
      textAlign: "left",
    },
    faceInfo: {
      marginTop: 8,
      color: "white",
      background: "#007bff",
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
      color: "white",
      background: "#ff4444",
      border: "1px solid rgba(125, 0, 0, 0.08)",
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

  const startCamera = async () => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Camera access requires HTTPS. Please open this page over https://");
      return;
    }
    try {
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
    } catch (e) {
      setErr(e?.message || "Could not access camera");
    }
  };

  const loadFaceModels = async () => {
    if (modelsReady) return;

    setFaceStatus("Loading face models...");
    try {
      if (!faceapiRef.current) {
        faceapiRef.current = await import("face-api.js");
      }
      const faceapi = faceapiRef.current;
      await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);

      setModelsReady(true);
      setFaceStatus("Face models loaded");
    } catch (e) {
      console.error(e);
      setErr("Failed to load face models. Make sure /public/models exists.");
      setFaceStatus("");
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadFaceModels();
        if (mounted) await startCamera();
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      mounted = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // Get baseline face position
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

      // Detect horizontal movement
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

        // accept clear horizontal movement (webcam may be mirrored)
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

  const detectAndIdentifyFace = async () => {
    if (faceBusy || loading || livenessBusy) return;

    if (!modelsReady) {
      setErr("Face models are not ready yet");
      return;
    }
    if (!videoRef.current || !cameraReady) {
      setErr("Camera not ready");
      return;
    }
    const faceapi = faceapiRef.current;

    setErr("");
    setFaceBusy(true);
    setFaceStatus("Starting liveness check...");
    setIdentifiedUser(null);
    setFaceEmbedding(null);
    setLivenessPassed(false);

    try {
      await runTurnHeadLeftChallenge();

      // Give the user time to re-center after the head-turn challenge
      setFaceStatus("✅ Liveness passed — now look straight at the camera...");
      await wait(1800);

      // Retry face detection up to 5 times so a brief delay doesn't fail the whole scan
      setFaceStatus("Detecting face...");
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

      if (!detection || !detection.descriptor) {
        throw new Error("No face detected. Please look straight at the camera in good light.");
      }

      const embedding = Array.from(detection.descriptor);
      setFaceEmbedding(embedding);

      setFaceStatus("Face detected. Identifying...");

      const res = await fetch(`${API_BASE}/auth/face/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (Array.isArray(data?.message) ? data.message.join(", ") : data?.message) ||
          "Face not recognized";
        throw new Error(msg);
      }

      setIdentifiedUser(data?.user || null);
      setFaceStatus(
        data?.score != null
          ? `Recognized as ${data?.user?.username} (score: ${data.score})`
          : "Recognized"
      );
    } catch (e) {
      setErr(e?.message || "Face identify failed");
      setFaceStatus("");
      setIdentifiedUser(null);
      setFaceEmbedding(null);
      setLivenessPassed(false);
      setLivenessStatus("");
    } finally {
      setFaceBusy(false);
    }
  };

  const handleFaceLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!faceEmbedding) {
      setErr("Please scan your face first");
      return;
    }
    if (!livenessPassed) {
      setErr("Please complete liveness check first");
      return;
    }
    if (!facePassword) {
      setErr("Please enter your password");
      return;
    }

    setErr("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/face/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embedding: faceEmbedding,
          password: facePassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (Array.isArray(data?.message) ? data.message.join(", ") : data?.message) ||
          "Face login failed";
        throw new Error(msg);
      }

      if (!data?.access_token) throw new Error("No token returned from server");

      sessionStorage.setItem("token", data.access_token);

      if (data?.user?.language) {
        setLanguage(data.user.language);
      }

      window.location.href = "/dashboard";
    } catch (e2) {
      setErr(e2?.message || "Face login failed");
    } finally {
      setLoading(false);
    }
  };

  const resetFaceFlow = () => {
    setErr("");
    setFaceStatus("");
    setFaceEmbedding(null);
    setIdentifiedUser(null);
    setFacePassword("");
    setLivenessPassed(false);
    setLivenessStatus("");
  };

  return (
    <div className="auth-container" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/assets/background.png)` }}>
      <div className="auth-form">
        <div className="welcome-text">Welcome to Shamoun Co.</div>
        <h2>Login</h2>

        <div
          style={{
            marginBottom: 10,
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "#111",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              maxHeight: 260,
              objectFit: "cover",
              display: "block",
              background: "#111",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            onClick={startCamera}
            disabled={faceBusy || livenessBusy || loading}
            style={{ flex: 1 }}
          >
            {cameraReady ? "Restart Camera" : "Start Camera"}
          </button>

          <button
            type="button"
            onClick={detectAndIdentifyFace}
            disabled={!cameraReady || faceBusy || livenessBusy || loading || !modelsReady}
            style={{ flex: 1 }}
          >
            {faceBusy || livenessBusy ? "Scanning..." : "Scan Face"}
          </button>
        </div>

        {livenessStatus ? (
          <div style={{ ...uiMsgStyles.liveness, marginBottom: 8, marginTop: 0 }}>
            {livenessStatus}
          </div>
        ) : null}

        {faceStatus ? (
          <div style={{ ...uiMsgStyles.faceInfo, marginBottom: 10, marginTop: 0, fontSize: 14 }}>
            {faceStatus}
          </div>
        ) : null}

        {identifiedUser ? (
          <div
            style={{
              marginBottom: 10,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 6 }}>Continue as:</div>
            <div style={{ fontWeight: 700 }}>
              {identifiedUser.username}{" "}
              <span style={{ opacity: 0.75, fontWeight: 400 }}>({identifiedUser.role})</span>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleFaceLogin}>
          <input
            type="password"
            placeholder="Enter your password to confirm"
            value={facePassword}
            onChange={(e) => setFacePassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {err ? <div style={uiMsgStyles.error}>{err}</div> : null}

          <button
            type="submit"
            disabled={loading || !identifiedUser || !faceEmbedding || !livenessPassed}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div style={uiMsgStyles.tip}>
          Look at the camera and click Scan Face. Turn your head left when asked, then enter your password.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;