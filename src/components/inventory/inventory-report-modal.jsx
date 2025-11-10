import React, { useEffect, useMemo } from "react";
import "./inventory-report-modal.css";

/* ----------------- Utilities ----------------- */
const fmt2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};
const prettyDims = (L, W) => {
  const l = Math.floor(Number(L) || 0);
  const w = Math.floor(Number(W) || 0);
  if (l && w) return `${l}×${w}`;
  return "-";
};
const typeOf = (t) => String(t || "").toLowerCase();

/* Group by "<thickness>ملم <itemName>" and merge rows by (dimension + origin) */
function useGroupedMerged(rows, qtyMap, sqmMap) {
  return useMemo(() => {
    const order = [];            // group order (first-seen)
    const groups = new Map();    // key -> { title, rows: [aggRows], totals: {box, sheet} }

    (rows || []).forEach((r) => {
      const groupKey = `${fmt2(r.thickness)}ملم ${r.itemName || ""}`.trim();
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          title: groupKey,
          rowsMap: new Map(),   // key: `${L}x${W}|${origin}`
          rows: [],             // materialized later; preserve first-seen
          rowKeysOrder: [],
          totals: { box: 0, sheet: 0 },
        });
        order.push(groupKey);
      }
      const g = groups.get(groupKey);

      const vid = Number(r.variantId ?? r.id);
      const qty = qtyMap.get(vid);
      const sqm = sqmMap.get(vid);
      const t = typeOf(r.type);

      // header totals
      if (Number.isFinite(qty)) {
        if (t === "box")   g.totals.box   += Number(qty);
        if (t === "sheet") g.totals.sheet += Number(qty);
      }

      // aggregate by dimension + origin
      const L = Math.floor(Number(r.length) || 0);
      const W = Math.floor(Number(r.width)  || 0);
      const origin = r.origin || "";
      const aggKey = `${L}x${W}|${origin}`;

      if (!g.rowsMap.has(aggKey)) {
        g.rowsMap.set(aggKey, {
          idKey: aggKey,
          length: L,
          width: W,
          origin,
          qtyBox: 0,
          qtySheet: 0,
          sqmBox: 0,
          sqmSheet: 0,
        });
        g.rowKeysOrder.push(aggKey);
      }
      const agg = g.rowsMap.get(aggKey);

      const q = Number.isFinite(qty) ? Number(qty) : 0;
      const s = Number.isFinite(sqm) ? Number(sqm) : 0;

      if (t === "box") {
        agg.qtyBox += q;
        agg.sqmBox += s;
      } else if (t === "sheet") {
        agg.qtySheet += q;
        agg.sqmSheet += s;
      } else {
        // include sqm-only/unit in total sqm if ever present
        agg.sqmSheet += s;
      }
    });

    // materialize rows (keep order)
    for (const key of order) {
      const g = groups.get(key);
      g.rows = g.rowKeysOrder.map((rk) => g.rowsMap.get(rk));
      delete g.rowsMap;
      delete g.rowKeysOrder;
    }

    return { order, groups };
  }, [rows, qtyMap, sqmMap]);
}

