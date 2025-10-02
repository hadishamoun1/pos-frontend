// invoicePreviewModal.jsx
import React, { useMemo, useRef, useEffect } from "react";
import html2pdf from "html2pdf.js";

// helpers
function fmt(n, d = 2) {
  const num = Number(n);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  return isNaN(dt) ? "" : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ---------- Popup modal CSS (outside iframe) ---------- */
const MODAL_CSS = `
.invoice-modal-overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,.55);
  display: flex; align-items: center; justify-content: center;
  padding: 24px; z-index: 9999;
}
.invoice-modal-shell {
  width: min(1100px, 96vw); max-height: 96vh;
  display: flex; flex-direction: column; background: #fff;
  border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,.10), 0 10px 10px -5px rgba(0,0,0,.04);
  overflow: hidden; border: 1px solid #e5e7eb;
}
.invoice-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; background: #ffffff; border-bottom: 1px solid #e5e7eb;
}
.invoice-modal-title {
  font-size: 16px; font-weight: 700; color: #0f172a;
}
.invoice-modal-controls { display: flex; gap: 8px; }

/* Buttons */
.btn {
  border: 1px solid transparent; background: #fff; padding: 10px 14px;
  border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 700;
  line-height: 1; display: inline-flex; align-items: center; gap: 10px;
  transition: background .15s ease, color .15s ease, border-color .15s ease, transform .04s ease;
}
.btn:active { transform: translateY(1px); }

/* Primary (Print) */
.btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.btn-primary:hover { background: #1d4ed8; border-color: #1d4ed8; }

/* Secondary (Download PDF) */
.btn-secondary { background: #0ea5e9; color: #fff; border-color: #0ea5e9; }
.btn-secondary:hover { background: #0284c7; border-color: #0284c7; }

/* Outline (Close) */
.btn-outline { background: #fff; color: #0f172a; border-color: #e5e7eb; }
.btn-outline:hover { background: #f8fafc; }

/* Content area */
.invoice-modal-content { background: #f8fafc; padding: 12px; overflow: auto; flex: 1; }
.invoice-layout { background: #e5e7eb; border: 1px dashed #cbd5e1; padding: 8px; }
`;

/* ---------- Invoice CSS (inside iframe) ---------- */
const INLINE_INVOICE_CSS = `
/* === Invoice Preview Styles - Exact Match to Image === */
.invoice-a4-wrapper {
  width: 794px; min-height: 1120px; margin: auto; padding: 0; background: white;
  box-shadow: 0 0 10px rgba(0,0,0,0.1); box-sizing: border-box;
  font-family: "Times New Roman", Times, serif; font-size: 12px; direction: rtl;
  display: flex; flex-direction: column; justify-content: space-between;
  transform-origin: top left; transition: transform .2s ease; border: 1px solid #000;
}
.invoice-body { flex: 1; display: flex; flex-direction: column; }
.invoice-header { display: flex; justify-content: space-between; padding: 5px; border: 1px solid #000; margin: 7px; height: 150px; }
.invoice-header .left-info { direction: ltr; text-align: left; font-size: 15px; line-height: 1.4; }
.invoice-header .right-info { text-align: right; direction: rtl; font-size: 15px; line-height: 1.4; }
.company-title, .company-subtitle { font-family: Arial, sans-serif; font-size: 26px; margin: 0; }
.company-arabic-title, .company-arabic-subtitle { font-family: Arial, sans-serif; font-size: 26px; margin: 0; font-weight: bold; }
.small-subtitle { font-weight: normal; }
.left-info { font-family: "Times New Roman", Times, serif; line-height: 1.4; font-size: 14px; font-weight: normal; }
.invoice-header .left-info h2, .invoice-header .left-info p, .invoice-header .right-info h2, .invoice-header .right-info p { margin: 0; padding: 0; }
.invoice-arabic-contact { font-family: "Times New Roman", Times, serif; font-size: 15px; display: flex; flex-direction: column; font-weight: normal; direction: rtl; }
.invoice-arabic-line { display: flex; justify-content: flex-start; align-items: center; }
.invoice-arabic-label { width: 80px; text-align: right; }
.invoice-arabic-colon { width: 10px; display: inline-block; text-align: center; }
.invoice-arabic-value { text-align: right; flex: 1; }

.invoice-meta {
  display: flex; justify-content: space-between; padding: 5px; margin: 0 7px 7px 7px; border: 1px solid #000;
  font-family: Arial, sans-serif; font-size: 16px; box-sizing: border-box; height: 135px;
}
.meta-right, .meta-left { display: flex; flex-direction: column; padding: 0; text-align: right; }
.meta-left { margin-left: 25px; }
.invoice-meta p { margin: 2px; line-height: 1.2; padding: 2px; }
.meta-line { display: flex; align-items: center; font-size: 17px; line-height: 1.2; margin: 2px 0; }
.meta-label { width: 80px; text-align: right; font-weight: bold; }
.meta-colon { width: 10px; text-align: center; }
.meta-value { flex: 1; text-align: right; }

.invoice-table {
  width: calc(100% - 15px); margin: 0 7px 7px 7px; border-collapse: collapse;
  font-family: Arial, sans-serif; font-size: 15px; direction: rtl; box-sizing: border-box; border: 0.5px solid black;
}
.invoice-table td { text-align: center; border-left: 0.5px solid black; box-sizing: border-box; }
.invoice-table td:first-child { border-right: 0.5px solid black; }
.invoice-table th { background: #fff; font-weight: bold; border: none; border-bottom: 0.5px solid #000 !important; padding: 6px; text-align: center; }

.invoice-footer {
  display: flex; justify-content: space-between; margin: 0 15px 15px 15px; padding: 10px;
  font-family: "Arial", sans-serif; font-size: 12px; box-sizing: border-box; height: 180px;
}
.footer-left { width: 55%; font-family: Arial, sans-serif; font-size: 12px; border: 0.5px solid #000; padding: 5px; box-sizing: border-box; }
.amount-in-words { margin-bottom: 5px; font-size: 14px; display: flex; justify-content: flex-end; }
.footer-left-box { display: flex; align-items: flex-start; margin-bottom: 5px; }
.footer-left-cells { display: flex; width: 70%; height: 50px; border: 1px solid #000; }
.footer-left-cell { flex: 1; }
.border-right { border-right: 1px solid #000; }
.footer-left-label-row { display: flex; flex-direction: column; justify-content: space-between; padding-right: 5px; padding-left: 5px; height: 50px; border: 1px solid black; }
.footer-left-label { border-left: 0.5px solid black; width: 50%; font-size: 14px; text-align: right; padding: 5px; }
.footer-left-label-note { font-size: 14px; text-align: right; padding: 5px; }
.footer-left-note { display: flex; justify-content: flex-start; padding: 5px; font-size: 14px; }

.footer-right { width: 43%; display: flex; flex-direction: column; justify-content: flex-start; box-sizing: border-box; padding: 10px; border: 0.5px solid #000; padding-top: 40px; }
.footer-line { display: flex; align-items: center; margin-bottom: 6px; }
.footer-label { min-width: 80px; text-align: right; font-weight: bold; }
.footer-colon { margin: 0 5px; }
.footer-value { font-size: 15px; border: 0.5px solid black; direction: ltr; text-align: left; display: inline-block; width: 100%; padding-left: 5px; box-sizing: border-box; }
.footer-total-amount { font-weight: bold; font-size: 13px; }
.footer-row { display: flex; justify-content: space-between; direction: ltr; margin-bottom: 6px; font-size: 16px; }
.footer-row span { width: 32%; text-align: right; }
.footer-row span:nth-child(1) { text-align: left; }
.footer-row span:last-child { text-align: left; }
.footer-total-line { width: 100%; padding-top: 6px; display: flex; justify-content: space-around; direction: ltr; font-size: 15px; }
.footer-total-label { font-weight: bold; font-size: 21px; }
.footer-total-amount { font-weight: bolder; font-size: 18px; text-align: left; border: 0.5px solid black; padding: 3px 0 3px 3px; margin-right: 0; width: 60%; }

.invoice-table th { padding-top: 6px; padding-bottom: 6px; padding-right: 6px; text-align: center; border-left: none !important; border-right: none !important; border-top: 0.5px solid black; box-sizing: border-box; }
.invoice-table th:last-child{ border-right: 0.5px solid black; }
.invoice-table th:first-child{ border-left: 0.5px solid black; }
.invoice-table td { padding-top: 6px; padding-bottom: 6px; padding-right: 6px; text-align: center; border-left: 0.5px solid black; box-sizing: border-box; }

.arabic-item-name { font-size: 17px; }
.col-small { width: 50px; }
.col-price { width: 50px; }
.col-amount { width: 80px; }
.col-area { width: 75px; }
.col-description { width: 190px; }
.col-item { width: 90px; }
.col-description, .col-item { text-align: left; white-space: normal; word-break: break-word; vertical-align: top; }
.invoice-table td:not(.col-description):not(.col-item), .invoice-table th:not(.col-description):not(.col-item) { text-align: right; }

/* ---- Print: A4 portrait ---- */
@page { size: A4 portrait; margin: 10mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .invoice-a4-wrapper {
    width: 210mm !important; min-height: 297mm !important; margin: 0 auto !important;
    box-shadow: none !important; transform: none !important; border: 1px solid #000 !important;   
  }
}
`;

/* ---------- Build full iframe HTML ---------- */
function buildInvoiceHtml(invoiceData = {}, { inlineCss, baseHref = "/" } = {}) {
  const {
    invoiceNumber = "", date = "", customerName = "", customerAddress = "", customerPhone = "",
    customerAccountNumber = "", customerTaxNumber = "", currencyRate = 1, vatPercentage = 0,
    totalWithoutVAT = 0, totalVAT = 0, grandTotal = 0, items = [], currencyCode = "USD",
  } = invoiceData;

  const grandTotalLL = grandTotal * currencyRate;
  const totalVatLL  = totalVAT * currencyRate;

  const rowsHtml =
    items.length === 0
      ? `<tr><td colspan="9" style="text-align:center;padding:12px">لا توجد أصناف</td></tr>`
      : items.map((it) => {
          const amount = it.totalAmount ?? (Number(it.unitPrice || 0) * Number(it.sqm || 0));
          const isBox = it.itemType === "box";
          const isSheet = it.itemType === "sheet";
          return `
            <tr>
              <td>${fmt(amount)}</td>
              <td>${fmt(it.unitPrice)}</td>
              <td>${fmt(it.sqm)}</td>
              <td>${it.width ?? ""}</td>
              <td>${it.length ?? ""}</td>
              <td>${isSheet ? (it.quantity ?? "") : ""}</td>
              <td>${isBox ? (it.quantity ?? "") : ""}</td>
              <td class="arabic-item-name">${it.itemName ?? ""}</td>
              <td>${it.itemVariantId ?? ""}</td>
            </tr>
          `;
        }).join("");

  const baseTag  = `<base href="${baseHref}">`;
  const styleTag = `<style>${inlineCss || ""}</style>`;

  return `<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
${baseTag}
${styleTag}
</head>
<body>
  <div class="invoice-a4-wrapper">
    <div class="invoice-body">
      <div class="invoice-header">
        <div class="right-info">
          <h2 class="company-arabic-title">شركة شمعون</h2>
          <h2 class="company-arabic-subtitle">للزجاج و المرايا</h2>
          <p class="small-subtitle">الحدث/ شويفات</p>
          <div class="invoice-arabic-contact">
            <div class="invoice-arabic-line">
              <span class="invoice-arabic-label">تلفون</span><span class="invoice-arabic-colon">:</span>
              <span class="invoice-arabic-value">05/810888 05/814964</span>
            </div>
            <div class="invoice-arabic-line">
              <span class="invoice-arabic-label">خلوي/ واتساب</span><span class="invoice-arabic-colon">:</span>
              <span class="invoice-arabic-value">79/100068</span>
            </div>
            <div class="invoice-arabic-line">
              <span class="invoice-arabic-label">فاكس</span><span class="invoice-arabic-colon">:</span>
              <span class="invoice-arabic-value">05/814961</span>
            </div>
          </div>
        </div>
        <div class="left-info">
          <h1 class="company-title">Shamoun Company</h1>
          <h2 class="company-subtitle">For Glass & Mirrors</h2>
          <p>Chweifat - Near Spot Mall</p>
          <p>Tel: 05-810 888 ; 79-1000 68 ; Fax: 05-814 961</p>
          <p>Email: info@shamoun.com</p>
          <p>VAT Reg.No 10909-601</p>
        </div>
      </div>

      <div class="invoice-meta">
        <div class="meta-right">
          <div class="meta-line"><span class="meta-label">اسم الزبون</span><span class="meta-colon">:</span><span class="meta-value">${customerName || "-"}</span></div>
          <div class="meta-line"><span class="meta-label">العنوان</span><span class="meta-colon">:</span><span class="meta-value">${customerAddress || "-"}</span></div>
          <div class="meta-line"><span class="meta-label">تلفون</span><span class="meta-colon">:</span><span class="meta-value">${customerPhone || "-"}</span></div>
          <div class="meta-line"><span class="meta-label">رقم الحساب</span><span class="meta-colon">:</span><span class="meta-value">${customerAccountNumber || "-"}</span></div>
          <div class="meta-line"><span class="meta-label">الرقم الضريبي</span><span class="meta-colon">:</span><span class="meta-value">${customerTaxNumber || "-"}</span></div>
        </div>
        <div class="meta-left">
          <div class="meta-line"><span class="meta-label">رقم الفاتورة</span><span class="meta-colon">:</span><span class="meta-value">${invoiceNumber || "-"}</span></div>
          <div class="meta-line"><span class="meta-label">التاريخ</span><span class="meta-colon">:</span><span class="meta-value">${fmtDate(date)}</span></div>
          <div class="meta-line"><span class="meta-label">العملة</span><span class="meta-colon">:</span><span class="meta-value">${currencyCode}</span></div>
        </div>
      </div>

      <table class="invoice-table">
        <thead>
          <tr>
            <th class="col-amount">المبلغ</th>
            <th class="col-price">السعر</th>
            <th class="col-area">مساحة</th>
            <th class="col-small">عرض</th>
            <th class="col-small">طول</th>
            <th class="col-small">لوح</th>
            <th class="col-small">صندوق</th>
            <th class="col-description">الشرح</th>
            <th class="col-item">الصنف</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <div class="invoice-footer">
      <div class="footer-right">
        <div class="footer-row">
          <span class="footer-label">VAT LBP</span>
          <span class="footer-label">المجموع</span>
          <span class="footer-value">${fmt(grandTotalLL)}</span>
        </div>
        <div class="footer-row">
          <span class="footer-vat-value">${fmt(totalVatLL)}</span>
          <span class="footer-label">V.A.T ${vatPercentage}%</span>
          <span class="footer-value">${fmt(totalVAT)}</span>
        </div>
        <div class="footer-total-line">
          <strong class="footer-total-label">المجموع الصافي</strong>
          <span class="footer-total-amount">${fmt(grandTotal)} ${currencyCode}</span>
        </div>
      </div>

      <div class="footer-left">
        <p class="amount-in-words"></p>
        <div class="footer-left-table">
          <div class="footer-left-row">
            <div class="footer-left-cell"></div>
            <div class="footer-left-cell border-left"></div>
          </div>
          <div class="footer-left-label-row">
            <span class="footer-left-label">المستلم:</span>
            <span class="footer-left-label">الإمضاء:</span>
          </div>
        </div>
        <div class="footer-left-note">
          <span class="footer-left-label-note">ملاحظات:</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/* ---------- Popup modal component ---------- */
const InvoiceModal = ({ isOpen, onClose, invoiceData }) => {
  const iframeRef = useRef(null);

  const html = useMemo(() => {
    const baseHref = typeof window !== "undefined" ? window.location.origin + "/" : "/";
    return buildInvoiceHtml(invoiceData, { inlineCss: INLINE_INVOICE_CSS, baseHref });
  }, [invoiceData]);

  // ESC close + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains("invoice-modal-overlay")) onClose?.();
  };

  const handleDownloadPDF = () => {
    const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
    if (!doc) return;
    const element = doc.documentElement;
    html2pdf().set({
      margin: 0,
      filename: "Invoice.pdf",
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from(element).save();
  };

  // ✅ Robust print via hidden iframe (no popup, no sandbox issues)
  const handlePrint = () => {
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    // Important: no sandbox attribute here
    document.body.appendChild(printFrame);

    const onLoad = () => {
      try {
        const win = printFrame.contentWindow;
        win.focus();
        // Give layout a tick to settle before print (fonts, etc.)
        setTimeout(() => {
          win.print();
          // clean up after a short delay (some browsers need a moment)
          setTimeout(() => document.body.removeChild(printFrame), 500);
        }, 50);
      } catch (err) {
        console.error("Print failed:", err);
        document.body.removeChild(printFrame);
        alert("Unable to print. Please check your browser’s print permissions.");
      }
    };

    printFrame.onload = onLoad;
    // Write the same exact HTML we show in the preview
    printFrame.srcdoc = html;
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{MODAL_CSS}</style>

      <div
        className="invoice-modal-overlay"
        role="dialog"
        aria-modal="true"
        onMouseDown={handleOverlayClick}
      >
        <div className="invoice-modal-shell" onMouseDown={(e) => e.stopPropagation()}>
          <div className="invoice-modal-header">
            <div className="invoice-modal-title">Invoice Preview</div>

            <div className="invoice-modal-controls">
              <button onClick={handlePrint} className="btn btn-primary" title="Print (A4)">🖨 Print</button>
              <button onClick={handleDownloadPDF} className="btn btn-secondary" title="Download PDF">⬇ Download PDF</button>
              <button onClick={onClose} className="btn btn-outline" title="Close">✕ Close</button>
            </div>
          </div>

          <div className="invoice-modal-content">
            <div className="invoice-layout">
              <iframe
                ref={iframeRef}
                title="Invoice Preview"
                srcDoc={html}
                style={{ width: "100%", height: "85vh", border: 0, background: "#fff" }}
                // sandboxed preview is fine; printing uses a separate unsandboxed hidden iframe
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoiceModal;
