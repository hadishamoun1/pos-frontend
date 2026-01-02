// src/recievables/DailyReceivablesModal.jsx
import React, { useState, useRef } from "react";
import { axiosClient } from "../api/axiosClient";
import "./DailyRecievablesModal.css";

const DailyReceivablesModal = ({ isOpen, onClose }) => {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("ALL");
  const [pmtType, setPmtType] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  
  const printRef = useRef(null);

  if (!isOpen) return null;

  const handleFetchReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      const response = await axiosClient.get("/recievables/daily", {
        params: {
          date,
          type,
          pmtType,
        },
      });

      setReportData(response.data);
    } catch (err) {
      console.error("Error fetching daily receivables:", err);
      setError(
        err?.response?.data?.message ||
          "Failed to fetch daily receivables report."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatNumberWithCommas = (n) =>
    n != null ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

  // ✅ FIXED: Calculate separate totals for S and G types with proper number conversion
  const calculateSeparateTotals = () => {
    if (!reportData?.data) return null;

    const totals = {
      usd: {
        s: { cash: 0, check: 0, total: 0 },
        g: { cash: 0, check: 0, total: 0 },
        cash: 0,
        check: 0,
        total: 0,
      },
      ll: {
        s: { cash: 0, check: 0, total: 0 },
        g: { cash: 0, check: 0, total: 0 },
        cash: 0,
        check: 0,
        total: 0,
      },
    };

    reportData.data.forEach((entry) => {
      // ✅ FIXED: Parse as number explicitly
      const amount = parseFloat(entry.cashNumber) || 0;
      const currency = entry.currency;
      const paymentType = entry.pmtType;
      const entryType = entry.type;

      if (currency === 'USD') {
        totals.usd.total += amount;
        
        if (paymentType === 'Cash') {
          totals.usd.cash += amount;
        } else {
          totals.usd.check += amount;
        }

        if (entryType === 'S') {
          totals.usd.s.total += amount;
          if (paymentType === 'Cash') {
            totals.usd.s.cash += amount;
          } else {
            totals.usd.s.check += amount;
          }
        } else if (entryType === 'G') {
          totals.usd.g.total += amount;
          if (paymentType === 'Cash') {
            totals.usd.g.cash += amount;
          } else {
            totals.usd.g.check += amount;
          }
        }
      } else if (currency === 'LL') {
        totals.ll.total += amount;
        
        if (paymentType === 'Cash') {
          totals.ll.cash += amount;
        } else {
          totals.ll.check += amount;
        }

        if (entryType === 'S') {
          totals.ll.s.total += amount;
          if (paymentType === 'Cash') {
            totals.ll.s.cash += amount;
          } else {
            totals.ll.s.check += amount;
          }
        } else if (entryType === 'G') {
          totals.ll.g.total += amount;
          if (paymentType === 'Cash') {
            totals.ll.g.cash += amount;
          } else {
            totals.ll.g.check += amount;
          }
        }
      }
    });

    return totals;
  };

  const separateTotals = calculateSeparateTotals();

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank');
    const printContent = printRef.current.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily Receivables Report - ${date}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #2c3e50;
            }
            
            .print-header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #2c3e50;
            }
            
            .print-header h1 {
              font-size: 24px;
              margin-bottom: 10px;
              color: #2c3e50;
            }
            
            .print-header p {
              font-size: 14px;
              color: #5a6c7d;
            }
            
            .summary-section-recievables {
              margin-bottom: 30px;
            }
            
            .summary-card {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              text-align: center;
              border: 2px solid #2c3e50;
            }
            
            .summary-card h4 {
              font-size: 16px;
              color: #2c3e50;
            }
            
            .totals-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            
            .total-card {
              border: 2px solid #e1e4e8;
              border-radius: 8px;
              padding: 20px;
            }
            
            .total-card h4 {
              font-size: 14px;
              margin-bottom: 15px;
              color: #2c3e50;
              border-bottom: 2px solid #3498db;
              padding-bottom: 10px;
              font-weight: bold;
            }
            
            .total-card p {
              margin: 8px 0;
              font-size: 13px;
              color: #5a6c7d;
              display: flex;
              justify-content: space-between;
            }
            
            .type-subtotal {
              background: #f8f9fa;
              padding: 8px;
              margin: 12px 0;
              border-radius: 4px;
              border-left: 3px solid #3498db;
            }
            
            .type-subtotal-title {
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 6px;
            }
            
            .total-amount {
              margin-top: 15px !important;
              padding-top: 15px;
              border-top: 2px solid #e1e4e8;
              font-weight: bold !important;
              color: #2c3e50 !important;
            }
            
            .report-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            
            .report-table thead {
              background: #34495e;
              color: white;
            }
            
            .report-table th {
              padding: 12px 8px;
              text-align: center;
              font-size: 11px;
              font-weight: 600;
              border: 1px solid #2c3e50;
            }
            
            .report-table tbody tr {
              border-bottom: 1px solid #e1e4e8;
            }
            
            .report-table tbody tr:nth-child(even) {
              background: #f8f9fa;
            }
            
            .report-table td {
              padding: 8px;
              font-size: 10px;
              border: 1px solid #e1e4e8;
              color: #2c3e50;
              text-align: center;
            }
            
            .report-table td.amount {
              text-align: right;
              font-weight: bold;
              font-family: 'Courier New', monospace;
            }
            
            .report-table td.customer-name {
              text-align: left;
              font-weight: 500;
            }
            
            .report-table td.account-col {
              text-align: center;
              color: #5a6c7d;
              font-style: italic;
            }
            
            .type-cell-s {
              background: #d4edda;
              color: #155724;
              font-weight: bold;
            }
            
            .type-cell-g {
              background: #fff3cd;
              color: #856404;
              font-weight: bold;
            }
            
            .no-data {
              text-align: center;
              padding: 40px;
              color: #95a5a6;
              font-style: italic;
            }
            
            @page {
              margin: 1cm;
            }
            
            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Daily Receivables Report</h1>
            <p>Date: ${new Date(date).toLocaleDateString()} | Type: ${type} | Payment: ${pmtType}</p>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          ${printContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="daily-receivables-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Daily Receivables Report</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Filters Section */}
          <div className="filters-section">
            <div className="filter-group">
              <label htmlFor="date">Date:</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="type">Type:</label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">ALL (S & G)</option>
                <option value="S">S</option>
                <option value="G">G</option>
                <option value="RVR">RVR</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="pmtType">Payment Type:</label>
              <select
                id="pmtType"
                value={pmtType}
                onChange={(e) => setPmtType(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">ALL</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
              </select>
            </div>

            <button
              className="fetch-button"
              onClick={handleFetchReport}
              disabled={loading}
            >
              {loading ? "Loading..." : "Generate Report"}
            </button>
          </div>

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Report Section */}
          {reportData && separateTotals && (
            <div className="report-section">
              <div className="report-header">
                <h3>Report for {reportData.date}</h3>
                <button className="print-button" onClick={handlePrint}>
                  🖨️ Print
                </button>
              </div>

              <div ref={printRef}>
                {/* Summary Section */}
                <div className="summary-section-recievables">
                  <div className="summary-card">
                    <h4>Total Entries: {reportData.count}</h4>
                  </div>

                  <div className="totals-grid">
                    {/* USD Totals Card */}
                    <div className="total-card">
                      <h4>USD Totals</h4>
                      
                      {/* Type S Subtotal */}
                      <div className="type-subtotal">
                        <div className="type-subtotal-title">Type S</div>
                        <p><span>Cash:</span> <span>${formatNumberWithCommas(separateTotals.usd.s.cash)}</span></p>
                        <p><span>Check:</span> <span>${formatNumberWithCommas(separateTotals.usd.s.check)}</span></p>
                        <p style={{ fontWeight: 'bold' }}><span>Subtotal S:</span> <span>${formatNumberWithCommas(separateTotals.usd.s.total)}</span></p>
                      </div>

                      {/* Type G Subtotal */}
                      <div className="type-subtotal">
                        <div className="type-subtotal-title">Type G</div>
                        <p><span>Cash:</span> <span>${formatNumberWithCommas(separateTotals.usd.g.cash)}</span></p>
                        <p><span>Check:</span> <span>${formatNumberWithCommas(separateTotals.usd.g.check)}</span></p>
                        <p style={{ fontWeight: 'bold' }}><span>Subtotal G:</span> <span>${formatNumberWithCommas(separateTotals.usd.g.total)}</span></p>
                      </div>

                      {/* Overall USD Total */}
                      <p className="total-amount">
                        <strong>Total USD: ${formatNumberWithCommas(separateTotals.usd.total)}</strong>
                      </p>
                    </div>

                    {/* LL Totals Card */}
                    <div className="total-card">
                      <h4>LL Totals</h4>
                      
                      {/* Type S Subtotal */}
                      <div className="type-subtotal">
                        <div className="type-subtotal-title">Type S</div>
                        <p><span>Cash:</span> <span>{formatNumberWithCommas(separateTotals.ll.s.cash)} LL</span></p>
                        <p><span>Check:</span> <span>{formatNumberWithCommas(separateTotals.ll.s.check)} LL</span></p>
                        <p style={{ fontWeight: 'bold' }}><span>Subtotal S:</span> <span>{formatNumberWithCommas(separateTotals.ll.s.total)} LL</span></p>
                      </div>

                      {/* Type G Subtotal */}
                      <div className="type-subtotal">
                        <div className="type-subtotal-title">Type G</div>
                        <p><span>Cash:</span> <span>{formatNumberWithCommas(separateTotals.ll.g.cash)} LL</span></p>
                        <p><span>Check:</span> <span>{formatNumberWithCommas(separateTotals.ll.g.check)} LL</span></p>
                        <p style={{ fontWeight: 'bold' }}><span>Subtotal G:</span> <span>{formatNumberWithCommas(separateTotals.ll.g.total)} LL</span></p>
                      </div>

                      {/* Overall LL Total */}
                      <p className="total-amount">
                        <strong>Total LL: {formatNumberWithCommas(separateTotals.ll.total)} LL</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data Table */}
                <div className="report-table-container">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Acc #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Currency</th>
                        <th>Type S</th>
                        <th>Type G</th>
                        <th>Payment</th>
                        <th>JV #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.data.length === 0 ? (
                        <tr>
                          <td colSpan="10" className="no-data">
                            No receivables found for the selected criteria.
                          </td>
                        </tr>
                      ) : (
                        reportData.data.map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.id}</td>
                            <td className="account-col">
                              {entry.customerAccountNumber || "-"}
                            </td>
                            <td className="customer-name">{entry.customerName}</td>
                            <td>{new Date(entry.date).toLocaleDateString()}</td>
                            <td className="amount">
                              {formatNumberWithCommas(entry.cashNumber)}
                            </td>
                            <td>{entry.currency}</td>
                            <td className={entry.type === 'S' ? 'type-cell-s' : ''}>
                              {entry.type === 'S' ? 'S' : ''}
                            </td>
                            <td className={entry.type === 'G' ? 'type-cell-g' : ''}>
                              {entry.type === 'G' ? 'G' : ''}
                            </td>
                            <td>{entry.pmtType}</td>
                            <td>{entry.jvNumber}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyReceivablesModal;