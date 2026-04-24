// src/components/pos-system/invoicePreviewModal.jsx
import React, { useMemo, useRef, useEffect, useState } from "react";
import html2pdf from "html2pdf.js"; // (kept if you use it elsewhere)
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { axiosClient } from "../api/axiosClient";
import { hasPerm } from "../auth/authz";
import revoLogoSrc from "../revo-logo/revo.png";

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

/* =========================
   Helpers: numbers & dates
   ========================= */
function fmtSmart(n) {
  const num = Number(String(n ?? "").replace(/,/g, ""));
  if (!Number.isFinite(num)) return n ?? "";
  return Number.isInteger(num)
    ? num.toLocaleString("en-US")
    : num.toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      });
}
function fmtOpt(n) {
  if (n === null || n === undefined || n === "") return "";
  return fmtSmart(n);
}

function fmtDate(input) {
  if (!input) return "";

  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (typeof input === "string") {
    let m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, y, mo, d] = m;
      const mon = MONTHS[Number(mo) - 1];
      return `${d}-${mon}-${y}`;
    }
    m = input.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const mon = MONTHS[Number(mo) - 1];
      return `${d}-${mon}-${y}`;
    }
    m = input.match(/^(\d{2})-([a-zA-Z]{3})-(\d{4})$/);
    if (m) {
      const d = m[1];
      const mon3 = m[2].slice(0, 3).toLowerCase();
      const idx = [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ].indexOf(mon3);
      const Mon =
        idx >= 0
          ? MONTHS[idx]
          : mon3.charAt(0).toUpperCase() + mon3.slice(1);
      const y = m[3];
      return `${d}-${Mon}-${y}`;
    }
  }

  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}-${mon}-${year}`;
}

/* =========================
   Modal (outside iframe)
   ========================= */
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
  flex-wrap: wrap; gap: 8px;
}
.invoice-modal-title-row {
  display: flex; align-items: center; gap: 12px;
}
.invoice-modal-title { font-size: 15px; font-weight: 700; color: #0f172a; }
.edit-mode-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 6px; background: #fef3c7;
  border: 1px solid #f59e0b; font-size: 11px; font-weight: 600;
  color: #92400e;
}
.invoice-modal-controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.invoice-modal-vat-toggle { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; color: #374151; cursor: pointer; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; user-select: none; }
.invoice-modal-vat-toggle input { cursor: pointer; width: 15px; height: 15px; }
.btn {
  border: 1px solid transparent; background: #fff; padding: 10px 14px;
  border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700;
  line-height: 1; display: inline-flex; align-items: center; gap: 10px;
  transition: background .15s ease, color .15s ease, border-color .15s ease, transform .04s ease;
}
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.btn-primary:hover:not(:disabled) { background: #1d4ed8; border-color: #1d4ed8; }
.btn-secondary { background: #0ea5e9; color: #fff; border-color: #0ea5e9; }
.btn-secondary:hover:not(:disabled) { background: #0284c7; border-color: #0284c7; }
.btn-tertiary { background: #22c55e; color: #fff; border-color: #22c55e; }
.btn-tertiary:hover:not(:disabled) { background: #16a34a; border-color: #16a34a; }
.btn-warning { background: #f59e0b; color: #fff; border-color: #f59e0b; }
.btn-warning:hover:not(:disabled) { background: #d97706; border-color: #d97706; }
.btn-outline { background: #fff; color: #0f172a; border-color: #e5e7eb; }
.btn-outline:hover:not(:disabled) { background: #f8fafc; }
.invoice-modal-content { background: #f8fafc; padding: 12px; overflow: auto; flex: 1; }
.invoice-layout { background: #e5e7eb; border: 1px dashed #cbd5e1; padding: 8px; }
`;

/* =========================
   Invoice (inside iframe) - WITH EDIT MODE STYLES
   ========================= */
