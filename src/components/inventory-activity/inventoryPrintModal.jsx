import React, { useEffect, useMemo, useRef, useState } from "react";
import "./inventoryPrintModal.css";

const DEFAULT_FONT_PT = 8;
const MIN_FONT_PT = 4;
const SMALL_FONT_PT = 6;
const PAGE_MARGIN_MM = 8;
const PX_TO_MM = 25.4 / 96;

// Text columns may wrap onto a second line to save width; everything else
// (numbers, dates, dimensions) stays on one line so it never breaks mid-value.
const WRAP_COLUMNS = new Set(["name", "category", "subCategory", "condition", "warehouse", "origin"]);

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const TOTAL_FIELDS = {
  quantity: "totalQuantity",
  quantityofr: "totalQuantityOFR",
  sqm: "totalSQM",
  sqmofr: "totalSQMOFR",
};

// Rendered as one long sheet first; paginateSheets then measures it and splits
// the rows onto real A4 sheets. The preview and the printout are this same
// document, so what the user sees is what the printer gets.
const buildDocument = ({ columns, rows, totals, filters, orientation, fontPt, totalRecords }) => {
  const landscape = orientation === "landscape";
  const pageW = landscape ? 297 : 210;
  const pageH = landscape ? 210 : 297;

  const headCells = columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const cls = WRAP_COLUMNS.has(c.id) ? "wrap" : "";
          return `<td class="${cls}" dir="auto">${esc(row[c.id])}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const footCells = columns
    .map((c, idx) => {
      const field = TOTAL_FIELDS[c.id];
      if (field) return `<td>${Number(totals?.[field] || 0).toFixed(2)}</td>`;
      return `<td>${idx === 0 ? "Totals" : ""}</td>`;
    })
    .join("");
  const filterText = (filters || []).map((f) => `${f.key}: ${f.value}`).join("  •  ");

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: A4 ${orientation}; margin: 0; }
    html, body { margin: 0; padding: 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Tahoma, Arial, sans-serif; font-size: ${fontPt}pt; color: #111; }
    .sheet {
      position: relative; box-sizing: border-box; background: #fff;
      width: ${pageW}mm; height: ${pageH}mm; padding: ${PAGE_MARGIN_MM}mm;
    }
    .report-head { margin-bottom: 3mm; }
    .report-head h1 { margin: 0 0 1mm; font-size: 13pt; }
    .report-head div { font-size: 8pt; color: #444; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 1px 3px; text-align: center; white-space: nowrap; overflow: hidden; }
    th { background: #e5e7eb; white-space: normal; }
    td.wrap { white-space: normal; }
    tfoot td { font-weight: bold; background: #f3f4f6; }
    .page-no { position: absolute; bottom: 3mm; right: ${PAGE_MARGIN_MM}mm; font-size: 7pt; color: #555; }
    @media screen {
      body { background: #6b7280; padding: 16px; width: max-content; min-width: calc(100% - 32px); }
      .sheet { margin: 0 auto 16px; box-shadow: 0 2px 10px rgba(0,0,0,.45); }
    }
    @media print {
      .sheet { overflow: hidden; break-after: page; }
      .sheet:last-child { break-after: auto; }
    }
  </style></head><body>
    <div class="sheet" id="measure">
      <div class="report-head">
        <h1>Inventory Activity</h1>
        <div>Printed ${esc(new Date().toLocaleString())} — ${totalRecords} record${totalRecords === 1 ? "" : "s"}</div>
        ${filterText ? `<div>Filters: ${esc(filterText)}</div>` : ""}
      </div>
      <table>
        <thead><tr>${headCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
        <tfoot><tr>${footCells}</tr></tfoot>
      </table>
    </div>
  </body></html>`;
};

const measureOverflow = (doc) => {
  const sheet = doc.getElementById("measure");
  const table = sheet.querySelector("table");
  const style = doc.defaultView.getComputedStyle(sheet);
  const contentW = sheet.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  return { sheet, table, contentW, overflowPx: Math.max(0, table.offsetWidth - contentW) };
};

