import React, { useRef } from "react";
import "./StatementReportModal.css";

const ROWS_PER_PAGE = 27; // body rows per page

// Helper: normalize any date-ish input to "DD-MM-YYYY"
const toDMY = (val) => {
  if (!val) return "";
  // Handle ISO-like strings: "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss"
  if (typeof val === "string") {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  // Fallback to Date parsing
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
  type = "ALL",         // frontend-selected type: 'S' | 'G' | 'ALL'
  customerName,
}) => {
  // ✅ Hooks must run unconditionally
  const printRef = useRef(null);

  if (!open) return null;

  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const openingBalance = Number(data?.openingBalance ?? 0);

  const clientName =
    customerName ||
    data?.customerName ||
    data?.customer?.name ||
    data?.accountName ||
    data?.customer?.customerName ||
    "-";

  const accountNo = data?.customerAccountNumber || "-";

  const currencyCode =
    data?.currency || data?.currencyCode || data?.currencyName || "-";

  // 🔹 Determine if header should be shown based on API invoice type and UI selection
  const customerInvoiceType = String(
    data?.customerInvoiceType ?? data?.invoiceType ?? ""
  ).toUpperCase(); // 'S' | 'G' | 'BOTH'
  const uiType = String(type ?? "").toUpperCase(); // 'S' | 'G' | 'ALL'

  let showHeader = false;
  if (customerInvoiceType === "S") {
    showHeader = true;
  } else if (customerInvoiceType === "G") {
    showHeader = false;
  } else if (customerInvoiceType === "BOTH") {
    // When customer supports both:
    // - UI 'S'  -> show
    // - UI 'G'  -> hide
    // - UI 'ALL'-> hide
    showHeader = uiType === "S";
  }

  // Keep a Date; we’ll format at render time
  const statementDate = new Date();

  // ------- PAGINATION -------
  const items = Array.isArray(data?.items) ? data.items : [];
  const PAGE1_BODY_CAP = Math.max(0, ROWS_PER_PAGE - 1);
  const page1 = items.slice(0, PAGE1_BODY_CAP);
  const rest = items.slice(PAGE1_BODY_CAP);
  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  const otherPages = chunk(rest, ROWS_PER_PAGE);
  const pages = [page1, ...otherPages];
  const totalPages = Math.max(1, pages.length);

  // ✅ Closing balance to show in footer row under "رصيد"
  const closingBalance = Number(
    data?.closingBalance ??
      (items.length ? items[items.length - 1]?.balanceAfter : openingBalance) ??
      0
  );

  // ------- PRINT ONLY THE A4 CONTENT (NO SHRINK) -------
  const handlePrint = () => {
    const printableRoot = printRef.current;
    if (!printableRoot) return;

    const copiedStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((node) => node.outerHTML)
      .join("");

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
      html, body { margin: 0; padding: 0; }
      .statement-report-modal-a4 {
        width: 190mm;              /* 210mm - 2*10mm margins */
        min-height: 277mm;         /* 297mm - 2*10mm margins */
        margin: 0;
        padding: 0;
        box-shadow: none;
        border: 0;
      }
      .statement-report-modal-a4 + .statement-report-modal-a4 {
        page-break-before: always;
      }
      .statement-report-modal-table thead th { position: static !important; }
      .statement-report-modal-table tr { break-inside: avoid; page-break-inside: avoid; }
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

  return (
    <div className="statement-report-modal-overlay" onClick={onClose}>
      <div
        className="statement-report-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="statement-report-modal-toolbar">
          <h3>Account Statement</h3>
          <div>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button className="btn" onClick={handlePrint}>
              Print
            </button>
          </div>
        </div>

        {/* Everything inside this ref is what gets printed 1:1 on A4 */}
        <div className="statement-report-modal-body" ref={printRef}>
          {pages.map((pageItems, pageIndex) => (
            <div className="statement-report-modal-a4" key={`page-${pageIndex}`}>
              {pageIndex === 0 && (
                <>
                  {/* 🔸 Header appears based on customerInvoiceType + UI type */}
                  {showHeader && (
                    <div className="statement-report-modal-header">
                      <div className="statement-report-modal-header-right">
                        <h2 className="statement-report-modal-company-arabic-title">
                          شركة شمعون
                        </h2>
                        <h2 className="statement-report-modal-company-arabic-subtitle">
                          للزجاج و المرايا
                        </h2>
                        <p className="statement-report-modal-small-subtitle">
                          الحدث / شويفات
                        </p>

                        <div className="statement-report-modal-arabic-contact">
                          <div className="statement-report-modal-arabic-line">
                            <span className="statement-report-modal-arabic-label">
                              تلفون
                            </span>
                            <span className="statement-report-modal-arabic-colon">
                              :
                            </span>
                            <span className="statement-report-modal-arabic-value">
                              05/814964 05/810888
                            </span>
                          </div>
                          <div className="statement-report-modal-arabic-line">
                            <span className="statement-report-modal-arabic-label">
                              خلوي / واتساب
                            </span>
                            <span className="statement-report-modal-arabic-colon">
                              :
                            </span>
                            <span className="statement-report-modal-arabic-value">
                              79/100068
                            </span>
                          </div>
                          <div className="statement-report-modal-arabic-line">
                            <span className="statement-report-modal-arabic-label">
                              فاكس
                            </span>
                            <span className="statement-report-modal-arabic-colon">
                              :
                            </span>
                            <span className="statement-report-modal-arabic-value">
                              05/814961
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="statement-report-modal-header-left">
                        <h1 className="statement-report-modal-company-title">
                          Shamoun Company
                        </h1>
                        <h2 className="statement-report-modal-company-subtitle">
                          For Glass & Mirrors
                        </h2>
                        <p>Chweifat - Near Spot Mall</p>
                        <p>Tel: 05-810 888 ; 79-1000 68 ; Fax: 05-814 961</p>
                        <p>Email: info@shamoun.com</p>
                        <p>VAT Reg.No 10909-601</p>
                      </div>
                    </div>
                  )}

                  <div className="statement-report-modal-titlebar">كشف حساب</div>

                  <div className="statement-report-modal-clientline">
                    <span className="statement-report-modal-clientline-label">
                      السادة
                    </span>
                    <span className="statement-report-modal-clientline-colon">
                      :
                    </span>
                    <span className="statement-report-modal-clientline-value">
                      {clientName}
                    </span>
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
                          <td>
                            {pageIndex + 1} / {totalPages}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}

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

                  {pageIndex === 0 && (
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
                  )}

                  <tbody>
                    {pageIndex === 0 && (
                      <tr className="statement-report-thead-gap">
                        <td colSpan={6}></td>
                      </tr>
                    )}

                    {pageIndex === 0 && (
                      <tr className="statement-report-modal-opening-row">
                        <td>{toDMY(from)}</td>
                        <td>—</td>
                        <td>رصيد سابق</td>
                        <td>{fmt(0)}</td>
                        <td>{fmt(0)}</td>
                        <td>{fmt(openingBalance)}</td>
                      </tr>
                    )}

                    {pageItems.map((r, i) => (
                      <tr key={`row-${pageIndex}-${i}`}>
                        <td>{toDMY(r.date)}</td>
                        <td>{r.docNbr}</td>
                        <td>{r.description}</td>
                        <td>{fmt(Number(r.debit || 0).toFixed(2))}</td>
                        <td>{fmt(Number(r.credit || 0).toFixed(2))}</td>
                        <td>{fmt(Number(r.balanceAfter || 0).toFixed(2))}</td>
                      </tr>
                    ))}
                  </tbody>

                  {pageIndex === totalPages - 1 && (
                    <tfoot>
                      {/* gap above summary */}
                      <tr className="statement-report-tfoot-gap">
                        <td colSpan={6}></td>
                      </tr>

                      <tr className="statement-report-modal-summary-row">
                        <td style={{ border: "none" }}></td>
                        <td style={{ border: "none" }}></td>
                        <td style={{ border: "none" }}></td>
                        <td style={{ border: "none" }}></td>
                        <td
                          style={{
                            border: "2px solid #707070",
                            fontWeight: "bold",
                            textAlign: "right",
                            paddingRight: "6px",
                            fontSize: "18px",
                          }}
                        >
                          الرصيد
                        </td>
                        <td
                          style={{
                            border: "2px solid #707070",
                            fontWeight: "bold",
                            textAlign: "center",
                          }}
                        >
                          {fmt(closingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatementReportModal;