export const INLINE_INVOICE_CSS = `
:root {
  --a4-w-mm: 210mm;
  --a4-h-mm: 297mm;
  --a4-w-px: 770px;
  --a4-h-px: 1123px;
}
#pages-root { display: flex; flex-direction: column; gap: 16px; }
#pages-root[data-invoice-type="G"] .invoice-meta { height: 95px; }
#pages-root[data-invoice-type="G"] .footer-value{border:none}
#pages-root[data-invoice-type="G"] .footer-left{border:none}
#pages-root[data-invoice-type="G"] .footer-left-label-row{height:90px; }
#pages-root[data-invoice-type="G"] .footer-left-label{padding:15px}

.invoice-a4-wrapper {
  width: var(--a4-w-px);
  height: var(--a4-h-px);
  margin: 0 auto; padding: 0; background: #fff;
  box-shadow: 0 0 10px rgba(0,0,0,0.1); box-sizing: border-box;
  font-family: "Times New Roman", Times, serif; font-size: 11px; direction: rtl;
  display: flex; flex-direction: column;
  transform-origin: top left; transition: transform .2s ease;
}
.footer-page {}

.page-body { flex: 1; display: flex; flex-direction: column; }
.invoice-header { display: flex; justify-content: space-between; padding: 5px; border: 1px solid #000; margin: 7px; height: 150px; }
.invoice-header .left-info { direction: ltr; text-align: left; font-size: 14px; line-height: 1.4; }
.invoice-header .right-info { text-align: right; direction: rtl; font-size: 14px; line-height: 1.4; }
.company-title, .company-subtitle { font-family: Arial, sans-serif; font-size: 25px; margin: 0; }
.company-arabic-title, .company-arabic-subtitle { font-family: Arial, sans-serif; font-size: 25px; margin: 0; font-weight: bold; }
.small-subtitle { font-weight: normal; }
.left-info { font-family: "Times New Roman", Times, serif; line-height: 1.4; font-size: 13px; }
.invoice-header .left-info h2, .invoice-header .left-info p, .invoice-header .right-info h2, .invoice-header .right-info p { margin: 0; padding: 0; }
.invoice-arabic-contact { font-family: "Times New Roman", Times, serif; font-size: 14px; display: flex; flex-direction: column; direction: rtl; }
.invoice-arabic-line { display: flex; align-items: center; }
.invoice-arabic-label { width: 80px; text-align: right; }
.invoice-arabic-colon { width: 10px; text-align: center; display: inline-block; }
.invoice-arabic-value { flex: 1; text-align: right; }

.invoice-meta {
  display: flex; justify-content: space-between; padding: 5px; margin: 0 7px 7px 7px; border: 1px solid #000;
  font-family: Arial, sans-serif; font-size: 15px; box-sizing: border-box; height: 135px;
}
.meta-right, .meta-left { display: flex; flex-direction: column; text-align: right; }
.meta-left { margin-left: 25px; }
.meta-line { display: flex; align-items: center; font-size: 16px; line-height: 1.2; margin: 2px 0; }
.meta-label { width: 90px; text-align: right; font-weight: bold; }
.meta-colon { width: 10px; text-align: center; }
.meta-value { flex: 1; text-align: right; }
.meta-name-cus{font-size:17px;font-weight:bold;}
.meta-value.date-ltr {
  direction: ltr;
  unicode-bidi: embed;
  text-align: left;
  display: inline-block; 
}

.invoice-table {
  width: calc(100% - 15px); margin: 0 7px 7px 7px; border-collapse: collapse;
  font-family: Arial, sans-serif; font-size: 14px; direction: rtl; border: 0.5px solid #000;
}
.invoice-table thead { display: table-header-group; }
.invoice-table th {
  background: #fff; font-weight: bold; border: none; border-bottom: 0.5px solid #000 !important;
  padding: 6px; text-align: center;
}
.invoice-table tr, .invoice-table td, .invoice-table th { page-break-inside: auto; break-inside: auto; }
.invoice-table td { padding: 6px; border-left: 0.5px solid #9c9c9cff; position: relative; }
.invoice-table td:first-child { border-right: 0.5px solid #000; }

/* ✅ EDITABLE CELL STYLES */
.invoice-table td.editable {
  background: #fffbeb;
  cursor: text;
  transition: background 0.15s ease;
}
.invoice-table td.editable:hover { background: #fef3c7; }
.invoice-table td.editable:focus {
  outline: 2px solid #f59e0b;
  outline-offset: -2px;
  background: #fef3c7;
}

/* ✅ ROW ACTIONS */
.row-actions {
  position: absolute;
  right: -35px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  flex-direction: column;
  gap: 2px;
  z-index: 10;
}
.invoice-table tbody tr:hover .row-actions { display: flex; }
.row-action-btn {
  width: 26px; height: 26px;
  border: 1px solid #e5e7eb; border-radius: 4px;
  background: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  transition: all 0.15s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.row-action-btn:hover { background: #f3f4f6; border-color: #d1d5db; transform: scale(1.05); }
.row-action-btn.delete { color: #dc2626; }
.row-action-btn.delete:hover { background: #fee2e2; border-color: #fca5a5; }

/* ✅ ADD ROW BUTTON */
.add-row-container {
  margin: 8px 7px;
  padding: 10px;
  border: 1px dashed #9ca3af;
  background: #f9fafb;
  cursor: pointer;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  border-radius: 6px;
  transition: all 0.15s ease;
  font-family: Arial, sans-serif;
}
.add-row-container:hover {
  background: #f3f4f6;
  border-color: #6b7280;
  color: #374151;
  border-style: solid;
}

.arabic-item-name { font-size: 16px; text-align: left;}
.col-small { width: 40px; }
.col-price { width: 40px; }
.col-amount { width: 90px; }
.col-area { width: 75px; }
.col-description { width: 190px; text-align: left; white-space: normal; word-break: break-word; vertical-align: top; }
.col-item { width: 90px; text-align: left; }

.invoice-footer {
  display: flex; justify-content: space-between; padding: 10px;
  font-family: "Arial", sans-serif; font-size: 12px; height: 180px; box-sizing: border-box;
  margin-top: auto;
}
.footer-spacer { height: 0; }
.footer-left { width: 55%; border: 0.5px solid #000; padding: 5px; box-sizing: border-box; }
.footer-left-amount-words-row {
  display: none;
  border: 1px solid #000;
  padding: 6px 8px;
  margin: 6px 0;
  font-size: 13px;
  align-items: center;
  gap: 8px;
}
#pages-root[data-invoice-type="G"] .footer-left-amount-words-row {
  display: flex;
  justify-content: flex-end;
}
.footer-left-amount-words-plain {
  display: none;
  padding: 4px 6px;
  font-size: 13px;
  direction: ltr;      
  text-align: left;
}
#pages-root[data-invoice-type="S"] .footer-left-amount-words-plain { display: block; }
.footer-left-label-row { display: flex; flex-direction: column; justify-content: space-between; padding: 0 10px; height: 60px; border: 1px solid #000; }
.footer-left-label { border-left: 0.5px solid #000; width: 50%; font-size: 13px; text-align: right; padding: 7px; }
.footer-left-note, .footer-left-label-note { display: none; }
#pages-root[data-invoice-type="S"] .footer-left-note,
#pages-root[data-invoice-type="S"] .footer-left-label-note,
#pages-root[data-invoice-type="RVR"] .footer-left-label-note { display: block; }
.footer-left-note {margin-top:10px;}
.footer-right { width: 44%; display: flex; flex-direction: column; padding: 40px 10px 10px; border: 0.5px solid #000; box-sizing: border-box; }
.footer-row { display: flex; justify-content: space-between; direction: ltr; margin-bottom: 6px; font-size: 15px; }
.footer-row span { width: 32%; text-align: right; }
.footer-row span:nth-child(1) { text-align: left; }
.footer-row span:last-child { text-align: left; }
.footer-total-line { width:100%; padding-top: 6px; display: flex; justify-content: space-around; direction: ltr; font-size: 14px; }
.footer-total-label { font-weight: bold; font-size: 20px; }
.footer-total-amount { font-weight: bolder; font-size: 17px; text-align: left; border: 0.5px solid #000; padding: 3px 0 3px 3px; width: 50%; }
.footer-label{font-weight:bold;}
.footer-value{border: 0.5px solid #000;padding:2px;}

@page { size: A4; margin: 6mm; }

@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: hidden !important;
  }

  #pages-root { gap: 0 !important; margin: 0 !important; padding: 0 !important; }

  .invoice-a4-wrapper {
    width: 198mm !important;
    height: 285mm !important;
    padding-top: 2mm !important;
    padding-left: 2mm !important;
    padding-right: 0 !important;
    padding-bottom: 0 !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    box-shadow: none !important;
    border: none !important;
    overflow: hidden !important;
    page-break-after: always !important;
    break-after: page !important;
    transform: none !important;
  }

  .invoice-a4-wrapper:last-child { page-break-after: auto !important; break-after: auto !important; }

  .invoice-header, .invoice-meta {
    margin: 0 0 2mm 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  .invoice-table {
    width: calc(100% ) !important;
    margin-left: 2mm !important;
    margin-right: 0 !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    table-layout: fixed !important;
  }

  .invoice-table th, .invoice-table td {
    padding-left: 3mm !important;
    box-sizing: border-box !important;
  }

  .invoice-footer {
    width: calc(100% ) !important;
    margin-left: 2mm !important;
    margin-right: 0 !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .row-actions, .add-row-container { display: none !important; }
}
`;

