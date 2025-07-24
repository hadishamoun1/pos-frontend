import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import html2pdf from "html2pdf.js";
import "./rctPreview.css";

// ✅ Number to Words Function (Supports up to Billions)
const numberToWords = (num) => {
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100)
      return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 !== 0 ? " " + inWords(n % 100) : "")
      );
    if (n < 1000000)
      return (
        inWords(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 !== 0 ? " " + inWords(n % 1000) : "")
      );
    if (n < 1000000000)
      return (
        inWords(Math.floor(n / 1000000)) +
        " Million" +
        (n % 1000000 !== 0 ? " " + inWords(n % 1000000) : "")
      );
    return (
      inWords(Math.floor(n / 1000000000)) +
      " Billion" +
      (n % 1000000000 !== 0 ? " " + inWords(n % 1000000000) : "")
    );
  };

  return num === 0 ? "Zero" : inWords(num);
};

const RctPaper = ({ record, onClose }) => {
  const receiptRef = useRef();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "auto");
  }, []);

  const handleDownloadPDF = () => {
    const element = receiptRef.current;
    element.classList.add("printing-mode");

    html2pdf()
      .from(element)
      .set({
        margin: 0,
        filename: `Receipt-${record.rct}.pdf`,
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a3", orientation: "portrait" },
      })
      .save()
      .then(() => element.classList.remove("printing-mode"));
  };

  const handleDirectPrint = () => {
    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=1200,height=1600");

    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Receipt</title>
            <style>
              @media print {
                @page {
                  size: A3 portrait;
                  margin: 2mm;
                }
  
                html, body {
                  margin: 0;
                  padding: 0;
                  height: 100%;
                  width: 100%;
                  font-family: Arial, sans-serif;
                  background: white;
                }
  
                .receipt-paper {
                  width: 100%;
                  height: auto;
                  padding: 0; /* or padding: 2mm if you want extra internal space */
                  box-sizing: border-box;
                  background: white;
                }
              }
  
              body {
                margin: 0;
                font-family: Arial, sans-serif;
                background: white;
              }
  
              .receipt-paper {
                width: 100%;
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                background: white;
              }
  
              .special-container {
                border: 0.5px solid rgb(97, 97, 97);
                padding: 2mm;
                height: 150px;
              }
  
              .receipt-header-bar {
                display: flex;
                justify-content: flex-end;
                align-items: center;
              }
  
              .Reciept-Txt {
                font-size: 30pt;
                font-weight: bold;
              }
  
              .receipt-info-box {
                border: 2px solid #000;
                padding: 2mm;
                margin-top: 2mm;
              }
  
              .info-box-stacked {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 5px;
                margin-left: 10px;
              }
  
              .info-box-stacked .info-row {
                display: flex;
                justify-content: flex-start;
                gap: 10px;
                font-size: 14pt;
                margin-right: 7mm;
              }
  
              .receipt-main-box {
                border: 2px solid #000;
                padding: 5mm;
                margin-top: 2mm;
                display: flex;
                flex-direction: column;
                gap: 3mm;
                min-height: 350px;
              }
  
              .main-row, .sum-words, .bank-section {
                font-size: 14pt;
              }
  
              .with-bank {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10mm;
              }
  
              .for-line {
                border-bottom: 2px solid black;
                height: 2mm;
                margin-top: 2mm;
              }
  
              .signature-container-right {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
              }
  
              .signature-text {
                font-size: 16pt;
                margin-bottom: 2mm;
                text-align: center;
                width: 30%;
              }
  
              .signature-line {
                border-bottom: 2px solid black;
                width: 30%;
                height: 2mm;
              }
  
              .with-usd-value {
                display: flex;
                justify-content: flex-start;
                align-items: center;
              }
  
              .usd-value {
                font-weight: bold;
                font-size: 14pt;
              }
            </style>
          </head>
          <body>
            <div class="receipt-paper">
              ${printContent}
            </div>
          </body>
        </html>
      `);

      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  };

  const formatNumber = (num) => {
    return num != null ? Number(num).toLocaleString("en-US") : "0";
  };

  if (!record) return null;

  return ReactDOM.createPortal(
    <div className="receipt-modal-backdrop">
      <div className="top-right-controls">
        <button onClick={handleDownloadPDF} className="download-btn-fixed">
          Download PDF
        </button>
        <button onClick={handleDirectPrint} className="download-btn-fixed">
          Print
        </button>
        <button onClick={onClose} className="modal-close-btn-fixed">
          ×
        </button>
      </div>

      <div className="receipt-wrapper">
        <div className="receipt-preview-wrapper">
          <div ref={receiptRef} className="receipt-paper">
            {record.rct?.startsWith("RV") && !record.rct?.startsWith("RVG") && (
              <div className="special-container">
                <div
                  style={{
                    fontWeight: "500",
                    fontSize: "23pt",
                    marginBottom: "10mm",
                  }}
                >
                  Shamoun Company For Glass & Mirrors
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12pt",
                    marginTop: "2mm",
                  }}
                >
                  <span>Chweifat - Near Spot Mall</span>
                  <span>Registration #: 45446</span>
                </div>

                <div style={{ fontSize: "12pt", marginTop: "1mm" }}>
                  Tel: 05-810888; 79-100068; Fax: 05814961
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12pt",
                    marginTop: "1mm",
                  }}
                >
                  <span>E-Mail: info@shamounco.com</span>
                  <span>Financial #: 10909-601</span>
                </div>
              </div>
            )}

            <div className="receipt-header-bar">
              <span className="Reciept-Txt">RECEIPT</span>
            </div>

            <div className="receipt-info-box">
              <div className="info-box-stacked">
                <div className="info-row">
                  <strong>Date:</strong>
                  <span>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    {record.date}
                  </span>
                </div>
                <div className="info-row">
                  <strong>Receipt #:</strong>
                  <span>&nbsp;&nbsp;&nbsp;{record.rct}</span>
                </div>
              </div>
            </div>

            <div className="receipt-main-box">
              <div className="main-row">
                <strong>Recieved From:</strong>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{" "}
                {record.customerName}
              </div>

              <div className="main-row with-usd-value">
                <div>
                  <strong>The Sum of:</strong>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                  {formatNumber(record.cashNumber)}&nbsp;
                  {record.currency?.toUpperCase() === "LL" ? "LBP" : "USD"}
                </div>
                {record.currency?.toUpperCase() === "LL" && (
                  <div className="usd-value">
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;={" "}
                    {formatNumber(record.amountExchanged)}&nbsp;&nbsp; USD
                  </div>
                )}
              </div>

              <div className="main-row sum-words">
                {numberToWords(Number(record.cashNumber))}{" "}
                {record.currency?.toUpperCase() === "LL"
                  ? "LL Only"
                  : "USD Only"}
              </div>

              <div className="main-row">
                <strong>Recieved As:</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                {record.pmtType?.toLowerCase() === "cash"
                  ? record.currency?.toUpperCase() === "USD"
                    ? "$$ دفعة نقدا "
                    : "LL دفعة نقدا "
                  : record.pmtType}{" "}
              </div>

              <div className="main-row with-bank">
                <div>
                  <strong>Check/Card #:</strong>
                </div>
                <div className="bank-section">
                  <strong>Bank Name:</strong> _________________________________
                </div>
              </div>

              <div className="for-signature-row">
                <div className="for-section">
                  <strong>For:</strong>&nbsp;&nbsp;{record.comments}
                  <div className="for-line"></div>
                </div>
              </div>

              <div className="signature-container-right">
                <div className="signature-text">
                  <strong>Signature</strong>
                </div>
                <div className="signature-line"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RctPaper;
