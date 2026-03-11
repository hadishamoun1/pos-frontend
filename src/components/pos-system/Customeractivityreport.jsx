import React, { useState, useRef } from "react";
import { axiosClient } from "../api/axiosClient";
import "./Customeractivityreport.css";

const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "0.00";
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  if (!isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const isNumberedCustomer = (name) => /^\d+[-\s]/.test((name || "").trim());

export default function CustomerActivityReport() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [type, setType] = useState("ALL");
  const [minInvoices, setMinInvoices] = useState("");
  const [minPaid, setMinPaid] = useState("");
  const [showNumbered, setShowNumbered] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const printRef = useRef(null);

  const fetchReport = async () => {
    if (!from || !to) { setError("Both From and To dates are required."); return; }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const params = { from, to };
      if (type !== "ALL") params.type = type;
      if (minInvoices.trim()) { const n = parseFloat(minInvoices); if (!isNaN(n)) params.minInvoices = n; }
      if (minPaid.trim())     { const n = parseFloat(minPaid);     if (!isNaN(n)) params.minPaid = n; }
      const res = await axiosClient.get("/journal-vouchers/reports/customer-activity", { params });
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = (data?.customers || [])
    .filter((c) => !searchTerm || c.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((c) => showNumbered || !isNumberedCustomer(c.customerName));

  const groupedByCurrency = filteredCustomers.reduce((acc, c) => {
    if (!acc[c.currencyCode]) acc[c.currencyCode] = [];
    acc[c.currencyCode].push(c);
    return acc;
  }, {});

  const handlePrint = () => {
    if (!data) return;
    const printDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const copiedStyles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((n) => n.outerHTML).join("");

    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position: "fixed", right: 0, bottom: 0, width: 0, height: 0, border: 0 });
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"/>
      <title>Customer Activity Report</title>${copiedStyles}
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; font-family: 'Segoe UI', sans-serif; color: #000; background: #fff; font-size: 9pt; }
        .p-header { text-align: center; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px; margin-bottom: 14px; }
        .p-header h1 { margin: 0; font-size: 17pt; font-weight: 800; letter-spacing: 1px; color: #1a1a2e; }
        .p-header .sub { font-size: 11pt; color: #555; margin-top: 3px; }
        .p-meta { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .p-meta-item { background: #f4f4f8; border: 1px solid #ddd; border-radius: 3px; padding: 6px 10px; flex: 1; text-align: center; }
        .p-meta-item strong { display: block; font-size: 7pt; text-transform: uppercase; color: #888; margin-bottom: 2px; }
        .p-meta-item span { font-size: 10pt; font-weight: 700; color: #1a1a2e; }
        .p-summary { display: flex; gap: 8px; margin-bottom: 16px; }
        .p-summary-card { flex: 1; padding: 8px; background: #1a1a2e; color: #fff; border-radius: 3px; text-align: center; }
        .p-summary-card strong { display: block; font-size: 6.5pt; text-transform: uppercase; color: #aab; margin-bottom: 3px; }
        .p-summary-card div { font-size: 11pt; font-weight: 700; }
        .p-section { page-break-inside: avoid; margin-bottom: 20px; }
        .p-section-title { background: #1a1a2e; color: #fff; padding: 7px 12px; font-size: 10pt; font-weight: 700; display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
        th { background: #2d2d44; color: #fff; padding: 6px 8px; text-align: left; font-size: 7.5pt; text-transform: uppercase; }
        th.num, td.num { text-align: right; font-family: 'Courier New', monospace; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) td { background: #f9f9fb; }
        tfoot td { background: #e8e8f0; font-weight: 700; font-size: 9pt; border-top: 2px solid #1a1a2e; }
        .neg { color: #c0392b; font-weight: 700; }
        .pos { color: #1a7a4a; }
      </style></head><body>
      <div class="p-header">
        <h1>Customer Activity Report</h1>
        <div class="sub">تقرير نشاط الزبائن</div>
      </div>
      <div class="p-meta">
        <div class="p-meta-item"><strong>From</strong><span>${data.from}</span></div>
        <div class="p-meta-item"><strong>To</strong><span>${data.to}</span></div>
        <div class="p-meta-item"><strong>Type</strong><span>${data.type}</span></div>
        <div class="p-meta-item"><strong>Generated</strong><span>${printDate}</span></div>
      </div>
      <div class="p-summary">
        <div class="p-summary-card"><strong>Customers</strong><div>${data.summary.totalCustomers}</div></div>
        <div class="p-summary-card"><strong>Total Invoices</strong><div>${fmt(data.summary.totalInvoices)}</div></div>
        <div class="p-summary-card"><strong>Total Paid</strong><div>${fmt(data.summary.totalPaid)}</div></div>
        <div class="p-summary-card"><strong>Net Balance</strong><div>${fmt(data.summary.totalBalance)}</div></div>
      </div>
      ${Object.keys(groupedByCurrency).map((cur) => {
        const custs = groupedByCurrency[cur];
        const totInv = custs.reduce((s, c) => s + c.invoices, 0);
        const totPaid = custs.reduce((s, c) => s + c.paid, 0);
        const totBal = custs.reduce((s, c) => s + c.balance, 0);
        return `
          <div class="p-section">
            <div class="p-section-title"><span>${cur}</span><span>${custs.length} customers</span></div>
            <table>
              <thead><tr>
                <th>Customer Name</th><th>Account #</th>
                <th class="num">Invoices</th><th class="num">Paid</th><th class="num">Balance</th>
              </tr></thead>
              <tbody>
                ${custs.map((c) => `
                  <tr>
                    <td>${c.customerName}</td>
                    <td>${c.customerAccountNumber || "-"}</td>
                    <td class="num">${fmt(c.invoices)}</td>
                    <td class="num">${fmt(c.paid)}</td>
                    <td class="num ${c.balance < 0 ? "neg" : c.balance > 0 ? "pos" : ""}">${fmt(c.balance)}</td>
                  </tr>`).join("")}
              </tbody>
              <tfoot><tr>
                <td colspan="2"><strong>TOTAL ${cur}</strong></td>
                <td class="num"><strong>${fmt(totInv)}</strong></td>
                <td class="num"><strong>${fmt(totPaid)}</strong></td>
                <td class="num"><strong>${fmt(totBal)}</strong></td>
              </tr></tfoot>
            </table>
          </div>`;
      }).join("")}
    </body></html>`);
    doc.close();
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 200);
    };
  };

  return (
    <div className="car-page">
      {/* ── Header ── */}
      <div className="car-page-header">
        <div className="car-page-title">
          <h2>Customer Activity Report</h2>
          <span className="car-page-subtitle">تقرير نشاط الزبائن</span>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="car-controls">
        <div className="car-controls-row">
          <label className="car-field">
            <span>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={loading} />
          </label>
          <label className="car-field">
            <span>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={loading} />
          </label>
          <label className="car-field">
            <span>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
              <option value="S">S — Sales</option>
              <option value="G">G — Offers</option>
              <option value="ALL">All</option>
            </select>
          </label>
          <label className="car-field">
            <span>Min Invoices</span>
            <input type="number" step="0.01" placeholder="0.00" value={minInvoices}
              onChange={(e) => setMinInvoices(e.target.value)} disabled={loading} />
          </label>
          <label className="car-field">
            <span>Min Paid</span>
            <input type="number" step="0.01" placeholder="0.00" value={minPaid}
              onChange={(e) => setMinPaid(e.target.value)} disabled={loading} />
          </label>
        </div>

        <div className="car-controls-row car-controls-row--actions">
          <label className="car-checkbox-label">
            <input type="checkbox" checked={showNumbered}
              onChange={(e) => setShowNumbered(e.target.checked)} disabled={loading} />
            <span>Show numbered customers</span>
          </label>

          <button className="car-btn car-btn--primary" onClick={fetchReport} disabled={loading}>
            {loading ? <span className="car-spinner" /> : null}
            {loading ? "Loading…" : "Generate"}
          </button>
          {data && (
            <button className="car-btn car-btn--ghost" onClick={handlePrint} disabled={loading}>
              Print
            </button>
          )}
        </div>
      </div>

      {error && <div className="car-error">{error}</div>}

      {/* ── Results ── */}
      {data && (
        <div ref={printRef}>
          {/* Summary cards */}
          <div className="car-summary">
            <div className="car-summary-card">
              <span className="car-summary-label">Customers</span>
              <span className="car-summary-value">{data.summary.totalCustomers}</span>
            </div>
            <div className="car-summary-card car-summary-card--invoices">
              <span className="car-summary-label">Total Invoices</span>
              <span className="car-summary-value">{fmt(data.summary.totalInvoices)}</span>
            </div>
            <div className="car-summary-card car-summary-card--paid">
              <span className="car-summary-label">Total Paid</span>
              <span className="car-summary-value">{fmt(data.summary.totalPaid)}</span>
            </div>
            <div className="car-summary-card car-summary-card--balance">
              <span className="car-summary-label">Net Balance</span>
              <span className={`car-summary-value ${data.summary.totalBalance < 0 ? "car-neg" : "car-pos"}`}>
                {fmt(data.summary.totalBalance)}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="car-search-bar">
            <input type="text" placeholder="Search customers…" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="car-search-input" />
            <span className="car-search-count">
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}
            </span>
          </div>

          {Object.keys(groupedByCurrency).length === 0 && (
            <div className="car-empty">No activity found for the selected period.</div>
          )}

          {Object.keys(groupedByCurrency).map((currency) => {
            const custs = groupedByCurrency[currency];
            const totInv  = custs.reduce((s, c) => s + c.invoices, 0);
            const totPaid = custs.reduce((s, c) => s + c.paid, 0);
            const totBal  = custs.reduce((s, c) => s + c.balance, 0);

            return (
              <div key={currency} className="car-currency-group">
                <div className="car-currency-header">
                  <span className="car-currency-label">{currency}</span>
                  <div className="car-currency-totals">
                    <span>Inv: <strong>{fmt(totInv)}</strong></span>
                    <span>Paid: <strong>{fmt(totPaid)}</strong></span>
                    <span>Bal: <strong className={totBal < 0 ? "car-neg" : "car-pos"}>{fmt(totBal)}</strong></span>
                  </div>
                </div>

                <table className="car-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Account #</th>
                      <th className="car-th-num">Invoices</th>
                      <th className="car-th-num">Paid</th>
                      <th className="car-th-num">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custs.map((c) => (
                      <tr key={c.customerId} className={c.balance < 0 ? "car-row-neg" : ""}>
                        <td>{c.customerName}</td>
                        <td className="car-td-acc">{c.customerAccountNumber || "—"}</td>
                        <td className="car-td-num">{fmt(c.invoices)}</td>
                        <td className="car-td-num">{fmt(c.paid)}</td>
                        <td className={`car-td-num ${c.balance < 0 ? "car-neg" : c.balance > 0 ? "car-pos" : ""}`}>
                          {fmt(c.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="car-tfoot-row">
                      <td colSpan={2}><strong>Total {currency}</strong></td>
                      <td className="car-td-num"><strong>{fmt(totInv)}</strong></td>
                      <td className="car-td-num"><strong>{fmt(totPaid)}</strong></td>
                      <td className={`car-td-num ${totBal < 0 ? "car-neg" : "car-pos"}`}>
                        <strong>{fmt(totBal)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}