/* =========================
   Build full iframe HTML
   FIX: صندوق editable for ANY type (sheet/unit/sqm/box)
   ========================= */
export function buildInvoiceHtml(
  invoiceData = {},
  { inlineCss, baseHref = "/", editMode = false, isRevo = false, logoBase64 = "", forceHeaderOnG = false, shamounSigBase64 = "", forceShowVat = false } = {}
) {
  const {
    invoiceNumber = "",
    date = "",
    customerName = "",
    customerAddress = "",
    customerPhone = "",
    customerAccountNumber = "",
    customerTaxNumber = "",
    currencyRate = 1,
    vatPercentage = 11,
    totalWithoutVAT = 0,
    totalVAT = 0,
    grandTotal = 0,
    items = [],
    currencyCode = "USD",
  } = invoiceData;

  const currNorm = String(currencyCode ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .trim();
  const isLLCurrency = currNorm === "LL" || currNorm === "LBP";

  const rate = Number(currencyRate || 1) || 1;
  const totalVatLBP = isLLCurrency
    ? Number(String(totalVAT || 0).replace(/,/g, "")) || 0
    : (Number(String(totalVAT || 0).replace(/,/g, "")) || 0) * rate;
  const totalVatLL = totalVatLBP;

  const invoiceType = String(
    invoiceData?.invoiceType ?? invoiceData?.type ?? ""
  ).toUpperCase();
  const hideTaxAccount = invoiceType === "G";

  const toNumLoose = (v) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const rowsHtml =
    items.length === 0
      ? `<tr><td colspan="9" style="text-align:center;padding:12px">لا توجد أصناف</td></tr>`
      : items
          .map((it, idx) => {
            const type = String(it?.itemType ?? it?.type ?? "").toLowerCase();
            const isBox = type === "box";
            const isSheet = type === "sheet";
            const isSqmPiece = type === "sqm";
            const isUnit = type === "unit";

            const itemId = it?._id ?? idx;
            const itemNumber = it?.itemNumber ?? "";

            // ✅ BOX compatibility values
            const sheetsPerBoxVal =
              it?.sheetsPerBox ??
              it?.sheets_per_box ??
              it?.sheetsPerCarton ??
              it?.sheets_per_carton ??
              "";

            // ✅ IMPORTANT: boxQty is now allowed for ALL types
            // - for BOX: default from boxQty OR quantity
            // - for others: default from boxQty only (no fallback to quantity)
            const boxQtyVal = isBox
              ? it?.boxQty ?? it?.boxQuantity ?? it?.quantity ?? ""
              : it?.boxQty ?? it?.boxQuantity ?? "";

            // ✅ لوح column behavior stays:
            // - BOX => sheetsPerBox
            // - SHEET/UNIT/SQM => quantity
            const lohField = isBox ? "sheetsPerBox" : "quantity";
            const lohValue = isBox ? fmtOpt(sheetsPerBoxVal) : fmtOpt(it?.quantity);

            const qtyForUnit = toNumLoose(it?.quantity);
            const amount =
              it?.totalAmount ??
              toNumLoose(it?.unitPrice) * (isUnit ? qtyForUnit : toNumLoose(it?.sqm));

            const hasThickness =
              !isUnit &&
              it?.thickness !== undefined &&
              it?.thickness !== null &&
              String(it?.thickness) !== "";

            const thicknessLabel = hasThickness ? fmtSmart(it.thickness) + " ملم " : "";

            const displayName =
              (it?.invoiceItemDisplayName &&
                String(it.invoiceItemDisplayName).trim()) ||
              (it?.invoiceDisplayName && String(it.invoiceDisplayName).trim()) ||
              `${thicknessLabel}${it?.itemName ?? ""}`.trim();

            if (editMode) {
              return `
                <tr data-item-id="${itemId}" data-item-type="${type}">
                  <td class="editable" contenteditable="true" data-field="totalAmount">${fmtSmart(amount)}</td>
                  <td class="editable" contenteditable="true" data-field="unitPrice">${fmtOpt(it?.unitPrice)}</td>
                  <td class="editable" contenteditable="true" data-field="sqm">${isUnit ? "" : fmtOpt(it?.sqm)}</td>
                  <td class="editable" contenteditable="true" data-field="width">${fmtOpt(it?.width)}</td>
                  <td class="editable" contenteditable="true" data-field="length">${fmtOpt(it?.length)}</td>

                  <!-- ✅ لوح -->
                  <td class="editable" contenteditable="true" data-field="${lohField}">${lohValue}</td>

                  <!-- ✅ صندوق: ALWAYS editable now -->
                  <td class="editable" contenteditable="true" data-field="boxQty">${fmtOpt(boxQtyVal)}</td>

                  <td class="arabic-item-name editable" contenteditable="true" data-field="itemName">${displayName}</td>

                  <!-- actions inside TD (valid HTML) -->
                  <td class="editable" contenteditable="true" data-field="itemNumber">
                    ${itemNumber}
                    <div class="row-actions">
                      <button class="row-action-btn delete" onclick="window.deleteRow(${itemId})" title="Delete row">🗑</button>
                    </div>
                  </td>
                </tr>`;
            }

            // non-edit display
            const sheetsCell = isBox
              ? fmtOpt(sheetsPerBoxVal)
              : isSqmPiece
              ? fmtOpt(it?.quantity)
              : isSheet || isUnit
              ? fmtOpt(it?.quantity)
              : "";

            // ✅ show boxQty if user stored it, even for non-box
            const boxCell = fmtOpt(boxQtyVal);

            return `
                <tr>
                  <td>${fmtSmart(amount)}</td>
                  <td>${fmtOpt(it?.unitPrice)}</td>
                  <td>${isUnit ? "" : fmtOpt(it?.sqm)}</td>
                  <td>${fmtOpt(it?.width)}</td>
                  <td>${fmtOpt(it?.length)}</td>
                  <td>${sheetsCell}</td>
                  <td>${boxCell}</td>
                  <td class="arabic-item-name">${displayName}</td>
                  <td>${itemNumber}</td>
                </tr>`;
          })
          .join("");

  const addRowButton = editMode
    ? `<div class="add-row-container" onclick="window.addRow()">+ Add Row</div>`
    : "";

  const baseTag = `<base href="${baseHref}">`;
  const styleTag = `<style>${inlineCss || ""}</style>`;

  const editModeScript = editMode
    ? `
  <script>
    window.deleteRow = function(itemId) {
      window.parent.postMessage({ type: 'deleteRow', itemId }, '*');
    };
    window.addRow = function() {
      window.parent.postMessage({ type: 'addRow' }, '*');
    };

    document.addEventListener('blur', function(e) {
      if (e.target.hasAttribute('contenteditable') && e.target.getAttribute('contenteditable') === 'true') {
        const row = e.target.closest('tr');
        const itemId = row?.dataset?.itemId;
        const itemType = row?.dataset?.itemType;
        const field = e.target.dataset?.field;
        const value = e.target.textContent.trim();

        if (itemId !== undefined && field) {
          window.parent.postMessage({
            type: 'itemChange',
            itemId: parseInt(itemId),
            itemType,
            field,
            value
          }, '*');
        }
      }
    }, true);

    document.addEventListener('keydown', function(e) {
      if (e.target.hasAttribute('contenteditable') && e.key === 'Enter') {
        e.preventDefault();
      }
    });
  </script>
  `
    : "";

  return `<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
${baseTag}
${styleTag}
</head>
<body>
  <div id="pages-root" data-invoice-type="${invoiceType}" data-force-header="${forceHeaderOnG ? '1' : '0'}"></div>

  <div id="source" style="display:none">
    <table class="invoice-table" id="source-table">
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
    ${addRowButton}

    ${isRevo ? `
    <div class="invoice-header" id="source-header">
      <div class="right-info">
        <h2 class="company-arabic-title">شركة ريفو جلاس</h2>
        <p class="small-subtitle">سوريا – حلب – الراموسة</p>
        <div class="invoice-arabic-contact">
          <div class="invoice-arabic-line"><span class="invoice-arabic-label">تلفون</span><span class="invoice-arabic-colon">:</span><span class="invoice-arabic-value">+963 995118111</span></div>
          <div class="invoice-arabic-line"><span class="invoice-arabic-label">الاستفسار</span><span class="invoice-arabic-colon">:</span><span class="invoice-arabic-value">+963 995434366</span></div>
          <div class="invoice-arabic-line"><span class="invoice-arabic-label">البريد</span><span class="invoice-arabic-colon">:</span><span class="invoice-arabic-value">revo.glass.co@gmail.com</span></div>
        </div>
      </div>
      <div class="left-info" style="display:flex;align-items:center;justify-content:center;">
        ${logoBase64
          ? `<img src="${logoBase64}" alt="Revo" style="max-height:120px;max-width:180px;object-fit:contain;" />`
          : `<h1 class="company-title">REVO GLASS COMPANY</h1>`}
      </div>
    </div>` : `
    <div class="invoice-header" id="source-header">
      <div class="right-info">
        <h2 class="company-arabic-title">شركة شمعون</h2>
        <h2 class="company-arabic-subtitle">للزجاج و المرايا</h2>
        <p class="small-subtitle">الحدث/ شويفات</p>
        <div class="invoice-arabic-contact">
          <div class="invoice-arabic-line"><span class="invoice-arabic-label">تلفون</span><span class="invoice-arabic-colon">:</span><span class="invoice-arabic-value">05/810888 05/814964</span></div>
          <div class="invoice-arabic-line"><span class="invoice-arabic-label">خلوي/ واتساب</span><span class="invoice-arabic-colon">:</span><span class="invoice-arabic-value">79/100068</span></div>
          <div class="invoice-arabic-line"><span class="invoice-arabic-label">فاكس</span><span class="invoice-arabic-colon">:</span><span class="invoice-arabic-value">05/814961</span></div>
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
    </div>`}

    <div class="invoice-meta" id="source-meta">
      <div class="meta-right">
        <div class="meta-line"><span class="meta-label">اسم الزبون</span><span class="meta-colon">:</span><span class="meta-name-cus">${customerName || "-"}</span></div>
        <div class="meta-line"><span class="meta-label">العنوان</span><span class="meta-colon">:</span><span class="meta-value">${customerAddress || "-"}</span></div>
        <div class="meta-line"><span class="meta-label">تلفون</span><span class="meta-colon">:</span><span class="meta-value">${customerPhone || "-"}</span></div>
        ${hideTaxAccount ? "" : `<div class="meta-line"><span class="meta-label">رقم الحساب</span><span class="meta-colon">:</span><span class="meta-value">${customerAccountNumber || "-"}</span></div>`}
        ${hideTaxAccount ? "" : `<div class="meta-line"><span class="meta-label">الرقم الضريبي</span><span class="meta-colon">:</span><span class="meta-value">${customerTaxNumber || "-"}</span></div>`}
      </div>
      <div class="meta-left">
        <div class="meta-line"><span class="meta-label">${invoiceType === "G" ? "Proforma #" : "رقم الفاتورة"}</span><span class="meta-colon">:</span><span class="meta-value">${invoiceNumber || "-"}</span></div>
        <div class="meta-line"><span class="meta-label">التاريخ</span><span class="meta-colon">:</span><span class="meta-value date-ltr">${fmtDate(date)}</span></div>
        <div class="meta-line"><span class="meta-label">العملة</span><span class="meta-colon">:</span><span class="meta-value">${currencyCode}</span></div>
      </div>
    </div>

    <div class="invoice-footer" id="source-footer" data-grandtotal="${grandTotal}" data-currency="${currencyCode}" data-vat="${vatPercentage}">
      <div class="footer-right">
        ${
          (Number(vatPercentage) > 0 || forceShowVat)
            ? `
        <div class="footer-row">
          <span class="footer-label">${isLLCurrency ? "VAT" : "VAT LBP"}</span>
          <span class="footer-label">${invoiceType === "G" ? "القيمة" : "المجموع"}</span>
          <span class="footer-value">${fmtSmart(totalWithoutVAT)}</span>
        </div>
        <div class="footer-row">
          <span class="footer-vat-value">${fmtSmart(totalVatLL)}</span>
          <span class="footer-label">V.A.T ${fmtSmart(vatPercentage)}%</span>
          <span class="footer-value">${fmtSmart(totalVAT)}</span>
        </div>
        `
            : ""
        }
        <div class="footer-total-line" style="${
          Number(vatPercentage) === 0 && !forceShowVat ? "padding-top: 80px;" : ""
        }">
          <strong class="footer-total-label">${
            invoiceType === "G" ? "المجموع" : "المجموع الصافي"
          }</strong>
          <span class="footer-total-amount">${fmtSmart(grandTotal)} ${currencyCode}</span>
        </div>
      </div>
      <div class="footer-left">
        <div class="footer-left-table">
          <div class="footer-left-amount-words-row">
            <span class="footer-left-amount-words-txt"></span>
          </div>
          <div class="footer-left-amount-words-plain">
            <span class="footer-left-amount-words-plain-txt"></span>
          </div>
          <div class="footer-left-row">
            <div class="footer-left-cell"></div>
            <div class="footer-left-cell border-left"></div>
          </div>
          <div class="footer-left-label-row" style="position:relative;">
            ${shamounSigBase64 ? `<img src="${shamounSigBase64}" style="position:absolute;left:2px;top:50%;transform:translateY(-50%);height:86px;max-width:48%;object-fit:contain;" />` : ""}
            <span class="footer-left-label">المستلم:</span>
            <span class="footer-left-label">الإمضاء:</span>
          </div>
        </div>
        ${invoiceType === "G" ? "" : `<div class="footer-left-note"><span class="footer-left-label-note">ملاحظات:</span></div>`}
      </div>
    </div>
  </div>

  ${editModeScript}

  <script>
    (function () {
      const sel = (s, r=document) => r.querySelector(s);
      const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
      const round = (n) => Math.ceil(n);

      function numberToWordsEn(amount, currency) {
        const ones = ["","one","two","three","four","five","six","seven","eight","nine"];
        const teens = ["ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
        const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
        const scales = ["","thousand","million","billion","trillion"];
        const toWordsUnder100 = (n) => {
          if (n >= 20) {
            const t = Math.floor(n/10), u = n % 10;
            return tens[t] + (u ? "-" + ones[u] : "");
          } else if (n >= 10) return teens[n-10];
          else if (n > 0) return ones[n];
          return "";
        };
        const toWordsUnder1000 = (n) => {
          let str = "";
          const h = Math.floor(n/100), rem = n % 100;
          if (h) { str += ones[h] + " hundred"; if (rem) str += " "; }
          if (rem) str += toWordsUnder100(rem);
          return str;
        };
        const dollars = Math.floor(Math.abs(amount));
        const cents = Math.round((Math.abs(amount) - dollars) * 100);
        const centsWords = cents ? toWordsUnder100(cents) : "";
        const centsLabel = cents === 1 ? "cent" : "cents";
        let words = "";
        let num = dollars;
        let scaleIdx = 0;
        while (num > 0) {
          const chunk = num % 1000;
          if (chunk) {
            const chunkWords = toWordsUnder1000(chunk);
            const scale = scales[scaleIdx] ? " " + scales[scaleIdx] : "";
            words = chunkWords + scale + (words ? " " + words : "");
          }
          num = Math.floor(num / 1000);
          scaleIdx++;
        }
        words = words.trim();
        if (!words && cents) {
          const onlyCents = (centsWords || "zero") + " " + centsLabel + (currency ? " " + currency : "");
          return onlyCents.charAt(0).toUpperCase() + onlyCents.slice(1);
        }
        if (!words) words = "zero";
        words = words.charAt(0).toUpperCase() + words.slice(1);
        if (cents) return words + " and " + centsWords + " " + centsLabel + (currency ? " " + currency : "");
        return words + (currency ? " " + currency : "");
      }

      let RUN_ID = 0;

      function makePage({ includeHeader, includeMeta, headerNode, metaNode, thead }) {
        const page = el('div', 'invoice-a4-wrapper');
        const body = el('div', 'page-body');
        if (includeHeader && headerNode) body.appendChild(headerNode.cloneNode(true));
        if (includeMeta && metaNode) body.appendChild(metaNode.cloneNode(true));
        const tbl = el('table', 'invoice-table');
        const th = thead.cloneNode(true);
        const tb = el('tbody');
        tbl.appendChild(th);
        tbl.appendChild(tb);
        body.appendChild(tbl);
        page.appendChild(body);
        return { page, body, table: tbl, tbody: tb };
      }

      function makeFooterPage() {
        const page = el('div', 'invoice-a4-wrapper footer-page');
        const body = el('div', 'page-body');
        page.appendChild(body);
        return { page, body };
      }

      function paginate() {
        const currentRun = String(++RUN_ID);
        const pagesRoot = sel('#pages-root');
        pagesRoot.setAttribute('data-run', currentRun);

        const srcHeader = sel('#source-header');
        const srcMeta = sel('#source-meta');
        const srcFooter = sel('#source-footer');
        const srcTable = sel('#source-table');
        const srcRows = Array.from(srcTable.tBodies[0].rows);
        const thead = srcTable.tHead;
        const addRowBtn = document.querySelector('.add-row-container');

        const invoiceTypeAttr = (pagesRoot?.getAttribute('data-invoice-type') || '').toUpperCase();
        const forceHeaderAttr = pagesRoot?.getAttribute('data-force-header') === '1';
        const shouldShowHeaderOnFirstPage = invoiceTypeAttr !== 'G' || forceHeaderAttr;

        if (srcFooter) {
          const total = parseFloat(srcFooter.getAttribute('data-grandtotal') || '0');
          const ccy = srcFooter.getAttribute('data-currency') || '';
          if (invoiceTypeAttr === 'G') {
            const txtNodeG = sel('.footer-left-amount-words-txt', srcFooter);
            if (txtNodeG) txtNodeG.textContent = numberToWordsEn(total, ccy);
          } else if (invoiceTypeAttr === 'S') {
            const txtNodeS = sel('.footer-left-amount-words-plain-txt', srcFooter);
            if (txtNodeS) txtNodeS.textContent = numberToWordsEn(total, ccy);
          }
        }

        pagesRoot.innerHTML = '';

        let { page, body, table, tbody } = makePage({
          includeHeader: shouldShowHeaderOnFirstPage,
          includeMeta: true,
          headerNode: srcHeader,
          metaNode: srcMeta,
          thead
        });
        pagesRoot.appendChild(page);

        const PAGE_H = round(page.getBoundingClientRect().height);
        const SAFETY = 8;

        for (let i = 0; i < srcRows.length; i++) {
          const row = srcRows[i].cloneNode(true);
          tbody.appendChild(row);

          const tableRect = table.getBoundingClientRect();
          const currentBottom = round(tableRect.bottom - page.getBoundingClientRect().top);
          if (currentBottom > (PAGE_H - SAFETY)) {
            tbody.removeChild(row);
            ({ page, body, table, tbody } = makePage({
              includeHeader: false,
              includeMeta: false,
              headerNode: srcHeader,
              metaNode: srcMeta,
              thead
            }));
            pagesRoot.appendChild(page);
            tbody.appendChild(row);
          }
        }

        if (addRowBtn) {
          const lastPageBody = pagesRoot.lastChild?.querySelector('.page-body');
          if (lastPageBody) {
            const addRowClone = addRowBtn.cloneNode(true);
            addRowClone.onclick = () => window.addRow();
            lastPageBody.insertBefore(addRowClone, lastPageBody.querySelector('.invoice-footer'));
          }
        }

        placeFooter(pagesRoot, srcFooter, currentRun);
      }

      function placeFooter(pagesRoot, srcFooter, runToken) {
        const allPages = Array.from(pagesRoot.children);
        let lastPage = allPages[allPages.length - 1];
        let lastBody = sel('.page-body', lastPage);

        const footer = srcFooter.cloneNode(true);
        const spacer = el('div', 'footer-spacer'); spacer.id = 'footer-spacer';
        lastBody.appendChild(spacer);
        lastBody.appendChild(footer);

        void lastPage.offsetHeight;
        requestAnimationFrame(() => {
          if (pagesRoot.getAttribute('data-run') !== runToken) return;

          const freshPages = Array.from(pagesRoot.children);
          lastPage = freshPages[freshPages.length - 1];
          lastBody = sel('.page-body', lastPage);

          const PAGE_H = Math.ceil(lastPage.getBoundingClientRect().height);
          const footerH = Math.ceil(footer.getBoundingClientRect().height) || 190;

          const bodyChildren = Array.from(lastBody.children).filter(n => n !== spacer);
          const used = bodyChildren.reduce((h, n) => h + Math.ceil(n.getBoundingClientRect().height), 0);

          let remaining = PAGE_H - used - footerH;

          if (remaining < 0) {
            if (pagesRoot.getAttribute('data-run') !== runToken) return;
            lastBody.removeChild(footer);
            lastBody.removeChild(spacer);

            const { page: footerPage, body: footerBody } = makeFooterPage();
            pagesRoot.appendChild(footerPage);

            const PAGE_H2 = Math.ceil(footerPage.getBoundingClientRect().height);
            const spacer2 = el('div', 'footer-spacer'); spacer2.id = 'footer-spacer';

            let remaining2 = PAGE_H2 - footerH;
            if (remaining2 < 0) remaining2 = 0;
            if (remaining2 > PAGE_H2 - 2) remaining2 = 0;

            spacer2.style.height = remaining2 + 'px';
            footerBody.appendChild(spacer2);
            footerBody.appendChild(footer);
          } else {
            if (remaining > PAGE_H - 2) remaining = 0;
            spacer.style.height = remaining + 'px';
          }
        });
      }

      window.repaginateAndAdjust = function() { paginate(); };
      window.applyPreviewZoom = function (scale) {
        const root = document.body;
        if ('zoom' in root.style) root.style.zoom = String(scale);
        else {
          const pages = document.querySelectorAll('.invoice-a4-wrapper');
          pages.forEach(p => {
            p.style.transform = 'scale(' + scale + ')';
            p.style.transformOrigin = 'top left';
            const rect = p.getBoundingClientRect();
            const scaledH = Math.ceil(rect.height * scale);
            p.style.marginBottom = Math.max(0, scaledH - rect.height + 16) + 'px';
          });
        }
      };

      const onReady = () => requestAnimationFrame(paginate);
      if (document.readyState === 'complete') onReady();
      else window.addEventListener('load', onReady);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(paginate);
      window.addEventListener('resize', () => requestAnimationFrame(paginate));
    })();
  </script>
</body>
</html>`;
}

/* =========================
   Popup component
   - keeps "لوح" and "صندوق" independent
   - does not reload iframe on each blur (prevents jump)
   ========================= */
const InvoiceModal = ({ isOpen, onClose, invoiceData, onSaveEdited }) => {
  const iframeRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState([]);
  const editedItemsRef = useRef([]);
  const [savedEditedData, setSavedEditedData] = useState(null);

  const [renderVersion, setRenderVersion] = useState(0);

  const [isRevo, setIsRevo] = useState(false);
  const [logoBase64, setLogoBase64] = useState("");
  const [showVatAtZero, setShowVatAtZero] = useState(false);

  useEffect(() => {
    axiosClient.get("/company").then(({ data }) => {
      const active = Array.isArray(data) ? data.find((c) => c.isActive) : null;
      const revo = !!active?.companyName?.toLowerCase().includes("revo");
      setIsRevo(revo);
      if (revo) toBase64(revoLogoSrc).then(setLogoBase64);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    editedItemsRef.current = editedItems;
  }, [editedItems]);

  useEffect(() => {
    if (isOpen && invoiceData?.items) {
      setEditedItems(
        invoiceData.items.map((item, idx) => ({
          ...item,
          _id: idx,
          itemNumber: item.itemNumber ?? idx + 1,
          boxQty: item.boxQty ?? item.boxQuantity ?? "",
          sheetsPerBox:
            item.sheetsPerBox ??
            item.sheets_per_box ??
            item.sheetsPerCarton ??
            item.sheets_per_carton ??
            "",
        }))
      );
    }
    if (!isOpen) {
      setSavedEditedData(null);
      setEditMode(false);
      setRenderVersion(0);
    }
  }, [isOpen, invoiceData]);

  const html = useMemo(() => {
    const baseHref =
      typeof window !== "undefined" ? window.location.origin + "/" : "/";

    let dataToRender;

    if (savedEditedData) dataToRender = savedEditedData;
    else if (editMode) dataToRender = { ...invoiceData, items: editedItemsRef.current };
    else dataToRender = invoiceData;

    return buildInvoiceHtml(dataToRender, {
      inlineCss: INLINE_INVOICE_CSS,
      baseHref,
      editMode: editMode && !savedEditedData,
      isRevo,
      logoBase64,
      forceShowVat: showVatAtZero,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceData, editMode, savedEditedData, renderVersion, isRevo, logoBase64, showVatAtZero]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!editMode || savedEditedData) return;

      const { type, itemId, field, value } = event.data || {};

      if (type === "itemChange") {
        setEditedItems((prev) =>
          prev.map((item) => {
            if (item._id !== itemId) return item;

            const itemType = String(item?.itemType ?? item?.type ?? "").toLowerCase();
            const updated = { ...item };

            if (field === "boxQty") {
              // ✅ always editable for ALL types
              updated.boxQty = value;

              // ✅ compatibility only for BOX: quantity = number of boxes
              if (itemType === "box") updated.quantity = value;
            } else if (field === "sheetsPerBox") {
              updated.sheetsPerBox = value;
              updated.sheets_per_box = value;
            } else if (field === "quantity") {
              updated.quantity = value;
            } else {
              updated[field] = value;
            }

            return updated;
          })
        );
      } else if (type === "deleteRow") {
        setEditedItems((prev) => prev.filter((item) => item._id !== itemId));
        setRenderVersion((v) => v + 1);
      } else if (type === "addRow") {
        setEditedItems((prev) => [
          ...prev,
          {
            _id: Math.max(...prev.map((i) => i._id || 0), 0) + 1,
            itemNumber: prev.length + 1,
            itemName: "",
            itemType: "sheet",
            type: "sheet",
            quantity: "",
            unitPrice: "",
            sqm: "",
            totalAmount: "",
            length: "",
            width: "",
            boxQty: "",
            sheetsPerBox: "",
          },
        ]);
        setRenderVersion((v) => v + 1);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [editMode, savedEditedData]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
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

  const applyZoom = (z) => {
    const win =
      iframeRef.current?.contentWindow ||
      iframeRef.current?.contentDocument?.defaultView;
    if (!win) return;
    try {
      win.applyPreviewZoom?.(z);
    } catch {}
  };

  const handleZoomIn = () => {
    const next = Math.min(2, +(zoom + 0.1).toFixed(2));
    setZoom(next);
    applyZoom(next);
  };
  const handleZoomOut = () => {
    const next = Math.max(0.5, +(zoom - 0.1).toFixed(2));
    setZoom(next);
    applyZoom(next);
  };

  const handleToggleEdit = () => {
    if (savedEditedData) {
      setSavedEditedData(null);
      setEditMode(true);
      setRenderVersion((v) => v + 1);
    } else {
      setEditMode((prev) => !prev);
      setRenderVersion((v) => v + 1);
    }
  };

  const handleSaveEdited = () => {
    const keepAsTyped = (val) => {
      if (val === null || val === undefined) return val;
      return String(val);
    };

    const processedItems = editedItems.map((item) => ({
      ...item,
      quantity: keepAsTyped(item?.quantity),
      unitPrice: keepAsTyped(item?.unitPrice),
      sqm: keepAsTyped(item?.sqm),
      width: keepAsTyped(item?.width),
      length: keepAsTyped(item?.length),
      totalAmount: keepAsTyped(item?.totalAmount),
      boxQty: keepAsTyped(item?.boxQty),
      sheetsPerBox: keepAsTyped(item?.sheetsPerBox),
    }));

    const editedInvoiceData = {
      ...invoiceData,
      items: processedItems,
    };

    setSavedEditedData(editedInvoiceData);
    onSaveEdited?.(editedInvoiceData);
    setEditMode(false);
  };

  const getPagesFromIframe = (win) => {
    const root = win.document.getElementById("pages-root");
    if (!root) return [];
    return Array.from(root.children).filter(
      (el) =>
        el.classList &&
        el.classList.contains("invoice-a4-wrapper") &&
        el.offsetParent !== null &&
        el.getBoundingClientRect().height > 0
    );
  };

  const handleDownloadPDF = async () => {
    try {
      const win =
        iframeRef.current?.contentWindow ||
        iframeRef.current?.contentDocument?.defaultView;
      if (!win) return;

      win?.repaginateAndAdjust?.();
      const prevZoom = zoom;
      win?.applyPreviewZoom?.(1);

      const h2c = win.html2canvas || html2canvas;

      const waitForPages = async (timeoutMs = 4000, stableTicks = 2) => {
        const t0 = Date.now();
        let lastSig = "";
        let stable = 0;
        while (Date.now() - t0 < timeoutMs) {
          const pages = getPagesFromIframe(win);
          const sig =
            pages.length +
            ":" +
            pages.map((p) => Math.round(p.getBoundingClientRect().height)).join(",");
          if (sig === lastSig && pages.length) stable++;
          else {
            stable = 0;
            lastSig = sig;
          }
          if (stable >= stableTicks) return pages;
          await new Promise((r) => setTimeout(r, 60));
        }
        return getPagesFromIframe(win);
      };

      const pages = await waitForPages();
      if (!pages.length) {
        alert("No pages found to export.");
        win?.applyPreviewZoom?.(prevZoom);
        return;
      }

      const origRoot = win.document.getElementById("pages-root");
      const invoiceTypeAttr = origRoot?.getAttribute("data-invoice-type") || "";

      let stage = win.document.getElementById("pdf-stage");
      if (!stage) {
        stage = win.document.createElement("div");
        stage.id = "pdf-stage";
        Object.assign(stage.style, {
          position: "absolute",
          left: "-99999px",
          top: "0",
          overflow: "visible",
          pointerEvents: "none",
          zIndex: "-1",
        });
        win.document.body.appendChild(stage);
      }

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const baseName = `Invoice-${invoiceData?.invoiceNumber || "Preview"}${
        savedEditedData ? "-edited" : ""
      }`;

      for (let i = 0; i < pages.length; i++) {
        const orig = pages[i];

        stage.innerHTML = "";
        const wrapper = win.document.createElement("div");
        wrapper.id = "pages-root";
        if (invoiceTypeAttr) wrapper.setAttribute("data-invoice-type", invoiceTypeAttr);

        const clone = orig.cloneNode(true);
        clone.style.boxShadow = "none";
        clone.style.border = "none";

        const r = orig.getBoundingClientRect();
        clone.style.width = `${Math.ceil(r.width)}px`;
        clone.style.height = `${Math.ceil(r.height)}px`;

        wrapper.appendChild(clone);
        stage.appendChild(wrapper);

        stage.style.width = `${Math.ceil(r.width)}px`;
        stage.style.height = `${Math.ceil(r.height)}px`;

        void clone.offsetHeight;

        const canvas = await h2c(clone, {
          scale: 3,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: clone.scrollWidth || Math.ceil(r.width),
          windowHeight: clone.scrollHeight || Math.ceil(r.height),
        });

        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        if (i > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }

      pdf.save(`${baseName}.pdf`);
      win?.applyPreviewZoom?.(prevZoom);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("Could not export the PDF.");
    }
  };

  const handlePrint = () => {
    const printFrame = document.createElement("iframe");
    Object.assign(printFrame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(printFrame);

    const cleanup = () => {
      try {
        document.body.removeChild(printFrame);
      } catch {}
    };

    const waitForPagesStable = async (win, timeoutMs = 6000, stableTicks = 3) => {
      const t0 = Date.now();
      let lastSig = "";
      let stable = 0;

      while (Date.now() - t0 < timeoutMs) {
        win?.repaginateAndAdjust?.();
        win?.applyPreviewZoom?.(1);

        const pages = getPagesFromIframe(win);
        const sig =
          pages.length +
          ":" +
          pages.map((p) => Math.round(p.getBoundingClientRect().height)).join(",");

        if (sig === lastSig && pages.length) stable++;
        else {
          stable = 0;
          lastSig = sig;
        }

        if (stable >= stableTicks) return true;
        await new Promise((r) => setTimeout(r, 80));
      }
      return false;
    };

    printFrame.onload = async () => {
      try {
        const win = printFrame.contentWindow;

        if (win?.document?.fonts?.ready) {
          try {
            await win.document.fonts.ready;
          } catch {}
        }

        await waitForPagesStable(win);

        win.focus();
        win.onafterprint = cleanup;

        setTimeout(() => {
          win.print();
          setTimeout(cleanup, 2000);
        }, 200);
      } catch (err) {
        console.error("Print failed:", err);
        cleanup();
        alert("Unable to print. Please check your browser's print permissions.");
      }
    };

    const baseHref = typeof window !== "undefined" ? window.location.origin + "/" : "/";

    let dataForPrint;
    if (savedEditedData) dataForPrint = savedEditedData;
    else if (editMode) dataForPrint = { ...invoiceData, items: editedItems };
    else dataForPrint = invoiceData;

    const printHtml = buildInvoiceHtml(dataForPrint, {
      inlineCss: INLINE_INVOICE_CSS,
      baseHref,
      editMode: false,
      isRevo,
      logoBase64,
    });

    printFrame.srcdoc = printHtml;
  };

  const handleScreenshot = async () => {
    try {
      const win =
        iframeRef.current?.contentWindow ||
        iframeRef.current?.contentDocument?.defaultView;
      if (!win) return;

      const h2c = win.html2canvas || html2canvas;
      if (typeof h2c !== "function") {
        alert("Screenshot tool not available.");
        return;
      }

      win?.repaginateAndAdjust?.();

      const waitForPages = async (timeoutMs = 4000, stableTicks = 2) => {
        const t0 = Date.now();
        let lastSig = "";
        let stable = 0;
        while (Date.now() - t0 < timeoutMs) {
          const pages = getPagesFromIframe(win);
          const sig =
            pages.length +
            ":" +
            pages.map((p) => Math.round(p.getBoundingClientRect().height)).join(",");
          if (sig === lastSig && pages.length) stable++;
          else {
            stable = 0;
            lastSig = sig;
          }
          if (stable >= stableTicks) return pages;
          await new Promise((r) => setTimeout(r, 60));
        }
        return getPagesFromIframe(win);
      };

      const pages = await waitForPages();
      if (!pages.length) {
        alert("No pages found to capture.");
        return;
      }

      const origRoot = win.document.getElementById("pages-root");
      const invoiceTypeAttr = origRoot?.getAttribute("data-invoice-type") || "";

      let stage = win.document.getElementById("sc-stage");
      if (!stage) {
        stage = win.document.createElement("div");
        stage.id = "sc-stage";
        Object.assign(stage.style, {
          position: "absolute",
          left: "-99999px",
          top: "0",
          overflow: "visible",
          pointerEvents: "none",
          zIndex: "-1",
        });
        win.document.body.appendChild(stage);
      }

      const baseName = `Invoice-${invoiceData?.invoiceNumber || "Preview"}${
        savedEditedData ? "-edited" : ""
      }`;

      const downloadCanvas = (canvas, name) =>
        new Promise((resolve) => {
          if (canvas.toBlob) {
            canvas.toBlob((blob) => {
              if (!blob) return resolve();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = name;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                URL.revokeObjectURL(url);
                a.remove();
                resolve();
              }, 90);
            }, "image/png");
          } else {
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/png");
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(resolve, 90);
          }
        });

      for (let i = 0; i < pages.length; i++) {
        const orig = pages[i];

        stage.innerHTML = "";

        const wrapper = win.document.createElement("div");
        wrapper.id = "pages-root";
        if (invoiceTypeAttr) wrapper.setAttribute("data-invoice-type", invoiceTypeAttr);

        const clone = orig.cloneNode(true);
        clone.style.boxShadow = "none";
        clone.style.border = "none";

        const r = orig.getBoundingClientRect();
        clone.style.width = `${Math.ceil(r.width)}px`;
        clone.style.height = `${Math.ceil(r.height)}px`;

        wrapper.appendChild(clone);
        stage.appendChild(wrapper);

        stage.style.width = `${Math.ceil(r.width)}px`;
        stage.style.height = `${Math.ceil(r.height)}px`;

        void clone.offsetHeight;

        const canvas = await h2c(clone, {
          scale: 3,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: clone.scrollWidth || Math.ceil(r.width),
          windowHeight: clone.scrollHeight || Math.ceil(r.height),
        });

        const filename = `${baseName}-page-${i + 1}.png`;
        await downloadCanvas(canvas, filename);
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (e) {
      console.error("Screenshot failed:", e);
      alert("Could not capture the invoice screenshots.");
    }
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
            <div className="invoice-modal-title-row">
              <div className="invoice-modal-title">Invoice Preview</div>
              {editMode && <div className="edit-mode-badge">✏️ Edit Mode</div>}
            </div>

            <div className="invoice-modal-controls">
              {Number(invoiceData?.vatPercentage ?? 11) === 0 && hasPerm("invoice.showVatZero") && (
                <label className="invoice-modal-vat-toggle" title="Show VAT row even at 0%">
                  <input
                    type="checkbox"
                    checked={showVatAtZero}
                    onChange={(e) => setShowVatAtZero(e.target.checked)}
                  />
                  Show VAT
                </label>
              )}

              <button
                onClick={() => {
                  if (savedEditedData) {
                    setSavedEditedData(null);
                    setEditMode(true);
                    setRenderVersion((v) => v + 1);
                  } else {
                    setEditMode((p) => !p);
                    setRenderVersion((v) => v + 1);
                  }
                }}
                className={`btn ${editMode ? "btn-warning" : "btn-outline"}`}
                title="Toggle edit mode"
              >
                {editMode ? "📝 Exit Edit" : "✏️ Edit"}
              </button>

              {editMode && (
                <button
                  onClick={handleSaveEdited}
                  className="btn btn-tertiary"
                  title="Save edited version"
                >
                  💾 Save Edited
                </button>
              )}

              <button onClick={handlePrint} className="btn btn-primary" title="Print (A4)">
                🖨 Print
              </button>
              <button onClick={handleZoomOut} className="btn btn-outline" title="Zoom out">
                ➖ Zoom
              </button>
              <button onClick={handleZoomIn} className="btn btn-outline" title="Zoom in">
                ➕ Zoom
              </button>
              <button onClick={handleDownloadPDF} className="btn btn-secondary" title="Download PDF">
                ⬇ Download PDF
              </button>
              <button onClick={handleScreenshot} className="btn btn-tertiary" title="Save PNG">
                📸 Screenshot
              </button>
              <button onClick={onClose} className="btn btn-outline" title="Close">
                ✕ Close
              </button>
            </div>
          </div>

          <div className="invoice-modal-content">
            <div className="invoice-layout">
              <iframe
                ref={iframeRef}
                title="Invoice Preview"
                srcDoc={html}
                style={{ width: "100%", height: "85vh", border: 0, background: "#fff" }}
                sandbox="allow-same-origin allow-scripts"
                onLoad={() => {
                  const win = iframeRef.current?.contentWindow;
                  win?.repaginateAndAdjust?.();
                  win?.applyPreviewZoom?.(zoom);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoiceModal;
