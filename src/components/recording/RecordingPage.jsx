import React, { useCallback, useEffect, useRef, useState } from "react";
import "./RecordingPage.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

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
  if (!res.ok) throw new Error(data?.message || `${res.status}`);
  return data;
}

function timeAgo(dateStr) {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function formatBytes(b) {
  if (!b) return "0 B";
  const n = Number(b);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

export default function RecordingPage() {
  const [devices, setDevices] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [selectedPcId, setSelectedPcId] = useState(null);
  const [playingFile, setPlayingFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [cmdBusy, setCmdBusy] = useState({});
  const pollRef = useRef(null);
  const videoRef = useRef(null);

  const loadDevices = useCallback(async () => {
    try {
      const data = await apiFetch("/recording/devices");
      setDevices(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Failed to load devices");
    }
  }, []);

  const loadRecordings = useCallback(async (pcId) => {
    setLoading(true);
    try {
      const url = pcId ? `/recording/files?pcId=${encodeURIComponent(pcId)}` : "/recording/files";
      const data = await apiFetch(url);
      setRecordings(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Failed to load recordings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    loadRecordings(null);
    pollRef.current = setInterval(loadDevices, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadDevices, loadRecordings]);

  useEffect(() => {
    loadRecordings(selectedPcId);
  }, [selectedPcId, loadRecordings]);

  async function sendCommand(pcId, command) {
    setCmdBusy((p) => ({ ...p, [pcId]: true }));
    setErr("");
    try {
      await apiFetch(`/recording/command/${encodeURIComponent(pcId)}`, {
        method: "POST",
        body: JSON.stringify({ command }),
      });
      await loadDevices();
    } catch (e) {
      setErr(e?.message || "Command failed");
    } finally {
      setCmdBusy((p) => ({ ...p, [pcId]: false }));
    }
  }

  async function deleteRecording(id) {
    if (!window.confirm("Delete this recording?")) return;
    try {
      await apiFetch(`/recording/files/${id}`, { method: "DELETE" });
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      if (playingFile?.id === id) setPlayingFile(null);
    } catch (e) {
      setErr(e?.message || "Delete failed");
    }
  }

  function playRecording(rec) {
    setPlayingFile(rec);
    setTimeout(() => {
      videoRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  const streamUrl = playingFile
    ? `${API_BASE}/recording/stream/${encodeURIComponent(playingFile.filename)}?token=${getToken()}`
    : null;

  // Token in URL won't work with JWT guard — use fetch with auth header instead
  // We'll use a blob URL approach
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!playingFile) { setBlobUrl(null); return; }
    let objectUrl = null;
    const token = getToken();
    fetch(`${API_BASE}/recording/stream/${encodeURIComponent(playingFile.filename)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setErr("Failed to load video"));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [playingFile]);

  const filteredRecordings = selectedPcId
    ? recordings.filter((r) => r.pcId === selectedPcId)
    : recordings;

  return (
    <div className="rp-page">
      <div className="rp-header">
        <div>
          <h2 className="rp-title">Recording Control</h2>
          <p className="rp-subtitle">Start and stop camera recording on any registered PC.</p>
        </div>
        <button className="rp-refresh-btn" onClick={() => { loadDevices(); loadRecordings(selectedPcId); }}>
          Refresh
        </button>
      </div>

      {err && <div className="rp-error">{err}</div>}

      {/* ── Devices ── */}
      <div className="rp-section-title">Registered PCs</div>
      {!devices.length ? (
        <div className="rp-empty">No PCs registered yet. Run the agent on a PC to register it.</div>
      ) : (
        <div className="rp-devices">
          {devices.map((d) => (
            <div key={d.pcId} className={`rp-device-card ${d.status === "recording" ? "recording" : ""}`}>
              <div className="rp-device-top">
                <div>
                  <div className="rp-device-name">{d.pcName}</div>
                  <div className="rp-device-id">{d.pcId}</div>
                </div>
                <div className={`rp-device-badge ${d.online ? (d.status === "recording" ? "badge-rec" : "badge-online") : "badge-offline"}`}>
                  {d.online ? (d.status === "recording" ? "● Recording" : "● Online") : "○ Offline"}
                </div>
              </div>
              <div className="rp-device-meta">Last seen: {timeAgo(d.lastSeen)}</div>
              <div className="rp-device-actions">
                <button
                  className="rp-btn rp-btn-record"
                  disabled={cmdBusy[d.pcId] || d.command === "recording"}
                  onClick={() => sendCommand(d.pcId, "recording")}
                >
                  ▶ Start Recording
                </button>
                <button
                  className="rp-btn rp-btn-stop"
                  disabled={cmdBusy[d.pcId] || d.command === "idle"}
                  onClick={() => sendCommand(d.pcId, "idle")}
                >
                  ■ Stop
                </button>
                <button
                  className={`rp-btn rp-btn-view ${selectedPcId === d.pcId ? "active" : ""}`}
                  onClick={() => setSelectedPcId(selectedPcId === d.pcId ? null : d.pcId)}
                >
                  {selectedPcId === d.pcId ? "All PCs" : "View Recordings"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Video player ── */}
      {playingFile && (
        <div className="rp-player" ref={videoRef}>
          <div className="rp-player-title">
            Playing: <strong>{playingFile.pcName}</strong> — {formatDate(playingFile.recordedAt)}
            <button className="rp-player-close" onClick={() => { setPlayingFile(null); setBlobUrl(null); }}>✕</button>
          </div>
          {blobUrl ? (
            <video className="rp-video" controls autoPlay src={blobUrl} />
          ) : (
            <div className="rp-video-loading">Loading video…</div>
          )}
        </div>
      )}

      {/* ── Recordings list ── */}
      <div className="rp-section-title" style={{ marginTop: 28 }}>
        Recordings {selectedPcId ? `— ${devices.find((d) => d.pcId === selectedPcId)?.pcName || selectedPcId}` : "— All PCs"}
      </div>

      {loading ? (
        <div className="rp-empty">Loading…</div>
      ) : !filteredRecordings.length ? (
        <div className="rp-empty">No recordings found.</div>
      ) : (
        <table className="rp-table">
          <thead>
            <tr>
              <th>PC</th>
              <th>Recorded At</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecordings.map((r) => (
              <tr key={r.id} className={playingFile?.id === r.id ? "rp-row-active" : ""}>
                <td>{r.pcName}</td>
                <td>{formatDate(r.recordedAt)}</td>
                <td>{formatBytes(r.fileSize)}</td>
                <td>
                  <div className="rp-row-actions">
                    <button className="rp-btn rp-btn-play" onClick={() => playRecording(r)}>▶ Play</button>
                    <button className="rp-btn rp-btn-del" onClick={() => deleteRecording(r.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
