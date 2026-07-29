import React, { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";

const fmt4 = (v) => Number(v).toFixed(4);

export default function SqmPiecesMaintenance() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState("");
  const [fixResult, setFixResult] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    setFixResult(null);
    try {
      const { data } = await axiosClient.get("/sqm-pieces/debug-raw");
      setRows(data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load pieces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFix = async () => {
    if (!window.confirm("This will recalculate sqmRemaining for all pieces where it is incorrect (sqmRemaining ≠ sqmTotal − sqmSold − sqmTrash). Proceed?")) return;
    setFixing(true);
    setError("");
    setFixResult(null);
    try {
      const { data } = await axiosClient.post("/sqm-pieces/fix-remaining");
      setFixResult(data.fixed);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Fix failed.");
    } finally {
      setFixing(false);
    }
  };

  const isWrong = (r) => {
    const correct = Math.max(0, r.sqmTotal - r.sqmSold - r.sqmTrash);
    return Math.abs(r.sqmRemaining - correct) > 0.0001;
  };

  const displayed = rows.filter((r) => {
    if (filter === "wrong") return isWrong(r);
    if (filter === "zero") return r.sqmRemaining === 0;
    return true;
  });

  const wrongCount = rows.filter(isWrong).length;

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: "100%" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>SQM Pieces Maintenance</h2>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Shows all rows in the <code>sqm_pieces</code> table. Rows highlighted in red have an incorrect
        <code> sqmRemaining</code> (does not equal <code>sqmTotal − sqmSold − sqmTrash</code>).
      </p>

      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {fixResult !== null && (
        <div style={{ background: "#dcfce7", color: "#16a34a", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          Fixed {fixResult} piece row{fixResult !== 1 ? "s" : ""}.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={load} disabled={loading} style={btnStyle("#2563eb")}>
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button onClick={handleFix} disabled={fixing || loading} style={btnStyle("#dc2626")}>
          {fixing ? "Fixing…" : `Fix Wrong Rows${wrongCount ? ` (${wrongCount})` : ""}`}
        </button>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {["all", "wrong", "zero"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: "1px solid",
                background: filter === f ? "#1e40af" : "#fff",
                color: filter === f ? "#fff" : "#374151",
                borderColor: filter === f ? "#1e40af" : "#d1d5db",
              }}
            >
              {f === "all" ? `All (${rows.length})` : f === "wrong" ? `Wrong (${wrongCount})` : `Zero Remaining (${rows.filter(r => r.sqmRemaining === 0).length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "#fff" }}>
              {["ID", "TransferItem ID", "Length", "Width", "Pieces", "sqmTotal", "sqmSold", "sqmTrash", "sqmRemaining", "Expected Remaining", "Active", "Status"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>
                  {loading ? "Loading…" : "No rows found."}
                </td>
              </tr>
            ) : (
              displayed.map((r) => {
                const expected = Math.max(0, r.sqmTotal - r.sqmSold - r.sqmTrash);
                const wrong = Math.abs(r.sqmRemaining - expected) > 0.0001;
                return (
                  <tr
                    key={r.id}
                    style={{
                      background: wrong ? "#fee2e2" : r.sqmRemaining === 0 ? "#fefce8" : "#fff",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={td}>{r.id}</td>
                    <td style={td}>{r.transferItemId}</td>
                    <td style={td}>{r.length}</td>
                    <td style={td}>{r.width}</td>
                    <td style={td}>{r.piecesCount}</td>
                    <td style={td}>{fmt4(r.sqmTotal)}</td>
                    <td style={td}>{fmt4(r.sqmSold)}</td>
                    <td style={td}>{fmt4(r.sqmTrash)}</td>
                    <td style={{ ...td, fontWeight: 700, color: wrong ? "#dc2626" : r.sqmRemaining > 0 ? "#16a34a" : "#374151" }}>
                      {fmt4(r.sqmRemaining)}
                    </td>
                    <td style={{ ...td, color: "#6b7280" }}>{fmt4(expected)}</td>
                    <td style={td}>{r.isActive ? "✓" : "✗"}</td>
                    <td style={td}>
                      {wrong
                        ? <span style={{ color: "#dc2626", fontWeight: 700 }}>Wrong</span>
                        : r.sqmRemaining === 0
                        ? <span style={{ color: "#d97706" }}>Zero</span>
                        : <span style={{ color: "#16a34a" }}>OK</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const td = { padding: "6px 10px", whiteSpace: "nowrap" };
const btnStyle = (bg) => ({
  padding: "7px 16px", borderRadius: 7, border: "none", background: bg,
  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
});
