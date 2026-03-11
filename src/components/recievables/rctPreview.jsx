import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import html2pdf from "html2pdf.js";
import "./rctPreview.css";
import { axiosClient } from "../api/axiosClient";
import revoLogoSrc from "../revo-logo/revo.png"; // ✅ adjust path if needed

// Number → Words (unchanged)
const numberToWords = (num) => {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
    if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + inWords(n%100) : "");
    if (n < 1_000_000) return inWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + inWords(n%1000) : "");
    if (n < 1_000_000_000) return inWords(Math.floor(n/1_000_000)) + " Million" + (n%1_000_000 ? " " + inWords(n%1_000_000) : "");
    return inWords(Math.floor(n/1_000_000_000)) + " Billion" + (n%1_000_000_000 ? " " + inWords(n%1_000_000_000) : "");
  };
  return num === 0 ? "Zero" : inWords(num);
};

const formatNumber = (num) => (num != null ? Number(num).toLocaleString("en-US") : "0");

const iframeStyles = `
  @media print {
    @page { size: A3 portrait; margin: 2mm; }
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: white; }
  }
  html, body { margin: 0; padding: 0; background: white; font-family: Arial, sans-serif; }
  .receipt-paper { width: 297mm; height: 420mm; background: white; padding: 3mm; box-sizing: border-box; }
  .receipt-header-bar { display: flex; justify-content: flex-end; align-items: center; }
  .Reciept-Txt { font-size: 30pt; font-weight: bold; }
  .receipt-info-box { border: 2px solid #000; padding: 2mm; margin-top: 2mm; display: flex; flex-direction: column; gap: 2mm; }
  .info-box-stacked { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; margin-left: 10px; }
  .info-row { display: flex; justify-content: flex-start; gap: 10px; font-size: 14pt; margin-right: 7mm; }
  .receipt-main-box { border: 2px solid #000; padding: 5mm; margin-top: 2mm; display: flex; flex-direction: column; gap: 3mm; height: 350px; }
  .main-row, .sum-words, .bank-section { font-size: 14pt; }
  .reciept-customer-name{font-size:25px}
  .recieved-text-receipt{font-size: 20px}
  .with-bank { display: flex; justify-content: space-between; margin-bottom: 10mm; }
  .for-section { font-size: 14pt; }
  .for-line { border-bottom: 2px solid black; height: 2mm; margin-top: 2mm; }
  .signature-container-right { display: flex; flex-direction: column; align-items: flex-end; }
  .signature-text { font-size: 16pt; margin-bottom: 2mm; text-align: center; width: 30%; }
  .signature-line { border-bottom: 2px solid black; width: 30%; height: 2mm; }
  .with-usd-value { display: flex; justify-content: flex-start; align-items: center; }
  .usd-value { font-weight: bold; font-size: 14pt; }
  .special-container { border: 0.5px solid rgb(97, 97, 97); padding: 2mm; text-align: flex-start; font-weight: normal; height: 150px; }
  /* ✅ Revo header inside iframe */
  .revo-header-box { display: flex; justify-content: space-between; padding: 5px; border: 1px solid #000; margin-bottom: 4mm; height: 130px; align-items: center; box-sizing: border-box; }
  .revo-header-logo { display: flex; align-items: center; justify-content: center; height: 100%; padding: 8px; }
  .revo-header-logo img { max-height: 100px; max-width: 180px; object-fit: contain; display: block; }
  .revo-header-text { text-align: right; direction: rtl; font-size: 13px; line-height: 1.4; font-family: Arial, sans-serif; }
  .revo-header-text h2 { font-size: 20px; margin: 0; font-weight: bold; }
  .revo-header-text p { margin: 0; font-weight: normal; }
  .revo-contact-line { display: flex; align-items: center; font-family: 'Times New Roman', serif; font-size: 13px; direction: rtl; }
  .revo-contact-label { width: 90px; text-align: right; }
  .revo-contact-colon { width: 10px; text-align: center; }
  .revo-contact-value { direction: ltr; }
`;

