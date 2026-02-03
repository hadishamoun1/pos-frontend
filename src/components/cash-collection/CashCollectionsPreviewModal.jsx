// src/components/cash-collection/ViewCashflowModal.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ✅ MUST MATCH NewRecordModal
const DRAFT_KEY = "__receivables_create_draft__";

function injectViewFontCss(html, { fontScale = 1.25, fontPx = null } = {}) {
  const css = `
    /* ✅ VIEW ONLY (does not affect print) */

    /* ✅ FORCE RTL in preview so English starts from RIGHT */
    html, body {
      direction: rtl !important;
      unicode-bidi: isolate !important;
      text-align: right !important;
    }

    /* ✅ ensure table cells do not auto-switch direction */
    table, thead, tbody, tr, th, td, div, span {
      direction: rtl !important;
      unicode-bidi: isolate !important;
      text-align: right !important;
    }

    /* ✅ keep numbers readable in amounts columns (optional but recommended) */
    .c-usd, .c-ll {
      direction: ltr !important;
      unicode-bidi: isolate !important;
      text-align: center !important;
    }

    body {
      ${
        fontPx
          ? `font-size: ${fontPx}px !important;`
          : `font-size: calc(12.5px * ${fontScale}) !important;`
      }
    }

    table { 
      ${
        fontPx
          ? `font-size: ${Math.max(11, Math.round(fontPx * 0.95))}px !important;`
          : `font-size: calc(12.5px * ${fontScale}) !important;`
      }
    }

    th, td {
      ${
        fontPx
          ? `font-size: ${Math.max(11, Math.round(fontPx * 0.95))}px !important;`
          : `font-size: calc(12.5px * ${fontScale}) !important;`
      }
    }

    /* ✅ make "Created" rows green in VIEW modal only */
    .row-created td {
      background: #d9f8d9 !important;
    }
  `.trim();

  const styleTag = `<style id="__view_cashflow_font__">${css}</style>`;

  const src = String(html || "");
  if (!src.trim())
    return `<!doctype html><html><head>${styleTag}</head><body></body></html>`;

  if (src.includes("</head>")) return src.replace("</head>", `${styleTag}</head>`);
  if (src.includes("<head>")) return src.replace("<head>", `<head>${styleTag}`);

  return `<!doctype html><html><head>${styleTag}</head><body>${src}</body></html>`;
}

function normalizeToDraftShape(input) {
  if (!input) return null;
  if (Array.isArray(input?.rows)) return input;
  return { rows: [input] };
}

export default function ViewCashflowModal({
  open,
  title = "Preview",
  html,
  onClose,
  onPrint,

  // ✅ view-only font controls
  fontScale = 1.25,
  fontPx = null,

  // ✅ draft + route
  prefillDraft = null,
  receivablesRoute = "/recievables",
}) {
  const iframeRef = useRef(null);
  const navigate = useNavigate();

  const viewHtml = useMemo(() => {
    return injectViewFontCss(html, { fontScale, fontPx });
  }, [html, fontScale, fontPx]);

  useEffect(() => {
    if (!open) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = viewHtml;
  }, [open, viewHtml]);

  if (!open) return null;

  const goCreateReceivable = () => {
    const draft = normalizeToDraftShape(prefillDraft);

    if (!draft || !draft.rows?.length) {
      alert("No draft data available to create a receivable.");
      return;
    }

    const first = draft.rows[0];
    if (!first?.customerId) {
      alert("Cannot create receivable: customerId is missing in the draft.");
      return;
    }
    if (!first?.date) {
      alert("Cannot create receivable: date is missing in the draft.");
      return;
    }

    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}

    navigate(receivablesRoute, { state: { draft } });
  };

  return (
    <div className="view-cashflow-modal-overlay" onMouseDown={onClose}>
      <div className="view-cashflow-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="view-cashflow-modal-head">
          <div className="view-cashflow-modal-title">{title}</div>

          <div className="view-cashflow-modal-actions">
            <button className="btn" onClick={goCreateReceivable}>
              Create Receivable
            </button>

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
