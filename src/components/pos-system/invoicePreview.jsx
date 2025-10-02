import React, { useMemo } from "react";

/** number formatter */
function fmt(n, d = 2) {
  const num = Number(n);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}
/** date formatter (DD Mon YYYY) */
function fmtDate(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  return isNaN(dt) ? "" : dt.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/**
 * Build the full HTML doc as a string for srcDoc.
 * If you pass inlineCss, it will be embedded. Otherwise it will <link> cssHref.
 */
function buildInvoiceHtml(invoiceData = {}, { cssHref, inlineCss } = {}) {
  const {
    invoiceNumber = "",
    date = "",
    customerName = "",
    customerAddress = "",
    customerPhone = "",
    customerAccountNumber = "",
    customerTaxNumber = "",
    currencyRate = 1,
    vatPercentage = 0,
    totalWithoutVAT = 0,
    totalVAT = 0,
    grandTotal = 0,
    items = [],
    currencyCode = "USD",
  } = invoiceData;

  const grandTotalLL = grandTotal * currencyRate;
  const totalVatLL = totalVAT * currencyRate;

  // build rows html
  const rowsHtml =
    items.length === 0
      ? `<tr><td colspan="9" style="text-align:center;padding:12px">لا توجد أصناف</td></tr>`
      : items
          .map((it) => {
            const amount =
              it.totalAmount ?? (Number(it.unitPrice || 0) * Number(it.sqm || 0));
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
          })
          .join("");

  const headCss = inlineCss
    ? `<style>${inlineCss}</style>`
    : cssHref
    ? `<link rel="stylesheet" href="${cssHref}">`
    : "";

  // a tiny fallback so it looks okay even if CSS doesn’t load
  const fallbackCss = `
    <style>
      html,body { margin:0; padding:0; }
      .invoice-a4-wrapper { padding: 16px; font-family: Arial, sans-serif; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
      thead th { background:#f2f2f2; }
      .invoice-header, .invoice-meta, .invoice-footer { margin-bottom: 12px; }
      .arabic-item-name { direction: rtl; text-align: right; }
    </style>
  `;

  return `<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
${headCss || fallbackCss}
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
              <span class="invoice-arabic-label">تلفون</span>
              <span class="invoice-arabic-colon">:</span>
              <span class="invoice-arabic-value">05/810888 05/814964</span>
            </div>
            <div class="invoice-arabic-line">
              <span class="invoice-arabic-label">خلوي/ واتساب</span>
              <span class="invoice-arabic-colon">:</span>
              <span class="invoice-arabic-value">79/100068</span>
            </div>
            <div class="invoice-arabic-line">
              <span class="invoice-arabic-label">فاكس</span>
              <span class="invoice-arabic-colon">:</span>
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
          <div class="meta-line">
            <span class="meta-label">اسم الزبون</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${customerName || "-"}</span>
          </div>
          <div class="meta-line">
            <span class="meta-label">العنوان</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${customerAddress || "-"}</span>
          </div>
          <div class="meta-line">
            <span class="meta-label">تلفون</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${customerPhone || "-"}</span>
          </div>
          <div class="meta-line">
            <span class="meta-label">رقم الحساب</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${customerAccountNumber || "-"}</span>
          </div>
          <div class="meta-line">
            <span class="meta-label">الرقم الضريبي</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${customerTaxNumber || "-"}</span>
          </div>
        </div>
        <div class="meta-left">
          <div class="meta-line">
            <span class="meta-label">رقم الفاتورة</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${invoiceNumber || "-"}</span>
          </div>
          <div class="meta-line">
            <span class="meta-label">التاريخ</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${fmtDate(date)}</span>
          </div>
          <div class="meta-line">
            <span class="meta-label">العملة</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${currencyCode}</span>
          </div>
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
        <tbody>
          ${rowsHtml}
        </tbody>
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

const frameStyle = {
  width: "100%",
  height: "100%",
  border: "0",
};

/**
 * Props:
 *  - invoiceData: the same object you already pass
 *  - cssHref: (optional) path to the same CSS file, e.g. "/invoicePreview.css" (put it in /public)
 *  - inlineCss: (optional) a CSS string to embed directly into the iframe
 *  - className / style: styling for the iframe element
 */
const InvoicePreviewIframe = ({ invoiceData, cssHref = "/invoicePreview.css", inlineCss, className, style }) => {
  const html = useMemo(
    () => buildInvoiceHtml(invoiceData, { cssHref, inlineCss }),
    [invoiceData, cssHref, inlineCss]
  );

  return (
    <iframe
      title="Invoice Preview"
      className={className}
      style={{ width: "100%", minHeight: "1123px", border: 0 }}
      srcDoc={html}
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
    />
  );
};

export default InvoicePreviewIframe;
