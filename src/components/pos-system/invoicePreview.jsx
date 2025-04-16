import React, { useRef } from "react";
import html2pdf from "html2pdf.js";
import "./invoicePreview.css";

const InvoicePreview = ({ invoiceData = {} }) => {
  const invoiceRef = useRef();

  const handleDownloadPDF = () => {
    const element = invoiceRef.current;
    const opt = {
      margin: 0.2,
      filename: `Invoice-${invoiceData.invoiceNumber || "preview"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(opt).from(element).save();
  };

  const items = invoiceData.items || [];

  return (
    <div>
      <div className="invoice-wrapper" ref={invoiceRef}>
        <div className="invoice-header">
          <div className="invoice-logo">
            <h2>Shamoun Company</h2>
            <p>For Glass & Mirrors</p>
            <p>Chweifat - Near Soot Mall</p>
            <p>Tel: 05-810 888 / 79-1000 68</p>
            <p>Fax: 05-814 961</p>
            <p>Email: info@shamoun.com</p>
            <p>VAT Reg. No: 10909-601</p>
          </div>
          <div className="invoice-arabic">
            <h2>شركة شمعون</h2>
            <p>للزجاج و المرايا</p>
            <p>الحدث / الشويفات</p>
            <p>تلفون: 05/810888</p>
            <p>خلوي: 79/100068</p>
            <p>فاكس: 05/814961</p>
          </div>
        </div>

        <div className="invoice-info">
          <div>
            <p>
              <strong>رقم الفاتورة:</strong> {invoiceData.invoiceNumber || "—"}
            </p>
            <p>
              <strong>التاريخ:</strong> {invoiceData.date || "—"}
            </p>
            <p>
              <strong>العملة:</strong> {invoiceData.currency || "—"}
            </p>
          </div>
          <div className="invoice-client">
            <p>
              <strong>اسم الزبون:</strong> {invoiceData.customerName || "—"}
            </p>
            <p>
              <strong>العنوان:</strong> {invoiceData.address || "—"}
            </p>
            <p>
              <strong>تلفون:</strong> {invoiceData.phone || "—"}
            </p>
            <p>
              <strong>رقم الحساب:</strong> {invoiceData.accountNumber || "—"}
            </p>
            <p>
              <strong>الرقم الضريبي:</strong> {invoiceData.vatNumber || "—"}
            </p>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>الرمز</th>
              <th>الوصف</th>
              <th>الفرخ</th>
              <th>لوح</th>
              <th>صندوق</th>
              <th>طول</th>
              <th>عرض</th>
              <th>مساحة</th>
              <th>السعر</th>
              <th>المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{item.code || "—"}</td>
                <td>{item.description || "—"}</td>
                <td>{item.sheet || "—"}</td>
                <td>{item.panel || "—"}</td>
                <td>{item.box || "—"}</td>
                <td>{item.length || "—"}</td>
                <td>{item.width || "—"}</td>
                <td>{item.sqm || "—"}</td>
                <td>{item.unitPrice || "—"}</td>
                <td>{item.total || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-footer">
          <div className="invoice-notes">
            <p>{invoiceData.amountInWords || "—"}</p>
            <div>
              <p>المستلم:</p>
              <p>الإمضاء:</p>
              <p>ملاحظات:</p>
            </div>
          </div>

          <div className="invoice-summary">
            <p>
              <strong>المجموع:</strong> {invoiceData.total || "—"} USD
            </p>
            <p>
              <strong>V.A.T 11%:</strong> {invoiceData.vatAmount || "—"}
            </p>
            <p>
              <strong>VAT LBP:</strong> {invoiceData.vatLBP || "—"}
            </p>
            <p>
              <strong>المجموع الصافي:</strong> {invoiceData.grandTotal || "—"}{" "}
              USD
            </p>
          </div>
        </div>
      </div>

      <button className="invoice-download-button" onClick={handleDownloadPDF}>
        Download PDF
      </button>
    </div>
  );
};

export default InvoicePreview;