/* --------- Build printable HTML from grouped data (print-only totals styling) --------- */
function buildPrintHTML({ order, groups, title = "Inventory Report" }) {
  const now = new Date();
  const stamp = now.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).replace(",", "");

  const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch])
  );

  const groupBlocks = order.map((gk) => {
    const g = groups.get(gk);

    const header =
      `<div class="g-head">
         <div class="g-title">${escape(g.title)}</div>
         <div class="g-totals">
           <span>Boxes: <strong>${fmt2(g.totals.box)}</strong></span>
           <span>Sheets: <strong>${fmt2(g.totals.sheet)}</strong></span>
         </div>
       </div>`;

    const rowsHtml = g.rows.map((r) => {
      const sqmTotal = Number(r.sqmBox || 0) + Number(r.sqmSheet || 0);
      return `<tr>
        <td class="rtl item">${escape(g.title)}</td>
        <td class="tc">${escape(prettyDims(r.length, r.width))}</td>
        <td class="origin">${escape(r.origin)}</td>
        <td class="tr">${r.qtyBox ? fmt2(r.qtyBox) : ""}</td>
        <td class="tr">${r.qtySheet ? fmt2(r.qtySheet) : ""}</td>
        <td class="tr">${sqmTotal ? fmt2(sqmTotal) : ""}</td>
      </tr>`;
    }).join("");

    /* Totals row (print only) */
    const sumQtyBox   = g.rows.reduce((a, r) => a + (Number(r.qtyBox)   || 0), 0);
    const sumQtySheet = g.rows.reduce((a, r) => a + (Number(r.qtySheet) || 0), 0);
    const sumSqm      = g.rows.reduce((a, r) => a + ((Number(r.sqmBox)||0) + (Number(r.sqmSheet)||0)), 0);


    return `
      <section class="group">
        ${header}
        <table class="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Dimension</th>
              <th>Origin</th>
              <th class="tr">Qty (Box)</th>
              <th class="tr">Qty (Sheet)</th>
              <th class="tr">SQM (Total)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="6" class="tc muted">No rows</td></tr>`}
          
          </tbody>
        </table>
      </section>`;
  }).join("");

  /* Print-only CSS lives inside the printable HTML */
  const css = `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Cairo", "Tajawal", Arial, sans-serif; color: #111; margin: 16px; }
    header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    h1 { font-size: 18px; margin: 0; }
    .stamp { font-size: 12px; color:#666; }
    .group { margin: 14px 0 18px; page-break-inside: avoid; }

    .g-head {
      display:flex; justify-content: space-between; align-items: baseline;
      background: #f7f9ffff;              /* slightly dark header in print */
      border: 1px solid #cfd7ff;
      border-radius: 8px; padding: 6px 8px; margin-bottom: 6px;
    }
    .g-title { font-weight: 800; direction: rtl; }
    .g-totals { display: inline-flex; gap: 16px; }

    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border:1px solid #e8e8e8; padding:6px 8px; }
    .table thead th { background:#f3f3f3; font-weight:700; font-size:11px; text-transform: uppercase; }

    /* PRINT-ONLY: darker background for totals row */
    .table tr.total-row td {
      background: #d6defe !important;
      font-weight: 700;
      border-top: 2px solid #b7c2ff;
    }

    .rtl { direction: rtl; text-align:right; }
    .tc { text-align:center; }
    .tr { text-align:right; }
    .muted { color:#666; }

    @media print {
      body { margin: 0; }
      header { position: sticky; top: 0; background: #fff; }
      .group { page-break-inside: avoid; }
    }
  `;

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escape(title)}</title>
      <style>${css}</style>
    </head>
    <body>
      <header>
        <h1>${escape(title)}</h1>
        <div class="stamp">${escape(stamp)}</div>
      </header>
      ${groupBlocks || `<div class="muted">No data.</div>`}
    </body>
  </html>`;
}


/* ----------------- Component ----------------- */
export default function ReportModal({
  open,
  onClose,
  rows = [],
  qtyMap = new Map(),
  sqmMap = new Map(),
  loading = false,
}) {
  // Group + merge for view & print
  const { order, groups } = useGroupedMerged(rows, qtyMap, sqmMap);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePrint = () => {
    // Build a clean HTML document for printing
    const html = buildPrintHTML({ order, groups, title: "Inventory Report" });

    // Create hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    /** Write and print */
    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    // Wait a tick for rendering, then print & cleanup
    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        // Give the print dialog time to open before removing
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
        }, 1000);
      }
    };

    // If the document has images/fonts (we're not loading externals, but just in case)
    if (doc.readyState === "complete") {
      doPrint();
    } else {
      iframe.onload = doPrint;
    }
  };

  return (
    <div className="invb-report-overlay" onClick={onClose}>
      <aside className="invb-report-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="invb-report-head">
          <div>
            <div className="invb-report-title">Inventory Report</div>
            <div className="invb-report-sub">
              Grouped by item; rows merge same <em>dimension + origin</em> (box &amp; sheet).
            </div>
          </div>
          <button className="invb-btn" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="invb-report-body">
          {/* Left column (placeholder for future filters) */}
          <div className="invb-report-options">
            <div className="row">
              <div className="u-muted">
                Columns: Item, Dimension, Origin, Qty (Box), Qty (Sheet), SQM (Total).
              </div>
            </div>
          </div>

          {/* Right column: preview */}
          <div className="invb-report-preview">
            <div className="invb-tablewrap">
              {loading && (
                <div className="invb-empty" style={{ padding: 16 }}>
                  Gathering all items for the report…
                </div>
              )}

              {!loading && order.length === 0 && (
                <div className="invb-empty">No data to preview.</div>
              )}

              {!loading && order.map((gk) => {
                const g = groups.get(gk);
                return (
                  <div className="report-group" key={gk}>
                    {/* Group header */}
                    <div className="report-group-head">
                      <div className="report-group-title">{g.title}</div>
                      <div className="report-group-totals">
                        <span>Boxes: <strong>{fmt2(g.totals.box)}</strong></span>
                        <span>Sheets: <strong>{fmt2(g.totals.sheet)}</strong></span>
                      </div>
                    </div>

                    {/* Group table */}
                    <table className="invb-table invb-table--compact invb-table--striped">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th className="ta-center">Dimension</th>
                          <th>Origin</th>
                          <th className="ta-right">Qty (Box)</th>
                          <th className="ta-right">Qty (Sheet)</th>
                          <th className="ta-right">SQM (Total)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((row) => {
                          const sqmTotal = Number(row.sqmBox || 0) + Number(row.sqmSheet || 0);
                          return (
                            <tr key={row.idKey}>
                              <td style={{ direction: "rtl", textAlign: "right" }} className="truncate">
                                {g.title}
                              </td>
                              <td className="ta-center">{prettyDims(row.length, row.width)}</td>
                              <td className="truncate">{row.origin || ""}</td>
                              <td className="ta-right">{row.qtyBox ? fmt2(row.qtyBox) : ""}</td>
                              <td className="ta-right">{row.qtySheet ? fmt2(row.qtySheet) : ""}</td>
                              <td className="ta-right u-muted">{sqmTotal ? fmt2(sqmTotal) : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="invb-report-foot">
          <div className="u-muted">
            {loading
              ? "Loading…"
              : rows?.length
              ? `${rows.length} variants in report`
              : "No rows"}
          </div>
          <div className="invb-report-actions">
            <button className="invb-btn" onClick={handlePrint}>🖨️ Print</button>
            <button className="invb-btn">Export CSV</button>
            <button className="invb-btn">Generate PDF</button>
            <button className="invb-btn invb-btn--ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
