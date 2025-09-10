import React, { useEffect, useState } from "react";
import axios from "axios";
import "./StatementModal.css";

const StatementModal = ({ isOpen, onClose, customerId, defaultDate }) => {
  // Hooks (unconditional)
  const today = defaultDate || new Date().toISOString().split("T")[0];
  const [type, setType] = useState("ALL"); // NEW: S | G | ALL
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFrom(today);
      setTo(today);
      setType("ALL");   // reset to ALL on open
      setData(null);
      setErr("");
    }
  }, [isOpen, today]);

  const fetchStatement = async () => {
    if (!customerId) return;
    setLoading(true);
    setErr("");
    setData(null);

    try {
      const params = { from, to };
      // Only send type when not "ALL"
      if (type !== "ALL") params.type = type; // if your backend expects "invoiceType", rename the key here

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

  if (!isOpen) return null;

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pos-modal-header">
          <h3>Account Statement</h3>
          <button className="pos-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="pos-modal-controls">
          {/* REPLACED: Currency → Type */}
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

        {err && <div className="pos-modal-error">{err}</div>}

        {data && (
          <div className="pos-modal-body">
            <div className="stmt-summary">
              <div><strong>Opening:</strong> {data.openingBalance}</div>
              <div><strong>Total Dr:</strong> {data.totals?.totalDebit}</div>
              <div><strong>Total Cr:</strong> {data.totals?.totalCredit}</div>
              <div><strong>Closing:</strong> {data.closingBalance}</div>
            </div>
            <div className="stmt-table-wrap">
              <table className="stmt-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice #</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items?.map((r, i) => (
                    <tr key={i}>
                      <td>{String(r.date).split("T")[0]}</td>
                      <td>{r.docNbr}</td>
                      <td>{r.description}</td>
                      <td>{Number(r.debit || 0).toFixed(2)}</td>
                      <td>{Number(r.credit || 0).toFixed(2)}</td>
                      <td>{Number(r.balanceAfter || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementModal;
