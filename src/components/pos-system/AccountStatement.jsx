// src/components/pos-system/AccountStatement.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Reports.css"; // reuse your styles
import { axiosClient } from "../api/axiosClient"; // ✅ added

const BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:3000";

const ENDPOINTS = {
  arrangedAccounts: `${BASE_URL}/accounts/v1/acc-flat-arranged`,
  accountStatementOFR: `${BASE_URL}/journal-vouchers/account-statement/ofr`,
};

function sanitizeParams(p) {
  const out = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    out[k] = v;
  });
  return out;
}

export default function AccountStatement() {
  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // ✅ default range: [today - 1 month, today]
  const getDefaultRange = () => {
    const toDate = new Date(); // today
    const fromDate = new Date(); // clone
    fromDate.setMonth(fromDate.getMonth() - 1); // one month back
    return { from: toYMD(fromDate), to: toYMD(toDate) };
  };

  const [{ from: defaultFrom, to: defaultTo }] = useState(() =>
    getDefaultRange()
  );

  // inputs
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [type, setType] = useState("ALL");

  // accounts
  const [accTree, setAccTree] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState("");
  const [accountId, setAccountId] = useState("");

  // data
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);

  // print source
  const printRef = useRef(null);

  // helpers to show "Opening Balance" in Arabic
  const looksLikeOpening = (txt = "") =>
    /opening\s*balance/i.test(txt) || /رصيد\s*سابق/.test(txt);
  const displayDesc = (txt = "") =>
    looksLikeOpening(txt) ? "رصيد سابق" : txt || "";

  // fetch accounts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAccLoading(true);
      setAccError("");
      try {
        // ✅ axios -> axiosClient
        const res = await axiosClient.get(ENDPOINTS.arrangedAccounts);

        if (cancelled) return;
        const tree = Array.isArray(res.data) ? res.data : res.data?.rows || [];
        setAccTree(tree);

        const flat = flattenTree(tree);
        const first = flat.find((a) => a.id);
        if (first && !accountId) setAccountId(String(first.id));
      } catch (e) {
        if (!cancelled)
          setAccError(
            e?.response?.data?.message || e.message || "Failed to load accounts"
          );
      } finally {
        if (!cancelled) setAccLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flatAccounts = useMemo(() => flattenTree(accTree), [accTree]);

  function flattenTree(nodes) {
    const out = [];
    const walk = (arr, depth = 0) => {
      (arr || []).forEach((n) => {
        // ✅ NEW: support kind/refId coming from backend
        const kind = String(n.kind || "account").toLowerCase(); // account | customer | supplier
        const refId = n.refId ?? n.id ?? n.accountId ?? null;

        const code = n.accountNumber ?? n.accountCode ?? n.code ?? "";
        const name = n.accountName ?? n.name ?? "";

        // ✅ value stored in "id" (keeps your structure)
        const id = refId != null ? `${kind}:${refId}` : null;

        if (id && code) {
          const indent = "\u00A0\u00A0".repeat(depth);
          out.push({
            id,
            kind,
            refId,
            code: String(code),
            name: String(name),
            label: `${indent}${code} — ${name}`,
          });
        }
        if (Array.isArray(n.children) && n.children.length)
          walk(n.children, depth + 1);
      });
    };
    walk(nodes, 0);
    return out;
  }

  const parseSelected = (val) => {
    if (!val) return null;
    const [kindRaw, idRaw] = String(val).split(":");
    const kind = (kindRaw || "account").toLowerCase();
    const idNum = Number(idRaw);
    if (!Number.isFinite(idNum)) return null;
    return { kind, idNum };
  };

  const fetchStatement = async () => {
    setLoading(true);
    setErr("");
    setItems([]);
    setMeta(null);

    try {
      const sel = parseSelected(accountId);

      const params = sanitizeParams({
        // ✅ send exactly ONE of these
        accountId: sel?.kind === "account" ? String(sel.idNum) : undefined,
        customerId: sel?.kind === "customer" ? String(sel.idNum) : undefined,
        supplierId: sel?.kind === "supplier" ? String(sel.idNum) : undefined,

        type,
        from,
        to,
      });

      // ✅ axios -> axiosClient
      const res = await axiosClient.get(ENDPOINTS.accountStatementOFR, {
        params,
      });

      const data = res.data || {};
      setMeta({
        // ✅ keep your meta shape (UI uses accountCode/accountName)
        accountId: data.targetId ?? data.accountId,
        accountCode: data.accountCode,
        accountName: data.accountName,
        from: data.from ?? null,
        to: data.to ?? null,
        openingBalance: Number(data.openingBalance || 0),
        closingBalance: Number(data.closingBalance || 0),
        totalDebit: Number(data?.totals?.totalDebit || 0),
        totalCredit: Number(data?.totals?.totalCredit || 0),
        currency: data?.basis?.currency || data?.currency || "-",
      });

      const arr = Array.isArray(data.items) ? data.items : [];
      const normalized = arr.map((r, i) => ({
        _ord: i,
        date: r.date,
        jvNumber: r.jvNumber,
        docNbr: r.docNbr ?? "",
        description: r.description ?? "",
        kind: r.kind,
        debit: Number(r.debit || 0),
        credit: Number(r.credit || 0),
        balanceAfter: Number(r.balanceAfter || 0),
        journalVoucherId: r.journalVoucherId,
        exRateUSD: r.exRateUSD,
        exRateEUROToUSD: r.exRateEUROToUSD,
      }));
      setItems(normalized);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v) => {
    const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v ?? 0);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const downloadCSV = (csv) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const code = meta?.accountCode || "account";
    a.download = `account-statement_${code}_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = [
      "Date",
      "JV Number",
      "Doc No.",
      "Kind",
      "Description",
      "Debit",
      "Credit",
      "Balance After",
    ].join(",");

    const lines = items.map((r) =>
      [
        r.date ?? "",
        r.jvNumber ?? "",
        r.docNbr ?? "",
        r.kind ?? "",
        `"${(r.description ?? "").replace(/"/g, '""')}"`,
        fmt(r.debit),
        fmt(r.credit),
        fmt(r.balanceAfter),
      ].join(",")
    );

    const footer = [
      "",
      "",
      "",
      "",
      "TOTAL",
      fmt(meta?.totalDebit || 0),
      fmt(meta?.totalCredit || 0),
      fmt(meta?.closingBalance || 0),
    ].join(",");

    downloadCSV([header, ...lines, footer].join("\n"));
  };

  // ---------- data for printing ----------
  const openingBalance = Number(meta?.openingBalance ?? 0);
  const closingBalance =
    typeof meta?.closingBalance === "number"
      ? meta.closingBalance
      : items.length
      ? Number(items[items.length - 1].balanceAfter || 0)
      : openingBalance;

  const statementDate = new Date().toISOString().split("T")[0];

  const clientName =
    meta?.accountName ||
    flatAccounts.find((fa) => String(fa.id) === String(accountId))?.name ||
    "-";

  const accountNo =
    meta?.accountCode ||
    flatAccounts.find((fa) => String(fa.id) === String(accountId))?.code ||
    "-";

  const currencyCode = meta?.currency || "-";

  // ---------- PRINT (manual pagination, repeat only thead) ----------
  const handlePrint = () => {
    const printableRoot = printRef.current;
    if (!printableRoot) return;

    const copiedStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((node) => node.outerHTML)
      .join("");

    // source bits from the hidden template
    const srcHeader = printableRoot.querySelector(
      ".statement-report-modal-header"
    );
    const srcTitle = printableRoot.querySelector(
      ".statement-report-modal-titlebar"
    );
    const srcClientLine = printableRoot.querySelector(
      ".statement-report-modal-clientline"
    );
    const srcTable = printableRoot.querySelector(
      ".statement-report-modal-table"
    );
    if (!srcHeader || !srcTitle || !srcClientLine || !srcTable) return;

    // rows; keep final footer for last page
    const allRows = Array.from(srcTable.querySelectorAll("tbody > tr")).map((r) =>
      r.cloneNode(true)
    );
    let footerRow = null;
    if (
      allRows.length &&
      allRows[allRows.length - 1].classList.contains(
        "statement-report-modal-footer-row"
      )
    ) {
      footerRow = allRows.pop();
    }

    // iframe
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed",
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      border: 0,
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
      .statement-report-modal-a4 { width: 190mm; margin: 0; padding: 0; box-shadow: none; border: 0; }

      /* Table look */
      .statement-report-modal-table { width: 100%; border-collapse: collapse; table-layout: fixed; border-spacing: 0; }
      .statement-report-modal-table th, .statement-report-modal-table td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; line-height: 1.2; }
      .statement-report-modal-table thead th { position: static !important; background: #f3f4f6; }
      .statement-report-modal-table tr { break-inside: avoid; page-break-inside: avoid; }

      /* Make sure thead/tbody are treated as proper groups in print engines */
      @media print {
        .statement-report-modal-table thead { display: table-header-group; }
        .statement-report-modal-table tbody { display: table-row-group; }
        .statement-report-modal-table tfoot { display: table-row-group; }
      }

      .statement-report-modal-footer-row td { font-weight: 700; }
      .statement-report-modal-footer-row td.footer-spacer { border: none !important; background: transparent !important; }
      .statement-report-modal-footer-row td.footer-label { border-left: none !important; }
      /* Footer row: bigger label + amount */
.statement-report-modal-footer-row td.footer-label,
.statement-report-modal-footer-row td.footer-amount {
  font-size: 16px;
  line-height: 1.25;
  font-weight: 700;
}

      /* Column widths */
      .statement-report-modal-table col:nth-child(1) { width: 15% !important; }
      .statement-report-modal-table col:nth-child(2) { width: 10% !important; }
      .statement-report-modal-table col:nth-child(3) { width: 25% !important; }
      .statement-report-modal-table col:nth-child(4) { width: 12% !important; }
      .statement-report-modal-table col:nth-child(5) { width: 12% !important; }
      .statement-report-modal-table col:nth-child(6) { width: 19% !important; }

      /* Page wrapper */
      .print-page {
        position: relative;
        width: 190mm;
        height: 277mm;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        page-break-after: always;
      }
      .print-page:last-child { page-break-after: auto; }

      .page-header { flex: 0 0 auto; }
      .page-body   { flex: 1 1 auto; display: flex; flex-direction: column; }
      .page-body .statement-report-modal-table { width: 100%; }

      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1,h2,p { margin: 0; }
    </style>
    <title>Account Statement</title>
  </head>
  <body>
    <div class="statement-report-modal-a4" id="pages"></div>
  </body>
</html>`);
    doc.close();

    const win = iframe.contentWindow;
    const idoc = win.document;

    // Wait for styles & fonts to be ready BEFORE paginating
    const waitForReady = async () => {
      if (idoc.readyState !== "complete") {
        await new Promise((res) =>
          idoc.defaultView.addEventListener("load", res, { once: true })
        );
      }
      await new Promise((r) =>
        idoc.defaultView.requestAnimationFrame(() =>
          idoc.defaultView.requestAnimationFrame(r)
        )
      );
      try {
        if (idoc.fonts?.ready) await idoc.fonts.ready;
      } catch {}
      await new Promise((r) => idoc.defaultView.requestAnimationFrame(r));
    };

    const build = async () => {
      await waitForReady();

      const pagesHost = idoc.getElementById("pages");
      const cloneInto = (el) => idoc.importNode(el, true);

      const buildInfoTable = (pageNumText) => {
        const wrap = idoc.createElement("div");
        wrap.className = "statement-report-modal-info";
        wrap.innerHTML = `
          <table class="statement-report-modal-info-table" style="width:100%; border-collapse:collapse; font-size:12px">
            <thead>
              <tr>
                <th>رقم الحساب</th><th>العملة</th><th>من تاريخ</th><th>الى تاريخ</th><th>تاريخ الكشف</th><th>الصفحة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${accountNo}</td>
                <td>${currencyCode}</td>
                <td>${from}</td>
                <td>${to}</td>
                <td>${statementDate}</td>
                <td>${pageNumText || ""}</td>
              </tr>
            </tbody>
          </table>`;
        return wrap;
      };

      const buildTableSkeleton = () => {
        const table = idoc.createElement("table");
        table.className = "statement-report-modal-table";
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.fontSize = "12px";

        const colgroup = idoc.createElement("colgroup");
        colgroup.innerHTML = `
          <col style="width:15%" />
          <col style="width:17%" />
          <col style="width:25%" />
          <col style="width:12%" />
          <col style="width:12%" />
          <col style="width:19%" />`;

        const thead = idoc.createElement("thead");
        thead.innerHTML = `
          <tr>
            <th>تاريخ</th>
            <th>رقم الفاتورة</th>
            <th>الشرح</th>
            <th>عليكم</th>
            <th>لكم</th>
            <th>الرصيد</th>
          </tr>`;

        const tbody = idoc.createElement("tbody");
        table.appendChild(colgroup);
        table.appendChild(thead);
        table.appendChild(tbody);
        return { table, tbody };
      };

      // page 1 = full header; later pages = table only
      const createPage = (pageIndex, mode /* 'full' | 'tableOnly' */) => {
        const page = idoc.createElement("section");
        page.className = "print-page";

        const headerBox = idoc.createElement("div");
        headerBox.className = "page-header";

        if (mode === "full") {
          headerBox.appendChild(cloneInto(srcHeader));
          headerBox.appendChild(cloneInto(srcTitle));
          headerBox.appendChild(cloneInto(srcClientLine));
          headerBox.appendChild(buildInfoTable("")); // fill x/y later
        }

        const bodyBox = idoc.createElement("div");
        bodyBox.className = "page-body";
        const { table, tbody } = buildTableSkeleton();
        bodyBox.appendChild(table);

        if (mode === "full") page.appendChild(headerBox);
        page.appendChild(bodyBox);
        pagesHost.appendChild(page);

        return { page, headerBox, bodyBox, tbody };
      };

      const pages = [];
      let current = createPage(1, "full");
      pages.push(current);

      // append → reflow → measure; if overflow, move row to a new page
      const appendRowWithPagination = (rowNode) => {
        current.tbody.appendChild(rowNode);

        // ✅ ESLint-safe reflow
        void current.page.offsetHeight;

        if (current.page.scrollHeight > current.page.clientHeight) {
          current.tbody.removeChild(rowNode);
          current = createPage(pages.length + 1, "tableOnly");
          pages.push(current);
          current.tbody.appendChild(rowNode);

          // ✅ ESLint-safe reflow
          void current.page.offsetHeight;
        }
      };

      // Lay out rows (except final footer)
      for (const row of allRows) {
        appendRowWithPagination(idoc.importNode(row, true));
      }

      // Append final footer row on last page (or move to a new page if needed)
      if (footerRow) {
        appendRowWithPagination(idoc.importNode(footerRow, true));
      }

      // Set page numbers x/y (only page 1, inside info table)
      const totalPages = pages.length;
      if (pages[0]) {
        const infoCell = pages[0].headerBox?.querySelector(
          ".statement-report-modal-info tbody td:last-child"
        );
        if (infoCell) infoCell.textContent = `1/${totalPages}`;
      }

      await new Promise((r) => idoc.defaultView.requestAnimationFrame(r));
      win.focus();
      win.print();
      setTimeout(() => document.body.removeChild(iframe), 200);
    };

    build();
  };

  return (
    <div className="tb-wrap">
      {/* Controls */}
      <div className="tb-toolbar">
        <div className="tb-controls tb-controls-grid">
          <label className="tb-field">
            Account
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={accLoading}
            >
              {flatAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tb-field">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>

          <label className="tb-field">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>

          <label className="tb-field">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {["ALL", "S", "G"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <button
            className="tb-btn tb-btn-primary"
            onClick={fetchStatement}
            disabled={loading || accLoading || !accountId}
          >
            {loading || accLoading ? "Loading…" : "Generate"}
          </button>
        </div>

        {accError && <div className="tb-error" style={{ marginTop: 12 }}>{accError}</div>}

        <div className="tb-actions">
          <button className="tb-btn" onClick={exportCSV} disabled={!items.length}>
            Export CSV
          </button>
          <button className="tb-btn tb-btn-primary" onClick={handlePrint} disabled={!items.length}>
            Print
          </button>
        </div>
      </div>

      {err && <div className="tb-error">{err}</div>}

      {/* On-screen table */}
      <div style={{ marginTop: 8 }}>
        {meta && (
          <div className="tb-meta" style={{ marginBottom: 8 }}>
            <div>
              <strong>Account:</strong> {meta.accountCode} — {meta.accountName}
            </div>
            <div>
              <strong>Opening Balance:</strong> {fmt(meta.openingBalance)}
            </div>
            <div>
              <strong>Total Debit:</strong> {fmt(meta.totalDebit)}
            </div>
            <div>
              <strong>Total Credit:</strong> {fmt(meta.totalCredit)}
            </div>
            <div>
              <strong>Closing Balance:</strong> {fmt(meta.closingBalance)}
            </div>
          </div>
        )}

        <table className="tb-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>JV Number</th>
              <th>Doc No.</th>
              <th>Kind</th>
              <th>Description</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={r._ord ?? i}>
                <td>{r.date ?? ""}</td>
                <td>{r.jvNumber ?? ""}</td>
                <td>{r.docNbr ?? ""}</td>
                <td>{r.kind ?? ""}</td>
                <td>{displayDesc(r.description)}</td>
                <td className="num">{fmt(r.debit)}</td>
                <td className="num">{fmt(r.credit)}</td>
                <td className="num">{fmt(r.balanceAfter)}</td>
              </tr>
            ))}
            {!items.length && !loading && !err && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center" }}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PRINT-ONLY source (as header + rows) */}
      <div
        className="statement-report-modal-body"
        ref={printRef}
        style={{ display: "none" }}
      >
        <div className="statement-report-modal-a4">
          {/* Header */}
          <div
            className="statement-report-modal-header"
            style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
          >
            <div className="statement-report-modal-header-right">
              <h2 className="statement-report-modal-company-arabic-title">شركة شمعون</h2>
              <h2 className="statement-report-modal-company-arabic-subtitle">للزجاج و المرايا</h2>
              <p className="statement-report-modal-small-subtitle">الحدث / شويفات</p>
              <div className="statement-report-modal-arabic-contact">
                <div className="statement-report-modal-arabic-line">
                  <span className="statement-report-modal-arabic-label">تلفون</span>
                  <span className="statement-report-modal-arabic-colon">:</span>
                  <span className="statement-report-modal-arabic-value">05/814964 05/810888</span>
                </div>
                <div className="statement-report-modal-arabic-line">
                  <span className="statement-report-modal-arabic-label">خلوي / واتساب</span>
                  <span className="statement-report-modal-arabic-colon">:</span>
                  <span className="statement-report-modal-arabic-value">79/100068</span>
                </div>
                <div className="statement-report-modal-arabic-line">
                  <span className="statement-report-modal-arabic-label">فاكس</span>
                  <span className="statement-report-modal-arabic-colon">:</span>
                  <span className="statement-report-modal-arabic-value">05/814961</span>
                </div>
              </div>
            </div>
            <div className="statement-report-modal-header-left">
              <h1 className="statement-report-modal-company-title">Shamoun Company</h1>
              <h2 className="statement-report-modal-company-subtitle">For Glass & Mirrors</h2>
              <p>Chweifat - Near Spot Mall</p>
              <p>Tel: 05-810 888 ; 79-1000 68 ; Fax: 05-814 961</p>
              <p>Email: info@shamoun.com</p>
              <p>VAT Reg.No 10909-601</p>
            </div>
          </div>

          <div
            className="statement-report-modal-titlebar"
            style={{ textAlign: "center", fontWeight: 700, fontSize: 18, margin: "8px 0" }}
          >
            كشف حساب
          </div>

          <div className="statement-report-modal-clientline" style={{ marginBottom: 6 }}>
            <span className="statement-report-modal-clientline-label">السادة</span>
            <span className="statement-report-modal-clientline-colon">:</span>
            <span className="statement-report-modal-clientline-value" style={{ marginInlineStart: 6 }}>
              {clientName}
            </span>
          </div>

          {/* Info (page 1 only in final print) */}
          <div className="statement-report-modal-info">
            <table
              className="statement-report-modal-info-table"
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
            >
              <thead>
                <tr>
                  <th>رقم الحساب</th>
                  <th>العملة</th>
                  <th>من تاريخ</th>
                  <th>الى تاريخ</th>
                  <th>تاريخ الكشف</th>
                  <th>الصفحة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{accountNo}</td>
                  <td>{currencyCode}</td>
                  <td>{from}</td>
                  <td>{to}</td>
                  <td>{statementDate}</td>
                  <td>&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Source table */}
          <div className="statement-report-modal-table-wrap" style={{ marginTop: 8 }}>
            <table
              className="statement-report-modal-table"
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
            >
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "19%" }} />
              </colgroup>

              <thead>
                <tr>
                  <th>تاريخ</th>
                  <th>رقم الفاتورة</th>
                  <th>الشرح</th>
                  <th>عليكم</th>
                  <th>لكم</th>
                  <th>الرصيد</th>
                </tr>
              </thead>

              <tbody>
                {!(items[0] && looksLikeOpening(items[0].description || "")) && (
                  <tr className="statement-report-modal-opening-row">
                    <td>{from}</td>
                    <td>—</td>
                    <td>رصيد سابق</td>
                    <td>{fmt(0)}</td>
                    <td>{fmt(0)}</td>
                    <td>{fmt(openingBalance)}</td>
                  </tr>
                )}

                {items.map((r, i) => (
                  <tr key={`print-row-${i}`}>
                    <td>{String(r.date ?? "").split("T")[0]}</td>
                    <td>{r.docNbr}</td>
                    <td>{displayDesc(r.description)}</td>
                    <td>{fmt(Number(r.debit || 0).toFixed(2))}</td>
                    <td>{fmt(Number(r.credit || 0).toFixed(2))}</td>
                    <td>{fmt(Number(r.balanceAfter || 0).toFixed(2))}</td>
                  </tr>
                ))}

                <tr className="statement-report-modal-footer-row">
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td
                    className="footer-label"
                    style={{ textAlign: "center", fontWeight: 700, fontSize: "14px" }}
                  >
                    رصيد
                  </td>
                  <td className="num footer-amount">{fmt(closingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