// Fixes the column widths from the measured table, works out which columns run
// past the printable edge, then deals the rows out onto A4 sheets.
const paginateSheets = (doc, columns) => {
  const { sheet, table, contentW, overflowPx } = measureOverflow(doc);
  const style = doc.defaultView.getComputedStyle(sheet);
  const contentH = sheet.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

  const tableLeft = table.getBoundingClientRect().left;
  const ths = Array.from(table.querySelectorAll("thead th"));
  const widths = ths.map((th) => th.getBoundingClientRect().width);
  const cutIdx = [];
  ths.forEach((th, i) => {
    if (th.getBoundingClientRect().right - tableLeft > contentW + 0.5) cutIdx.push(i);
  });

  const colgroup = doc.createElement("colgroup");
  widths.forEach((w) => {
    const col = doc.createElement("col");
    col.style.width = `${w}px`;
    colgroup.appendChild(col);
  });
  const tableW = table.offsetWidth;
  table.insertBefore(colgroup, table.firstChild);
  table.style.tableLayout = "fixed";
  table.style.width = `${tableW}px`;

  if (cutIdx.length) {
    // Screen only: colours the part of the table that can't reach the paper.
    const mark = doc.createElement("style");
    const sel = cutIdx.map((i) => `th:nth-child(${i + 1}), td:nth-child(${i + 1})`).join(",");
    mark.textContent = `@media screen { ${sel} { background: #fca5a5 !important; } }`;
    doc.head.appendChild(mark);
  }

  const head = sheet.querySelector(".report-head");
  const headH = head.getBoundingClientRect().height + parseFloat(doc.defaultView.getComputedStyle(head).marginBottom);
  const theadH = table.tHead.getBoundingClientRect().height;
  const tfootH = table.tFoot.getBoundingClientRect().height;
  const reserve = 16; // page number + rounding safety
  const rows = Array.from(table.tBodies[0].rows);
  const heights = rows.map((r) => r.getBoundingClientRect().height);

  const pages = [[]];
  let used = headH + theadH + reserve;
  rows.forEach((row, i) => {
    if (used + heights[i] > contentH && pages[pages.length - 1].length) {
      pages.push([]);
      used = theadH + reserve;
    }
    pages[pages.length - 1].push(row);
    used += heights[i];
  });
  if (used + tfootH > contentH) pages.push([]);

  const sheets = pages.map((pageRows, idx) => {
    const s = doc.createElement("div");
    s.className = "sheet";
    if (idx === 0) s.appendChild(head);

    const t = table.cloneNode(false);
    t.appendChild(colgroup.cloneNode(true));
    t.appendChild(table.tHead.cloneNode(true));
    const tb = doc.createElement("tbody");
    pageRows.forEach((r) => tb.appendChild(r));
    t.appendChild(tb);
    if (idx === pages.length - 1) t.appendChild(table.tFoot.cloneNode(true));
    s.appendChild(t);

    const no = doc.createElement("div");
    no.className = "page-no";
    no.textContent = `Page ${idx + 1} of ${pages.length}`;
    s.appendChild(no);
    return s;
  });
  sheet.remove();
  sheets.forEach((s) => doc.body.appendChild(s));

  return {
    pages: pages.length,
    overflowMm: Math.ceil(overflowPx * PX_TO_MM),
    cutColumns: cutIdx.map((i) => columns[i]?.label).filter(Boolean),
  };
};

