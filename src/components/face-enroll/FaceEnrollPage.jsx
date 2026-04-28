import React, { useEffect, useRef, useState } from "react";
import "./FaceEnrollPage.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const FACE_MODELS_URL = `${window.location.origin}/models`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function getToken() {
  return sessionStorage.getItem("token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
    throw new Error(msg || `${res.status}`);
  }
  return data;
}

export default function FaceEnrollPage() {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [livenessStatus, setLivenessStatus] = useState("");
  const [err, setErr] = useState("");
  const [lastResult, setLastResult] = useState(null); // { type: "enrolled" | "disabled", username }

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceapiRef = useRef(null);

  const selectedUser = users.find((u) => u.id === selectedId) || null;

  useEffect(() => {
    loadUsers();
  }, []);

  // Stop camera when selected user changes
  useEffect(() => {
    stopCamera();
    setStatus("");
    setLivenessStatus("");
    setErr("");
    setLastResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const data = await apiFetch("/users");
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch (e) {
      setErr(e?.message || "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }

  function stopCamera() {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    setCameraReady(false);
  }

  async function loadModels() {
    if (modelsReady) return;
    setStatus("Loading face models…");
    if (!faceapiRef.current) faceapiRef.current = await import("face-api.js");
    const fa = faceapiRef.current;
    await fa.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
    await fa.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL);
    await fa.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);
    setModelsReady(true);
    setStatus("Models ready — camera is on");
  }

  async function startCamera() {
    setErr(""); setLastResult(null);
    try {
      if (!modelsReady) await loadModels();
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraReady(true);
      setStatus("Camera ready — click Scan & Enroll");
    } catch (e) {
      setErr(e?.message || "Could not access camera");
    }
  }

  async function runLiveness(fa) {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

    setLivenessStatus("Look straight at the camera…");
    let baseline = null;
    for (let i = 0; i < 20 && !baseline; i++) {
      const d = await fa.detectSingleFace(videoRef.current, opts).withFaceLandmarks();
      if (d?.detection?.box) {
        const b = d.detection.box;
        baseline = { centerX: b.x + b.width / 2, width: b.width };
      } else { await wait(120); }
    }
    if (!baseline) throw new Error("No face detected. Look straight at the camera.");

    setLivenessStatus("Turn your head LEFT now");
    let passed = false;
    const end = Date.now() + 4000;
    while (Date.now() < end) {
      const d = await fa.detectSingleFace(videoRef.current, opts).withFaceLandmarks();
      if (d?.detection?.box) {
        const b = d.detection.box;
        const delta = (b.x + b.width / 2 - baseline.centerX) / Math.max(baseline.width, 1);
        if (Math.abs(delta) > 0.12) { passed = true; break; }
      }
      await wait(80);
    }
    if (!passed) throw new Error("Liveness failed — please turn your head left more clearly.");
    setLivenessStatus("Liveness passed ✅");
  }

  async function scanAndEnroll() {
    if (!selectedUser) { setErr("Select a user first."); return; }
    if (!cameraReady || !modelsReady) { setErr("Start the camera first."); return; }
    setErr(""); setLastResult(null); setBusy(true);
    setStatus("Starting liveness check…");
    const fa = faceapiRef.current;
    try {
      await runLiveness(fa);
      setStatus("✅ Liveness passed — look straight at the camera…");
      await wait(1800);

      setStatus("Scanning face…");
      let detection = null;
      for (let i = 0; i < 5; i++) {
        detection = await fa
          .detectSingleFace(videoRef.current, new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detection?.descriptor) break;
        await wait(400);
      }
      if (!detection?.descriptor) throw new Error("No face detected. Ensure good lighting and look at the camera.");

      setStatus("Saving face profile…");
      await apiFetch("/auth/face/enroll", {
        method: "POST",
        body: JSON.stringify({ userId: selectedUser.id, embedding: Array.from(detection.descriptor) }),
      });

      setStatus("");
      setLivenessStatus("");
      setLastResult({ type: "enrolled", username: selectedUser.username });
      stopCamera();
    } catch (e) {
      setErr(e?.message || "Enrollment failed");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function disableFace() {
    if (!selectedUser) return;
    if (!window.confirm(`Disable face login for ${selectedUser.username}?`)) return;
    setBusy(true); setErr(""); setLastResult(null);
    try {
      await apiFetch("/auth/face/disable", {
        method: "POST",
        body: JSON.stringify({ userId: selectedUser.id }),
      });
      setLastResult({ type: "disabled", username: selectedUser.username });
      stopCamera();
      setStatus("");
      setLivenessStatus("");
    } catch (e) {
      setErr(e?.message || "Failed to disable face");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fe-page">
      <div className="fe-header">
        <div>
          <h2 className="fe-title">Face Login Enrollment</h2>
          <p className="fe-subtitle">Enroll or disable face login for any employee.</p>
        </div>
        <button className="fe-refresh-btn" onClick={loadUsers} disabled={loadingUsers}>
          {loadingUsers ? "Loading…" : "Refresh Users"}
        </button>
      </div>

      <div className="fe-layout">
        {/* ── User list ── */}
        <div className="fe-sidebar">
          <div className="fe-sidebar-title">Employees</div>
          {users.map((u) => (
            <button
              key={u.id}
              className={`fe-user-item ${u.id === selectedId ? "active" : ""}`}
              onClick={() => setSelectedId(u.id)}
            >
              <div className="fe-user-name">{u.username}</div>
              <div className="fe-user-meta">#{u.id} · {u.role}</div>
            </button>
          ))}
          {!users.length && !loadingUsers && <div className="fe-empty">No users found</div>}
        </div>

        {/* ── Camera panel ── */}
        <div className="fe-panel">
          {!selectedUser ? (
            <div className="fe-empty fe-empty-center">Select an employee to manage their face login</div>
          ) : (
            <>
              <div className="fe-panel-title">
                Enrolling face for: <strong>{selectedUser.username}</strong>
              </div>

              <div className="fe-video-wrap">
                <video ref={videoRef} autoPlay muted playsInline className="fe-video" />
                {!cameraReady && (
                  <div className="fe-video-placeholder">
                    <span>Camera off</span>
                  </div>
                )}
              </div>

              <div className="fe-actions">
                <button className="fe-btn" onClick={startCamera} disabled={busy}>
                  {cameraReady ? "Restart Camera" : "Start Camera"}
                </button>
                <button
                  className="fe-btn fe-btn-primary"
                  onClick={scanAndEnroll}
                  disabled={busy || !cameraReady || !modelsReady}
                >
                  {busy ? "Working…" : "Scan & Enroll"}
                </button>
                <button className="fe-btn fe-btn-danger" onClick={disableFace} disabled={busy}>
                  Disable Face
                </button>
              </div>

              {livenessStatus && <div className="fe-msg fe-msg-liveness">{livenessStatus}</div>}
              {status && <div className="fe-msg fe-msg-info">{status}</div>}
              {err && <div className="fe-msg fe-msg-error">{err}</div>}

              {lastResult && (
                <div className={`fe-msg ${lastResult.type === "enrolled" ? "fe-msg-success" : "fe-msg-warning"}`}>
                  {lastResult.type === "enrolled"
                    ? `✅ Face enrolled successfully for ${lastResult.username}`
                    : `Face login disabled for ${lastResult.username}`}
                </div>
              )}

              {!lastResult && !err && (
                <div className="fe-tip">
                  Steps: <strong>Start Camera</strong> → <strong>Scan &amp; Enroll</strong> → turn head left when asked → look straight to capture
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
