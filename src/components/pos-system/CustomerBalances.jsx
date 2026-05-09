import React, { useState, useRef } from "react";
import { axiosClient } from "../api/axiosClient";
import { logActivity } from "../api/logActivity";
import "./CustomerBalances.css"; 

export default function CustomerBalances() {
  const today = new Date().toISOString().split("T")[0];
  const [toDate, setToDate] = useState(today);
  const [type, setType] = useState("ALL");
  const [minBalance, setMinBalance] = useState("");
  const [showNumberedCustomers, setShowNumberedCustomers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const printRef = useRef(null);

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    setData(null);
    logActivity({
      action: 'REPORT_RUN',
      entityType: 'Report',
      description: `Ran Customer Balances — as of ${toDate}, type: ${type}${minBalance ? `, min balance: ${minBalance}` : ''}`,
      metadata: { toDate, type, minBalance },
    });
    try {
      const params = { to: toDate };
      if (type !== "ALL") params.type = type;
      
      if (minBalance && minBalance.trim() !== "") {
        const parsedBalance = parseFloat(minBalance);
        if (!isNaN(parsedBalance)) {
          params.minBalance = parsedBalance;
        }
      }

      const res = await axiosClient.get("/journal-vouchers/reports/customer-balances", {
        params,
      });

      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    logActivity({
      action: 'REPORT_PRINTED',
      entityType: 'Report',
      description: `Printed Customer Balances — as of ${toDate}, type: ${type}`,
      metadata: { toDate, type, minBalance },
    });
    const printableRoot = printRef.current;
    if (!printableRoot) return;

    const printDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

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

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
      }, 300);
    };

    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Customer Balances Report - ${data.reportDate}</title>
    ${copiedStyles}
    <style>
      @page { 
        size: A4 portrait; 
        margin: 20mm 15mm;
      }
      
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      body { 
        margin: 0;
        padding: 0;
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        color: #000;
        font-size: 10pt;
      }
      
      .print-container {
        width: 100%;
        max-width: 100%;
      }
      
      .print-header {
        text-align: center;
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 3px solid #000;
      }
      
      .print-header h1 {
        margin: 0 0 8px 0;
        font-size: 20pt;
        font-weight: 700;
        color: #000;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .print-header .subtitle {
        font-size: 16pt;
        font-weight: 600;
        color: #333;
        margin: 5px 0;
      }
      
      .print-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
        padding: 12px;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .print-info-item {
        flex: 1;
        text-align: center;
      }
      
      .print-info-item strong {
        display: block;
        font-size: 8pt;
        text-transform: uppercase;
        color: #666;
        margin-bottom: 4px;
        letter-spacing: 0.5px;
      }
      
      .print-info-item span {
        display: block;
        font-size: 11pt;
        font-weight: 600;
        color: #000;
      }
      
      .print-summary {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin-bottom: 25px;
      }
      
      .print-summary-card {
        padding: 10px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        text-align: center;
        border-radius: 3px;
      }
      
      .print-summary-card strong {
        display: block;
        font-size: 7pt;
        text-transform: uppercase;
        color: #666;
        margin-bottom: 5px;
        letter-spacing: 0.3px;
      }
      
      .print-summary-card div {
        font-size: 14pt;
        font-weight: 700;
        color: #000;
      }
      
      .print-currency-group {
        page-break-inside: avoid;
        margin-bottom: 30px;
      }
      
      .print-currency-header {
        background: #2c3e50;
        color: white;
        padding: 10px 15px;
        margin-bottom: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12pt;
        font-weight: 700;
      }
      
      .print-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 5px;
        font-size: 9pt;
      }
      
      .print-table thead {
        background: #34495e;
        color: white;
      }
      
      .print-table th {
        padding: 8px 10px;
        text-align: left;
        font-weight: 600;
        font-size: 8pt;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border: 1px solid #2c3e50;
      }
      
      .print-table tbody tr {
        border-bottom: 1px solid #ddd;
      }
      
      .print-table tbody tr:nth-child(even) {
        background: #f8f9fa;
      }
      
      .print-table td {
        padding: 7px 10px;
        border: 1px solid #ddd;
        color: #000;
      }
      
      .print-table .negative-balance {
        color: #c92a2a;
        font-weight: 700;
      }
      
      .print-table .amount-cell {
        text-align: right;
        font-family: 'Courier New', monospace;
        font-weight: 600;
      }
      
      .print-table tfoot {
        background: #e9ecef;
        border-top: 2px solid #000;
      }
      
      .print-table tfoot td {
        padding: 10px;
        font-weight: 700;
        font-size: 10pt;
        border: 1px solid #adb5bd;
      }
      
      .print-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 8pt;
        color: #666;
        padding: 10px 0;
        border-top: 1px solid #ddd;
      }
      
      @media print {
        .print-footer::after {
          content: "Page " counter(page);
        }
      }
    </style>
  </head>
  <body>
    <div class="print-container">
      <div class="print-header">
        <h1>Customer Balances Report</h1>
        <div class="subtitle">أرصدة الزبائن</div>
      </div>
      
      <div class="print-info">
        <div class="print-info-item">
          <strong>Report Date</strong>
          <span>${data.reportDate}</span>
        </div>
        <div class="print-info-item">
          <strong>Type</strong>
          <span>${data.type}</span>
        </div>
        ${data.minBalance !== undefined ? `
        <div class="print-info-item">
          <strong>Min Balance Filter</strong>
          <span>≥ ${fmt(data.minBalance)}</span>
        </div>
        ` : ''}
        <div class="print-info-item">
          <strong>Generated On</strong>
          <span>${printDate}</span>
        </div>
      </div>
      
      <div class="print-summary">
        <div class="print-summary-card">
          <strong>Total Customers</strong>
          <div>${data.summary.totalCustomers}</div>
        </div>
        <div class="print-summary-card">
          <strong>Positive Balances</strong>
          <div>${data.summary.totalPositiveBalances}</div>
        </div>
        <div class="print-summary-card">
          <strong>Negative Balances</strong>
          <div>${data.summary.totalNegativeBalances}</div>
        </div>
        <div class="print-summary-card">
          <strong>Zero Balances</strong>
          <div>${data.summary.totalCustomers - data.summary.totalPositiveBalances - data.summary.totalNegativeBalances}</div>
        </div>
        <div class="print-summary-card">
          <strong>Currencies</strong>
          <div>${Object.keys(groupedByCurrency).length}</div>
        </div>
      </div>
      
      ${Object.keys(groupedByCurrency).map((currency) => {
        const customers = groupedByCurrency[currency];
        const total = customers.reduce((sum, c) => sum + c.balance, 0);
        
        return `
          <div class="print-currency-group">
            <div class="print-currency-header">
              <span>${currency}</span>
              <span>Total: ${fmt(total)}</span>
            </div>
            <table class="print-table">
              <thead>
                <tr>
                  <th style="width: 45%;">Customer Name</th>
                  <th style="width: 20%;">Account #</th>
                  <th style="width: 20%;">Balance</th>
                  <th style="width: 15%;">Transactions</th>
                </tr>
              </thead>
              <tbody>
                ${customers.map((c) => `
                  <tr>
                    <td>${c.customerName}</td>
                    <td>${c.customerAccountNumber || '-'}</td>
                    <td class="amount-cell ${c.balance < 0 ? 'negative-balance' : ''}">${fmt(c.balance)}</td>
                    <td style="text-align: center;">${c.transactionCount}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><strong>TOTAL ${currency}</strong></td>
                  <td class="amount-cell"><strong>${fmt(total)}</strong></td>
                  <td style="text-align: center;"><strong>${customers.reduce((sum, c) => sum + c.transactionCount, 0)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
      }).join('')}
      
      <div class="print-footer">
        Generated on ${printDate} | Customer Balances Report
      </div>
    </div>
  </body>
</html>`);
    doc.close();
  };

  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Check if customer name starts with number pattern (e.g., "2- عمر", "3- احمد")
  // OR ends with number pattern (e.g., "مصنع نزيه - 1", "NAJM ART - 1")
  const isNumberedCustomer = (customerName) => {
    if (!customerName) return false;
    return /^\d+[-\s]/.test(customerName.trim()) || /\s-\s\d+$/.test(customerName.trim());
  };

  const filteredCustomers = (data?.customers || [])
    .filter((c) => c.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((c) => {
      if (!showNumberedCustomers && isNumberedCustomer(c.customerName)) {
        return false;
      }
      return true;
    });

  const groupedByCurrency = filteredCustomers.reduce((acc, c) => {
    if (!acc[c.currencyCode]) acc[c.currencyCode] = [];
    acc[c.currencyCode].push(c);
    return acc;
  }, {});

  return (
    <div className="customer-balances-report">
      <div className="customer-balances-header">
        <h2>Customer Balances Report / أرصدة الزبائن</h2>
      </div>

      <div className="customer-balances-controls">
        <label>
          As of Date:
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            disabled={loading}
          />
        </label>

        <label>
          Type:
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
            <option value="S">S - Sales (includes RVR, RTN)</option>
            <option value="G">G - Offers</option>
            <option value="ALL">All</option>
          </select>
        </label>

        <label>
          Min Balance:
          <input
            type="number"
            step="0.01"
            placeholder="e.g., 5"
            value={minBalance}
            onChange={(e) => setMinBalance(e.target.value)}
            disabled={loading}
            title="Filter customers with balance greater than or equal to this value"
          />
        </label>

        <label className="customer-balances-checkbox-label">
          <input
            type="checkbox"
            checked={showNumberedCustomers}
            onChange={(e) => setShowNumberedCustomers(e.target.checked)}
            disabled={loading}
          />
          <span>Show numbered customers (e.g., "2- عمر", "NAJM ART - 1")</span>
        </label>

        <button onClick={fetchReport} disabled={loading} className="customer-balances-generate-btn">
          {loading ? "Loading..." : "Generate"}
        </button>

        {data && (
          <button 
            onClick={handlePrint} 
            className="customer-balances-print-btn"
            disabled={loading}
          >
            Print
          </button>
        )}
      </div>

      {error && <div className="customer-balances-error">{error}</div>}

      {data && (
        <div className="customer-balances-results" ref={printRef}>
          <div className="customer-balances-summary">
            <div>
              <strong>Report Date</strong>
              <div>{data.reportDate}</div>
            </div>
            <div>
              <strong>Type</strong>
              <div>{data.type}</div>
            </div>
            {data.minBalance !== undefined && (
              <div>
                <strong>Min Balance</strong>
                <div>≥ {fmt(data.minBalance)}</div>
              </div>
            )}
            <div>
              <strong>Total Customers</strong>
              <div>{data.summary.totalCustomers}</div>
            </div>
            <div>
              <strong>Positive Balances</strong>
              <div>{data.summary.totalPositiveBalances}</div>
            </div>
            <div>
              <strong>Negative Balances</strong>
              <div>{data.summary.totalNegativeBalances}</div>
            </div>
          </div>

          <div className="customer-balances-search">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="customer-balances-search-input"
            />
          </div>

          {Object.keys(groupedByCurrency).length === 0 && (
            <div className="customer-balances-no-results">No customers with balances found.</div>
          )}

          {Object.keys(groupedByCurrency).map((currency) => {
            const customers = groupedByCurrency[currency];
            const total = customers.reduce((sum, c) => sum + c.balance, 0);

            return (
              <div key={currency} className="customer-balances-currency-group">
                <h3>
                  <span>{currency}</span>
                  <span>Total: {fmt(total)}</span>
                </h3>
                <table className="customer-balances-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Account #</th>
                      <th>Balance</th>
                      <th>Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr
                        key={c.customerId}
                        className={c.balance < 0 ? "customer-balances-negative-row" : ""}
                      >
                        <td>{c.customerName}</td>
                        <td>{c.customerAccountNumber || "-"}</td>
                        <td className="customer-balances-amount-cell">{fmt(c.balance)}</td>
                        <td>{c.transactionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="customer-balances-total-row">
                      <td colSpan="2">
                        <strong>Total</strong>
                      </td>
                      <td className="customer-balances-amount-cell">
                        <strong>{fmt(total)}</strong>
                      </td>
                      <td>
                        <strong>
                          {customers.reduce((sum, c) => sum + c.transactionCount, 0)}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}