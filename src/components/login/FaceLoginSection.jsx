import React, { useEffect, useRef, useState } from "react";
import { preloadFaceModels, getFaceApi, areFaceModelsLoaded } from "./faceApiCache";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const uiMsgStyles = {
  error: {
    marginTop: 10, color: "white", background: "#9b0000",
    border: "1px solid rgba(248,113,113,0.35)", padding: "8px 10px",
    borderRadius: 8, fontSize: 13, lineHeight: 1.35, textAlign: "left",
  },
  liveness: {
    marginTop: 8, color: "white", background: "#eb9d00",
    border: "1px solid rgba(247,177,1,0.28)", padding: "8px 10px",
    borderRadius: 8, fontSize: 13, lineHeight: 1.35, textAlign: "left",
  },
  faceInfo: {
    marginTop: 8, color: "white", background: "#007bff",
    border: "1px solid rgba(56,189,248,0.25)", padding: "8px 10px",
    borderRadius: 8, fontSize: 13, lineHeight: 1.35, textAlign: "left",
  },
  tip: {
    marginTop: 8, color: "white", background: "#ff4444",
    border: "1px solid rgba(125,0,0,0.08)", padding: "8px 10px",
    borderRadius: 8, fontSize: 12, lineHeight: 1.35, opacity: 0.95, textAlign: "left",
  },
};

const FaceLoginSection = ({ onLogin }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const faceapiRef = useRef(null);

  const [modelsReady, setModelsReady] = useState(areFaceModelsLoaded);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const [faceEmbedding, setFaceEmbedding] = useState(null);
  const [identifiedUser, setIdentifiedUser] = useState(null);
  const [livenessBusy, setLivenessBusy] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState("");
  const [facePassword, setFacePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const stopCamera = () => {
    cancelAnimationFrame(animFrameRef.current);
    try { if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    setCameraReady(false);
  };

  useEffect(() => {
    if (!cameraReady) return;
    let running = true;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    const track = streamRef.current?.getVideoTracks?.()[0];
    let cap = null;
    if (track && typeof ImageCapture !== "undefined") {
      try { cap = new ImageCapture(track); } catch {}
    }

    const draw = async () => {
      if (!running) return;
      try {
        if (cap) {
          const bmp = await cap.grabFrame();
          if (canvas && running) {
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            canvas.getContext("2d").drawImage(bmp, 0, 0);
            bmp.close();
          }
        } else if (video && canvas && video.readyState >= 2) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d").drawImage(video, 0, 0);
        }
      } catch {}
      if (running) animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraReady]);

  const startCamera = async () => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Camera access requires HTTPS.");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);

      // Diagnostics: log camera info and center pixel color
      try {
        const track = stream.getVideoTracks()[0];
        const s = track.getSettings();
        console.log("[CAM] Label:", track.label);
        console.log("[CAM] Format:", s.width + "x" + s.height + " @ " + s.frameRate + "fps");
        const cap = new ImageCapture(track);
        await new Promise(r => setTimeout(r, 500)); // let camera warm up
        const bmp = await cap.grabFrame();
        const off = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = off.getContext("2d");
        ctx.drawImage(bmp, 0, 0);
        const px = ctx.getImageData(Math.floor(bmp.width / 2), Math.floor(bmp.height / 2), 1, 1).data;
        console.log("[CAM] Center pixel R/G/B:", px[0], px[1], px[2], px[3]);
        bmp.close();
      } catch (diagErr) {
        console.log("[CAM] Diagnostic error:", diagErr?.message);
      }
    } catch (e) {
      setErr(e?.message || "Could not access camera");
    }
  };

  const loadFaceModels = async () => {
    if (modelsReady) return;
    setFaceStatus("Loading face models...");
    try {
      await preloadFaceModels();
      faceapiRef.current = getFaceApi();
      setModelsReady(true);
      setFaceStatus("Face models loaded");
    } catch (e) {
      setErr("Failed to load face models.");
      setFaceStatus("");
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (areFaceModelsLoaded()) {
          faceapiRef.current = getFaceApi();
        } else {
          await loadFaceModels();
        }
        if (mounted) await startCamera();
      } catch (e) {}
    })();
    return () => { mounted = false; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runLiveness = async () => {
    if (!videoRef.current || !cameraReady || !modelsReady) throw new Error("Camera or models not ready");
    const faceapi = faceapiRef.current || getFaceApi();
    setLivenessBusy(true);
    setLivenessPassed(false);
    setLivenessStatus("Look straight at the camera...");

    try {
      let baseline = null;
      let tries = 0;
      while (!baseline && tries < 10) {
        tries++;
        const d = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 })).withFaceLandmarks();
        if (d?.detection?.box) {
          const box = d.detection.box;
          baseline = { centerX: box.x + box.width / 2, width: box.width };
        } else {
          setLivenessStatus("No face detected. Look straight at the camera...");
          await wait(80);
        }
      }
      if (!baseline) throw new Error("Could not detect face for liveness check");

      setLivenessStatus("Turn your head LEFT now");
      let passed = false;
      const startedAt = Date.now();
      while (Date.now() - startedAt < 2500) {
        const d = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 })).withFaceLandmarks();
        if (!d?.detection?.box) { await wait(50); continue; }
        const box = d.detection.box;
        const deltaX = (box.x + box.width / 2 - baseline.centerX) / Math.max(baseline.width, 1);
        if (Math.abs(deltaX) > 0.12) { passed = true; break; }
        await wait(50);
      }
      if (!passed) throw new Error("Liveness failed. Please turn your head left more clearly.");
      setLivenessPassed(true);
      setLivenessStatus("Liveness passed ✅");
      return true;
    } finally {
      setLivenessBusy(false);
    }
  };

  const detectAndIdentifyFace = async () => {
    if (faceBusy || loading || livenessBusy || !modelsReady || !cameraReady) return;
    const faceapi = faceapiRef.current || getFaceApi();
    setErr(""); setFaceBusy(true);
    setFaceStatus("Starting liveness check...");
    setIdentifiedUser(null); setFaceEmbedding(null); setLivenessPassed(false);

    try {
      await runLiveness();
      setFaceStatus("Detecting face...");
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
        .withFaceLandmarks().withFaceDescriptor();
      if (!detection?.descriptor) throw new Error("No face detected. Please look at the camera in good light.");

      const embedding = Array.from(detection.descriptor);
      setFaceEmbedding(embedding);
      setFaceStatus("Face detected. Identifying...");

      const res = await fetch(`${API_BASE}/auth/face/identify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((Array.isArray(data?.message) ? data.message.join(", ") : data?.message) || "Face not recognized");

      setIdentifiedUser(data?.user || null);
      setFaceStatus(data?.score != null ? `Recognized as ${data?.user?.username} (score: ${data.score})` : "Recognized");
    } catch (e) {
      setErr(e?.message || "Face identify failed");
      setFaceStatus(""); setIdentifiedUser(null); setFaceEmbedding(null);
      setLivenessPassed(false); setLivenessStatus("");
    } finally {
      setFaceBusy(false);
    }
  };

  const handleFaceLogin = async (e) => {
    e.preventDefault();
    if (loading || !faceEmbedding || !livenessPassed || !facePassword) {
      if (!faceEmbedding) setErr("Please scan your face first");
      else if (!livenessPassed) setErr("Please complete liveness check first");
      else if (!facePassword) setErr("Please enter your password");
      return;
    }
    setErr(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/face/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding: faceEmbedding, password: facePassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((Array.isArray(data?.message) ? data.message.join(", ") : data?.message) || "Face login failed");
      if (!data?.access_token) throw new Error("No token returned from server");
      onLogin(data);
    } catch (e2) {
      setErr(e2?.message || "Face login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 10, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)", background: "#111" }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />
        <canvas ref={canvasRef} style={{ width: "100%", maxHeight: 260, display: "block", background: "#111" }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={startCamera} disabled={faceBusy || livenessBusy || loading} style={{ flex: 1 }}>
          {cameraReady ? "Restart Camera" : "Start Camera"}
        </button>
        <button type="button" onClick={detectAndIdentifyFace} disabled={!cameraReady || faceBusy || livenessBusy || loading || !modelsReady} style={{ flex: 1 }}>
          {faceBusy || livenessBusy ? "Scanning..." : "Scan Face"}
        </button>
      </div>

      {livenessStatus ? <div style={{ ...uiMsgStyles.liveness, marginBottom: 8, marginTop: 0 }}>{livenessStatus}</div> : null}
      {faceStatus ? <div style={{ ...uiMsgStyles.faceInfo, marginBottom: 10, marginTop: 0, fontSize: 14 }}>{faceStatus}</div> : null}

      {identifiedUser ? (
        <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "left" }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>Continue as:</div>
          <div style={{ fontWeight: 700 }}>
            {identifiedUser.username}{" "}
            <span style={{ opacity: 0.75, fontWeight: 400 }}>({identifiedUser.role})</span>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleFaceLogin}>
        <input type="password" placeholder="Enter your password to confirm" value={facePassword} onChange={(e) => setFacePassword(e.target.value)} autoComplete="current-password" required />
        {err ? <div style={uiMsgStyles.error}>{err}</div> : null}
        <button type="submit" disabled={loading || !identifiedUser || !faceEmbedding || !livenessPassed}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <div style={uiMsgStyles.tip}>
        Look at the camera and click Scan Face. Turn your head left when asked, then enter your password.
      </div>
    </>
  );
};

export default FaceLoginSection;
