import React, { useCallback, useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./InvoiceTypeConverter.css";
import "./JournalAudit.css";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");

const fmtStamp = (d) => (d ? new Date(d).toLocaleString() : "—");

// Same idea as ExchangeRateAudit: keep the scan when the user leaves the page
// to fix a receipt and comes back.
const SESSION_KEY = "receivableDuplicateAudit_state";
const saved = (() => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
})();

const startOfYear = () => `${new Date().getFullYear()}-01-01`;

// One receipt per row; used by both sections.
const ReceiptRows = ({ receipts }) =>
  receipts.map((r) => (
    <tr key={r.id} className="ja-row-bad">
      <td className="itc-inv-num">{r.jvNumber || `#${r.id}`}</td>
      <td>{fmtDate(r.date)}</td>
      <td className="itc-dim">{fmtStamp(r.createdAt)}</td>
      <td>{r.type}</td>
      <td>{r.pmtType || "—"}</td>
      <td className="num">
        {fmt(r.cashNumber)} {r.currency}
      </td>
      <td className="num">{fmt(r.usdAmount)}</td>
      <td>{r.invoiceNumber || "—"}</td>
      <td className="itc-dim">{r.comments || ""}</td>
    </tr>
  ));

const ReceiptHead = () => (
  <tr>
    <th>Receipt #</th>
    <th>Date</th>
    <th>Entered At</th>
    <th>Type</th>
    <th>Payment</th>
    <th className="num">Amount</th>
    <th className="num">USD</th>
    <th>Invoice</th>
    <th>Comments</th>
  </tr>
);

export default function ReceivableDuplicateAudit() {
  const [from, setFrom] = useState(saved?.from ?? startOfYear());
  const [to, setTo] = useState(saved?.to ?? "");
  const [windowDays, setWindowDays] = useState(saved?.windowDays ?? "7");
  const [tolerance, setTolerance] = useState(saved?.tolerance ?? "1");
  const [data, setData] = useState(saved?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ from, to, windowDays, tolerance, data }));
    } catch {}
  }, [from, to, windowDays, tolerance, data]);

  const handleScan = useCallback(async () => {
    setErr("");
    setData(null);
    setLoading(true);
    try {
      const params = { windowDays, tolerance };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axiosClient.get("/recievables/duplicate-audit", { params });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to scan.");
    } finally {
      setLoading(false);
    }
  }, [from, to, windowDays, tolerance]);

  const overpaid = data?.overpaid ?? [];
  const duplicates = data?.duplicates ?? [];
  const isClean = data && overpaid.length === 0 && duplicates.length === 0;

  return (
    <div className="itc-page ja-page">
      <div className="itc-header">
        <h1 className="itc-title">Receivable Duplicate Audit</h1>
        <p className="itc-subtitle">
          Finds receipts that look entered twice: receipts for the same customer with about the same
          amount a few days apart, and invoices whose receipts add up to more than the invoice total.
          Small differences up to the tolerance are treated as rounding.
        </p>
      </div>

      <section className="itc-section">
        <div className="itc-section-title">Scan Range</div>
        <div className="itc-filters">
          <div className="itc-field">
            <label>From</label>
            <input type="date" className="itc-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="itc-field">
            <label>To (optional)</label>
            <input type="date" className="itc-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="itc-field">
            <label>Within (days)</label>
            <input
              type="number"
              min="0"
              className="itc-input"
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value)}
            />
          </div>
          <div className="itc-field">
            <label>Amount tolerance ($)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="itc-input"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
            />
          </div>
          <div className="itc-field itc-field-btn">
            <button type="button" className="itc-btn itc-btn-primary" onClick={handleScan} disabled={loading}>
              {loading ? "Scanning…" : "Scan"}
            </button>
          </div>
        </div>
        {err && <div className="itc-error">{err}</div>}
      </section>

      {data && (
        <>
          <section className="itc-section">
            <div className={`itc-result ${isClean ? "itc-result-ok" : "itc-result-warn"}`}>
              Scanned {data.scannedReceipts} receipt{data.scannedReceipts === 1 ? "" : "s"} —{" "}
              {isClean ? (
                "nothing suspicious found."
              ) : (
                <>
                  <strong>{duplicates.length}</strong> possible duplicate group
                  {duplicates.length === 1 ? "" : "s"}, <strong>{overpaid.length}</strong> overpaid invoice
                  {overpaid.length === 1 ? "" : "s"}.
                </>
              )}
            </div>
          </section>

          <section className="itc-section">
            <div className="itc-section-title">
              Possible Duplicates — Same Customer, Amount ±{fmt(data.tolerance)}, Within {data.windowDays} Day
              {data.windowDays === 1 ? "" : "s"}
              <span className={`itc-badge ${duplicates.length ? "ja-badge-bad" : "itc-badge-green"}`}>
                {duplicates.length}
              </span>
            </div>
            {duplicates.length === 0 ? (
              <p className="ja-empty">No repeated receipts found.</p>
            ) : (
              duplicates.map((g) => (
                <div key={g.receipts.map((r) => r.id).join("-")} style={{ marginBottom: 18 }}>
                  <div style={{ marginBottom: 6 }}>
                    <strong>{g.customerName || "—"}</strong> — {g.receipts.length} receipts of{" "}
                    <strong>
                      {g.minAmountUsd === g.maxAmountUsd
                        ? fmt(g.minAmountUsd)
                        : `${fmt(g.minAmountUsd)} – ${fmt(g.maxAmountUsd)}`}
                    </strong>{" "}
                    USD
                    {g.sameInvoice && (
                      <span className="ja-badge-bad itc-badge" style={{ marginLeft: 8 }}>
                        same invoice
                      </span>
                    )}
                  </div>
                  <div className="itc-table-wrap">
                    <table className="itc-table">
                      <thead>
                        <ReceiptHead />
                      </thead>
                      <tbody>
                        <ReceiptRows receipts={g.receipts} />
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>
          <section className="itc-section">
            <div className="itc-section-title">
              Invoices Received More Than Their Total
              <span className={`itc-badge ${overpaid.length ? "ja-badge-bad" : "itc-badge-green"}`}>
                {overpaid.length}
              </span>
            </div>
            {overpaid.length === 0 ? (
              <p className="ja-empty">No invoice has received more than its total.</p>
            ) : (
              overpaid.map((inv) => (
                <div key={inv.invoiceId} style={{ marginBottom: 18 }}>
                  <div style={{ marginBottom: 6 }}>
                    <strong>{inv.invoiceNumber}</strong> ({inv.invoiceType}, {fmtDate(inv.invoiceDate)}) —{" "}
                    {inv.customerName || "—"} — total <strong>{fmt(inv.invoiceTotalUsd)}</strong>, received{" "}
                    <strong>{fmt(inv.receivedUsd)}</strong>,{" "}
                    <span className="ja-badge-bad itc-badge">over by {fmt(inv.overByUsd)}</span>
                  </div>
                  <div className="itc-table-wrap">
                    <table className="itc-table">
                      <thead>
                        <ReceiptHead />
                      </thead>
                      <tbody>
                        <ReceiptRows receipts={inv.receipts} />
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>

        </>
      )}
    </div>
  );
}
