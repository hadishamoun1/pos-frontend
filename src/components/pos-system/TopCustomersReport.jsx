import React, { useCallback, useRef, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./TopCustomersReport.css";

const fmt = (n) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TopCustomersReport() {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [fetched, setFetched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      if (from) params.from = from;
      if (to)   params.to   = to;
      const { data } = await axiosClient.get("/reports/top-customers", { params });
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setTotal(list.reduce((s, r) => s + Number(r.grandTotal || 0), 0));
      setFetched(true);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const today = new Date().toLocaleDateString("en-GB");

  return (
    <div className="tcr-wrap">
      {/* ── Controls (hidden on print) ── */}
      <div className="tcr-controls no-print">
        <h2 className="tcr-title">Top Customers Report</h2>
        <p className="tcr-subtitle">Sales invoices (S and RVR) ranked by grand total</p>

        <div className="tcr-filters">
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="tcr-btn tcr-btn-load" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Load Report"}
          </button>
          {fetched && rows.length > 0 && (
            <button className="tcr-btn tcr-btn-print" onClick={() => window.print()}>
              Print
            </button>
          )}
        </div>

        {err && <div className="tcr-error">{err}</div>}
      </div>

      {/* ── Print header (visible only on print) ── */}
      <div className="tcr-print-header print-only">
        <div className="tcr-print-title">Top Customers Report</div>
        <div className="tcr-print-meta">
          Invoice Types: S / RVR
          {from || to
            ? `   |   Period: ${from || "—"} → ${to || "—"}`
            : "   |   All dates"}
          {"   |   Generated: " + today}
        </div>
      </div>

      {/* ── Table ── */}
      {fetched && (
        <div className="tcr-table-wrap">
          {rows.length === 0 ? (
            <div className="tcr-empty no-print">No data found.</div>
          ) : (
            <table className="tcr-table">
              <thead>
                <tr>
                  <th className="tcr-col-num">#</th>
                  <th className="tcr-col-name">Customer Name</th>
                  <th className="tcr-col-fin">Financial Account</th>
                  <th className="tcr-col-total">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 1 ? "tcr-row-alt" : ""}>
                    <td className="tcr-col-num">{i + 1}</td>
                    <td className="tcr-col-name">{r.customerName}</td>
                    <td className="tcr-col-fin">{r.financialNumber}</td>
                    <td className="tcr-col-total">{fmt(r.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tcr-totals-row">
                  <td colSpan={3} className="tcr-totals-label">Total</td>
                  <td className="tcr-col-total">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
