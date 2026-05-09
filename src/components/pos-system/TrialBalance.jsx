// src/pages/Reports/TrialBalance.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./TrialBalance.css";
import { axiosClient } from "../api/axiosClient";
import { logActivity } from "../api/logActivity";
import { printHtml } from "./printHelper";

const ENDPOINTS = {
  arrangedAccounts: `/accounts/v1/acc-flat-arranged`,
  currencies: `/currency`,
  trialBalance: `/reports/trial-balance`,
  standardTrialBalance: `/reports/trial-balance/standard`,
  trialBalanceCurrencies: `/reports/trial-balance/currencies`, // NEW
};

function LoadingScreen({ show, text = "Generating report…" }) {
  if (!show) return null;
  return (
    <div className="tb-loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="tb-loading-card">
        <div className="tb-spinner" aria-hidden="true" />
        <div className="tb-loading-text">{text}</div>
      </div>
    </div>
  );
}

function sanitizeParams(p) {
  const out = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    out[k] = v;
  });
  return out;
}

export default function TrialBalance() {
  const today = new Date().toISOString().split("T")[0];

  // dates
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  // filters
  const [level, setLevel] = useState(3);
  const [currency, setCurrency] = useState("");
  const [invoiceType, setInvoiceType] = useState("ALL"); // ALL | S | G

  // report type
  const reportTypeOptions = [
    { value: "STANDARD", label: "Standard" },
    { value: "CURRENCIES", label: "Currencies" },
    { value: "GROUPED", label: "Grouped" },
  ];
  const [reportType, setReportType] = useState("STANDARD");

  // account filters
  const [mainFrom, setMainFrom] = useState("");
  const [mainTo, setMainTo] = useState("");
  const [subFrom, setSubFrom] = useState("");
  const [subTo, setSubTo] = useState("");
  const [subTouched, setSubTouched] = useState(false); // only apply sub-range if user changed it

  // comma-separated prefixes input (overrides main From/To)
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
  const [hasExtended, setHasExtended] = useState(false); // opening/period/closing support

  const printRef = useRef(null);

  const fmt = (v) => {
    const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v ?? 0);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // -------- fetch arranged accounts + currencies --------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setAccLoading(true);
      setAccError("");
      try {
        const [accRes, curRes] = await Promise.all([
          axiosClient.get(ENDPOINTS.arrangedAccounts), // ✅
          axiosClient.get(ENDPOINTS.currencies),       // ✅
        ]);

        if (!cancelled) {
          const accTree = Array.isArray(accRes.data)
            ? accRes.data
            : accRes.data?.rows || [];
          setAccountsTree(accTree);

          const curData = Array.isArray(curRes.data)
            ? curRes.data
            : curRes.data?.rows || [];
          const curOpts = curData
            .map((c) => ({
              value: c.code ?? c.currencyCode ?? c.id ?? "",
              label: c.code ?? c.currencyCode ?? c.name ?? "",
            }))
            .filter((o) => o.value);

          const opts =
            curOpts.length > 0
              ? curOpts
              : [
                  { value: "USD", label: "USD" },
                  { value: "LBP", label: "LBP" },
                ];

          setCurrencyOptions(opts);
          if (!currency) setCurrency(opts[0].value);
        }
      } catch (e) {
        if (!cancelled) {
          setAccError(
            e?.response?.data?.message ||
              e.message ||
              "Failed to load accounts/currencies"
          );
          // Fallback sample tree (optional)
          setAccountsTree([
            {
              id: 1,
              accountNumber: "1000",
              accountName: "Assets",
              children: [
                { id: 11, accountNumber: "1000-01", accountName: "Cash", children: [] },
                { id: 12, accountNumber: "1000-02", accountName: "Bank", children: [] },
              ],
            },
            {
              id: 2,
              accountNumber: "2000",
              accountName: "Liabilities",
              children: [
                { id: 21, accountNumber: "2000-01", accountName: "Payables", children: [] },
              ],
            },
            { id: 3, accountNumber: "3000", accountName: "Equity", children: [] },
            {
              id: 4,
              accountNumber: "4000",
              accountName: "Revenue",
              children: [
                { id: 41, accountNumber: "4000-01", accountName: "Sales", children: [] },
              ],
            },
            {
              id: 5,
              accountNumber: "5000",
              accountName: "Expenses",
              children: [
                { id: 51, accountNumber: "5000-01", accountName: "COGS", children: [] },
              ],
            },
          ]);
          const opts = [
            { value: "USD", label: "USD" },
            { value: "LBP", label: "LBP" },
          ];
          setCurrencyOptions(opts);
          if (!currency) setCurrency("USD");
        }
      } finally {
        if (!cancelled) setAccLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- flatten arranged tree (store node + depth) --------
  const flatAccounts = useMemo(() => {
    const out = [];
    const walk = (nodes, depth = 0) => {
      (nodes || []).forEach((n) => {
        const id =
          n.id ??
          n.accountId ??
          n.code ??
          n.accountNumber ??
          n.accountCode ??
          null;
        const code = n.accountNumber ?? n.accountCode ?? n.code ?? "";
        const name = n.accountName ?? n.name ?? "";
        out.push({ id, code: String(code), name: String(name), depth, node: n });
        if (Array.isArray(n.children) && n.children.length)
          walk(n.children, depth + 1);
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
    return mainOptions.map((m) => ({ code: m.value, node: m.node }));
  }, [mainOptions]);

  // Parse comma-separated prefixes (kept as-is; match via startsWith)
  const prefixes = useMemo(() => {
    const raw = (mainPrefixes || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return raw;
  }, [mainPrefixes]);

  // sub options
  const subOptions = useMemo(() => {
    const out = [];
    const added = new Set(); // dedupe by code

    const pushNode = (node) => {
      const code = node?.accountNumber ?? node?.accountCode ?? node?.code ?? "";
      const name = node?.accountName ?? node?.name ?? "";
      if (!code || added.has(code)) return;
      const d = nodeDepth.get(node) ?? 0;
      const indent = "\u00A0\u00A0".repeat(Math.max(0, d));
      out.push({ value: code, label: `${indent}${code} — ${name}` });
      added.add(code);
    };

    const walkDesc = (node) => {
      const kids = node?.children || [];
      for (const ch of kids) {
        pushNode(ch);
        if (Array.isArray(ch.children) && ch.children.length) walkDesc(ch);
      }
    };

    // If prefixes exist, override main range logic
    if (prefixes.length) {
      flatAccounts.forEach((fa) => {
        if (prefixes.some((p) => fa.code.startsWith(p))) {
          if (fa.depth === 0) {
            walkDesc(fa.node);
          } else {
            pushNode(fa.node);
            walkDesc(fa.node);
          }
        }
      });
      return out;
    }

    if (!rootMains.length) return out;

    const findIdx = (codeVal) => rootMains.findIndex((m) => m.code === codeVal);
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
    if (!mainTo) setMainTo(mainOptions[mainOptions.length - 1].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainOptions.length]);

  // adjust subFrom/subTo when subOptions change (do NOT mark touched)
  useEffect(() => {
    if (!subOptions.length) {
      setSubFrom("");
      setSubTo("");
      return;
    }
    const values = subOptions.map((o) => o.value);
    if (!values.includes(subFrom)) setSubFrom(values[0]);
    if (!values.includes(subTo)) setSubTo(values[values.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subOptions.length, mainFrom, mainTo, mainPrefixes]);

  // ---------- Fetch report ----------
  const fetchTB = async () => {
    setLoading(true);
    setErr("");
    const accountRange = prefixes.length
      ? `prefixes: ${mainPrefixes}`
      : `${mainFrom || '—'} → ${mainTo || '—'}`;
    logActivity({
      action: 'REPORT_RUN',
      entityType: 'Report',
      description: `Ran Trial Balance (${reportType}) — accounts ${accountRange}, ${from} to ${to}, currency: ${currency || 'all'}, type: ${invoiceType}`,
      metadata: { reportType, mainFrom, mainTo, mainPrefixes, from, to, currency, invoiceType, level },
    });
    try {
      const endpoint =
        reportType === "STANDARD"
          ? ENDPOINTS.standardTrialBalance
          : reportType === "CURRENCIES"
          ? ENDPOINTS.trialBalanceCurrencies
          : ENDPOINTS.trialBalance;

      const params = sanitizeParams({
        from,
        to,
        level,
        currency,
        invoiceType,
        mainFrom: prefixes.length ? undefined : mainFrom,
        mainTo: prefixes.length ? undefined : mainTo,
        ...(subTouched ? { subFrom, subTo } : {}),
        mainPrefixes: prefixes.length ? prefixes.join(",") : undefined,
      });

      const res = await axiosClient.get(endpoint, { params }); // ✅

      const rawRows = Array.isArray(res.data)
        ? res.data
        : (res.data?.rows ?? []);

      const extended =
        rawRows?.length > 0 &&
        (Object.prototype.hasOwnProperty.call(rawRows[0], "openingBalance") ||
          Object.prototype.hasOwnProperty.call(rawRows[0], "periodDebit") ||
          Object.prototype.hasOwnProperty.call(rawRows[0], "closingBalance"));

      const normalized = rawRows.map((r, _ord) => {
        const coerce = (x) => (x === null || x === undefined ? 0 : Number(x) || 0);

        const base = {
          _ord,
          accountCode: r.accountCode ?? r.code ?? "",
          accountName: r.accountName ?? r.name ?? "",
          parentCode: r.parentCode ?? null,
          parentName: r.parentName ?? null,
        };

        if (reportType === "CURRENCIES") {
          return {
            ...base,
            openingBalance: coerce(r.openingBalance),
            periodDebit: coerce(r.periodDebit),
            periodCredit: coerce(r.periodCredit),
            balance: coerce(r.balance),
            closingBalance: coerce(r.closingBalance),

            prevBalanceLL: coerce(r.prevBalanceLL ?? r.openingBalanceLL),
            debitLL: coerce(r.debitLL ?? r.periodDebitLL),
            creditLL: coerce(r.creditLL ?? r.periodCreditLL),
            balanceLL: coerce(r.balanceLL),
            endingBalanceLL: coerce(r.endingBalanceLL ?? r.closingBalanceLL),

            debit: coerce(r.periodDebit),
            credit: coerce(r.periodCredit),
          };
        } else if (extended) {
          const openingBalance =
            "openingBalance" in r
              ? coerce(r.openingBalance)
              : coerce(r.openingDebit) - coerce(r.openingCredit);
          const periodDebit = coerce(r.periodDebit ?? r.debit);
          const periodCredit = coerce(r.periodCredit ?? r.credit);
          const closingBalance =
            "closingBalance" in r
              ? coerce(r.closingBalance)
              : openingBalance + (periodDebit - periodCredit);
          const balance =
            "balance" in r ? coerce(r.balance) : periodDebit - periodCredit;

          return {
            ...base,
            openingBalance,
            periodDebit,
            periodCredit,
            balance,
            closingBalance,
            debit: periodDebit,
            credit: periodCredit,
          };
        } else {
          const debit = coerce(r.debit);
          const credit = coerce(r.credit);
          const openingBalance = 0;
          const periodDebit = debit;
          const periodCredit = credit;
          const balance = periodDebit - periodCredit;
          const closingBalance = openingBalance + balance;

          return {
            ...base,
            openingBalance,
            periodDebit,
            periodCredit,
            balance,
            closingBalance,
            debit,
            credit,
          };
        }
      });

      setHasExtended(extended);
      setRows(normalized);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
      setRows([]);
      setHasExtended(false);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Totals ----------
  const totals = useMemo(() => {
    if (!rows.length) {
      return {
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        balance: 0,
        closingBalance: 0,
        prevBalanceLL: 0,
        debitLL: 0,
        creditLL: 0,
        balanceLL: 0,
        endingBalanceLL: 0,
        diff: 0,
      };
    }
    const acc = rows.reduce(
      (t, r) => {
        t.openingBalance += Number(r.openingBalance || 0);
        t.periodDebit += Number(r.periodDebit || 0);
        t.periodCredit += Number(r.periodCredit || 0);
        t.balance += Number(r.balance || 0);
        t.closingBalance += Number(r.closingBalance || 0);

        t.prevBalanceLL += Number(r.prevBalanceLL || 0);
        t.debitLL += Number(r.debitLL || 0);
        t.creditLL += Number(r.creditLL || 0);
        t.balanceLL += Number(r.balanceLL || 0);
        t.endingBalanceLL += Number(r.endingBalanceLL || 0);

        return t;
      },
      {
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        balance: 0,
        closingBalance: 0,
        prevBalanceLL: 0,
        debitLL: 0,
        creditLL: 0,
        balanceLL: 0,
        endingBalanceLL: 0,
      }
    );
    return { ...acc, diff: acc.periodDebit - acc.periodCredit };
  }, [rows]);

  // ---------- CSV ----------
  const downloadCSV = (csv) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const accountRange = prefixes.length ? `prefixes: ${mainPrefixes}` : `${mainFrom || '—'} → ${mainTo || '—'}`;
    logActivity({
      action: 'REPORT_EXPORTED',
      entityType: 'Report',
      description: `Exported Trial Balance CSV — accounts ${accountRange}, ${from} to ${to}`,
      metadata: { reportType, mainFrom, mainTo, mainPrefixes, from, to, currency, invoiceType },
    });
    const displayCode = (r) =>
      r?.parentCode ? `${r.parentCode}-${r.accountCode}` : r.accountCode;

    if (reportType === "CURRENCIES") {
      const header = [
        "Account Code",
        "Account Name",
        "Prev Balance (USD)",
        "Debit (USD)",
        "Credit (USD)",
        "Balance (USD)",
        "Ending Balance (USD)",
        "Prev Balance (LL)",
        "Debit (LL)",
        "Credit (LL)",
        "Balance (LL)",
        "Ending Balance (LL)",
      ].join(",");

      const lines = rows.map((r) =>
        [
          `"${(displayCode(r) ?? "").replace(/"/g, '""')}"`,
          `"${(r.accountName ?? "").replace(/"/g, '""')}"`,
          fmt(r.openingBalance),
          fmt(r.periodDebit),
          fmt(r.periodCredit),
          fmt(r.balance),
          fmt(r.closingBalance),
          fmt(r.prevBalanceLL),
          fmt(r.debitLL),
          fmt(r.creditLL),
          fmt(r.balanceLL),
          fmt(r.endingBalanceLL),
        ].join(",")
      );

      const footer = [
        "",
        "TOTAL",
        fmt(totals.openingBalance),
        fmt(totals.periodDebit),
        fmt(totals.periodCredit),
        fmt(totals.balance),
        fmt(totals.closingBalance),
        fmt(totals.prevBalanceLL),
        fmt(totals.debitLL),
        fmt(totals.creditLL),
        fmt(totals.balanceLL),
        fmt(totals.endingBalanceLL),
      ].join(",");

      downloadCSV([header, ...lines, footer].join("\n"));
      return;
    }

    const header = [
      "Account Code",
      "Account Name",
      "Prev Balance",
      "Debit",
      "Credit",
      "Balance",
      "Ending Balance",
    ].join(",");

    const lines = rows.map((r) =>
      [
        `"${(displayCode(r) ?? "").replace(/"/g, '""')}"`,
        `"${(r.accountName ?? "").replace(/"/g, '""')}"`,
        fmt(r.openingBalance),
        fmt(r.periodDebit),
        fmt(r.periodCredit),
        fmt(r.balance),
        fmt(r.closingBalance),
      ].join(",")
    );

    const footer = [
      "",
      "TOTAL",
      fmt(totals.openingBalance),
      fmt(totals.periodDebit),
      fmt(totals.periodCredit),
      fmt(totals.balance),
      fmt(totals.closingBalance),
    ].join(",");

    downloadCSV([header, ...lines, footer].join("\n"));
  };

  // ---------- Print (A4 iframe technique) ----------
  const handlePrint = () => {
    const accountRange = prefixes.length ? `prefixes: ${mainPrefixes}` : `${mainFrom || '—'} → ${mainTo || '—'}`;
    logActivity({
      action: 'REPORT_PRINTED',
      entityType: 'Report',
      description: `Printed Trial Balance — accounts ${accountRange}, ${from} to ${to}, currency: ${currency || 'all'}`,
      metadata: { reportType, mainFrom, mainTo, mainPrefixes, from, to, currency, invoiceType },
    });
    const root = printRef.current;
    if (!root) return;

    const isCurrencies = reportType === "CURRENCIES";

    const metaHTML = `
      <div class="tb-title">Trial Balance / ميزان المراجعة</div>
      <div class="tb-meta">
        <div><strong>From:</strong> ${from}</div>
        <div><strong>To:</strong> ${to}</div>
        <div><strong>Main:</strong> ${ (mainPrefixes || "").trim() ? mainPrefixes : `${mainFrom || "—"} → ${mainTo || "—"}` }</div>
        <div><strong>Sub:</strong> ${ subTouched ? `${subFrom || "—"} → ${subTo || "—"}` : "ALL" }</div>
        <div><strong>Level:</strong> ${level}</div>
        <div><strong>Currency:</strong> ${currency || "—"}</div>
        <div><strong>Invoice Type:</strong> ${invoiceType}</div>
        <div><strong>Report Type:</strong> ${reportTypeOptions.find(o => o.value === reportType)?.label || reportType}</div>
        <div><strong>Date:</strong> ${new Date().toISOString().split("T")[0]}</div>
      </div>
    `;

    const buildCurrenciesPrintTable = () => {
      const rowHTML = rows.map((r) => {
        const codeCell = `<td class="code" rowspan="2">${r?.parentCode ? `${r.parentCode}-${r.accountCode}` : r.accountCode}</td>`;
        const nameCell = `<td class="name" rowspan="2">${r.accountName ?? ""}</td>`;

        const usdRow = `
          <tr>
            ${codeCell}
            ${nameCell}
            <td class="num">${fmt(r.openingBalance)}</td>
            <td class="num">${fmt(r.periodDebit)}</td>
            <td class="num">${fmt(r.periodCredit)}</td>
            <td class="num">${fmt(r.balance)}</td>
            <td class="num">${fmt(r.closingBalance)}</td>
          </tr>`;

        const llRow = `
          <tr class="ll-row">
            <td class="num">${fmt(r.prevBalanceLL)}</td>
            <td class="num">${fmt(r.debitLL)}</td>
            <td class="num">${fmt(r.creditLL)}</td>
            <td class="num">${fmt(r.balanceLL)}</td>
            <td class="num">${fmt(r.endingBalanceLL)}</td>
          </tr>`;

        return usdRow + llRow;
      }).join("");

      const totalsHTML = `
        <tr class="totals-row">
          <td class="total-label" colspan="2" rowspan="2">Total</td>
          <td class="num">${fmt(totals.openingBalance)}</td>
          <td class="num">${fmt(totals.periodDebit)}</td>
          <td class="num">${fmt(totals.periodCredit)}</td>
          <td class="num">${fmt(totals.balance)}</td>
          <td class="num">${fmt(totals.closingBalance)}</td>
        </tr>
        <tr class="totals-row ll-row">
          <td class="num">${fmt(totals.prevBalanceLL)}</td>
          <td class="num">${fmt(totals.debitLL)}</td>
          <td class="num">${fmt(totals.creditLL)}</td>
          <td class="num">${fmt(totals.balanceLL)}</td>
          <td class="num">${fmt(totals.endingBalanceLL)}</td>
        </tr>`;

      return `
        <table class="tb-table tb-cur">
          <colgroup>
            <col style="width:12%">
            <col style="width:15%">
            <col style="width:14%">
            <col style="width:14%">
            <col style="width:14%">
            <col style="width:14%">
            <col style="width:17%">
          </colgroup>
          <thead>
            <tr>
              <th rowspan="2" class="code">Account Code</th>
              <th rowspan="2" class="name">Account Name</th>
              <th colspan="5" class="usd-head">USD</th>
            </tr>
            <tr>
              <th>Prev</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
              <th>Ending</th>
            </tr>
          </thead>
          <tbody>
            ${rowHTML}
            ${totalsHTML}
          </tbody>
        </table>
      `;
    };

    const printBody = !isCurrencies
      ? root.innerHTML
      : `<div class="tb-a4">${metaHTML}${buildCurrenciesPrintTable()}</div>`;

    const styleStandard = `
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        html, body { margin: 0; padding: 0; }
        .tb-a4 { width: 277mm; min-height: 190mm; margin: 0; padding: 0 2mm; box-shadow: none; }
        .tb-title { text-align: center; font-weight: 700; font-size: 18px; margin: 4mm 0; }
        .tb-meta { display: flex; flex-wrap: wrap; gap: 8mm; margin: 2mm 0 4mm 0; font-size: 12px; }

        .tb-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
        .tb-table th, .tb-table td { border: 1px solid #000; padding: 4px 6px; }
        .tb-table th { background: #f3f4f6; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .totals-row td { font-weight: 700; background: #f9fafb; }
        .tb-table thead th { position: static !important; }
        .tb-table tr { break-inside: avoid; page-break-inside: avoid; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    `;

    const styleCurrencies = `
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        html, body { margin: 0; padding: 0; }
        .tb-a4 { width: 277mm; min-height: 190mm; margin: 0; padding: 0 2mm; box-shadow: none; }
        .tb-title { text-align: center; font-weight: 700; font-size: 18px; margin: 4mm 0; }
        .tb-meta { display: flex; flex-wrap: wrap; gap: 8mm; margin: 2mm 0 4mm 0; font-size: 12px; }

        .tb-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
        .tb-table th, .tb-table td { border: 1px solid #000; padding: 4px 6px; }
        .tb-table th { background: #f3f4f6; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .totals-row td { font-weight: 700; background: #f9fafb; }
        .tb-table thead th { position: static !important; }
        .tb-table tr { break-inside: avoid; page-break-inside: avoid; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        .tb-table.tb-cur th, .tb-table.tb-cur td { width: auto !important; }
        .tb-table.tb-cur col { width: auto; }
        .tb-table.tb-cur .ll-row td { background: #fcfcfc; }
        .tb-table.tb-cur .usd-head { text-align: center; }
      </style>
    `;

    printHtml(`${isCurrencies ? styleCurrencies : styleStandard}${printBody}`);
  };

  const mainDisabled = !!mainPrefixes.trim() || !mainOptions.length || accLoading;

  const reportTypeLabel =
    reportTypeOptions.find((o) => o.value === reportType)?.label || reportType;

  const tStyles = {
    thead: { display: "table-header-group" },
    tbody: { display: "table-row-group" },
    tr: { display: "table-row" },
    th: { display: "table-cell" },
    td: { display: "table-cell" },
  };

  const renderAccountCode = (r) =>
    r?.parentCode ? `${r.parentCode}-${r.accountCode}` : r.accountCode;

  return (
    <div className="tb-wrap">
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

          <label className={`tb-field ${mainDisabled ? "is-disabled" : ""}`}>
            Main Acc (From)
            <select
              value={mainFrom}
              onChange={(e) => setMainFrom(e.target.value)}
              disabled={mainDisabled}
            >
              {mainOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`tb-field ${mainDisabled ? "is-disabled" : ""}`}>
            Main Acc (To)
            <select
              value={mainTo}
              onChange={(e) => setMainTo(e.target.value)}
              disabled={mainDisabled}
            >
              {mainOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Sub Acc (From)
            <select
              value={subFrom}
              onChange={(e) => {
                setSubFrom(e.target.value);
                setSubTouched(true);
              }}
              disabled={accLoading}
            >
              {subOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Sub Acc (To)
            <select
              value={subTo}
              onChange={(e) => {
                setSubTo(e.target.value);
                setSubTouched(true);
              }}
              disabled={accLoading}
            >
              {subOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Level
            <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencyOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Invoice Type
            <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
              {invoiceTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            Report Type
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {reportTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="tb-btn tb-btn-primary"
            onClick={fetchTB}
            disabled={loading || accLoading}
          >
            {loading || accLoading ? "Loading…" : "Generate"}
          </button>
        </div>

        {accError && (
          <div className="tb-error" style={{ marginTop: 12 }}>
            {accError}
          </div>
        )}

        <div className="tb-actions">
          <button className="tb-btn" onClick={exportCSV} disabled={!rows.length}>
            Export CSV
          </button>
          <button
            className="tb-btn tb-btn-primary"
            onClick={handlePrint}
            disabled={!rows.length}
          >
            Print
          </button>
        </div>
      </div>

      {err && <div className="tb-error">{err}</div>}

      <div className="tb-paper" ref={printRef}>
        <div className="tb-a4">
          <div className="tb-title">Trial Balance / ميزان المراجعة</div>
          <div className="tb-meta">
            <div><strong>From:</strong> {from}</div>
            <div><strong>To:</strong> {to}</div>
            <div><strong>Main:</strong> {(mainPrefixes || "").trim() ? mainPrefixes : `${mainFrom || "—"} → ${mainTo || "—"}`}</div>
            <div><strong>Sub:</strong> {subTouched ? `${subFrom || "—"} → ${subTo || "—"}` : "ALL"}</div>
            <div><strong>Level:</strong> {level}</div>
            <div><strong>Currency:</strong> {currency || "—"}</div>
            <div><strong>Invoice Type:</strong> {invoiceType}</div>
            <div><strong>Report Type:</strong> {reportTypeLabel}</div>
            <div><strong>Date:</strong> {new Date().toISOString().split("T")[0]}</div>
          </div>

          {reportType !== "CURRENCIES" ? (
            <table className="tb-table">
              <thead style={tStyles.thead}>
                <tr style={tStyles.tr}>
                  <th style={{ ...tStyles.th, width: "12%" }}>Account Code</th>
                  <th style={{ ...tStyles.th, width: "20%" }}>Account Name</th>
                  <th style={{ ...tStyles.th, width: "13%" }}>Prev Balance</th>
                  <th style={{ ...tStyles.th, width: "13%" }}>Debit</th>
                  <th style={{ ...tStyles.th, width: "13%" }}>Credit</th>
                  <th style={{ ...tStyles.th, width: "13%" }}>Balance</th>
                  <th style={{ ...tStyles.th, width: "13%" }}>Ending Balance</th>
                </tr>
              </thead>
              <tbody style={tStyles.tbody}>
                {rows.map((r, i) => (
                  <tr key={r._ord ?? i} style={tStyles.tr}>
                    <td style={tStyles.td}>{renderAccountCode(r)}</td>
                    <td style={tStyles.td}>{r.accountName}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.openingBalance)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.periodDebit)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.periodCredit)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.balance)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.closingBalance)}</td>
                  </tr>
                ))}
                <tr className="totals-row" style={tStyles.tr}>
                  <td style={tStyles.td}></td>
                  <td style={tStyles.td}>Total</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.openingBalance)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.periodDebit)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.periodCredit)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.balance)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.closingBalance)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="tb-table">
              <thead style={tStyles.thead}>
                <tr style={tStyles.tr}>
                  <th style={{...tStyles.th, width: "10%"}}>Account Code</th>
                  <th style={{...tStyles.th, width: "10%"}}>Account Name</th>
                  <th style={tStyles.th}>Prev (USD)</th>
                  <th style={tStyles.th}>Debit (USD)</th>
                  <th style={tStyles.th}>Credit (USD)</th>
                  <th style={tStyles.th}>Balance (USD)</th>
                  <th style={tStyles.th}>Ending (USD)</th>
                  <th style={tStyles.th}>Prev (LL)</th>
                  <th style={tStyles.th}>Debit (LL)</th>
                  <th style={tStyles.th}>Credit (LL)</th>
                  <th style={tStyles.th}>Balance (LL)</th>
                  <th style={tStyles.th}>Ending (LL)</th>
                </tr>
              </thead>
              <tbody style={tStyles.tbody}>
                {rows.map((r, i) => (
                  <tr key={r._ord ?? i} style={tStyles.tr}>
                    <td style={tStyles.td}>{renderAccountCode(r)}</td>
                    <td style={tStyles.td}>{r.accountName}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.openingBalance)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.periodDebit)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.periodCredit)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.balance)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.closingBalance)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.prevBalanceLL)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.debitLL)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.creditLL)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.balanceLL)}</td>
                    <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(r.endingBalanceLL)}</td>
                  </tr>
                ))}
                <tr className="totals-row" style={tStyles.tr}>
                  <td style={tStyles.td}></td>
                  <td style={tStyles.td}>Total</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.openingBalance)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.periodDebit)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.periodCredit)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.balance)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.closingBalance)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.prevBalanceLL)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.debitLL)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.creditLL)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.balanceLL)}</td>
                  <td style={{ ...tStyles.td, textAlign: "right" }} className="num">{fmt(totals.endingBalanceLL)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <LoadingScreen
          show={loading || accLoading}
          text={accLoading ? "Loading accounts & currencies…" : "Generating report…"}
        />
      </div>

      {!rows.length && !loading && !err && (
        <div className="tb-empty">Choose your filters and click Generate.</div>
      )}
    </div>
  );
}
