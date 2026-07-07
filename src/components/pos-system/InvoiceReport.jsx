import React, { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { axiosClient } from "../api/axiosClient";
import { buildInvoiceHtml, INLINE_INVOICE_CSS } from "./invoicePreviewModal";
import revoLogoSrc from "../revo-logo/revo.png";
import "./InvoiceReport.css";

async function toBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

const INVOICE_TYPES = ["ALL", "S", "G", "RTN", "RVR"];

const TYPE_LABEL = { S: "S", G: "G", RTN: "RTN", RVR: "RVR", ALL: "All Types" };

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmt(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day}-${MONTHS[Number(m) - 1]}-${y}`;
}

// ─── iframe pool ─────────────────────────────────────────────────────────────
// Pre-create POOL_SIZE iframes once and reuse them across all invoices.
// Queue-based acquire: zero polling, O(1) hand-off — no setTimeout storm.
const POOL_SIZE = 6;

function createPool() {
  const frames = Array.from({ length: POOL_SIZE }, () => {
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-99999px",
      top: "0",
      width: "820px",
      height: "1200px",
      border: "none",
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.appendChild(iframe);
    return iframe;
  });
  return { frames, available: [...frames], queue: [] };
}

function destroyPool(pool) {
  pool.frames.forEach((iframe) => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  });
}

function acquireFrame(pool) {
  return new Promise((resolve) => {
    if (pool.available.length > 0) {
      resolve(pool.available.pop());
    } else {
      pool.queue.push(resolve);
    }
  });
}

function releaseFrame(pool, iframe) {
  if (pool.queue.length > 0) {
    pool.queue.shift()(iframe);
  } else {
    pool.available.push(iframe);
  }
}

// ─── iframe helpers ───────────────────────────────────────────────────────────
function getPagesFromWin(win) {
  const root = win.document.getElementById("pages-root");
  if (!root) return [];
  return Array.from(root.children).filter(
    (el) =>
      el.classList &&
      el.classList.contains("invoice-a4-wrapper") &&
      el.offsetParent !== null &&
      el.getBoundingClientRect().height > 0
  );
}

// Pagination script is synchronous — one stable tick at 30ms is enough.
async function waitForPages(win, timeoutMs = 4000) {
  const t0 = Date.now();
  let lastSig = "";
  while (Date.now() - t0 < timeoutMs) {
    const pages = getPagesFromWin(win);
    const sig = pages.length + ":" +
      pages.map((p) => Math.round(p.getBoundingClientRect().height)).join(",");
    if (sig === lastSig && pages.length > 0) return pages;
    lastSig = sig;
    await new Promise((r) => setTimeout(r, 30));
  }
  return getPagesFromWin(win);
}

async function renderInvoiceToPages(invoiceData, pool, companyOpts = {}) {
  const iframe = await acquireFrame(pool);

  return new Promise((resolve, reject) => {
    const baseHref = window.location.origin + "/";
    const html = buildInvoiceHtml(invoiceData, { inlineCss: INLINE_INVOICE_CSS, baseHref, ...companyOpts });

    iframe.onload = async () => {
      try {
        const win = iframe.contentWindow;
        win?.repaginateAndAdjust?.();
        const pages = await waitForPages(win);

        // scale 2: excellent print quality, ~2× faster than scale 3
        const canvases = await Promise.all(
          pages.map((page) =>
            html2canvas(page, {
              scale: 2,
              useCORS: true,
              backgroundColor: "#ffffff",
              logging: false,
              scrollX: 0,
              scrollY: 0,
              windowWidth: page.scrollWidth || 820,
              windowHeight: page.scrollHeight || 1200,
            })
          )
        );
        resolve(canvases);
      } catch (e) {
        reject(e);
      } finally {
        releaseFrame(pool, iframe); // return iframe to pool
      }
    };

    iframe.onerror = (e) => {
      releaseFrame(pool, iframe);
      reject(e);
    };

    iframe.srcdoc = html;
  });
}

// ─── component ────────────────────────────────────────────────────────────────
export default function InvoiceReport() {
  const today = toYMD(new Date());
  const monthAgo = toYMD(new Date(Date.now() - 30 * 86400_000));

  const [from, setFrom]           = useState(monthAgo);
  const [to, setTo]               = useState(today);
  const [type, setType]           = useState("ALL");
  const [minTotal, setMinTotal]   = useState("");
  const [maxCount, setMaxCount]   = useState("");

  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState("");

  const [pdfProgress, setPdfProgress] = useState(null); // null | { done, total }

  const [companyOpts, setCompanyOpts] = useState({ isRevo: false, logoBase64: "" });
  const [shamounSigBase64, setShamounSigBase64] = useState("");
  const [includeShamounSig, setIncludeShamounSig] = useState(false);
  const shamounSigCache = useRef("");

  useEffect(() => {
    axiosClient.get("/company").then(({ data }) => {
      const active = Array.isArray(data) ? data.find((c) => c.isActive) : null;
      const revo = !!active?.companyName?.toLowerCase().includes("revo");
      if (revo) {
        toBase64(revoLogoSrc).then((logo) =>
          setCompanyOpts({ isRevo: true, logoBase64: logo })
        );
      } else {
        setCompanyOpts({ isRevo: false, logoBase64: "" });
      }
    }).catch(() => {});
  }, []);

  const activeFilters = useRef({ from, to, type, minTotal, maxCount });

  const buildParams = (overrides = {}) => {
    const f = { ...activeFilters.current, ...overrides };
    const p = { from: f.from, to: f.to };
    if (f.type && f.type !== "ALL") p.type = f.type;
    if (f.minTotal && !isNaN(Number(f.minTotal))) p.minTotal = Number(f.minTotal);
    if (f.maxCount && Number(f.maxCount) > 0 && !isNaN(Number(f.maxCount))) p.maxCount = Number(f.maxCount);
    return p;
  };

  const fetchPage = async (pageNum, newFilters) => {
    setLoading(true);
    setErr("");
    try {
      const params = { ...buildParams(newFilters), page: pageNum, limit: 100 };
      const { data } = await axiosClient.get("/invoices/v1/report", { params });
      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(pageNum);
    } catch {
      setErr("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    activeFilters.current = { from, to, type, minTotal, maxCount };
    fetchPage(1);
  };

  const handleToggleShamounSig = async () => {
    const next = !includeShamounSig;
    setIncludeShamounSig(next);
    if (next && !shamounSigCache.current) {
      const b64 = await toBase64("/assets/shamoun logo and signature.svg");
      shamounSigCache.current = b64;
      setShamounSigBase64(b64);
    } else if (!next) {
      setShamounSigBase64("");
    } else {
      setShamounSigBase64(shamounSigCache.current);
    }
  };

    const handleDownloadPDF = async ({ forceHeaderOnG = false } = {}) => {
    setPdfProgress({ done: 0, total: 0, currentInvoice: null });
    setErr("");
    let pool = null;
    try {
      // 1. Fetch all matching rows (IDs + invoice numbers)
      const params = { ...buildParams(), all: true };
      const { data: allData } = await axiosClient.get("/invoices/v1/report", { params });
      const allRows = allData.data ?? [];

      if (!allRows.length) {
        setErr("No invoices to export.");
        setPdfProgress(null);
        return;
      }

      setPdfProgress({ done: 0, total: allRows.length, currentInvoice: null });

      // 2. Batch-fetch all invoice details in chunks of 25
      //    (25 IDs per request keeps URL length safe while minimising round trips)
      const FETCH_CHUNK = 25;
      const allInvoiceData = [];
      for (let i = 0; i < allRows.length; i += FETCH_CHUNK) {
        const ids = allRows.slice(i, i + FETCH_CHUNK).map((r) => r.id).join(",");
        const { data: batchData } = await axiosClient.get("/invoices/v1/batch", { params: { ids } });
        allInvoiceData.push(...(Array.isArray(batchData) ? batchData : []));
      }

      // 3. Pipeline render: keep 6 iframes rendering at all times.
      //    Promises are created all-at-once (limited by semaphore), so invoice N+1
      //    starts rendering the moment a slot is free — we never sit idle waiting.
      const CONCURRENCY = 6;
      let slots = CONCURRENCY; // available render slots
      const waiting = [];       // queue of resolve callbacks

      const acquire = () =>
        new Promise((res) => {
          if (slots > 0) { slots--; res(); }
          else waiting.push(res);
        });

      const release = () => {
        if (waiting.length > 0) {
          const next = waiting.shift();
          next();
        } else {
          slots++;
        }
      };

      // Create the iframe pool — reused across all invoices (no per-invoice DOM create/destroy)
      pool = createPool();

      // Kick off all renders — pool size naturally caps concurrency at POOL_SIZE
      const renderPromises = allInvoiceData.map((invoiceData) =>
        (async () => {
          await acquire();
          try {
            return await renderInvoiceToPages(invoiceData, pool, { ...companyOpts, forceHeaderOnG, shamounSigBase64 });
          } finally {
            release();
          }
        })()
      );

      // 4. Add pages to PDF in original order; free each canvas immediately to save RAM
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      let firstPage = true;
      let done = 0;

      for (let i = 0; i < renderPromises.length; i++) {
        setPdfProgress({
          done: i,
          total: allRows.length,
          currentInvoice: allRows[i]?.invoiceNumber || `#${allRows[i]?.id}`,
        });

        const canvases = await renderPromises[i];

        for (const canvas of canvases) {
          if (!firstPage) pdf.addPage("a4", "portrait");
          firstPage = false;
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, 210, 297);
          // Free canvas memory immediately — 500 invoices × ~14 MB each would OOM
          canvas.width = 0;
          canvas.height = 0;
        }

        done++;
        setPdfProgress({
          done,
          total: allRows.length,
          currentInvoice: allRows[done]?.invoiceNumber || null,
        });
      }

      const dateStr = from && to ? `${from}_${to}` : today;
      pdf.save(`invoices-report-${dateStr}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      setErr("PDF generation failed. See console for details.");
    } finally {
      if (pool) destroyPool(pool);
      setPdfProgress(null);
    }
  };

  const [printing, setPrinting] = useState(false);
  const [rowOrder, setRowOrder] = useState("asc");

  const handlePrintTable = async () => {
    if (!rows.length) return;
    setPrinting(true);
    setErr("");
    try {
      const params = { ...buildParams(), all: true };
      const { data: allData } = await axiosClient.get("/invoices/v1/report", { params });
      let allRows = allData.data ?? [];
      if (!allRows.length) return;

      if (rowOrder === "desc") allRows = [...allRows].reverse();

      const grandSum = allRows.reduce((s, r) => s + (Number(r.grandTotal) || 0), 0);
      const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const typeColors = { S: "#1d4ed8", G: "#854d0e", RTN: "#b91c1c", RVR: "#7c3aed" };
      const totalCount = allRows.length;
      const rowsHtml = allRows.map((r, i) => `
        <tr>
          <td>${rowOrder === "asc" ? i + 1 : totalCount - i}</td>
          <td class="mono">${esc(r.invoiceNumber)}</td>
          <td>${esc(fmtDate(r.date))}</td>
          <td>${esc(r.customerName ?? "-")}</td>
          <td style="color:${typeColors[r.invoiceType] ?? "#111"};font-weight:700">${esc(r.invoiceType)}</td>
          <td class="num">${fmt(r.grandTotal)}</td>
        </tr>`).join("");

      const printWin = window.open("", "_blank", "width=960,height=720");
      if (!printWin) return;
      printWin.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<title>Invoice Report ${from} – ${to}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;margin:20px;color:#111}
  h2{margin:0 0 4px;font-size:18px}
  .meta{font-size:12px;color:#555;margin-bottom:14px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #d1d5db;padding:7px 10px;text-align:left}
  th{background:#1d4ed8;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.4px}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  td.mono{font-family:monospace;font-size:12px}
  tbody tr:nth-child(even) td{background:#f8fafc}
  tfoot td{border-top:2px solid #374151;background:#f0f7ff;font-weight:700}
  .foot-label{text-align:right;color:#374151}
  @media print{body{margin:10mm}}
</style>
</head><body>
<h2>Invoice Report</h2>
<div class="meta">${from} – ${to}${type !== "ALL" ? ` &nbsp;·&nbsp; Type: ${type}` : ""} &nbsp;·&nbsp; ${allRows.length} invoices</div>
<table>
  <thead><tr><th>#</th><th>Invoice No.</th><th>Date</th><th>Customer</th><th>Type</th><th class="num">Grand Total</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot><tr><td colspan="5" class="foot-label">Total</td><td class="num">${fmt(grandSum)}</td></tr></tfoot>
</table>
<script>window.onload=function(){window.print();window.addEventListener('afterprint',function(){window.close();});}<\/script>
</body></html>`);
      printWin.document.close();
    } catch {
      setErr("Failed to fetch data for printing.");
    } finally {
      setPrinting(false);
    }
  };

  // Totals row
  const displayRows = rowOrder === "desc" ? [...rows].reverse() : rows;
  const sumTotal = rows.reduce((s, r) => s + (Number(r.grandTotal) || 0), 0);

  return (
    <div className="inv-report">
      {/* ── Filter Bar ── */}
      <div className="inv-report-filters">
        <label className="inv-report-filter-group">
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="inv-report-filter-group">
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="inv-report-filter-group">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {INVOICE_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
            ))}
          </select>
        </label>
        <label className="inv-report-filter-group">
          <span>Min Total</span>
          <input
            type="number"
            placeholder="0"
            value={minTotal}
            onChange={(e) => setMinTotal(e.target.value)}
            min="0"
          />
        </label>
        <label className="inv-report-filter-group">
          <span>Max Invoices</span>
          <input
            type="number"
            placeholder="All"
            value={maxCount}
            onChange={(e) => setMaxCount(e.target.value)}
            min="1"
            step="1"
          />
        </label>
        <button className="inv-report-apply-btn" onClick={handleApply} disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </button>
        <button
          className="inv-report-pdf-btn"
          onClick={handleDownloadPDF}
          disabled={!!pdfProgress || loading}
          title="Download all filtered invoices as PDF"
        >
          Download PDF
        </button>
        <button
          className="inv-report-pdf-btn inv-report-pdf-header-btn"
          onClick={() => handleDownloadPDF({ forceHeaderOnG: true })}
          disabled={!!pdfProgress || loading}
          title="Download PDF — G-type invoices will include the company header logo"
        >
          Download PDF with Header
        </button>
        <button
          className={`inv-report-sig-btn${includeShamounSig ? " inv-report-sig-btn--active" : ""}`}
          onClick={handleToggleShamounSig}
          title="Toggle Shamou logo & signature in المستلم / الإمضاء section"
        >
          {includeShamounSig ? "Shamou Sig: ON" : "Shamou Sig: OFF"}
        </button>
        <button
          className="inv-report-print-order-btn"
          onClick={() => setRowOrder((o) => o === "asc" ? "desc" : "asc")}
          title="Toggle print order"
        >
          {rowOrder === "asc" ? "Order: 1 → N" : "Order: N → 1"}
        </button>
        <button
          className="inv-report-print-btn"
          onClick={handlePrintTable}
          disabled={!rows.length || loading || printing}
          title="Print all filtered invoices as a table"
        >
          {printing ? "Loading…" : "Print Table"}
        </button>
      </div>

      {err && <div className="inv-report-error">{err}</div>}

      {/* ── PDF Generation Overlay ── */}
      {pdfProgress && (
        <div className="inv-report-pdf-overlay">
          <div className="inv-report-pdf-dialog">
            <div className="inv-report-pdf-spinner" />
            <div className="inv-report-pdf-dialog-title">Generating PDF…</div>
            <div className="inv-report-pdf-dialog-sub">
              Invoice {pdfProgress.done} of {pdfProgress.total}
              {pdfProgress.currentInvoice && (
                <span className="inv-report-pdf-dialog-inv">
                  &nbsp;·&nbsp;{pdfProgress.currentInvoice}
                </span>
              )}
            </div>
            <div className="inv-report-pdf-bar-track">
              <div
                className="inv-report-pdf-bar-fill"
                style={{
                  width: pdfProgress.total
                    ? `${Math.round((pdfProgress.done / pdfProgress.total) * 100)}%`
                    : "0%",
                }}
              />
            </div>
            <div className="inv-report-pdf-pct">
              {pdfProgress.total
                ? `${Math.round((pdfProgress.done / pdfProgress.total) * 100)}%`
                : "0%"}
            </div>
          </div>
        </div>
      )}

      {/* ── Results Table ── */}
      {rows.length > 0 || loading ? (
        <>
          <div className="inv-report-meta">
            Showing {rows.length} of {total} invoices
            {total > 0 && (
              <span className="inv-report-meta-sum">
                &nbsp;·&nbsp;Page total: <strong>{fmt(sumTotal)}</strong>
              </span>
            )}
          </div>

          <div className="inv-report-table-wrap">
            <table className="inv-report-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th className="num">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => {
                  const rowNum = rowOrder === "asc"
                    ? (page - 1) * 100 + i + 1
                    : total - ((page - 1) * 100 + i);
                  return (
                    <tr key={r.id}>
                      <td>{rowNum}</td>
                      <td className="inv-report-inv-num">{r.invoiceNumber}</td>
                      <td>{fmtDate(r.date)}</td>
                      <td>{r.customerName ?? "-"}</td>
                      <td>
                        <span className={`inv-report-type-badge type-${r.invoiceType}`}>
                          {r.invoiceType}
                        </span>
                      </td>
                      <td className="num">{fmt(r.grandTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="inv-report-foot-label">Page Total</td>
                  <td className="num inv-report-foot-total">{fmt(sumTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="inv-report-pagination">
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page <= 1 || loading}
              >
                ← Prev
              </button>
              <span>Page {page} / {totalPages}</span>
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={page >= totalPages || loading}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        !loading && (
          <div className="inv-report-empty">
            Set filters above and press <strong>Apply</strong> to load invoices.
          </div>
        )
      )}
    </div>
  );
}