export default function InventoryPrintModal({ isOpen, onClose, columns, filters, fetchAllRows }) {
  const iframeRef = useRef(null);
  const fitRequested = useRef(false);

  const [loaded, setLoaded] = useState(null); // { rows, totals, totalRecords }
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [orientation, setOrientation] = useState("landscape");
  const [fontPt, setFontPt] = useState(DEFAULT_FONT_PT);
  const [excluded, setExcluded] = useState(() => new Set());
  const [layout, setLayout] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setLoaded(null);
    setError("");
    setLayout(null);
    setExcluded(new Set());
    setProgress({ done: 0, total: 0 });
    fetchAllRows(
      (done, total) => {
        if (!cancelled) setProgress({ done, total });
      },
      () => cancelled
    )
      .then((res) => {
        if (!cancelled) setLoaded(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.data?.message || e.message || "Failed to load the records.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const printColumns = useMemo(
    () => (columns || []).filter((c) => !excluded.has(c.id)),
    [columns, excluded]
  );

  const srcDoc = useMemo(() => {
    if (!loaded || printColumns.length === 0) return "";
    return buildDocument({
      columns: printColumns,
      rows: loaded.rows,
      totals: loaded.totals,
      totalRecords: loaded.totalRecords,
      filters,
      orientation,
      fontPt,
    });
  }, [loaded, printColumns, filters, orientation, fontPt]);

  const handleIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.getElementById("measure")) return;

    if (fitRequested.current) {
      fitRequested.current = false;
      let size = fontPt;
      while (measureOverflow(doc).overflowPx > 0 && size > MIN_FONT_PT) {
        size -= 0.5;
        doc.body.style.fontSize = `${size}pt`;
      }
      if (size !== fontPt) {
        setFontPt(size); // rebuilds the document at the fitted size
        return;
      }
    }
    setLayout(paginateSheets(doc, printColumns));
  };

  const shrinkToFit = () => {
    fitRequested.current = true;
    setLayout(null);
    setIframeKey((k) => k + 1);
  };

  const toggleColumn = (id) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  if (!isOpen) return null;

  const fits = layout && layout.cutColumns.length === 0;

  return (
    <div className="inv-print-overlay">
      <div className="inv-print-modal">
        <div className="inv-print-bar">
          <strong className="inv-print-title">Print Preview — A4</strong>

          <div className="inv-print-group">
            <button
              type="button"
              className={orientation === "landscape" ? "active" : ""}
              onClick={() => setOrientation("landscape")}
            >
              Landscape
            </button>
            <button
              type="button"
              className={orientation === "portrait" ? "active" : ""}
              onClick={() => setOrientation("portrait")}
            >
              Portrait
            </button>
          </div>

          <div className="inv-print-group">
            <span>Text size</span>
            <button type="button" onClick={() => setFontPt((f) => Math.max(MIN_FONT_PT, f - 0.5))}>
              −
            </button>
            <span className="inv-print-size">{fontPt} pt</span>
            <button type="button" onClick={() => setFontPt((f) => Math.min(14, f + 0.5))}>
              +
            </button>
            <button type="button" onClick={shrinkToFit} disabled={!layout || fits}>
              Shrink to fit
            </button>
          </div>

          <div className="inv-print-actions">
            <button type="button" className="inv-print-primary" onClick={handlePrint} disabled={!layout}>
              Print
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="inv-print-columns">
          {(columns || []).map((c) => (
            <label key={c.id}>
              <input type="checkbox" checked={!excluded.has(c.id)} onChange={() => toggleColumn(c.id)} />
              {c.label}
            </label>
          ))}
        </div>

        {layout && (
          <div className={`inv-print-status ${fits ? "ok" : "bad"}`}>
            {fits ? (
              <>
                All {printColumns.length} columns fit on the paper — {layout.pages} page
                {layout.pages === 1 ? "" : "s"}, {loaded.totalRecords} records.
              </>
            ) : (
              <>
                The table is {layout.overflowMm} mm wider than the paper. These will be cut off (shown in red):{" "}
                <strong>{layout.cutColumns.join(", ")}</strong>. Use Landscape, Shrink to fit, or untick some columns.
              </>
            )}
            {fontPt < SMALL_FONT_PT && " Text is very small and may be hard to read."}
          </div>
        )}

        <div className="inv-print-preview">
          {error && <div className="inv-print-message">{error}</div>}
          {!error && !loaded && (
            <div className="inv-print-message">
              Loading records… {progress.total ? `${progress.done} of ${progress.total}` : ""}
            </div>
          )}
          {!error && loaded && printColumns.length === 0 && (
            <div className="inv-print-message">Select at least one column to print.</div>
          )}
          {srcDoc && (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              title="Print preview"
              srcDoc={srcDoc}
              onLoad={handleIframeLoad}
            />
          )}
        </div>
      </div>
    </div>
  );
}
