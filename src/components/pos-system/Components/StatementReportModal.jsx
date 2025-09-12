import React from "react";
import "./StatementReportModal.css";

const StatementReportModal = ({
  open,
  onClose,
  data,
  from,
  to,
  type = "ALL",
  customerName,
}) => {
  if (!open) return null;

  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const openingBalance = Number(data?.openingBalance ?? 0);
  const clientName =
    customerName ||
    data?.customerName ||
    data?.customer?.name ||
    data?.accountName ||
    "-";

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
            {/* HEADER */}
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

            {/* TITLE ROW (centered) */}
            <div className="statement-report-modal-titlebar">كشف حساب</div>

            {/* CLIENT LINE */}
            <div className="statement-report-modal-clientline">
              <span className="statement-report-modal-clientline-label">السادة</span>
              <span className="statement-report-modal-clientline-colon">:</span>
              <span className="statement-report-modal-clientline-value">{clientName}</span>
            </div>

            {/* TABLE */}
            <div className="statement-report-modal-table-wrap">
              <table className="statement-report-modal-table">
                <thead>
                  <tr>
                    <th>تاريخ</th>
                    <th>رقم الفاتورة</th>
                    <th>شرح</th>
                    <th>عليكم</th>
                    <th>لكم</th>
                    <th>رصيد</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="statement-report-modal-opening-row">
                    <td>{from}</td>
                    <td>—</td>
                    <td>رصيد سابق</td>
                    <td>{fmt(0)}</td>
                    <td>{fmt(0)}</td>
                    <td>{fmt(openingBalance)}</td>
                  </tr>

                  {data?.items?.map((r, i) => (
                    <tr key={i}>
                      <td>{String(r.date).split("T")[0]}</td>
                      <td>{r.docNbr}</td>
                      <td>{r.description}</td>
                      <td>{fmt(Number(r.debit || 0).toFixed(2))}</td>
                      <td>{fmt(Number(r.credit || 0).toFixed(2))}</td>
                      <td>{fmt(Number(r.balanceAfter || 0).toFixed(2))}</td>
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
