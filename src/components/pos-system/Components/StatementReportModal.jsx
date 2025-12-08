import React, { useRef, useState } from "react";
import "./StatementReportModal.css";

const toDMY = (val) => {
  if (!val) return "";
  if (typeof val === "string") {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return String(val);
};

const StatementReportModal = ({
  open,
  onClose,
  data,
  from,
  to,
  type = "ALL", // 'S' | 'G' | 'ALL'
  customerName,
}) => {
  const printRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  if (!open) return null;

  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const openingBalance = Number(data?.openingBalance ?? 0);
  const items = Array.isArray(data?.items) ? data.items : [];
  const statementDate = new Date();

  const clientName =
    customerName ||
    data?.customerName ||
    data?.customer?.name ||
    data?.accountName ||
    data?.customer?.customerName ||
    "-";

  const accountNo = data?.customerAccountNumber || "-";
  const currencyCode = data?.currency || data?.currencyCode || data?.currencyName || "-";

  const customerInvoiceType = String(data?.customerInvoiceType ?? data?.invoiceType ?? "").toUpperCase(); // 'S'|'G'|'BOTH'
  const uiType = String(type ?? "").toUpperCase(); // 'S'|'G'|'ALL'
  let showHeader = false;
  if (customerInvoiceType === "S") showHeader = true;
  else if (customerInvoiceType === "G") showHeader = false;
  else if (customerInvoiceType === "BOTH") showHeader = uiType === "S";

  const closingBalance = Number(
    data?.closingBalance ?? (items.length ? items[items.length - 1]?.balanceAfter : openingBalance) ?? 0
  );

  const fmtMaybe = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  if (!isFinite(n) || Math.abs(n) < 0.0000001) return ""; // hide 0 / NaN
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};


  // ------ Print: clone styles and let the browser paginate naturally ------
  const handlePrint = () => {
    const printableRoot = printRef.current;
    if (!printableRoot) return;

    const copiedStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    ).map((node) => node.outerHTML).join("");

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    ${copiedStyles}
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      html, body { margin: 0; padding: 0; background: #fff; }

      /* Flow container: do NOT fix height; allow tight pagination */
      .statement-report-modal-a4 {
        width: 100%;
        margin: 0;
        padding: 0;
        box-shadow: none;
        border: 0;
        background: #fff;
      }



      /* Allow rows to break so pages fill completely.
         Keep only “special” rows unbreakable. */
      .statement-report-modal-table,
      .statement-report-modal-table tr,
      .statement-report-modal-table td,
      .statement-report-modal-table th {
        page-break-inside: auto;
        break-inside: auto;
      }
      .statement-report-modal-opening-row,
      .statement-report-modal-summary-row {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* Hide toolbar; remove modal constraints in print */
      .statement-report-modal-toolbar { display: none !important; }
      .statement-report-modal { width: 100% !important; max-width: none !important; box-shadow: none !important; border-radius: 0 !important; }
      .statement-report-modal-body { padding: 0 !important; overflow: visible !important; background: transparent !important; }

      /* Keep colors */
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
    <title>Account Statement</title>
  </head>
  <body>
    ${printableRoot.innerHTML}
  </body>
</html>`);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 200);
    };
  };

  // ------ Zoom (screen only) ------
  const zoomStep = 0.1, minZoom = 0.6, maxZoom = 2;
  const handleZoomIn = () => setZoom((z) => Math.min(maxZoom, +(z + zoomStep).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(minZoom, +(z - zoomStep).toFixed(2)));
  const handleZoomReset = () => setZoom(1);

  // ------ Screenshot / PDF (optional) ------
  const handleScreenshot = async () => {
    const root = printRef.current;
    if (!root) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(root, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `statement-${toDMY(statementDate)}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      alert("To use Screenshot, please install html2canvas:\n\nnpm i html2canvas");
    }
  };

  const handleDownloadPDF = async () => {
    const root = printRef.current;
    if (!root) return;
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const canvas = await html2canvas(root, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const imgData = canvas.toDataURL("image/png");
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
      pdf.save(`statement-${toDMY(statementDate)}.pdf`);
    } catch {
      handlePrint(); // fallback
    }
  };

  // ------ screen viewport + scaler so zoom stays aligned ------
  const viewportStyle = {
    height: "calc(100vh - 120px)",
    overflow: "auto",
    background: "#fff",
    padding: "16px 0",
    display: "flex",
    justifyContent: "center",
  };
  const scalerStyle = { transform: `scale(${zoom})`, transformOrigin: "top center" };

  return (
    <div className="statement-report-modal-overlay" onClick={onClose}>
      <div className="statement-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="statement-report-modal-toolbar">
          <h3>Account Statement</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-secondary" onClick={handleZoomOut} title="Zoom out">−</button>
            <button className="btn btn-secondary" onClick={handleZoomReset} title="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button className="btn btn-secondary" onClick={handleZoomIn} title="Zoom in">+</button>
            <div style={{ width: 1, height: 24, background: "#d9d9d9", margin: "0 4px" }} />
            <button className="btn btn-secondary" onClick={handleScreenshot} title="Save PNG">Screenshot</button>
            <button className="btn btn-secondary" onClick={handleDownloadPDF} title="Download PDF">Download PDF</button>
            <button className="btn" onClick={handlePrint} title="Print / Save as PDF">Print</button>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="statement-report-modal-body-viewport" style={viewportStyle}>
          <div className="statement-report-modal-body-scaler" style={scalerStyle}>
            <div className="statement-report-modal-body print-root" ref={printRef}>
              <div className="statement-report-modal-a4">
                {showHeader && (
                  <div className="statement-report-modal-header">
                    <div className="statement-report-modal-header-right">
                      <h2 className="statement-report-modal-company-arabic-title">شركة شمعون</h2>
                      <h2 className="statement-report-modal-company-arabic-subtitle">للزجاج و المرايا</h2>
                      <p className="statement-report-modal-small-subtitle">الحدث / شويفات</p>
                      <div className="statement-report-modal-arabic-contact">
                        <div className="statement-report-modal-arabic-line">
                          <span className="statement-report-modal-arabic-label">تلفون</span>
                          <span className="statement-report-modal-arabic-colon">:</span>
                          <span className="statement-report-modal-arabic-value">05/814964 05/810888</span>
                        </div>
                        <div className="statement-report-modal-arabic-line">
                          <span className="statement-report-modal-arabic-label">خلوي / واتساب</span>
                          <span className="statement-report-modal-arabic-colon">:</span>
                          <span className="statement-report-modal-arabic-value">79/100068</span>
                        </div>
                        <div className="statement-report-modal-arabic-line">
                          <span className="statement-report-modal-arabic-label">فاكس</span>
                          <span className="statement-report-modal-arabic-colon">:</span>
                          <span className="statement-report-modal-arabic-value">05/814961</span>
                        </div>
                      </div>
                    </div>
                    <div className="statement-report-modal-header-left">
                      <h1 className="statement-report-modal-company-title">Shamoun Company</h1>
                      <h2 className="statement-report-modal-company-subtitle">For Glass & Mirrors</h2>
                      <p>Chweifat - Near Spot Mall</p>
                      <p>Tel: 05-810 888 ; 79-1000 68 ; Fax: 05-814 961</p>
                      <p>Email: info@shamoun.com</p>
                      <p>VAT Reg.No 10909-601</p>
                    </div>
                  </div>
                )}

                <div className="statement-report-modal-titlebar">كشف حساب</div>

                <div className="statement-report-modal-clientline">
                  <span className="statement-report-modal-clientline-label">السادة</span>
                  <span className="statement-report-modal-clientline-colon">:</span>
                  <span className="statement-report-modal-clientline-value">{clientName}</span>
                </div>

                <div className="statement-report-modal-info">
                  <table className="statement-report-modal-info-table">
                    <thead>
                      <tr>
                        <th>رقم الحساب</th>
                        <th>العملة</th>
                        <th>من تاريخ</th>
                        <th>الى تاريخ</th>
                        <th>تاريخ الكشف</th>
                        <th>الصفحة</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{accountNo}</td>
                        <td>{currencyCode}</td>
                        <td>{toDMY(from)}</td>
                        <td>{toDMY(to)}</td>
                        <td>{toDMY(statementDate)}</td>
                        <td><span className="print-page-counter" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="statement-report-modal-table-wrap">
                  <table className="statement-report-modal-table">
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "23%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "18%" }} />
                    </colgroup>

                    <thead>
                      <tr>
                        <th>تاريخ</th>
                        <th>رقم المستند</th>
                        <th>الشرح</th>
                        <th>عليكم</th>
                        <th>لكم</th>
                        <th>الرصيد</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr className="statement-report-modal-opening-row">
                        <td>{toDMY(from)}</td>
                        <td>—</td>
                        <td>رصيد سابق</td>
                        <td></td>
                        <td></td>
                        <td>{fmt(openingBalance)}</td>
                      </tr>

               {items.map((r, i) => (
  <tr key={i}>
    <td>{toDMY(r.date)}</td>
    <td>{r.docNbr}</td>
    <td>{r.description}</td>
    <td>{fmtMaybe(r.debit)}</td>
    <td>{fmtMaybe(r.credit)}</td>
    <td>{fmt(Number(r.balanceAfter || 0).toFixed(2))}</td>
  </tr>
))}

                    </tbody>

                    <tfoot>
                      <tr className="statement-report-tfoot-gap"><td colSpan={6}></td></tr>
                      <tr className="statement-report-modal-summary-row">
                        <td style={{ border: "none" }}></td>
                        <td style={{ border: "none" }}></td>
                        <td style={{ border: "none" }}></td>
                        <td style={{ border: "none" }}></td>
                        <td style={{ border: "2px solid #707070", fontWeight: "bold", textAlign: "right", paddingRight: 6, fontSize: 18 }}>
                          الرصيد
                        </td>
                        <td style={{ border: "2px solid #707070", fontWeight: "bold", textAlign: "center" }}>
                          {fmt(closingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
};

export default StatementReportModal;
