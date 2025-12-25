import React, { useMemo, useState } from "react";
import axiosClient from "../api/axiosClient"; // ✅ use your axiosClient (baseURL: /api)

export default function RecomputeCostsPanel() {
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [fromDate, setFromDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "success"|"error", text: string }

  const runRecompute = async () => {
    setLoading(true);
    setMsg(null);

    try {
      const res = await axiosClient.post("/recompute/recompute-costs", {
        fromDate,
      });

      setMsg({
        type: "success",
        text:
          (res?.data && (res.data.message || res.data.status)) ||
          "Recompute finished successfully.",
      });
    } catch (err) {
      const text =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Recompute failed";
      setMsg({ type: "error", text: String(text) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 10,
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>Recompute from date</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          disabled={loading}
          style={{
            height: 36,
            padding: "0 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />
      </div>

      <button
        onClick={runRecompute}
        disabled={loading || !fromDate}
        style={{
          height: 36,
          padding: "0 14px",
          borderRadius: 8,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Recomputing..." : "Run Recompute"}
      </button>

      {msg && (
        <div
          style={{
            marginLeft: 8,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid",
            borderColor: msg.type === "success" ? "#5cb85c" : "#d9534f",
            color: msg.type === "success" ? "#2d7a2d" : "#a94442",
            background: msg.type === "success" ? "#eef9ee" : "#fdeeee",
            maxWidth: 520,
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
