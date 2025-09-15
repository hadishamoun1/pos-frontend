import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "./TrialBalance.css";

/**
 * Filters added:
 * - mainFrom, mainTo (dropdowns)
 * - subFrom, subTo (dropdowns; refetched when main range changes)
 * - level (numeric)
 * - currency (dropdown)
 * - invoiceType (dropdown)
 *
 * Adjust the OPTION_ENDPOINTS section if your API paths differ.
 */

const OPTION_ENDPOINTS = {
  mainAccounts: "http://localhost:3000/accounts/main",
  subAccounts:  "http://localhost:3000/accounts/sub",
  currencies:   "http://localhost:3000/currencies",
  // if you have invoice types endpoint, add it here; otherwise we fallback
};

export default function TrialBalance() {
  const today = new Date().toISOString().split("T")[0];

  // dates
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  // filters
  const [level, setLevel] = useState(3);          // numeric level depth
  const [currency, setCurrency] = useState("");   // currency code
  const [invoiceType, setInvoiceType] = useState("ALL"); // ALL | S | G | ...

  const [mainFrom, setMainFrom] = useState("");
  const [mainTo, setMainTo] = useState("");
  const [subFrom, setSubFrom] = useState("");
  const [subTo, setSubTo] = useState("");

  // options
  const [mainOptions, setMainOptions] = useState([]);
  const [subOptions, setSubOptions]   = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const invoiceTypeOptions = ["ALL", "S", "G"]; // fallback; adjust if you have more

  // data
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  const printRef = useRef(null);

  const fmt = (v) => {
    const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v ?? 0);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totals = useMemo(() => {
    const debit = rows.reduce((a, r) => a + (Number(r.debit) || 0), 0);
    const credit = rows.reduce((a, r) => a + (Number(r.credit) || 0), 0);
    return { debit, credit, diff: debit - credit };
  }, [rows]);

  // ---------- Fetch options ----------
  useEffect(() => {
    const fetchMainAccounts = async () => {
      try {
        const res = await axios.get(OPTION_ENDPOINTS.mainAccounts);
        // map to {value, label}
        const data = Array.isArray(res.data) ? res.data : res.data?.rows || [];
        const mapped = data.map((a) => ({
          value: a.code ?? a.accountCode ?? a.id ?? "",
          label: `${a.code ?? a.accountCode ?? ""} — ${a.name ?? a.accountName ?? ""}`.trim(),
        })).filter(opt => opt.value);
        setMainOptions(mapped);
        if (!mainFrom && mapped[0]) setMainFrom(mapped[0].value);
        if (!mainTo && mapped[mapped.length - 1]) setMainTo(mapped[mapped.length - 1].value);
      } catch {
        // Safe fallback (edit/remove if not needed)
        const fallback = [
          { value: "1000", label: "1000 — Assets" },
          { value: "2000", label: "2000 — Liabilities" },
          { value: "3000", label: "3000 — Equity" },
          { value: "4000", label: "4000 — Revenue" },
          { value: "5000", label: "5000 — Expenses" },
        ];
        setMainOptions(fallback);
        if (!mainFrom) setMainFrom("1000");
        if (!mainTo) setMainTo("5000");
      }
    };

    const fetchCurrencies = async () => {
      try {
        const res = await axios.get(OPTION_ENDPOINTS.currencies);
        const data = Array.isArray(res.data) ? res.data : res.data?.rows || [];
        const mapped = data.map((c) => ({
          value: c.code ?? c.currencyCode ?? c.id ?? "",
          label: c.code ?? c.currencyCode ?? c.name ?? "",
        })).filter(opt => opt.value);
        setCurrencyOptions(mapped);
        if (!currency && mapped[0]) setCurrency(mapped[0].value);
      } catch {
        // fallback
        const fb = [
          { value: "USD", label: "USD" },
          { value: "LBP", label: "LBP" },
        ];
        setCurrencyOptions(fb);
        if (!currency) setCurrency("USD");
      }
    };

    fetchMainAccounts();
    fetchCurrencies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount

  useEffect(() => {
    const fetchSubAccounts = async () => {
      try {
        const params = {};
        if (mainFrom) params.mainFrom = mainFrom;
        if (mainTo) params.mainTo = mainTo;

        const res = await axios.get(OPTION_ENDPOINTS.subAccounts, { params });
        const data = Array.isArray(res.data) ? res.data : res.data?.rows || [];
        const mapped = data.map((a) => ({
          value: a.code ?? a.accountCode ?? a.id ?? "",
          label: `${a.code ?? a.accountCode ?? ""} — ${a.name ?? a.accountName ?? ""}`.trim(),
        })).filter(opt => opt.value);
        setSubOptions(mapped);

        if (!mapped.length) {
          setSubFrom("");
          setSubTo("");
          return;
        }
        // If current selected sub range falls outside new list, reset to bounds
        const values = mapped.map(m => m.value);
        if (!subFrom || !values.includes(subFrom)) setSubFrom(values[0]);
        if (!subTo   || !values.includes(subTo))   setSubTo(values[values.length - 1]);
      } catch {
        // fallback: synthesize a few subs under the selected main range
        const fb = [
          { value: "1000-01", label: "1000-01 — Cash" },
          { value: "1000-02", label: "1000-02 — Bank" },
          { value: "1000-03", label: "1000-03 — Petty Cash" },
          { value: "4000-01", label: "4000-01 — Sales" },
          { value: "5000-01", label: "5000-01 — COGS" },
        ];
        setSubOptions(fb);
        if (!subFrom) setSubFrom(fb[0].value);
        if (!subTo) setSubTo(fb[fb.length - 1].value);
      }
    };

    fetchSubAccounts();
  }, [mainFrom, mainTo]); // refresh sub accounts when main range changes

  // ---------- Fetch report ----------
  const fetchTB = async () => {
    setLoading(true);
    setErr("");
    try {
      const params = {
        from,
        to,
        level,           // numeric
        currency,        // code
        invoiceType,     // e.g., ALL | S | G
        mainFrom,
        mainTo,
        subFrom,
        subTo,
      };

      const res = await axios.get("http://localhost:3000/reports/trial-balance", { params });

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.rows)
        ? res.data.rows
        : [];

      const normalized = data.map((r, i) => ({
        id: r.id ?? i,
        accountCode: r.accountCode ?? r.code ?? "",
        accountName: r.accountName ?? r.name ?? "",
        debit: Number(r.debit) || 0,
        credit: Number(r.credit) || 0,
      }));

      setRows(normalized);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------- CSV ----------
  const exportCSV = () => {
    const header = ["Account Code", "Account Name", "Debit", "Credit"].join(",");
    const lines = rows.map((r) =>
      [
        `"${(r.accountCode ?? "").replace(/"/g, '""')}"`,
        `"${(r.accountName ?? "").replace(/"/g, '""')}"`,
        fmt(r.debit),
        fmt(r.credit),
      ].join(",")
    );
    const footer = ["", "TOTAL", fmt(totals.debit), fmt(totals.credit)].join(",");
    const csv = [header, ...lines, footer].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Print (A4 iframe technique) ----------
  const handlePrint = () => {
    const root = printRef.current;
    if (!root) return;
    const copiedStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    ).map((n) => n.outerHTML).join("");

    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0",
    });
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  ${copiedStyles}
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    html, body { margin: 0; padding: 0; }
    .tb-a4 {
      width: 190mm;
      min-height: 277mm;
      margin: 0;
      padding: 0 2mm;
      box-shadow: none;
    }
    .tb-title { text-align: center; font-weight: 700; font-size: 18px; margin: 4mm 0; }
    .tb-meta { display: flex; flex-wrap: wrap; gap: 8mm; margin: 2mm 0 4mm 0; font-size: 12px; }
    .tb-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .tb-table th, .tb-table td { border: 1px solid #000; padding: 4px 6px; }
    .tb-table th { background: #f3f4f6; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .totals-row td { font-weight: 700; background: #f9fafb; }
    .tb-table thead th { position: static !important; }
    .tb-table tr { break-inside: avoid; page-break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
  <title>Trial Balance</title>
</head>
<body>
  ${root.innerHTML}
</body>
</html>`);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 200);
    };
  };

  return (
    <div className="tb-wrap">
      {/* Controls */}
      <div className="tb-toolbar">
        <div className="tb-controls tb-controls-grid">
          <label className="tb-field">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>

          <label className="tb-field">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>

          <label className="tb-field">
            Main Acc (From)
            <select value={mainFrom} onChange={(e) => setMainFrom(e.target.value)}>
              {mainOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Main Acc (To)
            <select value={mainTo} onChange={(e) => setMainTo(e.target.value)}>
              {mainOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Sub Acc (From)
            <select value={subFrom} onChange={(e) => setSubFrom(e.target.value)}>
              {subOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Sub Acc (To)
            <select value={subTo} onChange={(e) => setSubTo(e.target.value)}>
              {subOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Level
            <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {[1,2,3,4,5,6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencyOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Invoice Type
            <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
              {invoiceTypeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <button className="tb-btn tb-btn-primary" onClick={fetchTB} disabled={loading}>
            {loading ? "Loading…" : "Generate"}
          </button>
        </div>

        <div className="tb-actions">
          <button className="tb-btn" onClick={exportCSV} disabled={!rows.length}>
            Export CSV
          </button>
          <button className="tb-btn tb-btn-primary" onClick={handlePrint} disabled={!rows.length}>
            Print
          </button>
        </div>
      </div>

      {err && <div className="tb-error">{err}</div>}

      {/* Printable region */}
      <div className="tb-paper" ref={printRef}>
        <div className="tb-a4">
          <div className="tb-title">Trial Balance / ميزان المراجعة</div>
          <div className="tb-meta">
            <div><strong>From:</strong> {from}</div>
            <div><strong>To:</strong> {to}</div>
            <div><strong>Main:</strong> {mainFrom || "—"} → {mainTo || "—"}</div>
            <div><strong>Sub:</strong> {subFrom || "—"} → {subTo || "—"}</div>
            <div><strong>Level:</strong> {level}</div>
            <div><strong>Currency:</strong> {currency || "—"}</div>
            <div><strong>Invoice Type:</strong> {invoiceType}</div>
            <div><strong>Date:</strong> {new Date().toISOString().split("T")[0]}</div>
          </div>

          <table className="tb-table">
            <thead>
              <tr>
                <th style={{ width: "18%" }}>Account Code</th>
                <th>Account Name</th>
                <th style={{ width: "18%" }}>Debit</th>
                <th style={{ width: "18%" }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.accountCode}</td>
                  <td>{r.accountName}</td>
                  <td className="num">{fmt(r.debit)}</td>
                  <td className="num">{fmt(r.credit)}</td>
                </tr>
              ))}
              <tr className="totals-row">
                <td></td>
                <td>Total</td>
                <td className="num">{fmt(totals.debit)}</td>
                <td className="num">{fmt(totals.credit)}</td>
              </tr>
              <tr>
                <td></td>
                <td>Difference (Debit - Credit)</td>
                <td className="num" colSpan={2}>{fmt(totals.diff)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {!rows.length && !loading && !err && (
        <div className="tb-empty">Choose your filters and click Generate.</div>
      )}
    </div>
  );
}
