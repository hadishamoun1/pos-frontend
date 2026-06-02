import React, { useEffect, useMemo, useRef, useState } from "react";
import "./RequestPreviewModal.css";
import html2canvas from "html2canvas";
import AnnotationLayer, { clearAnnotations } from "../shared/AnnotationLayer";

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function fmtDate(d) {
  if (!d) return "";
  try {
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return String(d);
    return dd.toLocaleDateString();
  } catch {
    return String(d);
  }
}

/** 12.00 -> 12, 12.50 -> 12.50 */
function fmtMoneyTrim(v) {
  const n = safeNum(v, 0);
  const s = n.toFixed(2);
  return s.endsWith(".00") ? String(Math.trunc(n)) : s;
}

/** Dimensions: drop trailing zeros (100.00 -> 100, 100.50 -> 100.5) */
function fmtDimTrim(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, "");
}

/** Hide unwanted 0/0.00 */
function fmtMaybeBlank(v, { blankIfZero = true } = {}) {
  if (v === "" || v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  const n = Number(s);
  if (blankIfZero && Number.isFinite(n) && Math.abs(n) === 0) return "";
  if (Number.isFinite(n)) {
    const fixed = n.toFixed(2);
    return fixed.endsWith(".00") ? String(Math.trunc(n)) : fixed;
  }
  return s;
}

function buildRequestHtml(request, currencyCode, vatPercent /* currencyRate, llLabel removed */) {
  const requestNumber = pick(request, ["requestNumber", "reqNumber", "requestNo", "number"], "");
  const customerName = pick(request, ["customerName", "customer", "name", "clientName"]);
  const phone = pick(request, ["telephone", "phone", "phoneNumber", "tel"]);
  const address = pick(request, ["address", "customerAddress", "clientAddress"]);
  const date = pick(request, ["requestDate", "date", "createdAt"]);

  const items =
    request?.items ||
    request?.details ||
    request?.requestItems ||
    request?.lines ||
    request?.rows ||
    [];

  const rows = (Array.isArray(items) ? items : []).map((it, idx) => {
    const itemNumber = pick(it, ["itemNumber", "itemNo", "number", "code"], idx + 1);
    const itemName = pick(it, ["itemName", "name", "item", "description"], "");

    // Keep unit only for logic (not displayed)
    const unit = String(
      pick(it, ["unit", "unitName", "uom", "type", "itemType"], "")
    ).toUpperCase();

    // box/sheet
    let box = pick(it, ["box", "boxes"], "");
    let sheet = pick(it, ["sheet", "sheets", "qty", "quantity"], "");

    // ✅ If unit is SHEET, box must be empty (no zeros)
    if (unit === "SHEET") box = "";

    const length = pick(it, ["length", "len", "L"], "");
    const width = pick(it, ["width", "wid", "W"], "");
    const sqm = pick(it, ["sqm", "SQM"], "");

    const unitPrice = pick(it, ["unitPrice", "price", "unit_price"], "");
    const invoicePriceRaw = pick(it, ["invoicePrice", "lineTotal", "total", "amount"], "");

    let invoicePrice = invoicePriceRaw;
    if (invoicePrice === "" || invoicePrice === null || invoicePrice === undefined) {
      const up = safeNum(unitPrice, 0);
      const sqmN = safeNum(sqm, NaN);
      const shN = safeNum(sheet, NaN);

      if (Number.isFinite(sqmN) && sqmN > 0) invoicePrice = sqmN * up;
      else if (Number.isFinite(shN) && shN > 0) invoicePrice = shN * up;
      else invoicePrice = up;
    }

    return {
      itemNumber,
      itemName,
      box,
      sheet,
      length,
      width,
      sqm,
      unitPrice,
      invoicePrice,
    };
  });

  const subtotal = rows.reduce((sum, r) => sum + safeNum(r.invoicePrice, 0), 0);

  // ✅ hide subtotal + vat when vatPercent is 0
  const vatP = safeNum(vatPercent, 0);
  const showVat = vatP > 0;

  const vatAmount = showVat ? subtotal * (vatP / 100) : 0;
  const grandTotal = subtotal + vatAmount;

  const totalsHtml = showVat
    ? `
        <div class="request-preview-totals-row">
          <div class="request-preview-totals-label">Sub Total</div>
          <div class="request-preview-totals-value">${fmtMoneyTrim(subtotal)}</div>
        </div>

        <div class="request-preview-totals-row">
          <div class="request-preview-totals-label">VAT (${vatP.toFixed(2)}%)</div>
          <div class="request-preview-totals-value">${fmtMoneyTrim(vatAmount)}</div>
        </div>

        <div class="request-preview-totals-divider"></div>
      `
    : ``;

  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td class="request-preview-tc">${r.itemNumber ?? ""}</td>
        <td class="request-preview-td-name">${String(r.itemName ?? "")}</td>

        <td class="request-preview-tr">${fmtMaybeBlank(r.box)}</td>
        <td class="request-preview-tr">${fmtMaybeBlank(r.sheet)}</td>

        <td class="request-preview-tr">${fmtDimTrim(r.length)}</td>
        <td class="request-preview-tr">${fmtDimTrim(r.width)}</td>

        <td class="request-preview-tr">${fmtMaybeBlank(r.sqm, { blankIfZero: false })}</td>

        <!-- ✅ no $ sign -->
        <td class="request-preview-tr">${fmtMoneyTrim(r.unitPrice)}</td>
        <td class="request-preview-tr">${fmtMoneyTrim(r.invoicePrice)}</td>
      </tr>
    `
    )
    .join("");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Request Preview</title>

  <style>
    * { box-sizing: border-box; }

    @page { size: A4; margin: 10mm; }

    body {
      font-family: Arial, sans-serif;
      background: #f2f2f2;
      padding: 18px;
      color: #111;
    }

    .request-preview-page{
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      padding: 12mm;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.12);
    }

    .request-preview-title{
      font-size: 22px;
      font-weight: 800;
      margin: 0;
    }

    .request-preview-muted{
      color:#666;
      margin: 4px 0 12px;
    }

    .request-preview-headerBox{
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }

    .request-preview-top{
      display:flex;
      justify-content: space-between;
      gap: 16px;
    }

    .request-preview-leftMeta{
      text-align: left;
      font-size: 17px;
      line-height: 1.7;
      flex: 1;
    }

    .request-preview-rightMeta{
      min-width: 220px;
      text-align: right;
      font-size: 13px;
      line-height: 1.7;
    }

    .request-preview-rowLine b{
      display:inline-block;
      min-width: 95px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      table-layout: fixed;
    }

    th{
      border: 1px solid #ddd;
      padding: 8px;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    td {
      border: 1px solid #ddd;
      padding: 8px;
      font-size: 16px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    th { background: #f6f6f6; text-align: center; }

    .request-preview-tc { text-align: center; }
    .request-preview-tr { text-align: right; }
    .request-preview-table-muted { color: #666; text-align: center; }

    .request-preview-td-name {
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
      direction: rtl;
    }

    th:nth-child(1), td:nth-child(1) { width: 6%; }
    th:nth-child(2), td:nth-child(2) { width: 25%; }

    th:nth-child(3), td:nth-child(3) { width: 8%; }
    th:nth-child(4), td:nth-child(4) { width: 8%; }

    th:nth-child(5), td:nth-child(5) { width: 10%; }
    th:nth-child(6), td:nth-child(6) { width: 10%; }
    th:nth-child(7), td:nth-child(7) { width: 10%; }
    th:nth-child(8), td:nth-child(8) { width: 10%; }
    th:nth-child(9), td:nth-child(9) { width: 12%; }

    .request-preview-totals-wrap{
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .request-preview-totals{
      width: 340px;
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 17px;
    }
    .request-preview-totals-row{
      display:flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
    }
    .request-preview-totals-row strong{ font-size: 17px; }
    .request-preview-totals-divider{ border-top: 1px solid #eee; margin: 6px 0; }
    .request-preview-totals-label{ color:#333; }
    .request-preview-totals-value{ text-align:right; white-space:nowrap; }

    @media print {
      body { background: #fff; padding: 0; }
      .request-preview-page{
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
        border-radius: 0;
      }
      .request-preview-headerBox{ border-radius: 0; }
    }
  </style>
</head>

<body>
  <div class="request-preview-page">
    <div class="request-preview-title">${requestNumber || "Request"}</div>
    <div class="request-preview-muted">Preview</div>

    <div class="request-preview-headerBox">
      <div class="request-preview-top">
        <div class="request-preview-leftMeta">
          <div class="request-preview-rowLine"><b>Customer:</b> ${customerName || ""}</div>
          <div class="request-preview-rowLine"><b>Address:</b> ${address || ""}</div>
          <div class="request-preview-rowLine"><b>Telephone:</b> ${phone || ""}</div>
        </div>

        <div class="request-preview-rightMeta">
          <div class="request-preview-rowLine"><b>Date:</b> ${fmtDate(date) || ""}</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Item Name</th>
          <th>Box</th>
          <th>Sheet</th>
          <th>Length</th>
          <th>Width</th>
          <th>SQM</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="9" class="request-preview-table-muted">No items</td></tr>`}
      </tbody>
    </table>

    <div class="request-preview-totals-wrap">
      <div class="request-preview-totals">
        ${totalsHtml}

        <div class="request-preview-totals-row">
          <strong class="request-preview-totals-label">Grand Total</strong>
          <strong class="request-preview-totals-value">${fmtMoneyTrim(grandTotal)}</strong>
        </div>
      </div>
    </div>
  </div>

  <script>
    // zoom API called from parent
    window.__setPreviewZoom = function(z) {
      try {
        document.body.style.zoom = String(z);
      } catch (e) {
        var page = document.querySelector('.request-preview-page');
        if (!page) return;
        page.style.transform = 'scale(' + z + ')';
        page.style.transformOrigin = 'top left';
      }
    };
  </script>
</body>
</html>
`;
}

export default function RequestPreviewModal({
  open,
  onClose,
  request,
  currencyCode = "USD",
  vatPercent = 11,
  currencyRate = 0, // kept for prop compatibility (not used)
  llLabel = "LL",   // kept for prop compatibility (not used)
}) {
  const iframeRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [annotMode, setAnnotMode] = useState(false);

  const srcDoc = useMemo(
    () => buildRequestHtml(request || {}, currencyCode, vatPercent, currencyRate, llLabel),
    [request, currencyCode, vatPercent, currencyRate, llLabel]
  );

  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const callIframeZoom = (z) => {
    const w = iframeRef.current?.contentWindow;
    try {
      w?.__setPreviewZoom?.(z);
    } catch {}
  };

  const handleZoomIn = () => {
    const next = Math.min(2, +(zoom + 0.1).toFixed(2));
    setZoom(next);
    callIframeZoom(next);
  };

  const handleZoomOut = () => {
    const next = Math.max(0.5, +(zoom - 0.1).toFixed(2));
    setZoom(next);
    callIframeZoom(next);
  };

  const handleZoomReset = () => {
    setZoom(1);
    callIframeZoom(1);
  };

  const handlePrint = () => {
    const w = iframeRef.current?.contentWindow;
    if (w) w.print();
  };

  const handleScreenshot = async () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;

      const target = doc.querySelector(".request-preview-page") || doc.body;

      // temporarily reset zoom for clean capture
      const prev = zoom;
      callIframeZoom(1);
      await new Promise((r) => setTimeout(r, 60));

      // Inject annotation nodes into the target so they appear in the capture
      const injected = [];
      const annotNodes = doc.querySelectorAll(".annot-node");
      if (annotNodes.length) {
        const pr = target.getBoundingClientRect();
        const savedPos = target.style.position;
        const savedOvf = target.style.overflow;
        target.style.position = "relative";
        target.style.overflow = "visible";
        annotNodes.forEach((n) => {
          const nr = n.getBoundingClientRect();
          const ac = n.cloneNode(true);
          ac.querySelector(".annot-controls")?.remove();
          ac.querySelector(".annot-toolbar")?.remove();
          Object.assign(ac.style, {
            left:          (nr.left - pr.left) + "px",
            top:           (nr.top  - pr.top)  + "px",
            position:      "absolute",
            pointerEvents: "none",
            outline:       "none",
          });
          target.appendChild(ac);
          injected.push({ el: ac, savedPos, savedOvf });
        });
      }

      const canvas = await html2canvas(target, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      // Remove injected clones and restore styles
      injected.forEach(({ el, savedPos, savedOvf }) => {
        el.remove();
        target.style.position = savedPos;
        target.style.overflow = savedOvf;
      });

      // restore zoom
      callIframeZoom(prev);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `request-${(request?.requestNumber || "preview").replace(/[^\w\-]+/g, "_")}.png`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 250);
    } catch (err) {
      console.error("Screenshot failed:", err);
      alert("Screenshot failed.");
    }
  };

  if (!open) return null;

  return (
    <div className="request-preview-overlay" onMouseDown={onClose}>
      <div className="request-preview-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="request-preview-header">
          <div className="request-preview-title">Request Preview</div>

          <div className="request-preview-actions">
            <button className="request-preview-btn" onClick={handleZoomOut} title="Zoom out">
              -
            </button>
            <button className="request-preview-btn" onClick={handleZoomIn} title="Zoom in">
              +
            </button>
            <button className="request-preview-btn" onClick={handleZoomReset} title="Reset zoom">
              100%
            </button>

            <button className="request-preview-btn" onClick={handleScreenshot} title="Screenshot">
              Screenshot
            </button>

            <button className="request-preview-btn" onClick={handlePrint}>
              Print
            </button>

            {annotMode && (
              <button
                className="request-preview-btn request-preview-danger"
                onClick={() => clearAnnotations(iframeRef)}
                title="Remove all annotations"
              >
                🗑 Clear
              </button>
            )}
            <button
              className={`request-preview-btn${annotMode ? " request-preview-notes-active" : ""}`}
              onClick={() => setAnnotMode((v) => !v)}
              title="Annotate: click anywhere on the request to add a note"
            >
              {annotMode ? "✏️ Annotating…" : "✏️ Annotate"}
            </button>

            <button
              className="request-preview-btn request-preview-danger"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <iframe
          ref={iframeRef}
          className="request-preview-iframe"
          title="Request Preview"
          srcDoc={srcDoc}
          sandbox="allow-modals allow-same-origin allow-scripts"
          onLoad={() => callIframeZoom(zoom)}
        />
        <AnnotationLayer iframeRef={iframeRef} active={annotMode} />
      </div>
    </div>
  );
}
