import React, { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";

export default function ApiDelaySettings() {
  const [delayMs, setDelayMs] = useState(0);
  const [input, setInput] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // "saved" | "error"

  useEffect(() => {
    axiosClient
      .get("/settings/delay")
      .then((r) => {
        setDelayMs(r.data.delayMs);
        setInput(String(r.data.delayMs));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSlider = (e) => {
    const v = Number(e.target.value);
    setDelayMs(v);
    setInput(String(v));
    setStatus(null);
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    const v = Number(e.target.value);
    if (!isNaN(v)) {
      setDelayMs(Math.max(0, Math.min(30000, v)));
    }
    setStatus(null);
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const r = await axiosClient.post("/settings/delay", { delayMs });
      setDelayMs(r.data.delayMs);
      setInput(String(r.data.delayMs));
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const label =
    delayMs === 0
      ? "No delay (normal)"
      : delayMs < 1000
      ? `${delayMs} ms`
      : `${(delayMs / 1000).toFixed(1)} s`;

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h2 style={{ marginTop: 0, marginBottom: 6 }}>API Response Delay</h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
        Adds an artificial delay to every API response. Useful for simulating
        slow network conditions. Set to 0 to disable.
      </p>

      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
        <input
          type="range"
          min={0}
          max={10000}
          step={100}
          value={delayMs}
          onChange={handleSlider}
          style={{ flex: 1, accentColor: "#0072c6" }}
        />
        <input
          type="number"
          min={0}
          max={30000}
          step={100}
          value={input}
          onChange={handleInput}
          style={{
            width: 90,
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 14,
            textAlign: "right",
          }}
        />
        <span style={{ width: 30, fontSize: 13, color: "#555" }}>ms</span>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 22,
          fontWeight: 700,
          color: delayMs === 0 ? "#28a745" : delayMs < 2000 ? "#f0ad4e" : "#dc3545",
          marginBottom: 24,
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "8px 28px",
            background: "#0072c6",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>

        {status === "saved" && (
          <span style={{ color: "#28a745", fontSize: 14 }}>✓ Saved</span>
        )}
        {status === "error" && (
          <span style={{ color: "#dc3545", fontSize: 14 }}>Failed to save</span>
        )}
      </div>

      <div style={{ marginTop: 32, fontSize: 13, color: "#888" }}>
        <strong>Note:</strong> This delay is stored in memory and resets to 0
        when the server restarts.
      </div>
    </div>
  );
}
