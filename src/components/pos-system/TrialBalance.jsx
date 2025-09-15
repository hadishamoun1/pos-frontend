import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "./TrialBalance.css";

/**
 * Arranged accounts tree:
 *   GET http://localhost:3000/accounts/v1/acc-flat-arranged
 * New: "Main Acc (codes)" input. Example: 601 or 601,705.
 *  - When filled, it overrides Main From/To and disables those selects.
 *  - Sub accounts are built from any accounts whose code starts with
 *    any prefix, plus all their descendants.
 */

const ARRANGED_ACCOUNTS_ENDPOINT = "http://localhost:3000/accounts/v1/acc-flat-arranged";
const CURRENCIES_ENDPOINT = "http://localhost:3000/currency";

export default function TrialBalance() {
  const today = new Date().toISOString().split("T")[0];

  // dates
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  // filters
  const [level, setLevel] = useState(3);
  const [currency, setCurrency] = useState("");
  const [invoiceType, setInvoiceType] = useState("ALL"); // ALL | S | G

  // account filters
  const [mainFrom, setMainFrom] = useState("");
  const [mainTo, setMainTo] = useState("");
  const [subFrom, setSubFrom] = useState("");
  const [subTo,   setSubTo]   = useState("");

  // NEW: comma-separated prefixes
  const [mainPrefixes, setMainPrefixes] = useState(""); // e.g. "601,705"

  // options / data
  const [accountsTree, setAccountsTree] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState("");

  const invoiceTypeOptions = ["ALL", "S", "G"];

  // result data
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

  // -------- fetch arranged accounts + currencies --------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setAccLoading(true);
      setAccError("");
      try {
        const [accRes, curRes] = await Promise.all([
          axios.get(ARRANGED_ACCOUNTS_ENDPOINT),
          axios.get(CURRENCIES_ENDPOINT)
        ]);

        if (!cancelled) {
          setAccountsTree(Array.isArray(accRes.data) ? accRes.data : accRes.data?.rows || []);

          const curData = Array.isArray(curRes.data) ? curRes.data : curRes.data?.rows || [];
          const curOpts = curData
            .map((c) => ({
              value: c.code ?? c.currencyCode ?? c.id ?? "",
              label: c.code ?? c.currencyCode ?? c.name ?? ""
            }))
            .filter((o) => o.value);
          setCurrencyOptions(curOpts.length ? curOpts : [{ value: "USD", label: "USD" }, { value: "LBP", label: "LBP" }]);
          if (!currency && (curOpts[0]?.value || "USD")) {
            setCurrency(curOpts[0]?.value || "USD");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setAccError(e?.response?.data?.message || e.message || "Failed to load accounts/currencies");
          // Fallback sample tree (optional)
          setAccountsTree([
            { id: 1, accountNumber: "1000", accountName: "Assets", children: [
              { id: 11, accountNumber: "1000-01", accountName: "Cash", children: [] },
              { id: 12, accountNumber: "1000-02", accountName: "Bank", children: [] },
            ]},
            { id: 2, accountNumber: "2000", accountName: "Liabilities", children: [
              { id: 21, accountNumber: "2000-01", accountName: "Payables", children: [] },
            ]},
            { id: 3, accountNumber: "3000", accountName: "Equity", children: [] },
            { id: 4, accountNumber: "4000", accountName: "Revenue", children: [
              { id: 41, accountNumber: "4000-01", accountName: "Sales", children: [] },
            ]},
            { id: 5, accountNumber: "5000", accountName: "Expenses", children: [
              { id: 51, accountNumber: "5000-01", accountName: "COGS", children: [] },
            ]},
          ]);
          setCurrencyOptions([{ value: "USD", label: "USD" }, { value: "LBP", label: "LBP" }]);
          if (!currency) setCurrency("USD");
        }
      } finally {
        if (!cancelled) setAccLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- flatten arranged tree (store node + depth) --------
  const flatAccounts = useMemo(() => {
    const out = [];
    const walk = (nodes, depth = 0) => {
      (nodes || []).forEach((n) => {
        const id   = n.id ?? n.accountId ?? n.code ?? n.accountNumber ?? n.accountCode ?? null;
        const code = n.accountNumber ?? n.accountCode ?? n.code ?? "";
        const name = n.accountName ?? n.name ?? "";
        out.push({ id, code: String(code), name: String(name), depth, node: n });
        if (Array.isArray(n.children) && n.children.length) walk(n.children, depth + 1);
      });
    };
    walk(accountsTree, 0);
    return out.filter((x) => x.id && x.code);
  }, [accountsTree]);

  // Map node->depth (for displaying correct indent when traversing)
  const nodeDepth = useMemo(() => {
    const m = new Map();
    flatAccounts.forEach((fa) => m.set(fa.node, fa.depth));
    return m;
  }, [flatAccounts]);

  // main options = depth 0 only
  const mainOptions = useMemo(() => {
    return flatAccounts
      .filter((n) => n.depth === 0)
      .map((n) => ({
        value: n.code,
        label: `${n.code} — ${n.name}`,
        node: n.node,
      }));
  }, [flatAccounts]);

  // root mains (depth 0) as [{code, node}]
  const rootMains = useMemo(() => {
    return mainOptions.map(m => ({ code: m.value, node: m.node }));
  }, [mainOptions]);

  // Parse comma-separated prefixes (numbers only, trimmed)
  const prefixes = useMemo(() => {
    const raw = (mainPrefixes || "").split(",").map(s => s.trim()).filter(Boolean);
    // keep as-is (don’t strip non-digits in case codes have letters); compare via startsWith
    return raw;
  }, [mainPrefixes]);

  // sub options
  const subOptions = useMemo(() => {
    const out = [];
    const added = new Set(); // dedupe by code

    // utility to push a node (depth-aware)
    const pushNode = (node) => {
      const code = node?.accountNumber ?? node?.accountCode ?? node?.code ?? "";
      const name = node?.accountName ?? node?.name ?? "";
      if (!code || added.has(code)) return;
      const d = nodeDepth.get(node) ?? 0;
      const indent = "\u00A0\u00A0".repeat(Math.max(0, d)); // show absolute hierarchy
      out.push({ value: code, label: `${indent}${code} — ${name}` });
      added.add(code);
    };

    // traverse descendants
    const walkDesc = (node) => {
      const kids = node?.children || [];
      for (const ch of kids) {
        pushNode(ch);
        if (Array.isArray(ch.children) && ch.children.length) walkDesc(ch);
      }
    };

    // If prefixes exist, override main range logic
    if (prefixes.length) {
      // any account (any depth) whose code starts with any prefix:
      flatAccounts.forEach((fa) => {
        if (prefixes.some((p) => fa.code.startsWith(p))) {
          if (fa.depth === 0) {
            // main matched → include ALL descendants (subs only)
            walkDesc(fa.node);
          } else {
            // sub matched → include this node + its descendants
            pushNode(fa.node);
            walkDesc(fa.node);
          }
        }
      });
      return out;
    }

    // else: use main From→To (by index in root mains)
    if (!rootMains.length) return out;

    const findIdx = (codeVal) => rootMains.findIndex(m => m.code === codeVal);
    const startIdx = mainFrom ? findIdx(mainFrom) : 0;
    const endIdxRaw = mainTo ? findIdx(mainTo) : rootMains.length - 1;

    const iFrom = startIdx < 0 ? 0 : startIdx;
    const iTo = Math.max(iFrom, endIdxRaw < 0 ? iFrom : endIdxRaw);

    const selectedMains = rootMains.slice(iFrom, iTo + 1);
    selectedMains.forEach((m) => walkDesc(m.node));

    return out;
  }, [flatAccounts, nodeDepth, rootMains, mainFrom, mainTo, prefixes]);

  // set initial mainFrom/mainTo after accounts load
  useEffect(() => {
    if (!mainOptions.length) return;
    if (!mainFrom) setMainFrom(mainOptions[0].value);
    if (!mainTo)   setMainTo(mainOptions[mainOptions.length - 1].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainOptions.length]);

  // adjust subFrom/subTo when subOptions change
  useEffect(() => {
    if (!subOptions.length) { setSubFrom(""); setSubTo(""); return; }
    const values = subOptions.map((o) => o.value);
    if (!values.includes(subFrom)) setSubFrom(values[0]);
    if (!values.includes(subTo))   setSubTo(values[values.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subOptions.length, mainFrom, mainTo, mainPrefixes]);

  // ---------- Fetch report ----------
  const fetchTB = async () => {
    setLoading(true);
    setErr("");
    try {
      const params = {
        from,
        to,
        level,
        currency,
        invoiceType,
        mainFrom: prefixes.length ? undefined : mainFrom, // range not used when prefixes provided
        mainTo:   prefixes.length ? undefined : mainTo,
        subFrom,
        subTo,
        mainPrefixes: prefixes.length ? prefixes.join(",") : undefined, // send if your API supports it
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

  const mainDisabled = !!mainPrefixes.trim() || !mainOptions.length || accLoading;
  const mainDisplay = mainPrefixes.trim()
    ? mainPrefixes
    : `${mainFrom || "—"} → ${mainTo || "—"}`;

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
  <span className="tb-label-row">
    <span className="tb-label">Main Acc (codes)</span>
    <span className="tb-hint-inline">Comma-separated prefixes. Overrides range.</span>
  </span>
  <input
    type="text"
    placeholder="e.g. 601 or 601,705"
    value={mainPrefixes}
    onChange={(e) => setMainPrefixes(e.target.value)}
  />
</label>


          <label className="tb-field">
            Main Acc (From)
            <select
              value={mainFrom}
              onChange={(e) => setMainFrom(e.target.value)}
              disabled={mainDisabled}
            >
              {mainOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Main Acc (To)
            <select
              value={mainTo}
              onChange={(e) => setMainTo(e.target.value)}
              disabled={mainDisabled}
            >
              {mainOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Sub Acc (From)
            <select
              value={subFrom}
              onChange={(e) => setSubFrom(e.target.value)}
              disabled={accLoading}  /* only while loading */
            >
              {subOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Sub Acc (To)
            <select
              value={subTo}
              onChange={(e) => setSubTo(e.target.value)}
              disabled={accLoading}
            >
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

          <button className="tb-btn tb-btn-primary" onClick={fetchTB} disabled={loading || accLoading}>
            {(loading || accLoading) ? "Loading…" : "Generate"}
          </button>
        </div>

        {accError && <div className="tb-error" style={{ marginTop: 12 }}>{accError}</div>}

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
            <div><strong>Main:</strong> {mainDisplay}</div>
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
