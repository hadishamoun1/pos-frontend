import React, { useEffect, useState } from "react";
import axios from "axios";
import "./StatementModal.css";
import StatementReportModal from "./StatementReportModal"; // ⬅️ ADDED

const StatementModal = ({ isOpen, onClose, customerId, defaultDate }) => {
  // Hooks (unconditional)
  const today = defaultDate || new Date().toISOString().split("T")[0];
  const [type, setType] = useState("ALL"); // NEW: S | G | ALL
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // ⬅️ ADDED: controls the in-app report popup
const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFrom(today);
      setTo(today);
      setType("ALL");   // reset to ALL on open
      setData(null);
      setErr("");
    }
  }, [isOpen, today]);

  // format numbers with commas and 2 decimals (handles strings too)
  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fetchStatement = async () => {
    if (!customerId) return;
    setLoading(true);
    setErr("");
    setData(null);

    try {
      const params = { from, to };
      // Only send type when not "ALL"
      if (type !== "ALL") params.type = type;

      const res = await axios.get(
        `http://localhost:3000/journal-vouchers/statements/customers/${customerId}`,
        { params }
      );
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  // OPEN REPORT POPUP (replaced new-tab with modal, but kept your code commented)
  const openReport = () => {
    if (!customerId) return;

    // ⬇️ OPEN THE IN-APP POPUP
    setShowReportModal(true);

    // Your original "open in new tab" code kept here (not deleted):
    // const params = new URLSearchParams({
    //   from,
    //   to,
    //   ...(type !== "ALL" ? { type } : {}),
    // }).toString();
    // window.open(
    //   `http://localhost:3000/journal-vouchers/statements/customers/${customerId}/report?${params}`,
    //   "_blank"
    // );
  };

  if (!isOpen) return null;

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pos-modal-header">
          <h2>كشف حساب</h2>
          <button className="pos-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* CONTROLS ROW WITH REPORT ON FAR RIGHT */}
        <div className="pos-modal-controls">
          <div className="controls-left">
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="S">S</option>
                <option value="G">G</option>
                <option value="ALL">All</option>
              </select>
            </label>

            <label>
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>

            <label>
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>

            <button
              className="pos-page-toolbar-button pos-page-blue-button"
              onClick={fetchStatement}
              disabled={loading || !customerId}
            >
              {loading ? "Loading..." : "Generate"}
            </button>
          </div>

          <div className="controls-right">
            <button
              className="statement-report-button"
              onClick={() => setShowReportModal(true)}
              disabled={!customerId}
            >
              Report
            </button>
          </div>
        </div>

        {err && <div className="pos-modal-error">{err}</div>}

        {data && (
          <div className="pos-modal-body">
            <div className="stmt-summary">
              <div><strong>رصيد سابق:</strong> {fmt(data.openingBalance.toFixed(2))}</div>
              <div><strong>مجموع الفواتير:</strong> {fmt(data.totals?.totalDebit.toFixed(2))}</div>
              <div><strong>مجموع الدفعات:</strong> {fmt(data.totals?.totalCredit.toFixed(2))}</div>
              <div><strong>رصيد:</strong> {fmt(data.closingBalance.toFixed(2))}</div>
            </div>
            <div className="stmt-table-wrap">
              <table className="stmt-table">
                <thead>
                  <tr>
                    <th>رصيد</th>
                    <th>لكم</th>
                    <th>عليكم</th>
                    <th>شرح</th>
                    <th>رقم الفاتورة</th>
                    <th>تاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items?.map((r, i) => (
                    <tr key={i}>
                      <td>{fmt(Number(r.balanceAfter || 0).toFixed(2))}</td>
                      <td>{fmt(Number(r.credit || 0).toFixed(2))}</td>
                      <td>{fmt(Number(r.debit || 0).toFixed(2))}</td>
                      <td>{r.description}</td>
                      <td>{r.docNbr}</td>
                      <td>{String(r.date).split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ⬇️ ADDED: A4 report popup overlay (opens above this modal) */}
       <StatementReportModal
  open={showReportModal}
  onClose={() => setShowReportModal(false)}
  data={data}
  from={from}
  to={to}
  type={type}
/>
      </div>
    </div>
  );
};

export default StatementModal;
