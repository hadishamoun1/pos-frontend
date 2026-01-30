// src/components/cash-collection/ViewCashflowModal.jsx
import React, { useEffect, useMemo, useRef } from "react";

function injectViewFontCss(html, { fontScale = 1.25, fontPx = null } = {}) {
  const css = `
    /* ✅ VIEW ONLY (does not affect print) */
    body {
      ${fontPx ? `font-size: ${fontPx}px !important;` : `font-size: calc(12.5px * ${fontScale}) !important;`}
    }
    table { 
      ${fontPx ? `font-size: ${Math.max(11, Math.round(fontPx * 0.95))}px !important;` : `font-size: calc(12.5px * ${fontScale}) !important;`}
    }
    th, td {
      ${fontPx ? `font-size: ${Math.max(11, Math.round(fontPx * 0.95))}px !important;` : `font-size: calc(12.5px * ${fontScale}) !important;`}
    }
  `.trim();

  const styleTag = `<style id="__view_cashflow_font__">${css}</style>`;

  const src = String(html || "");
  if (!src.trim()) return `<!doctype html><html><head>${styleTag}</head><body></body></html>`;

  // If there is </head>, inject before it
  if (src.includes("</head>")) {
    return src.replace("</head>", `${styleTag}</head>`);
  }

  // If there is <head>, inject right after it
  if (src.includes("<head>")) {
    return src.replace("<head>", `<head>${styleTag}`);
  }

  // Fallback: prepend a head
  return `<!doctype html><html><head>${styleTag}</head><body>${src}</body></html>`;
}

export default function ViewCashflowModal({
  open,
  title = "Preview",
  html,
  onClose,
  onPrint,

  // ✅ choose one:
  fontScale = 1.25, // 1.25 = +25% bigger text
  fontPx = null,    // e.g. 16 (if you prefer fixed size)
}) {
  const iframeRef = useRef(null);

  const viewHtml = useMemo(() => {
    return injectViewFontCss(html, { fontScale, fontPx });
  }, [html, fontScale, fontPx]);

  useEffect(() => {
    if (!open) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    // ✅ load VIEW html with bigger fonts
    iframe.srcdoc = viewHtml;
  }, [open, viewHtml]);

  if (!open) return null;

  return (
    <div className="view-cashflow-modal-overlay" onMouseDown={onClose}>
      <div
        className="view-cashflow-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="view-cashflow-modal-head">
          <div className="view-cashflow-modal-title">{title}</div>

          <div className="view-cashflow-modal-actions">
            <button className="btn" onClick={onPrint}>
              Print
            </button>
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="view-cashflow-modal-body">
          <iframe
            ref={iframeRef}
            title="cashflow-preview"
            className="view-cashflow-modal-iframe"
          />
        </div>
      </div>
    </div>
  );
}
