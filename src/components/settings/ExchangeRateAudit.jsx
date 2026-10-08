import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { axiosClient } from "../api/axiosClient";
import "./InvoiceTypeConverter.css";
import "./JournalAudit.css";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");

// The standard rate must match EXCHANGE_RATE_OPTIONS in
// pos-system/Components/CustomerDetails.jsx — kept as a separate constant
// here (not imported) since this audit is a reporting tool, not part of the
// POS entry flow; the "Expected Rate" field lets you override it ad hoc if
// that standard ever changes or you want to check against a different value.
const DEFAULT_EXPECTED_RATE = "89500";

// Persist filters + results so clicking "Open" on a mismatch (navigating to
// the POS page) and then coming back doesn't throw away the scan — same
// pattern AccountStatement.jsx uses for the same reason.
const SESSION_KEY = "exchangeRateAudit_state";
const saved = (() => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
})();

export default function ExchangeRateAudit() {
  const [expectedRate, setExpectedRate] = useState(saved?.expectedRate ?? DEFAULT_EXPECTED_RATE);
  const [from, setFrom] = useState(saved?.from ?? "");
  const [to, setTo] = useState(saved?.to ?? "");
  const [data, setData] = useState(saved?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expectedRate, from, to, data }));
    } catch {}
  }, [expectedRate, from, to, data]);

  const handleScan = useCallback(async () => {
    setErr("");
    setData(null);
    setLoading(true);
    try {
      const params = { expectedRate };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axiosClient.get("/invoices/v1/exchange-rate-audit", { params });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to scan.");
    } finally {
      setLoading(false);
    }
  }, [expectedRate, from, to]);

  const mismatchCount = data?.mismatchCount ?? 0;
  const isClean = data && mismatchCount === 0;

  return (
    <div className="itc-page ja-page">
      <div className="itc-header">
        <h1 className="itc-title">Exchange Rate Audit</h1>
        <p className="itc-subtitle">
          Scans every sales invoice and flags any whose stored exchange rate doesn't match the
          standard rate selectable in the POS page's dropdown — catches invoices saved with a
          stale or broken rate (e.g. "1") instead of the real one.
        </p>
      </div>

      <section className="itc-section">
        <div className="itc-section-title">Scan Range</div>
        <div className="itc-filters">
          <div className="itc-field">
            <label>Expected Rate</label>
            <input
              type="number"
              className="itc-input"
              value={expectedRate}
              onChange={(e) => setExpectedRate(e.target.value)}
            />
          </div>
          <div className="itc-field">
            <label>From (optional)</label>
            <input
              type="date"
              className="itc-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="itc-field">
            <label>To (optional)</label>
            <input
              type="date"
              className="itc-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
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
              Scanned {data.scannedInvoices} invoice{data.scannedInvoices === 1 ? "" : "s"} against
              expected rate <strong>{fmt(data.expectedRate)}</strong> —{" "}
              {isClean ? (
                "nothing wrong found."
              ) : (
                <>
                  <strong>{mismatchCount}</strong> invoice{mismatchCount === 1 ? "" : "s"} with a
                  different rate.
                </>
              )}
            </div>
          </section>

          <section className="itc-section">
            <div className="itc-section-title">
              Rate Mismatches
              <span className={`itc-badge ${mismatchCount ? "ja-badge-bad" : "itc-badge-green"}`}>
                {mismatchCount}
              </span>
            </div>
            {mismatchCount === 0 ? (
              <p className="ja-empty">Every invoice uses the expected rate.</p>
            ) : (
              <div className="itc-table-wrap">
                <table className="itc-table">
                  <thead>
                    <tr>
                      <th>Invoice Number</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Customer</th>
                      <th className="num">Stored Rate</th>
                      <th className="num">Expected Rate</th>
                      <th className="num">Grand Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mismatches.map((m) => (
                      <tr key={m.invoiceId} className="ja-row-bad">
                        <td className="itc-inv-num">{m.invoiceNumber}</td>
                        <td>{fmtDate(m.date)}</td>
                        <td>{m.invoiceType}</td>
                        <td className="itc-dim">{m.customerName || "—"}</td>
                        <td className="num">
                          <span className="ja-badge-bad itc-badge">{fmt(m.currencyRate)}</span>
                        </td>
                        <td className="num">{fmt(m.expectedRate)}</td>
                        <td className="num">{fmt(m.grandTotal)}</td>
                        <td>
                          <Link
                            to={`/pos-system?openInvoiceId=${m.invoiceId}&openInvoiceType=${m.invoiceType}`}
                            className="ja-link"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
