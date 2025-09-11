import React from "react";
import "./StatementReportModal.css"; // the CSS you just added/merged

const StatementReportModal = ({
  open,
  onClose,
  data,         // { openingBalance, totals, closingBalance, items: [] }
  from,
  to,
  type = "ALL",
}) => {
  if (!open) return null;

  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="statement-report-modal-overlay" onClick={onClose}>
      <div className="statement-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="statement-report-modal-toolbar">
          <h3>Account Statement</h3>
          <div>
            <button className="btn-secondary btn" onClick={onClose}>Close</button>
            <button className="btn" onClick={() => window.print()}>Print</button>
          </div>
        </div>

        <div className="statement-report-modal-body">
          <div className="statement-report-modal-a4">

            {/* HEADER (copied layout from invoice header) */}
            <div className="statement-report-modal-header">
              {/* Right (Arabic) */}
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

              {/* Left (English) */}
              <div className="statement-report-modal-header-left">
                <h1 className="statement-report-modal-company-title">Shamoun Company</h1>
                <h2 className="statement-report-modal-company-subtitle">For Glass & Mirrors</h2>
                <p>Chweifat - Near Spot Mall</p>
                <p>Tel: 05-810 888 ; 79-1000 68 ; Fax: 05-814 961</p>
                <p>Email: info@shamoun.com</p>
                <p>VAT Reg.No 10909-601</p>
              </div>
            </div>

            {/* META */}
            <div className="statement-report-modal-meta">
              <div className="statement-report-modal-meta-right">
                <div className="statement-report-modal-meta-line">
                  <span className="statement-report-modal-meta-label">Email</span>
                  <span className="statement-report-modal-meta-colon">:</span>
                  <span className="statement-report-modal-meta-value">info@shamoun.com</span>
                </div>
                <div className="statement-report-modal-meta-line">
                  <span className="statement-report-modal-meta-label">VAT</span>
                  <span className="statement-report-modal-meta-colon">:</span>
                  <span className="statement-report-modal-meta-value">10909-601</span>
                </div>
              </div>

              <div className="statement-report-modal-meta-left">
                <div className="statement-report-modal-meta-line">
                  <span className="statement-report-modal-meta-label">من</span>
                  <span className="statement-report-modal-meta-colon">:</span>
                  <span className="statement-report-modal-meta-value">{from}</span>
                </div>
                <div className="statement-report-modal-meta-line">
                  <span className="statement-report-modal-meta-label">إلى</span>
                  <span className="statement-report-modal-meta-colon">:</span>
                  <span className="statement-report-modal-meta-value">{to}</span>
                </div>
                <div className="statement-report-modal-meta-line">
                  <span className="statement-report-modal-meta-label">النوع</span>
                  <span className="statement-report-modal-meta-colon">:</span>
                  <span className="statement-report-modal-meta-value">{type}</span>
                </div>
              </div>
            </div>

            {/* SUMMARY LINE (optional) */}
            <div style={{margin: "0 8px 6px 8px", direction: "rtl", fontFamily: "Arial, sans-serif"}}>
              <span style={{marginInlineStart: "8px"}}>الرصيد: <strong>{fmt((data?.closingBalance ?? 0).toFixed?.(2) || data?.closingBalance)}</strong></span>
              <span style={{marginInlineStart: "12px"}}>مجموع الدفعات: <strong>{fmt((data?.totals?.totalCredit ?? 0).toFixed?.(2) || data?.totals?.totalCredit)}</strong></span>
              <span style={{marginInlineStart: "12px"}}>مجموع الفواتير: <strong>{fmt((data?.totals?.totalDebit ?? 0).toFixed?.(2) || data?.totals?.totalDebit)}</strong></span>
              <span style={{marginInlineStart: "12px"}}>رصيد سابق: <strong>{fmt((data?.openingBalance ?? 0).toFixed?.(2) || data?.openingBalance)}</strong></span>
            </div>

            {/* TABLE */}
            <div className="statement-report-modal-table-wrap">
              <table className="statement-report-modal-table">
                <thead>
                  <tr>
                    <th>رصيد</th>
                    <th>لكم</th>
                    <th>عليكم</th>
                    <th>شرح</th>
                    <th>رقم الفاتورة</th>
                    <th>تاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.map((r, i) => (
                    <tr key={i}>
                      <td>{fmt(Number(r.balanceAfter || 0).toFixed(2))}</td>
                      <td>{fmt(Number(r.credit || 0).toFixed(2))}</td>
                      <td>{fmt(Number(r.debit || 0).toFixed(2))}</td>
                      <td>{r.description}</td>
                      <td>{r.docNbr}</td>
                      <td>{String(r.date).split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default StatementReportModal;
