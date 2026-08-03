// src/components/pos-system/AccountStatement.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Reports.css";
import "./Components/StatementReportModal.css";
import { axiosClient } from "../api/axiosClient";
import { logActivity } from "../api/logActivity";
import { printWithDomBuilder } from "./printHelper";
import revoLogoSrc from "../revo-logo/revo.png"; // ✅ same level as this file
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function hasPerm(perm) {
  try {
    const payload = JSON.parse(atob(sessionStorage.getItem("token")?.split(".")[1]));
    return (payload?.permissions || []).includes(perm);
  } catch { return false; }
}

const ENDPOINTS = {
  arrangedAccounts: `/accounts/v1/acc-flat-arranged`,
  accountStatementOFR: `/journal-vouchers/account-statement/ofr`,
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

  const getDefaultRange = () => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 1);
    return { from: toYMD(fromDate), to: toYMD(toDate) };
  };

  const [{ from: defaultFrom, to: defaultTo }] = useState(() => getDefaultRange());

  const SESSION_KEY = "accountStatement_state";
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } })();

  const [from, setFrom] = useState(saved?.from ?? defaultFrom);
  const [to, setTo] = useState(saved?.to ?? defaultTo);
  const [type, setType] = useState(saved?.type ?? "ALL");
  const [currency, setCurrency] = useState(saved?.currency ?? "USD");

  const [accTree, setAccTree] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState("");
  const [accountId, setAccountId] = useState(saved?.accountId ?? "");
  const [accSearch, setAccSearch] = useState("");
  const [accOpen, setAccOpen] = useState(false);
  const accComboRef = useRef(null);

  // Optional second account for combined statement
  const [accountId2, setAccountId2] = useState("");
  const [accSearch2, setAccSearch2] = useState("");
  const [accOpen2, setAccOpen2] = useState(false);
  const accComboRef2 = useRef(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState(saved?.meta ?? null);
  const [items, setItems] = useState(saved?.items ?? []);
  const [netView, setNetView] = useState(false);
  const [netMeta, setNetMeta] = useState(null);
  const [netItems, setNetItems] = useState([]);
  const [allNetData, setAllNetData] = useState(null);
  const [allNetLoading, setAllNetLoading] = useState(false);

  // Persist filters + results so navigating away and back restores everything
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ from, to, type, currency, accountId, meta, items }));
    } catch {}
  }, [from, to, type, currency, accountId, meta, items]);

  // Close account comboboxes when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (accComboRef.current && !accComboRef.current.contains(e.target)) setAccOpen(false);
      if (accComboRef2.current && !accComboRef2.current.contains(e.target)) setAccOpen2(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ✅ Fetch active company — same pattern as StatementModal
  const navigate = useNavigate();
  const [companyKey, setCompanyKey] = useState("shamoun");
  useEffect(() => {
    axiosClient.get("/company")
      .then(({ data }) => {
        const active = Array.isArray(data) ? data.find((c) => c.isActive) : null;
        setCompanyKey(
          active?.companyName?.toLowerCase().includes("revo") ? "revo" : "shamoun"
        );
      })
      .catch(() => setCompanyKey("shamoun"));
  }, []);

  const isRevo = companyKey === "revo";
  const canCombineAccounts = hasPerm("reports.accountStatement.combineAccounts");
  const canDownloadPdf     = hasPerm("reports.accountStatement.downloadPdf");

  const printRef = useRef(null);
  const netPrintRef = useRef(null);

  const looksLikeOpening = (txt = "") =>
    /opening\s*balance/i.test(txt) || /رصيد\s*سابق/.test(txt);
  const displayDesc = (txt = "") =>
    looksLikeOpening(txt) ? "رصيد سابق" : txt || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAccLoading(true);
      setAccError("");
      try {
        const res = await axiosClient.get(ENDPOINTS.arrangedAccounts);
        if (cancelled) return;
        const tree = Array.isArray(res.data) ? res.data : res.data?.rows || [];
        setAccTree(tree);
        const flat = flattenTree(tree);
        const first = flat.find((a) => a.id);
        if (first && !accountId) setAccountId(String(first.id));
      } catch (e) {
        if (!cancelled)
          setAccError(e?.response?.data?.message || e.message || "Failed to load accounts");
      } finally {
        if (!cancelled) setAccLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flatAccounts = useMemo(() => flattenTree(accTree), [accTree]);

  const selectedAccount = flatAccounts.find((a) => a.id === accountId);
  const filteredAccounts = accSearch.trim()
    ? flatAccounts.filter((a) =>
        a.label.toLowerCase().includes(accSearch.toLowerCase()) ||
        a.code.toLowerCase().includes(accSearch.toLowerCase()) ||
        a.name.toLowerCase().includes(accSearch.toLowerCase())
      )
    : flatAccounts;

  const handleAccSelect = (a) => {
    setAccountId(a.id);
    setAccSearch("");
    setAccOpen(false);
    logActivity({
      action: 'REPORT_ACCOUNT_SELECTED',
      entityType: 'Report',
      description: `Account Statement — selected account ${a.code || ''} ${a.name || ''}`.trim(),
      metadata: { accountId: a.id, accountCode: a.code, accountName: a.name },
    });
  };

  function flattenTree(nodes) {
    const out = [];
    const walk = (arr, depth = 0) => {
      (arr || []).forEach((n) => {
        const kind = String(n.kind || "account").toLowerCase();
        const refId = n.refId ?? n.id ?? n.accountId ?? null;
        const code = n.accountNumber ?? n.accountCode ?? n.code ?? "";
        const name = n.accountName ?? n.name ?? "";
        const id = refId != null ? `${kind}:${refId}` : null;
        if (id && code) {
          const indent = "\u00A0\u00A0".repeat(depth);
          out.push({ id, kind, refId, code: String(code), name: String(name), label: `${indent}${code} — ${name}` });
        }
        if (Array.isArray(n.children) && n.children.length) walk(n.children, depth + 1);
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

  const fetchNetStatement = async (customerId) => {
    setLoading(true);
    setErr("");
    setNetItems([]);
    setNetMeta(null);
    try {
      const res = await axiosClient.get(`/journal-vouchers/statements/net/${customerId}`, {
        params: sanitizeParams({ type, from, to }),
      });
      const data = res.data || {};
      setNetMeta({
        customerName: data.customerName,
        supplierName: data.supplierName,
        linkedSupplierId: data.linkedSupplierId,
        from: data.from,
        to: data.to,
        openingBalance: Number(data.openingBalance || 0),
        closingBalance: Number(data.closingBalance || 0),
        totalDebit: Number(data?.totals?.totalDebit || 0),
        totalCredit: Number(data?.totals?.totalCredit || 0),
      });
      setNetItems((data.items || []).map((r, i) => ({
        _ord: i,
        date: r.date,
        jvNumber: r.jvNumber,
        docNbr: r.docNbr ?? "",
        description: r.description ?? "",
        side: r.side,
        debit: Number(r.debit || 0),
        credit: Number(r.credit || 0),
        balanceAfter: Number(r.balanceAfter || 0),
        journalVoucherId: r.journalVoucherId,
      })));
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllNetPositions = async () => {
    setAllNetLoading(true);
    setAllNetData(null);
    try {
      const res = await axiosClient.get(`/journal-vouchers/reports/net-positions`, {
        params: sanitizeParams({ type, from, to }),
      });
      setAllNetData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setAllNetLoading(false);
    }
  };

  const buildParams = (selId) => {
    const sel = parseSelected(selId);
    return sanitizeParams({
      accountId: sel?.kind === "account" ? String(sel.idNum) : undefined,
      customerId: sel?.kind === "customer" ? String(sel.idNum) : undefined,
      supplierId: sel?.kind === "supplier" ? String(sel.idNum) : undefined,
      type, from, to, currency,
    });
  };

  const shapeItems = (arr) =>
    (Array.isArray(arr) ? arr : []).map((r, i) => ({
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

  const fetchStatement = async () => {
    setLoading(true);
    setErr("");
    setItems([]);
    setMeta(null);
    setNetView(false);
    setNetMeta(null);
    setNetItems([]);
    logActivity({
      action: 'REPORT_RUN',
      entityType: 'Report',
      description: `Ran Account Statement — account ${accountNo || accountId}, ${from} to ${to}, type: ${type}, currency: ${currency}`,
      metadata: { accountId, accountCode: accountNo, from, to, type, currency },
    });
    try {
      if (accountId2 && accountId2 !== accountId) {
        // ── Combined statement: fetch both in parallel, merge ──────────
        const [res1, res2] = await Promise.all([
          axiosClient.get(ENDPOINTS.accountStatementOFR, { params: buildParams(accountId) }),
          axiosClient.get(ENDPOINTS.accountStatementOFR, { params: buildParams(accountId2) }),
        ]);
        const d1 = res1.data || {};
        const d2 = res2.data || {};

        const ob1 = Number(d1.openingBalance || 0);
        const ob2 = Number(d2.openingBalance || 0);
        const combinedOpening = ob1 + ob2;

        // Merge and sort by date then jvNumber
        const rawItems = [
          ...shapeItems(d1.items),
          ...shapeItems(d2.items),
        ];
        rawItems.sort((a, b) => {
          const dc = (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
          if (dc !== 0) return dc;
          return String(a.jvNumber || "").localeCompare(String(b.jvNumber || ""));
        });

        // Recompute running balance over the merged sequence
        let running = combinedOpening;
        rawItems.forEach((r) => {
          running = running + r.debit - r.credit;
          r.balanceAfter = running;
        });

        const name1 = d1.accountName || flatAccounts.find(a => String(a.id) === String(accountId))?.name || accountId;
        const name2 = d2.accountName || flatAccounts.find(a => String(a.id) === String(accountId2))?.name || accountId2;
        const code1 = d1.accountCode || flatAccounts.find(a => String(a.id) === String(accountId))?.code || "";
        const code2 = d2.accountCode || flatAccounts.find(a => String(a.id) === String(accountId2))?.code || "";

        setMeta({
          accountCode: `${code1} / ${code2}`,
          accountName: `${name1} + ${name2}`,
          primaryAccountName: name1,
          primaryAccountCode: code1,
          from: d1.from ?? null,
          to: d1.to ?? null,
          openingBalance: combinedOpening,
          closingBalance: running,
          totalDebit: Number(d1?.totals?.totalDebit || 0) + Number(d2?.totals?.totalDebit || 0),
          totalCredit: Number(d1?.totals?.totalCredit || 0) + Number(d2?.totals?.totalCredit || 0),
          currency: d1?.basis?.currency || d1?.currency || "-",
          isCombined: true,
        });
        setItems(rawItems);
      } else {
        // ── Single account statement (original logic) ──────────────────
        const res = await axiosClient.get(ENDPOINTS.accountStatementOFR, { params: buildParams(accountId) });
        const data = res.data || {};
        setMeta({
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
        setItems(shapeItems(data.items));
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v) => {
    const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v ?? 0);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Print-only formatter: LL removes .00, USD keeps 2 decimal places
  const fmtPrint = (v) => {
    const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v ?? 0);
    if (!isFinite(n)) return currency === "LL" ? "0" : "0.00";
    if (currency === "LL") return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const downloadCSV = (csv) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `account-statement_${meta?.accountCode || "account"}_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    logActivity({
      action: 'REPORT_EXPORTED',
      entityType: 'Report',
      description: `Exported Account Statement CSV — account ${accountNo}, ${from} to ${to}`,
      metadata: { accountCode: accountNo, accountName: clientName, from, to, currency },
    });
    const header = ["Date","JV Number","Doc No.","Kind","Description","Debit","Credit","Balance After"].join(",");
    const lines = items.map((r) => [
      r.date ?? "", r.jvNumber ?? "", r.docNbr ?? "", r.kind ?? "",
      `"${(r.description ?? "").replace(/"/g, '""')}"`,
      fmt(r.debit), fmt(r.credit), fmt(r.balanceAfter),
    ].join(","));
    const footer = ["","","","","TOTAL", fmt(meta?.totalDebit || 0), fmt(meta?.totalCredit || 0), fmt(meta?.closingBalance || 0)].join(",");
    downloadCSV([header, ...lines, footer].join("\n"));
  };

  const openingBalance = Number(meta?.openingBalance ?? 0);
  const closingBalance =
    typeof meta?.closingBalance === "number"
      ? meta.closingBalance
      : items.length ? Number(items[items.length - 1].balanceAfter || 0) : openingBalance;

  const statementDate = new Date().toISOString().split("T")[0];
  const clientName = (meta?.isCombined ? meta?.primaryAccountName : meta?.accountName) || flatAccounts.find((fa) => String(fa.id) === String(accountId))?.name || "-";
  const accountNo = (meta?.isCombined ? meta?.primaryAccountCode : meta?.accountCode) || flatAccounts.find((fa) => String(fa.id) === String(accountId))?.code || "-";
  const currencyCode = meta?.currency || "-";

  const handlePrint = () => {
    logActivity({
      action: 'REPORT_PRINTED',
      entityType: 'Report',
      description: `Printed Account Statement — account ${accountNo} ${clientName}, ${from} to ${to}`,
      metadata: { accountCode: accountNo, accountName: clientName, from, to, currency },
    });
    const printableRoot = printRef.current;
    if (!printableRoot) return;

    const srcHeader = printableRoot.querySelector(".statement-report-modal-header, .srm-revo-header");
    const srcTitle = printableRoot.querySelector(".statement-report-modal-titlebar");
    const srcClientLine = printableRoot.querySelector(".statement-report-modal-clientline");
    const srcTable = printableRoot.querySelector(".statement-report-modal-table");
    if (!srcTitle || !srcClientLine || !srcTable) return;

    const allRows = Array.from(srcTable.querySelectorAll("tbody > tr")).map((r) => r.cloneNode(true));
    let footerRow = null;
    if (allRows.length && allRows[allRows.length - 1].classList.contains("statement-report-modal-footer-row")) {
      footerRow = allRows.pop();
    }

    printWithDomBuilder(async (container) => {
      const buildInfoTable = (pageNumText) => {
        const wrap = document.createElement("div");
        wrap.className = "statement-report-modal-info";
        wrap.innerHTML = `
          <table class="statement-report-modal-info-table" style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr><th>رقم الحساب</th><th>العملة</th><th>من تاريخ</th><th>الى تاريخ</th><th>تاريخ الكشف</th><th>الصفحة</th></tr></thead>
            <tbody><tr><td>${accountNo}</td><td>${currencyCode}</td><td>${from}</td><td>${to}</td><td>${statementDate}</td><td>${pageNumText || ""}</td></tr></tbody>
          </table>`;
        return wrap;
      };

      const buildTableSkeleton = () => {
        const table = document.createElement("table");
        table.className = "statement-report-modal-table";
        table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px";
        const colgroup = document.createElement("colgroup");
        colgroup.innerHTML = `<col style="width:15%"/><col style="width:17%"/><col style="width:25%"/><col style="width:12%"/><col style="width:12%"/><col style="width:19%"/>`;
        const thead = document.createElement("thead");
        thead.innerHTML = `<tr><th>تاريخ</th><th>رقم الفاتورة</th><th>الشرح</th><th>DR ${currency}</th><th>CR ${currency}</th><th>الرصيد</th></tr>`;
        const tbody = document.createElement("tbody");
        table.appendChild(colgroup); table.appendChild(thead); table.appendChild(tbody);
        return { table, tbody };
      };

      const createPage = (pageIndex, mode) => {
        const page = document.createElement("section");
        page.className = "print-page";
        const headerBox = document.createElement("div");
        headerBox.className = "page-header";
        if (mode === "full") {
          if (srcHeader) headerBox.appendChild(srcHeader.cloneNode(true));
          headerBox.appendChild(srcTitle.cloneNode(true));
          headerBox.appendChild(srcClientLine.cloneNode(true));
          headerBox.appendChild(buildInfoTable(""));
        }
        const bodyBox = document.createElement("div");
        bodyBox.className = "page-body";
        const { table, tbody } = buildTableSkeleton();
        bodyBox.appendChild(table);
        if (mode === "full") page.appendChild(headerBox);
        page.appendChild(bodyBox);
        container.appendChild(page);
        return { page, headerBox, bodyBox, tbody };
      };

      const pages = [];
      let current = createPage(1, "full");
      pages.push(current);

      const appendRowWithPagination = (rowNode) => {
        current.tbody.appendChild(rowNode);
        void current.page.offsetHeight;
        if (current.page.scrollHeight > current.page.clientHeight) {
          current.tbody.removeChild(rowNode);
          current = createPage(pages.length + 1, "tableOnly");
          pages.push(current);
          current.tbody.appendChild(rowNode);
          void current.page.offsetHeight;
        }
      };

      for (const row of allRows) appendRowWithPagination(row);
      if (footerRow) appendRowWithPagination(footerRow);

      const totalPages = pages.length;
      if (pages[0]) {
        const infoCell = pages[0].headerBox?.querySelector(".statement-report-modal-info tbody td:last-child");
        if (infoCell) infoCell.textContent = `1/${totalPages}`;
      }
    });
  };

  const handlePDF = async () => {
    const printableRoot = printRef.current;
    if (!printableRoot || !items.length) return;

    const srcHeader = printableRoot.querySelector(".statement-report-modal-header, .srm-revo-header");
    const srcTitle = printableRoot.querySelector(".statement-report-modal-titlebar");
    const srcClientLine = printableRoot.querySelector(".statement-report-modal-clientline");
    const srcTable = printableRoot.querySelector(".statement-report-modal-table");
    if (!srcTitle || !srcClientLine || !srcTable) return;

    const allRows = Array.from(srcTable.querySelectorAll("tbody > tr")).map(r => r.cloneNode(true));
    let footerRow = null;
    if (allRows.length && allRows[allRows.length - 1].classList.contains("statement-report-modal-footer-row")) {
      footerRow = allRows.pop();
    }

    const PAGE_W = 794;
    const PAGE_H = 1123;

    const buildInfoTable = (pageNumText) => {
      const wrap = document.createElement("div");
      wrap.className = "statement-report-modal-info";
      wrap.innerHTML = `<table class="statement-report-modal-info-table" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>رقم الحساب</th><th>العملة</th><th>من تاريخ</th><th>الى تاريخ</th><th>تاريخ الكشف</th><th>الصفحة</th></tr></thead><tbody><tr><td>${accountNo}</td><td>${currencyCode}</td><td>${from}</td><td>${to}</td><td>${statementDate}</td><td>${pageNumText || ""}</td></tr></tbody></table>`;
      return wrap;
    };

    const buildTableSkeleton = () => {
      const table = document.createElement("table");
      table.className = "statement-report-modal-table";
      table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px";
      const colgroup = document.createElement("colgroup");
      colgroup.innerHTML = `<col style="width:15%"/><col style="width:17%"/><col style="width:25%"/><col style="width:12%"/><col style="width:12%"/><col style="width:19%"/>`;
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr><th>تاريخ</th><th>رقم الفاتورة</th><th>الشرح</th><th>DR ${currency}</th><th>CR ${currency}</th><th>الرصيد</th></tr>`;
      const tbody = document.createElement("tbody");
      table.appendChild(colgroup); table.appendChild(thead); table.appendChild(tbody);
      return { table, tbody };
    };

    const wrapper = document.createElement("div");
    wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;background:#fff;`;
    document.body.appendChild(wrapper);

    const pageEls = [];

    const createPage = (mode) => {
      const page = document.createElement("div");
      page.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:#fff;box-sizing:border-box;padding:38px;`;
      if (mode === "full") {
        const headerBox = document.createElement("div");
        if (srcHeader) headerBox.appendChild(srcHeader.cloneNode(true));
        headerBox.appendChild(srcTitle.cloneNode(true));
        headerBox.appendChild(srcClientLine.cloneNode(true));
        headerBox.appendChild(buildInfoTable(""));
        page.appendChild(headerBox);
      }
      const { table, tbody } = buildTableSkeleton();
      page.appendChild(table);
      wrapper.appendChild(page);
      pageEls.push(page);
      return { page, tbody };
    };

    let current = createPage("full");

    const appendRowWithPagination = (rowNode) => {
      current.tbody.appendChild(rowNode);
      void current.page.offsetHeight;
      if (current.page.scrollHeight > current.page.clientHeight) {
        current.tbody.removeChild(rowNode);
        current = createPage("tableOnly");
        current.tbody.appendChild(rowNode);
        void current.page.offsetHeight;
      }
    };

    for (const row of allRows) appendRowWithPagination(row);
    if (footerRow) appendRowWithPagination(footerRow);

    const totalPages = pageEls.length;
    const infoCell = pageEls[0]?.querySelector(".statement-report-modal-info tbody td:last-child");
    if (infoCell) infoCell.textContent = `1/${totalPages}`;

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await html2canvas(pageEls[i], {
          scale: 2, useCORS: true, backgroundColor: "#fff",
          width: PAGE_W, height: PAGE_H,
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
      }
      pdf.save(`statement-${accountNo}-${from}-${to}.pdf`);
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  const handleNetScreenshot = async () => {
    const el = netPrintRef.current;
    if (!el) return;
    const prev = el.style.display;
    el.style.display = "block";
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#fff" });
      el.style.display = prev;
      const link = document.createElement("a");
      link.download = `net-position-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      el.style.display = prev;
    }
  };

  const handleNetPDF = async () => {
    const printableRoot = netPrintRef.current;
    if (!printableRoot || !netItems.length) return;

    const srcHeader = printableRoot.querySelector(".statement-report-modal-header, .srm-revo-header");
    const srcTitle  = printableRoot.querySelector(".statement-report-modal-titlebar");
    const srcClientLine = printableRoot.querySelector(".statement-report-modal-clientline");
    const srcTable  = printableRoot.querySelector(".statement-report-modal-table");
    if (!srcTitle || !srcClientLine || !srcTable) return;

    const allRows = Array.from(srcTable.querySelectorAll("tbody > tr")).map(r => r.cloneNode(true));
    let footerRow = null;
    if (allRows.length && allRows[allRows.length - 1].classList.contains("statement-report-modal-footer-row")) {
      footerRow = allRows.pop();
    }

    const netStatementDate = new Date().toISOString().split("T")[0];
    // A4 at 96 dpi: 794 × 1123 px; 10 mm margin (38 px) each side → content 718 × 1047 px
    const PAGE_W = 794;
    const PAGE_H = 1123;

    const buildInfoTable = (pageNumText) => {
      const wrap = document.createElement("div");
      wrap.className = "statement-report-modal-info";
      wrap.innerHTML = `<table class="statement-report-modal-info-table" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>العميل</th><th>المورد المرتبط</th><th>من تاريخ</th><th>الى تاريخ</th><th>تاريخ الكشف</th><th>الصفحة</th></tr></thead><tbody><tr><td>${netMeta?.customerName || ""}</td><td>${netMeta?.supplierName || "—"}</td><td>${from}</td><td>${to}</td><td>${netStatementDate}</td><td>${pageNumText || ""}</td></tr></tbody></table>`;
      return wrap;
    };

    const buildTableSkeleton = () => {
      const table = document.createElement("table");
      table.className = "statement-report-modal-table";
      table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px";
      const colgroup = document.createElement("colgroup");
      colgroup.innerHTML = `<col style="width:13%"/><col style="width:15%"/><col style="width:10%"/><col style="width:27%"/><col style="width:11%"/><col style="width:11%"/><col style="width:13%"/>`;
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr><th>تاريخ</th><th>رقم الفاتورة</th><th>الجهة</th><th>الشرح</th><th>DR USD</th><th>CR USD</th><th>الرصيد</th></tr>`;
      const tbody = document.createElement("tbody");
      table.appendChild(colgroup); table.appendChild(thead); table.appendChild(tbody);
      return { table, tbody };
    };

    // Off-screen container
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;background:#fff;`;
    document.body.appendChild(wrapper);

    const pageEls = [];

    const createPage = (mode) => {
      const page = document.createElement("div");
      // Plain block layout — flex would shrink children to fit, hiding overflow from scrollHeight
      page.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:#fff;box-sizing:border-box;padding:38px;`;

      if (mode === "full") {
        const headerBox = document.createElement("div");
        if (srcHeader) headerBox.appendChild(srcHeader.cloneNode(true));
        headerBox.appendChild(srcTitle.cloneNode(true));
        headerBox.appendChild(srcClientLine.cloneNode(true));
        headerBox.appendChild(buildInfoTable(""));
        page.appendChild(headerBox);
      }

      const { table, tbody } = buildTableSkeleton();
      page.appendChild(table);
      wrapper.appendChild(page);
      pageEls.push(page);
      return { page, tbody };
    };

    let current = createPage("full");

    const appendRowWithPagination = (rowNode) => {
      current.tbody.appendChild(rowNode);
      void current.page.offsetHeight;
      if (current.page.scrollHeight > current.page.clientHeight) {
        current.tbody.removeChild(rowNode);
        current = createPage("tableOnly");
        current.tbody.appendChild(rowNode);
        void current.page.offsetHeight;
      }
    };

    for (const row of allRows) appendRowWithPagination(row);
    if (footerRow) appendRowWithPagination(footerRow);

    // Update page count in first page header
    const totalPages = pageEls.length;
    const infoCell = pageEls[0]?.querySelector(".statement-report-modal-info tbody td:last-child");
    if (infoCell) infoCell.textContent = `1/${totalPages}`;

    // Let layout settle before capturing
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await html2canvas(pageEls[i], {
          scale: 2, useCORS: true, backgroundColor: "#fff",
          width: PAGE_W, height: PAGE_H,
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
      }
      pdf.save(`net-position-${Date.now()}.pdf`);
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  const handleNetPrint = () => {
    const printableRoot = netPrintRef.current;
    if (!printableRoot) return;

    const srcHeader = printableRoot.querySelector(".statement-report-modal-header, .srm-revo-header");
    const srcTitle  = printableRoot.querySelector(".statement-report-modal-titlebar");
    const srcClientLine = printableRoot.querySelector(".statement-report-modal-clientline");
    const srcTable  = printableRoot.querySelector(".statement-report-modal-table");
    if (!srcTitle || !srcClientLine || !srcTable) return;

    const allRows = Array.from(srcTable.querySelectorAll("tbody > tr")).map(r => r.cloneNode(true));
    let footerRow = null;
    if (allRows.length && allRows[allRows.length - 1].classList.contains("statement-report-modal-footer-row")) {
      footerRow = allRows.pop();
    }

    const netClientName = netMeta?.customerName || "-";
    const netStatementDate = new Date().toISOString().split("T")[0];

    printWithDomBuilder(async (container) => {
      const buildInfoTable = (pageNumText) => {
        const wrap = document.createElement("div");
        wrap.className = "statement-report-modal-info";
        wrap.innerHTML = `
          <table class="statement-report-modal-info-table" style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr><th>العميل</th><th>المورد المرتبط</th><th>من تاريخ</th><th>الى تاريخ</th><th>تاريخ الكشف</th><th>الصفحة</th></tr></thead>
            <tbody><tr>
              <td>${netMeta?.customerName || ""}</td>
              <td>${netMeta?.supplierName || "—"}</td>
              <td>${from}</td><td>${to}</td>
              <td>${netStatementDate}</td><td>${pageNumText || ""}</td>
            </tr></tbody>
          </table>`;
        return wrap;
      };

      const buildTableSkeleton = () => {
        const table = document.createElement("table");
        table.className = "statement-report-modal-table";
        table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px";
        const colgroup = document.createElement("colgroup");
        colgroup.innerHTML = `<col style="width:13%"/><col style="width:15%"/><col style="width:10%"/><col style="width:27%"/><col style="width:11%"/><col style="width:11%"/><col style="width:13%"/>`;
        const thead = document.createElement("thead");
        thead.innerHTML = `<tr><th>تاريخ</th><th>رقم الفاتورة</th><th>الجهة</th><th>الشرح</th><th>DR USD</th><th>CR USD</th><th>الرصيد</th></tr>`;
        const tbody = document.createElement("tbody");
        table.appendChild(colgroup); table.appendChild(thead); table.appendChild(tbody);
        return { table, tbody };
      };

      const createPage = (pageIndex, mode) => {
        const page = document.createElement("section");
        page.className = "print-page";
        const headerBox = document.createElement("div");
        headerBox.className = "page-header";
        if (mode === "full") {
          if (srcHeader) headerBox.appendChild(srcHeader.cloneNode(true));
          headerBox.appendChild(srcTitle.cloneNode(true));
          headerBox.appendChild(srcClientLine.cloneNode(true));
          headerBox.appendChild(buildInfoTable(""));
        }
        const bodyBox = document.createElement("div");
        bodyBox.className = "page-body";
        const { table, tbody } = buildTableSkeleton();
        bodyBox.appendChild(table);
        if (mode === "full") page.appendChild(headerBox);
        page.appendChild(bodyBox);
        container.appendChild(page);
        return { page, headerBox, bodyBox, tbody };
      };

      const pages = [];
      let current = createPage(1, "full");
      pages.push(current);

      const appendRowWithPagination = (rowNode) => {
        current.tbody.appendChild(rowNode);
        void current.page.offsetHeight;
        if (current.page.scrollHeight > current.page.clientHeight) {
          current.tbody.removeChild(rowNode);
          current = createPage(pages.length + 1, "tableOnly");
          pages.push(current);
          current.tbody.appendChild(rowNode);
          void current.page.offsetHeight;
        }
      };

      for (const row of allRows) appendRowWithPagination(row);
      if (footerRow) appendRowWithPagination(footerRow);

      const totalPages = pages.length;
      if (pages[0]) {
        const infoCell = pages[0].headerBox?.querySelector(".statement-report-modal-info tbody td:last-child");
        if (infoCell) infoCell.textContent = `1/${totalPages}`;
      }
    });
  };

  return (
    <div className="tb-wrap">
      {/* Controls */}
      <div className="tb-toolbar">
        <div className="tb-controls tb-controls-grid">
          <label className="tb-field">
            Account
            <div ref={accComboRef} style={{ position: "relative" }}>
              <input
                type="text"
                placeholder={accLoading ? "Loading…" : "Search account…"}
                disabled={accLoading}
                value={accOpen ? accSearch : (selectedAccount?.label ?? "")}
                onChange={(e) => { setAccSearch(e.target.value); setAccOpen(true); }}
                onFocus={() => { setAccSearch(""); setAccOpen(true); }}
                onClick={() => { setAccSearch(""); setAccOpen(true); }}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              {accOpen && filteredAccounts.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
                  background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto",
                }}>
                  {filteredAccounts.map((a) => (
                    <div
                      key={a.id}
                      onMouseDown={() => handleAccSelect(a)}
                      style={{
                        padding: "7px 12px", cursor: "pointer", fontSize: 13,
                        background: a.id === accountId ? "#eff6ff" : "transparent",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f0f9ff"}
                      onMouseLeave={(e) => e.currentTarget.style.background = a.id === accountId ? "#eff6ff" : "transparent"}
                    >
                      {a.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </label>
          {/* ── Optional second account for combined statement ── */}
          {canCombineAccounts && <label className="tb-field">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Combine with
              <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}>(optional)</span>
              {accountId2 && (
                <button
                  type="button"
                  onClick={() => { setAccountId2(""); setAccSearch2(""); }}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
                  title="Clear second account"
                >✕</button>
              )}
            </span>
            <div ref={accComboRef2} style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search second account…"
                value={accOpen2 ? accSearch2 : (flatAccounts.find(a => a.id === accountId2)?.label ?? accSearch2)}
                onChange={(e) => { setAccSearch2(e.target.value); setAccOpen2(true); }}
                onFocus={() => { setAccSearch2(""); setAccOpen2(true); }}
                onClick={() => { setAccSearch2(""); setAccOpen2(true); }}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              {accOpen2 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
                  background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto",
                }}>
                  <div
                    onMouseDown={() => { setAccountId2(""); setAccSearch2(""); setAccOpen2(false); }}
                    style={{ padding: "7px 12px", cursor: "pointer", fontSize: 12, color: "#6b7280", borderBottom: "1px solid #f1f5f9" }}
                  >— None (single account) —</div>
                  {(accSearch2.trim()
                    ? flatAccounts.filter(a => a.label.toLowerCase().includes(accSearch2.toLowerCase()) || a.code.toLowerCase().includes(accSearch2.toLowerCase()))
                    : flatAccounts
                  ).filter(a => a.id !== accountId).map((a) => (
                    <div
                      key={a.id}
                      onMouseDown={() => { setAccountId2(a.id); setAccSearch2(""); setAccOpen2(false); }}
                      style={{
                        padding: "7px 12px", cursor: "pointer", fontSize: 13,
                        background: a.id === accountId2 ? "#eff6ff" : "transparent",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f0f9ff"}
                      onMouseLeave={(e) => e.currentTarget.style.background = a.id === accountId2 ? "#eff6ff" : "transparent"}
                    >{a.label}</div>
                  ))}
                </div>
              )}
            </div>
          </label>}

          <label className="tb-field">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="tb-field">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="tb-field">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {["ALL", "S", "G"].map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </label>
          <label className="tb-field">
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="LL">LL</option>
            </select>
          </label>
          <button className="tb-btn tb-btn-primary" onClick={fetchStatement} disabled={loading || accLoading || !accountId}>
            {loading || accLoading ? "Loading…" : "Generate"}
          </button>
        </div>
        {accError && <div className="tb-error" style={{ marginTop: 12 }}>{accError}</div>}
        <div className="tb-actions">
          <button className="tb-btn" onClick={exportCSV} disabled={!items.length}>Export CSV</button>
          <button className="tb-btn tb-btn-primary" onClick={handlePrint} disabled={!items.length}>Print</button>
          {canDownloadPdf && (
            <button className="net-export-btn net-export-btn--pdf" onClick={handlePDF} disabled={!items.length}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
              PDF
            </button>
          )}
          <button
            className="tb-btn"
            style={{ marginLeft: "auto", background: allNetData ? "#1d4ed8" : undefined, color: allNetData ? "#fff" : undefined }}
            onClick={() => allNetData ? setAllNetData(null) : fetchAllNetPositions()}
            disabled={allNetLoading}
          >
            {allNetLoading ? "Loading…" : allNetData ? "Hide All Net Positions" : "All Customers Net Position"}
          </button>
        </div>

        {/* All customers net position panel */}
        {allNetData && (
          <div style={{ marginTop: 16, border: "2px solid #1d4ed8", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "#1d4ed8", fontSize: 15 }}>
                All Customers — Net Position
                {allNetData.from && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 10, color: "#6b7280" }}>{allNetData.from} → {allNetData.to}</span>}
              </h3>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{allNetData.customers.length} customers</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Linked Supplier</th>
                    <th style={{ textAlign: "right" }}>Opening Balance</th>
                    <th style={{ textAlign: "right" }}>Total DR</th>
                    <th style={{ textAlign: "right" }}>Total CR</th>
                    <th style={{ textAlign: "right" }}>Net Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {allNetData.customers.map((c) => (
                    <tr key={c.customerId} style={{ background: c.linkedSupplierId ? "#fef9c3" : undefined }}>
                      <td>{c.customerName}</td>
                      <td style={{ color: "#92400e", fontSize: 12 }}>{c.supplierName ?? "—"}</td>
                      <td className="num">{fmt(c.openingBalance)}</td>
                      <td className="num">{fmt(c.totalDebit)}</td>
                      <td className="num">{fmt(c.totalCredit)}</td>
                      <td className="num" style={{ fontWeight: 700, color: c.closingBalance > 0 ? "#15803d" : c.closingBalance < 0 ? "#dc2626" : undefined }}>
                        {fmt(c.closingBalance)}
                      </td>
                    </tr>
                  ))}
                  {!allNetData.customers.length && (
                    <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af" }}>No data for the selected range</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, background: "#f0f9ff" }}>
                    <td colSpan={2}>Total</td>
                    <td className="num">{fmt(allNetData.customers.reduce((s, c) => s + c.openingBalance, 0))}</td>
                    <td className="num">{fmt(allNetData.customers.reduce((s, c) => s + c.totalDebit, 0))}</td>
                    <td className="num">{fmt(allNetData.customers.reduce((s, c) => s + c.totalCredit, 0))}</td>
                    <td className="num" style={{ color: allNetData.customers.reduce((s, c) => s + c.closingBalance, 0) >= 0 ? "#15803d" : "#dc2626" }}>
                      {fmt(allNetData.customers.reduce((s, c) => s + c.closingBalance, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {err && <div className="tb-error">{err}</div>}

      {/* On-screen table */}
      <div style={{ marginTop: 8 }}>
        {meta && (
          <div className="tb-meta" style={{ marginBottom: 8 }}>
            <div>
              <strong>Account:</strong> {meta.accountCode} — {meta.accountName}
              {meta.isCombined && (
                <span style={{ marginLeft: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                  Combined
                </span>
              )}
            </div>
            <div><strong>Opening Balance:</strong> {fmt(meta.openingBalance)}</div>
            <div><strong>Total Debit:</strong> {fmt(meta.totalDebit)}</div>
            <div><strong>Total Credit:</strong> {fmt(meta.totalCredit)}</div>
            <div><strong>Closing Balance:</strong> {fmt(meta.closingBalance)}</div>
            {/* Net Position button — only for customers */}
            {parseSelected(accountId)?.kind === "customer" && (
              <button
                style={{ marginTop: 8, background: netView ? "#1d4ed8" : "#6b7280", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}
                onClick={() => {
                  const cid = parseSelected(accountId)?.idNum;
                  if (!netView) { setNetView(true); fetchNetStatement(cid); }
                  else setNetView(false);
                }}
              >
                {netView ? "Hide Net Position" : "Show Net Position"}
              </button>
            )}
          </div>
        )}

        {/* Net position view */}
        {netView && (
          <div style={{ marginBottom: 16, border: "2px solid #1d4ed8", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, color: "#1d4ed8" }}>Net Position</h3>
              <div className="net-export-bar">
                <button
                  className="net-export-btn net-export-btn--print"
                  disabled={!netItems.length}
                  onClick={handleNetPrint}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
                <button
                  className="net-export-btn net-export-btn--screenshot"
                  disabled={!netItems.length}
                  onClick={handleNetScreenshot}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Screenshot
                </button>
                <button
                  className="net-export-btn net-export-btn--pdf"
                  disabled={!netItems.length}
                  onClick={handleNetPDF}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                  PDF
                </button>
              </div>
            </div>
            {netMeta && (
              <div style={{ marginBottom: 8, fontSize: 13 }}>
                <div><strong>Customer:</strong> {netMeta.customerName}</div>
                {netMeta.supplierName && <div><strong>Linked Supplier:</strong> {netMeta.supplierName}</div>}
                <div><strong>Opening Balance:</strong> {fmt(netMeta.openingBalance)}</div>
                <div><strong>Total Debit:</strong> {fmt(netMeta.totalDebit)}</div>
                <div><strong>Total Credit:</strong> {fmt(netMeta.totalCredit)}</div>
                <div><strong>Net Closing Balance:</strong> <span style={{ fontWeight: "bold", color: netMeta.closingBalance >= 0 ? "#15803d" : "#dc2626" }}>{fmt(netMeta.closingBalance)}</span></div>
              </div>
            )}
            <table className="tb-table">
              <thead>
                <tr>
                  <th>Date</th><th>JV Number</th><th>Side</th><th>Description</th>
                  <th>DR USD</th><th>CR USD</th><th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {netItems.map((r, i) => (
                  <tr key={i} style={{ background: r.side === "supplier" ? "#fef9c3" : undefined }}>
                    <td>{r.date ?? ""}</td>
                    <td>
                      {r.journalVoucherId ? (
                        <span style={{ color: "#2563eb", cursor: "pointer", textDecoration: "underline" }} onClick={() => navigate(`/journal-voucher/${r.journalVoucherId}`)}>
                          {r.jvNumber ?? ""}
                        </span>
                      ) : (r.jvNumber ?? "")}
                    </td>
                    <td style={{ fontSize: 11, color: r.side === "supplier" ? "#92400e" : "#1e40af" }}>
                      {r.side === "supplier" ? "Supplier" : "Customer"}
                    </td>
                    <td>{r.description ?? ""}</td>
                    <td className="num">{fmt(r.debit)}</td>
                    <td className="num">{fmt(r.credit)}</td>
                    <td className="num">{fmt(r.balanceAfter)}</td>
                  </tr>
                ))}
                {!netItems.length && !loading && (
                  <tr><td colSpan={7} style={{ textAlign: "center" }}>No data — make sure a supplier is linked to this customer</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <table className="tb-table">
          <thead>
            <tr>
              <th>Date</th><th>JV Number</th><th>Doc No.</th><th>Kind</th>
              <th>Description</th>
              <th>DR {currency}</th>
              <th>CR {currency}</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {openingBalance !== 0 && (
              <tr style={{ background: "#f0f9ff", fontWeight: 600 }}>
                <td>{meta?.from ?? "—"}</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>رصيد سابق</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num">{fmt(openingBalance)}</td>
              </tr>
            )}
            {items.map((r, i) => (
              <tr key={r._ord ?? i}>
                <td>{r.date ?? ""}</td>
                <td>
                  {r.journalVoucherId ? (
                    <span
                      style={{ color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => navigate(`/journal-voucher/${r.journalVoucherId}`)}
                    >
                      {r.jvNumber ?? ""}
                    </span>
                  ) : (r.jvNumber ?? "")}
                </td>
                <td>{r.docNbr ?? ""}</td><td>{r.kind ?? ""}</td>
                <td>{displayDesc(r.description)}</td>
                <td className="num">{fmt(r.debit)}</td>
                <td className="num">{fmt(r.credit)}</td>
                <td className="num">{fmt(r.balanceAfter)}</td>
              </tr>
            ))}
            {!items.length && !loading && !err && (
              <tr><td colSpan={8} style={{ textAlign: "center" }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NET POSITION PRINT-ONLY source */}
      <div className="statement-report-modal-body" ref={netPrintRef} style={{ display: "none" }}>
        <div className="statement-report-modal-a4">
          {isRevo ? (
            <div className="srm-revo-header" style={{ display:"flex", justifyContent:"space-between", padding:"5px", border:"1px solid #000", margin:"7px", height:"150px", alignItems:"center", boxSizing:"border-box" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", padding:"8px" }}>
                <img src={revoLogoSrc} alt="Revo Logo" style={{ maxHeight:"120px", maxWidth:"220px", objectFit:"contain", display:"block" }} />
              </div>
              <div style={{ textAlign:"right", direction:"rtl", fontSize:"14px", lineHeight:"1.4", fontFamily:"Arial, sans-serif" }}>
                <h2 style={{ fontFamily:"Arial, sans-serif", fontSize:"25px", margin:0, fontWeight:"bold" }}>REVO GLASS COMPANY</h2>
                <h2 style={{ fontFamily:"Arial, sans-serif", fontSize:"25px", margin:0, fontWeight:"bold" }}>شــــــركـــة ريـــفـــو جــــلاس</h2>
                <p style={{ fontWeight:"normal", margin:0 }}>ســـوريـــا – حــلب – الــرامـوســة</p>
                <div style={{ fontFamily:"Times New Roman, Times, serif", fontSize:"14px", display:"flex", flexDirection:"column", direction:"rtl" }}>
                  <div style={{ display:"flex", alignItems:"center" }}><span style={{ width:"80px", textAlign:"right" }}>تلفون</span><span style={{ width:"10px", textAlign:"center", display:"inline-block" }}>:</span><span style={{ direction:"ltr" }}>+963 995118111</span></div>
                  <div style={{ display:"flex", alignItems:"center" }}><span style={{ width:"80px", textAlign:"right" }}>للاستفسار</span><span style={{ width:"10px", textAlign:"center", display:"inline-block" }}>:</span><span style={{ direction:"ltr" }}>+963 995434366</span></div>
                  <div style={{ display:"flex", alignItems:"center" }}><span style={{ width:"80px", textAlign:"right" }}>البريد الالكتروني</span><span style={{ width:"10px", textAlign:"center", display:"inline-block" }}>:</span><span style={{ flex:1, textAlign:"right" }}>revo.glass.co@gmail.com</span></div>
                </div>
              </div>
            </div>
          ) : type !== "G" ? (
            <div className="statement-report-modal-header">
              <div className="statement-report-modal-header-right">
                <h2 className="statement-report-modal-company-arabic-title">شركة شمعون</h2>
                <h2 className="statement-report-modal-company-arabic-subtitle">للزجاج و المرايا</h2>
                <p className="statement-report-modal-small-subtitle">الحدث / شويفات</p>
                <div className="statement-report-modal-arabic-contact">
                  <div className="statement-report-modal-arabic-line"><span className="statement-report-modal-arabic-label">تلفون</span><span className="statement-report-modal-arabic-colon">:</span><span className="statement-report-modal-arabic-value">05/814964 05/810888</span></div>
                  <div className="statement-report-modal-arabic-line"><span className="statement-report-modal-arabic-label">خلوي / واتساب</span><span className="statement-report-modal-arabic-colon">:</span><span className="statement-report-modal-arabic-value">79/100068</span></div>
                  <div className="statement-report-modal-arabic-line"><span className="statement-report-modal-arabic-label">فاكس</span><span className="statement-report-modal-arabic-colon">:</span><span className="statement-report-modal-arabic-value">05/814961</span></div>
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
          ) : null}

          <div className="statement-report-modal-titlebar" style={{ textAlign:"center", fontWeight:700, fontSize:18, margin:"8px 0" }}>
            كشف حساب صافي
          </div>

          <div className="statement-report-modal-clientline" style={{ marginBottom:6 }}>
            <span className="statement-report-modal-clientline-label">السادة</span>
            <span className="statement-report-modal-clientline-colon">:</span>
            <span className="statement-report-modal-clientline-value" style={{ marginInlineStart:6 }}>
              {netMeta?.customerName || clientName}
              {netMeta?.supplierName ? ` / ${netMeta.supplierName}` : ""}
            </span>
          </div>

          <div className="statement-report-modal-table-wrap" style={{ marginTop:8 }}>
            <table className="statement-report-modal-table" style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <colgroup>
                <col style={{ width:"13%" }}/><col style={{ width:"15%" }}/><col style={{ width:"10%" }}/>
                <col style={{ width:"27%" }}/><col style={{ width:"11%" }}/><col style={{ width:"11%" }}/><col style={{ width:"13%" }}/>
              </colgroup>
              <thead>
                <tr>
                  <th>تاريخ</th><th>رقم الفاتورة</th><th>الجهة</th><th>الشرح</th>
                  <th>DR USD</th><th>CR USD</th><th>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {netMeta?.openingBalance !== undefined && (
                  <tr className="statement-report-modal-opening-row">
                    <td>{from}</td><td>—</td><td>—</td><td>رصيد سابق</td>
                    <td>{fmtPrint(0)}</td><td>{fmtPrint(0)}</td><td>{fmtPrint(netMeta.openingBalance)}</td>
                  </tr>
                )}
                {netItems.map((r, i) => (
                  <tr key={`net-print-${i}`}>
                    <td>{String(r.date ?? "").split("T")[0]}</td>
                    <td>{r.jvNumber ?? ""}</td>
                    <td>{r.side === "supplier" ? "مورد" : "عميل"}</td>
                    <td>{r.description ?? ""}</td>
                    <td>{fmtPrint(r.debit)}</td>
                    <td>{fmtPrint(r.credit)}</td>
                    <td>{fmtPrint(r.balanceAfter)}</td>
                  </tr>
                ))}
                <tr className="statement-report-modal-footer-row">
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-label" style={{ textAlign:"center", fontWeight:700, fontSize:"14px" }}>رصيد</td>
                  <td className="num footer-amount">{fmtPrint(netMeta?.closingBalance ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY source */}
      <div className="statement-report-modal-body" ref={printRef} style={{ display: "none" }}>
        <div className="statement-report-modal-a4">

          {isRevo ? (
            <div
              className="srm-revo-header"
              style={{ display: "flex", justifyContent: "space-between", padding: "5px", border: "1px solid #000", margin: "7px", height: "150px", alignItems: "center", boxSizing: "border-box" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "8px" }}>
                <img src={revoLogoSrc} alt="Revo Logo" style={{ maxHeight: "120px", maxWidth: "220px", objectFit: "contain", display: "block" }} />
              </div>
              <div style={{ textAlign: "right", direction: "rtl", fontSize: "14px", lineHeight: "1.4", fontFamily: "Arial, sans-serif" }}>
                <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: "25px", margin: 0, fontWeight: "bold" }}>REVO GLASS COMPANY</h2>
                <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: "25px", margin: 0, fontWeight: "bold" }}>شــــــركـــة ريـــفـــو جــــلاس</h2>
                <p style={{ fontWeight: "normal", margin: 0 }}>ســـوريـــا – حــلب – الــرامـوســة</p>
                <div style={{ fontFamily: "Times New Roman, Times, serif", fontSize: "14px", display: "flex", flexDirection: "column", direction: "rtl" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ width: "80px", textAlign: "right" }}>تلفون</span>
                    <span style={{ width: "10px", textAlign: "center", display: "inline-block" }}>:</span>
                    <span style={{ direction: "ltr" }}>+963 995118111</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ width: "80px", textAlign: "right" }}>البريد الالكتروني</span>
                    <span style={{ width: "10px", textAlign: "center", display: "inline-block" }}>:</span>
                    <span style={{ flex: 1, textAlign: "right" }}>revo.glass.co@gmail.com</span>
                  </div>
                </div>
              </div>
            </div>
          ) : type !== "G" ? (
            <div className="statement-report-modal-header">
              <div className="statement-report-modal-header-right">
                <h2 className="statement-report-modal-company-arabic-title">شركة شمعون</h2>
                <h2 className="statement-report-modal-company-arabic-subtitle">للزجاج و المرايا</h2>
                <p className="statement-report-modal-small-subtitle">الحدث / شويفات</p>
                <div className="statement-report-modal-arabic-contact">
                  <div className="statement-report-modal-arabic-line"><span className="statement-report-modal-arabic-label">تلفون</span><span className="statement-report-modal-arabic-colon">:</span><span className="statement-report-modal-arabic-value">05/814964 05/810888</span></div>
                  <div className="statement-report-modal-arabic-line"><span className="statement-report-modal-arabic-label">خلوي / واتساب</span><span className="statement-report-modal-arabic-colon">:</span><span className="statement-report-modal-arabic-value">79/100068</span></div>
                  <div className="statement-report-modal-arabic-line"><span className="statement-report-modal-arabic-label">فاكس</span><span className="statement-report-modal-arabic-colon">:</span><span className="statement-report-modal-arabic-value">05/814961</span></div>
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
          ) : null}

          <div className="statement-report-modal-titlebar" style={{ textAlign: "center", fontWeight: 700, fontSize: 18, margin: "8px 0" }}>
            كشف حساب
          </div>

          <div className="statement-report-modal-clientline" style={{ marginBottom: 6 }}>
            <span className="statement-report-modal-clientline-label">السادة</span>
            <span className="statement-report-modal-clientline-colon">:</span>
            <span className="statement-report-modal-clientline-value" style={{ marginInlineStart: 6 }}>{clientName}</span>
          </div>

          <div className="statement-report-modal-info">
            <table className="statement-report-modal-info-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>رقم الحساب</th><th>العملة</th><th>من تاريخ</th>
                  <th>الى تاريخ</th><th>تاريخ الكشف</th><th>الصفحة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{accountNo}</td><td>{currencyCode}</td>
                  <td>{from}</td><td>{to}</td>
                  <td>{statementDate}</td><td>&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="statement-report-modal-table-wrap" style={{ marginTop: 8 }}>
            <table className="statement-report-modal-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <colgroup>
                <col style={{ width: "15%" }} /><col style={{ width: "17%" }} />
                <col style={{ width: "25%" }} /><col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} /><col style={{ width: "19%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>تاريخ</th><th>رقم الفاتورة</th><th>الشرح</th>
                  <th>DR {currency}</th><th>CR {currency}</th><th>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {!(items[0] && looksLikeOpening(items[0].description || "")) && (
                  <tr className="statement-report-modal-opening-row">
                    <td>{from}</td><td>—</td><td>رصيد سابق</td>
                    <td>{fmtPrint(0)}</td><td>{fmtPrint(0)}</td><td>{fmtPrint(openingBalance)}</td>
                  </tr>
                )}
                {items.map((r, i) => (
                  <tr key={`print-row-${i}`}>
                    <td>{String(r.date ?? "").split("T")[0]}</td>
                    <td>{r.docNbr}</td>
                    <td>{displayDesc(r.description)}</td>
                    <td>{fmtPrint(r.debit || 0)}</td>
                    <td>{fmtPrint(r.credit || 0)}</td>
                    <td>{fmtPrint(r.balanceAfter || 0)}</td>
                  </tr>
                ))}
                <tr className="statement-report-modal-footer-row">
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-spacer">&nbsp;</td>
                  <td className="footer-label" style={{ textAlign: "center", fontWeight: 700, fontSize: "14px" }}>رصيد</td>
                  <td className="num footer-amount">{fmtPrint(closingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}