// ✅ isRevo + logoDataUrl are passed in so the function stays pure/serializable
function buildReceiptInnerHTML(record, isRevo, logoDataUrl) {
  const showSpecial = record.rct?.startsWith("RV") && !record.rct?.startsWith("RVG");
  const currencyText = record.currency?.toUpperCase() === "LL" ? "LBP" : "USD";
  const isLL = record.currency?.toUpperCase() === "LL";

  // ✅ Revo header — uses base64 logo so it works inside iframe/pdf
  const revoHeader = `
    <div class="revo-header-box">
      <div class="revo-header-logo">
        <img src="${logoDataUrl}" alt="Revo Logo" />
      </div>
      <div class="revo-header-text">
        <h2>REVO GLASS COMPANY</h2>
        <h2>شــــــركـــة ريـــفـــو جــــلاس</h2>
        <p>ســـوريـــا – حــلب – الــرامـوســة</p>
        <div class="revo-contact-line">
          <span class="revo-contact-label">تلفون</span>
          <span class="revo-contact-colon">:</span>
          <span class="revo-contact-value">+963 995118111</span>
        </div>
          <div class="revo-contact-line">
          <span class="revo-contact-label">الاستفسار</span>
          <span class="revo-contact-colon">:</span>
          <span class="revo-contact-value">+963 995434366</span>
        </div>
        <div class="revo-contact-line">
          <span class="revo-contact-label">البريد الالكتروني</span>
          <span class="revo-contact-colon">:</span>
          <span class="revo-contact-value">revo.glass.co@gmail.com</span>
        </div>
      </div>
    </div>`;

  // ✅ Shamoun header — only shown when showSpecial (RV* but not RVG*)
  const shamounHeader = showSpecial ? `
    <div class="special-container">
      <div style="font-weight:500; font-size:23pt; margin-bottom:10mm;">Shamoun Company For Glass & Mirrors</div>
      <div style="display:flex; justify-content:space-between; font-size:12pt; margin-top:2mm;">
        <span>Chweifat - Near Spot Mall</span><span>Registration #: 45446</span>
      </div>
      <div style="font-size:12pt; margin-top:1mm;">Tel: 05-810888; 79-100068; Fax: 05814961</div>
      <div style="display:flex; justify-content:space-between; font-size:12pt; margin-top:1mm;">
        <span>E-Mail: info@shamounco.com</span><span>Financial #: 10909-601</span>
      </div>
    </div>` : ``;

  return `
    <div class="receipt-paper">
      ${isRevo ? revoHeader : shamounHeader}
      <div class="receipt-header-bar"><span class="Reciept-Txt">RECEIPT</span></div>
      <div class="receipt-info-box">
        <div class="info-box-stacked">
          <div class="info-row"><strong>Date:</strong><span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${record.date ?? ""}</span></div>
          <div class="info-row"><strong>Receipt #:</strong><span>&nbsp;&nbsp;&nbsp;${record.rct ?? ""}</span></div>
        </div>
      </div>
      <div class="receipt-main-box">
        <div class="main-row"><strong>Recieved From:</strong><span class="reciept-customer-name">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${record.customerName ?? ""} </span></div>
        <div class="main-row with-usd-value">
          <div><strong>The Sum of:</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${formatNumber(record.cashNumber)} ${currencyText}</div>
          ${isLL ? `<div class="usd-value">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= ${formatNumber(record.amountExchanged)}&nbsp;&nbsp; USD</div>` : ``}
        </div>
        <div class="main-row sum-words">${numberToWords(Number(record.cashNumber))} ${isLL ? "LL Only" : "USD Only"}</div>
        <div class="main-row"><strong>Recieved As:</strong><span class="recieved-text-receipt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${
          (record.pmtType?.toLowerCase() === "cash")
            ? (record.currency?.toUpperCase() === "USD" ? "$$ دفعة نقدا " : "LL دفعة نقدا ")
            : (record.pmtType ?? "")
        }</span></div>
        <div class="main-row with-bank">
          <div><strong>Check/Card #:</strong></div>
          <div class="bank-section"><strong>Bank Name:</strong> _________________________________</div>
        </div>
        <div class="for-signature-row">
          <div class="for-section"><strong>For:</strong>&nbsp;&nbsp;${record.comments ?? ""}<div class="for-line"></div></div>
        </div>
        <div class="signature-container-right">
          <div class="signature-text"><strong>Signature</strong></div>
          <div class="signature-line"></div>
        </div>
      </div>
    </div>
  `;
}

// ✅ Convert imported image URL to base64 so it works inside iframe & pdf
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
    return url; // fallback to original URL
  }
}

const RctPaper = ({ record, onClose }) => {
  const iframeRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [printing, setPrinting] = useState(false);

  // ✅ Company state
  const [isRevo, setIsRevo] = useState(false);
  const [logoBase64, setLogoBase64] = useState("");

  // ✅ Fetch active company once on mount
  useEffect(() => {
    axiosClient.get("/company")
      .then(({ data }) => {
        const active = Array.isArray(data) ? data.find((c) => c.isActive) : null;
        const revo = !!active?.companyName?.toLowerCase().includes("revo");
        setIsRevo(revo);
        if (revo) {
          toBase64(revoLogoSrc).then(setLogoBase64);
        }
      })
      .catch(() => setIsRevo(false));
  }, []);

  const writeIframe = useCallback(() => {
    if (!iframeRef.current || !record) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    const html = `
      <html>
        <head><meta charset="utf-8" /><title>Receipt Preview</title><style>${iframeStyles}</style></head>
        <body>${buildReceiptInnerHTML(record, isRevo, logoBase64)}</body>
      </html>`;
    doc.open(); doc.write(html); doc.close();
  }, [record, isRevo, logoBase64]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    writeIframe();
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", onKey);
    };
  }, [writeIframe, onClose]);

  useEffect(() => { writeIframe(); }, [record, writeIframe]);

  const handleDownloadPDF = () => {
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-99999px;top:0;width:297mm;z-index:-1;";
    container.setAttribute("aria-hidden", "true");
    container.innerHTML = `<style>${iframeStyles}</style>${buildReceiptInnerHTML(record, isRevo, logoBase64)}`;
    document.body.appendChild(container);

    const element = container.querySelector(".receipt-paper");
    if (!element) { document.body.removeChild(container); return; }

    html2pdf()
      .from(element)
      .set({
        margin: 0,
        filename: `Receipt-${record?.rct ?? "Receipt"}.pdf`,
        html2canvas: { scale: 2, scrollY: 0, useCORS: true },
        jsPDF: { unit: "mm", format: "a3", orientation: "portrait" },
      })
      .save()
      .finally(() => document.body.removeChild(container));
  };

  const handleDirectPrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    setPrinting(true);
    setTimeout(() => {
      win.focus();
      win.print();
      setPrinting(false);
    }, 150);
  };

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains("receipt-modal-backdrop")) onClose?.();
  };

  const changeZoom = (val) => setZoom(Math.min(2, Math.max(0.3, val)));

  if (!record) return null;

  return ReactDOM.createPortal(
    <div className="receipt-modal-backdrop" onMouseDown={handleBackdropClick}>
      <div
        className="receipt-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Receipt Preview"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="receipt-modal-header">
          <div className="receipt-modal-title">
            <div className="title">Receipt Preview</div>
            <div className="meta">
              <span><strong>No:</strong> {record.rct ?? "-"}</span>
              <span className="divider">•</span>
              <span><strong>Date:</strong> {record.date ?? "-"}</span>
              {record.customerName ? (<><span className="divider">•</span><span>{record.customerName}</span></>) : null}
            </div>
          </div>
          <div className="header-actions">
            <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="receipt-modal-toolbar">
          <div className="left">
            <button className="btn" onClick={() => changeZoom(zoom - 0.1)}>-</button>
            <div className="zoom-display">{Math.round(zoom * 100)}%</div>
            <button className="btn" onClick={() => changeZoom(zoom + 0.1)}>+</button>
            <button className="btn ghost" onClick={() => setZoom(1)}>100%</button>
            <button className="btn ghost" onClick={() => setZoom(0.6)}>Fit</button>
          </div>
          <div className="right">
            <button className="btn success" onClick={handleDownloadPDF}>Download PDF</button>
            <button className="btn primary" onClick={handleDirectPrint} disabled={printing}>
              {printing ? "Printing…" : "Print"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="receipt-modal-body">
          <div className="receipt-preview-viewport" style={{ transform: `scale(${zoom})` }}>
            <iframe ref={iframeRef} title="Receipt Preview" className="receipt-iframe" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RctPaper;