// src/components/reports/ProfitabilityReport.jsx
import React, { useState, useEffect, useRef } from 'react';
import { axiosClient } from '../api/axiosClient';
import './Profitability-report.css';

const ProfitabilityReport = () => {
  const [loading, setLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [data, setData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [viewMode, setViewMode] = useState('detailed');
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState(new Set());
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const printRef = useRef(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const [filters, setFilters] = useState({
    from: `${currentYear}-01-01`,
    to: now.toISOString().slice(0, 10),
    customerId: '',
    invoiceType: 'ALL',
  });

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await axiosClient.get('/customers');
        setCustomers(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        console.error('Error loading customers:', err);
      }
    };
    loadCustomers();
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.customerId) params.append('customerId', filters.customerId);
    if (filters.invoiceType) params.append('invoiceType', filters.invoiceType);
    return params;
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get(`/reports/profitability?${buildParams()}`);
      setData(res?.data || null);
    } catch (err) {
      console.error('Error loading profitability report:', err);
      alert('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReport = async () => {
    setMonthlyLoading(true);
    try {
      const res = await axiosClient.get(`/reports/profitability/monthly?${buildParams()}`);
      setMonthlyData(res?.data || null);
    } catch (err) {
      console.error('Error loading monthly report:', err);
      alert('Failed to load monthly report');
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApply = () => {
    if (viewMode === 'by-month') loadMonthlyReport();
    else loadReport();
  };

  const handleViewMode = (key) => {
    setViewMode(key);
    if (key === 'by-month' && !monthlyData) loadMonthlyReport();
  };

  const toggleCustomer = (id) => setExpandedCustomers((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleItem = (id) => setExpandedItems((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleInvoice = (id) => setExpandedInvoices((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleMonth = (key) => setExpandedMonths((prev) => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  // ─── Print ──────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const customerName = filters.customerId
      ? customers.find((c) => String(c.id) === String(filters.customerId))?.customerName || 'All Customers'
      : 'All Customers';

    const viewLabels = {
      'detailed':    'Detailed View',
      'by-customer': 'By Customer',
      'by-item':     'By Item',
      'by-invoice':  'By Invoice',
      'by-month':    'By Month',
    };

    const summarySource = viewMode === 'by-month' ? monthlyData?.grandTotal : data?.totals;

    const summaryHTML = summarySource ? `
      <div class="print-summary-cards">
        <div class="print-summary-card">
          <div class="print-summary-title">Total Revenue</div>
          <div class="print-summary-value">${fmt(summarySource.revenue)}</div>
        </div>
        <div class="print-summary-card">
          <div class="print-summary-title">Total Cost</div>
          <div class="print-summary-value">${fmt(summarySource.cost)}</div>
        </div>
        <div class="print-summary-card profit ${summarySource.profit < 0 ? 'negative' : 'positive'}">
          <div class="print-summary-title">Total Profit</div>
          <div class="print-summary-value">${fmt(summarySource.profit)}</div>
        </div>
        <div class="print-summary-card margin ${summarySource.margin < 0 ? 'negative' : 'positive'}">
          <div class="print-summary-title">Overall Margin</div>
          <div class="print-summary-value">${summarySource.margin.toFixed(2)}%</div>
        </div>
        ${viewMode === 'by-month' && monthlyData?.grandTotal
          ? `<div class="print-summary-card"><div class="print-summary-title">Total Invoices</div><div class="print-summary-value">${monthlyData.grandTotal.invoiceCount}</div></div>`
          : ''
        }
      </div>
    ` : '';

    const win = window.open('', '_blank', 'width=1200,height=800');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Profitability Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #0f172a; padding: 20px; }

          .print-header { margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
          .print-header h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
          .print-header-meta { display: flex; gap: 24px; font-size: 11px; color: #475569; flex-wrap: wrap; }
          .print-header-meta span { display: flex; gap: 4px; }
          .print-header-meta strong { color: #0f172a; }

          .print-summary-cards { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
          .print-summary-card { flex: 1; min-width: 120px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
          .print-summary-title { font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
          .print-summary-value { font-size: 16px; font-weight: 700; }
          .print-summary-card.profit.positive .print-summary-value { color: #16a34a; }
          .print-summary-card.profit.negative .print-summary-value { color: #dc2626; }
          .print-summary-card.margin.positive .print-summary-value { color: #16a34a; }
          .print-summary-card.margin.negative .print-summary-value { color: #dc2626; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
          th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-weight: 600; border: 1px solid #e2e8f0; }
          td { padding: 5px 8px; border: 1px solid #e2e8f0; }
          tfoot td { background: #f8fafc; font-weight: 600; }
          .amount { text-align: right; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          .return-row { background: #fff7ed; }

          /* group headers */
          .group-header { background: #f8fafc; padding: 8px 12px; margin: 10px 0 4px; border-left: 4px solid #2563eb; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
          .group-header h3 { font-size: 13px; font-weight: 700; margin: 0; }
          .group-header-totals { display: flex; gap: 16px; font-size: 11px; }
          .group-header-totals span { display: flex; gap: 4px; }

          /* month headers */
          .month-header { background: #eff6ff; padding: 8px 12px; margin: 14px 0 4px; border-left: 4px solid #2563eb; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
          .month-header h3 { font-size: 14px; font-weight: 700; margin: 0; color: #1e40af; }
          .month-header-totals { display: flex; gap: 16px; font-size: 11px; }

          /* collapsed group (no table, just header line) */
          .collapsed-group { background: #f9fafb; padding: 6px 12px; margin: 6px 0; border: 1px solid #e5e7eb; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #374151; }
          .collapsed-group strong { font-size: 12px; }

          /* grand total */
          .grand-total { background: #0f172a; color: #fff; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
          .grand-total strong { font-size: 14px; }
          .grand-total-figures { display: flex; gap: 20px; font-size: 11px; }
          .grand-total-figures span { display: flex; gap: 4px; color: #94a3b8; }
          .grand-total-figures strong { color: #fff; }

          .type-badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; }
          .type-S { background: #dbeafe; color: #1d4ed8; }
          .type-G { background: #f3e8ff; color: #7c3aed; }
          .type-RVR { background: #fef9c3; color: #854d0e; }
          .type-RTN { background: #fee2e2; color: #dc2626; }

          .vat-stripped { background: #fef3c7; color: #d97706; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; }
          .vat-normal { background: #f0fdf4; color: #16a34a; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; }

          @media print {
            body { padding: 10px; }
            @page { margin: 1cm; size: landscape; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>Profitability Report — ${viewLabels[viewMode]}</h1>
          <div class="print-header-meta">
            <span><span>Period:</span><strong>${filters.from} to ${filters.to}</strong></span>
            <span><span>Customer:</span><strong>${customerName}</strong></span>
            <span><span>Type:</span><strong>${filters.invoiceType}</strong></span>
            <span><span>Printed:</span><strong>${new Date().toLocaleString()}</strong></span>
          </div>
        </div>

        ${summaryHTML}

        ${printContent.innerHTML}

        <script>window.onload = function() { window.print(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const handleExport = () => {
    if (!data?.rows?.length) { alert('No data to export'); return; }
    const headers = [
      'Invoice #', 'Date', 'Type', 'Customer', 'Item', 'Description',
      'Thickness', 'Dimensions', 'Origin', 'Unit Type', 'Sheets/Box',
      'Quantity', 'SQM', 'Unit Price', 'Revenue', 'Cost', 'Profit', 'Margin %',
    ];
    const rows = data.rows.map((r) => [
      r.invoiceNumber, r.invoiceDate, r.invoiceType, r.customerName,
      r.itemName, r.fullDescription, r.thickness ?? '', r.dimensions, r.origin,
      r.unitType, r.sheetsPerBox ?? '',
      r.quantity, r.sqm, r.unitPrice.toFixed(2),
      r.revenue.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2), r.margin.toFixed(2),
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      '', 'TOTALS',
      `,,,,,,,,,,,,,"${data.totals.revenue.toFixed(2)}","${data.totals.cost.toFixed(2)}","${data.totals.profit.toFixed(2)}","${data.totals.margin.toFixed(2)}"`,
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profitability-report-${filters.from}-${filters.to}.csv`;
    link.click();
  };

  const handleExportMonthly = () => {
    if (!monthlyData?.months?.length) { alert('No data to export'); return; }
    const headers = ['Month', 'Invoice #', 'Date', 'Type', 'Customer', 'Items', 'Revenue', 'Cost', 'Profit', 'Margin %'];
    const rows = [];
    for (const month of monthlyData.months) {
      for (const inv of month.invoices) {
        rows.push([month.monthLabel, inv.invoiceNumber, inv.invoiceDate, inv.invoiceType, inv.customerName, inv.itemCount, inv.revenue.toFixed(2), inv.cost.toFixed(2), inv.profit.toFixed(2), inv.margin.toFixed(2)]);
      }
      rows.push([`${month.monthLabel} TOTAL`, '', '', '', '', month.totals.invoiceCount, month.totals.revenue.toFixed(2), month.totals.cost.toFixed(2), month.totals.profit.toFixed(2), month.totals.margin.toFixed(2)]);
      rows.push([]);
    }
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell ?? ''}"`).join(',')),
      '',
      `"GRAND TOTAL","","","","","${monthlyData.grandTotal.invoiceCount}","${monthlyData.grandTotal.revenue.toFixed(2)}","${monthlyData.grandTotal.cost.toFixed(2)}","${monthlyData.grandTotal.profit.toFixed(2)}","${monthlyData.grandTotal.margin.toFixed(2)}"`,
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `monthly-profitability-${filters.from}-${filters.to}.csv`;
    link.click();
  };

  const fmt = (num) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num ?? 0);
  const fmtUnitType = (unitType, sheetsPerBox) => {
    if (unitType === 'Box' && sheetsPerBox) return `Box (${sheetsPerBox}/box)`;
    return unitType || '-';
  };
  const profitClass = (val) => val < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive';
  const summarySource = viewMode === 'by-month' ? monthlyData?.grandTotal : data?.totals;

  // ─── Print-ready renderers (used inside printRef div) ────────────────────
  const renderDetailedPrint = () => (
    <table className="profitability-report__table">
      <thead>
        <tr>
          <th>Invoice #</th><th>Date</th><th>Type</th><th>Customer</th>
          <th>Item</th><th>Description</th><th>Thickness</th><th>Dimensions</th>
          <th>Origin</th><th>Unit Type</th><th>Qty</th><th>SQM</th>
          <th>Unit Price</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, idx) => (
          <tr key={idx} className={row.invoiceType === 'RTN' ? 'return-row' : ''}>
            <td>{row.invoiceNumber}</td>
            <td>{row.invoiceDate}</td>
            <td><span className={`type-badge type-${row.invoiceType}`}>{row.invoiceType}</span></td>
            <td>{row.customerName}</td>
            <td>{row.itemName}</td>
            <td>{row.fullDescription}</td>
            <td>{row.thickness ? row.thickness.toFixed(1) : '-'}</td>
            <td>{row.dimensions || '-'}</td>
            <td>{row.origin}</td>
            <td>{fmtUnitType(row.unitType, row.sheetsPerBox)}</td>
            <td>{row.quantity}</td>
            <td>{row.sqm.toFixed(2)}</td>
            <td className="amount">${fmt(row.unitPrice)}</td>
            <td className="amount">${fmt(row.revenue)}</td>
            <td className="amount">${fmt(row.cost)}</td>
            <td className={`amount ${row.profit < 0 ? 'negative' : 'positive'}`}>${fmt(row.profit)}</td>
            <td className={row.margin < 0 ? 'negative' : 'positive'}>{row.margin.toFixed(2)}%</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan="13"><strong>TOTALS</strong></td>
          <td className="amount"><strong>${fmt(data.totals.revenue)}</strong></td>
          <td className="amount"><strong>${fmt(data.totals.cost)}</strong></td>
          <td className={`amount ${data.totals.profit < 0 ? 'negative' : 'positive'}`}><strong>${fmt(data.totals.profit)}</strong></td>
          <td className={data.totals.margin < 0 ? 'negative' : 'positive'}><strong>{data.totals.margin.toFixed(2)}%</strong></td>
        </tr>
      </tfoot>
    </table>
  );

  const renderCustomerPrint = () => (
    <div>
      {data.customerSummary.map((customer) => {
        const isExpanded = expandedCustomers.has(customer.customerId);
        return (
          <div key={customer.customerId}>
            {isExpanded ? (
              <>
                <div className="group-header">
                  <h3>{customer.customerName || 'Unknown Customer'} ({customer.itemCount} items)</h3>
                  <div className="group-header-totals">
                    <span>Revenue: <strong>${fmt(customer.revenue)}</strong></span>
                    <span>Cost: <strong>${fmt(customer.cost)}</strong></span>
                    <span className={customer.profit < 0 ? 'negative' : 'positive'}>Profit: <strong>${fmt(customer.profit)}</strong></span>
                    <span className={customer.margin < 0 ? 'negative' : 'positive'}>Margin: <strong>{customer.margin.toFixed(2)}%</strong></span>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr><th>Item</th><th>Description</th><th>Thickness</th><th>Dimensions</th><th>Origin</th><th>Unit Type</th><th>Qty</th><th>SQM</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr>
                  </thead>
                  <tbody>
                    {customer.items.map((item) => (
                      <tr key={item.itemVariantId}>
                        <td>{item.itemName}</td>
                        <td>{item.fullDescription}</td>
                        <td>{item.thickness ? item.thickness.toFixed(1) : '-'}</td>
                        <td>{item.dimensions || '-'}</td>
                        <td>{item.origin}</td>
                        <td>{fmtUnitType(item.unitType, item.sheetsPerBox)}</td>
                        <td>{item.quantity.toFixed(2)}</td>
                        <td>{item.sqm.toFixed(2)}</td>
                        <td className="amount">${fmt(item.revenue)}</td>
                        <td className="amount">${fmt(item.cost)}</td>
                        <td className={`amount ${item.profit < 0 ? 'negative' : 'positive'}`}>${fmt(item.profit)}</td>
                        <td className={item.margin < 0 ? 'negative' : 'positive'}>{item.margin.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="collapsed-group">
                <strong>{customer.customerName || 'Unknown Customer'}</strong>
                <div className="group-header-totals">
                  <span>Revenue: <strong>${fmt(customer.revenue)}</strong></span>
                  <span>Cost: <strong>${fmt(customer.cost)}</strong></span>
                  <span className={customer.profit < 0 ? 'negative' : 'positive'}>Profit: <strong>${fmt(customer.profit)}</strong></span>
                  <span className={customer.margin < 0 ? 'negative' : 'positive'}>Margin: <strong>{customer.margin.toFixed(2)}%</strong></span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderItemPrint = () => (
    <div>
      {data.itemSummary.map((item) => {
        const isExpanded = expandedItems.has(item.itemVariantId);
        return (
          <div key={item.itemVariantId}>
            {isExpanded ? (
              <>
                <div className="group-header">
                  <h3>{item.itemName} — {fmtUnitType(item.unitType, item.sheetsPerBox)} {item.thickness ? `${item.thickness.toFixed(1)}mm` : ''} {item.origin}</h3>
                  <div className="group-header-totals">
                    <span>Revenue: <strong>${fmt(item.revenue)}</strong></span>
                    <span>Cost: <strong>${fmt(item.cost)}</strong></span>
                    <span className={item.profit < 0 ? 'negative' : 'positive'}>Profit: <strong>${fmt(item.profit)}</strong></span>
                    <span className={item.margin < 0 ? 'negative' : 'positive'}>Margin: <strong>{item.margin.toFixed(2)}%</strong></span>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr><th>Customer</th><th>Qty</th><th>SQM</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr>
                  </thead>
                  <tbody>
                    {item.customers.map((cust) => (
                      <tr key={cust.customerId}>
                        <td>{cust.customerName}</td>
                        <td>{cust.quantity.toFixed(2)}</td>
                        <td>{cust.sqm.toFixed(2)}</td>
                        <td className="amount">${fmt(cust.revenue)}</td>
                        <td className="amount">${fmt(cust.cost)}</td>
                        <td className={`amount ${cust.profit < 0 ? 'negative' : 'positive'}`}>${fmt(cust.profit)}</td>
                        <td className={cust.margin < 0 ? 'negative' : 'positive'}>{cust.margin.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="collapsed-group">
                <strong>{item.itemName}</strong>
                <div className="group-header-totals">
                  <span>Revenue: <strong>${fmt(item.revenue)}</strong></span>
                  <span>Cost: <strong>${fmt(item.cost)}</strong></span>
                  <span className={item.profit < 0 ? 'negative' : 'positive'}>Profit: <strong>${fmt(item.profit)}</strong></span>
                  <span className={item.margin < 0 ? 'negative' : 'positive'}>Margin: <strong>{item.margin.toFixed(2)}%</strong></span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderInvoicePrint = () => (
    <div>
      {data.invoiceSummary.map((invoice) => {
        const isExpanded = expandedInvoices.has(invoice.invoiceId);
        return (
          <div key={invoice.invoiceId}>
            {isExpanded ? (
              <>
                <div className="group-header">
                  <h3>
                    <span className={`type-badge type-${invoice.invoiceType}`}>{invoice.invoiceType}</span>
                    {' '}{invoice.invoiceNumber} — {invoice.invoiceDate} — {invoice.customerName}
                  </h3>
                  <div className="group-header-totals">
                    <span>Revenue: <strong>${fmt(invoice.revenue)}</strong></span>
                    <span>Cost: <strong>${fmt(invoice.cost)}</strong></span>
                    <span className={invoice.profit < 0 ? 'negative' : 'positive'}>Profit: <strong>${fmt(invoice.profit)}</strong></span>
                    <span className={invoice.margin < 0 ? 'negative' : 'positive'}>Margin: <strong>{invoice.margin.toFixed(2)}%</strong></span>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr><th>Item</th><th>Description</th><th>Thickness</th><th>Dimensions</th><th>Origin</th><th>Unit Type</th><th>Qty</th><th>SQM</th><th>Unit Price</th><th>Avg Cost</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.itemName}</td>
                        <td>{item.fullDescription || '-'}</td>
                        <td>{item.thickness ? item.thickness.toFixed(1) : '-'}</td>
                        <td>{item.dimensions || '-'}</td>
                        <td>{item.origin || '-'}</td>
                        <td>{fmtUnitType(item.unitType, item.sheetsPerBox)}</td>
                        <td>{item.quantity.toFixed(2)}</td>
                        <td>{item.sqm.toFixed(2)}</td>
                        <td className="amount">${fmt(item.unitPrice)}</td>
                        <td className="amount">${fmt(item.averageCost)}</td>
                        <td className="amount">${fmt(item.revenue)}</td>
                        <td className="amount">${fmt(item.cost)}</td>
                        <td className={`amount ${item.profit < 0 ? 'negative' : 'positive'}`}>${fmt(item.profit)}</td>
                        <td className={item.margin < 0 ? 'negative' : 'positive'}>{item.margin.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="10"><strong>Invoice Total</strong></td>
                      <td className="amount"><strong>${fmt(invoice.revenue)}</strong></td>
                      <td className="amount"><strong>${fmt(invoice.cost)}</strong></td>
                      <td className={`amount ${invoice.profit < 0 ? 'negative' : 'positive'}`}><strong>${fmt(invoice.profit)}</strong></td>
                      <td className={invoice.margin < 0 ? 'negative' : 'positive'}><strong>{invoice.margin.toFixed(2)}%</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </>
            ) : (
              <div className="collapsed-group">
                <span>
                  <span className={`type-badge type-${invoice.invoiceType}`}>{invoice.invoiceType}</span>
                  {' '}<strong>{invoice.invoiceNumber}</strong> — {invoice.invoiceDate} — {invoice.customerName}
                </span>
                <div className="group-header-totals">
                  <span>Revenue: <strong>${fmt(invoice.revenue)}</strong></span>
                  <span>Cost: <strong>${fmt(invoice.cost)}</strong></span>
                  <span className={invoice.profit < 0 ? 'negative' : 'positive'}>Profit: <strong>${fmt(invoice.profit)}</strong></span>
                  <span className={invoice.margin < 0 ? 'negative' : 'positive'}>Margin: <strong>{invoice.margin.toFixed(2)}%</strong></span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderMonthPrint = () => (
    <div>
      {monthlyData.months.map((month) => {
        const monthKey = `${month.year}-${month.month}`;
        const isExpanded = expandedMonths.has(monthKey);
        return (
          <div key={monthKey}>
            {isExpanded ? (
              <>
                <div className="month-header">
                  <h3>{month.monthLabel}</h3>
                  <div className="month-header-totals">
                    <span>Revenue: <strong>${fmt(month.totals.revenue)}</strong></span>
                    <span>Cost: <strong>${fmt(month.totals.cost)}</strong></span>
                    <span className={month.totals.profit < 0 ? 'negative' : 'positive'}>Profit: <strong>${fmt(month.totals.profit)}</strong></span>
                    <span className={month.totals.margin < 0 ? 'negative' : 'positive'}>Margin: <strong>{month.totals.margin.toFixed(2)}%</strong></span>
                    <span>{month.totals.invoiceCount} invoices</span>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Invoice #</th><th>Date</th><th>Type</th><th>Customer</th><th>Items</th>
                      <th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th>
                      {monthlyData.vatInclusive && <th>VAT</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {month.invoices.map((inv) => (
                      <tr key={inv.invoiceId} className={inv.invoiceType === 'RTN' ? 'return-row' : ''}>
                        <td><strong>{inv.invoiceNumber}</strong></td>
                        <td>{inv.invoiceDate}</td>
                        <td><span className={`type-badge type-${inv.invoiceType}`}>{inv.invoiceType}</span></td>
                        <td>{inv.customerName}</td>
                        <td>{inv.itemCount}</td>
                        <td className="amount">${fmt(inv.revenue)}</td>
                        <td className="amount">${fmt(inv.cost)}</td>
                        <td className={`amount ${inv.profit < 0 ? 'negative' : 'positive'}`}>${fmt(inv.profit)}</td>
                        <td className={inv.margin < 0 ? 'negative' : 'positive'}>{inv.margin.toFixed(2)}%</td>
                        {monthlyData.vatInclusive && (
                          <td>
                            {inv.vatStripped
                              ? <span className="vat-stripped">Stripped</span>
                              : <span className="vat-normal">{inv.vatPercentage}%</span>
                            }
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5"><strong>Month Total</strong></td>
                      <td className="amount"><strong>${fmt(month.totals.revenue)}</strong></td>
                      <td className="amount"><strong>${fmt(month.totals.cost)}</strong></td>
                      <td className={`amount ${month.totals.profit < 0 ? 'negative' : 'positive'}`}><strong>${fmt(month.totals.profit)}</strong></td>
                      <td className={month.totals.margin < 0 ? 'negative' : 'positive'}><strong>{month.totals.margin.toFixed(2)}%</strong></td>
                      {monthlyData.vatInclusive && <td />}
                    </tr>
                  </tfoot>
                </table>
              </>
            ) : (
              <div className="collapsed-group">
                <strong>{month.monthLabel}</strong>
                <div className="group-header-totals">
                  <span>{month.totals.invoiceCount} invoices</span>
                  <span>Revenue: <strong>${fmt(month.totals.revenue)}</strong></span>
                  <span>Cost: <strong>${fmt(month.totals.cost)}</strong></span>
                  <span className={month.totals.profit < 0 ? 'negative' : 'positive'}>Profit: <strong>${fmt(month.totals.profit)}</strong></span>
                  <span className={month.totals.margin < 0 ? 'negative' : 'positive'}>Margin: <strong>{month.totals.margin.toFixed(2)}%</strong></span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {/* Grand total */}
      <div className="grand-total">
        <strong>Grand Total — {monthlyData.grandTotal.invoiceCount} invoices</strong>
        <div className="grand-total-figures">
          <span>Revenue: <strong>${fmt(monthlyData.grandTotal.revenue)}</strong></span>
          <span>Cost: <strong>${fmt(monthlyData.grandTotal.cost)}</strong></span>
          <span>Profit: <strong className={monthlyData.grandTotal.profit < 0 ? 'negative' : 'positive'}>${fmt(monthlyData.grandTotal.profit)}</strong></span>
          <span>Margin: <strong className={monthlyData.grandTotal.margin < 0 ? 'negative' : 'positive'}>{monthlyData.grandTotal.margin.toFixed(2)}%</strong></span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="profitability-report">
      <h1 className="profitability-report__title">Profitability Report</h1>

      {/* Filters */}
      <div className="profitability-report__filters">
        <div className="profitability-report__filter-row">
          <label className="profitability-report__filter-label">
            From:
            <input type="date" name="from" value={filters.from} onChange={handleFilterChange} className="profitability-report__filter-input" />
          </label>
          <label className="profitability-report__filter-label">
            To:
            <input type="date" name="to" value={filters.to} onChange={handleFilterChange} className="profitability-report__filter-input" />
          </label>
          <label className="profitability-report__filter-label">
            Customer:
            <select name="customerId" value={filters.customerId} onChange={handleFilterChange} className="profitability-report__filter-select">
              <option value="">All Customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
            </select>
          </label>
          <label className="profitability-report__filter-label">
            Type:
            <select name="invoiceType" value={filters.invoiceType} onChange={handleFilterChange} className="profitability-report__filter-select">
              <option value="ALL">All Types</option>
              <option value="S">Sales (S)</option>
              <option value="G">Glass (G)</option>
              <option value="RVR">RVR</option>
              <option value="RTN">Returns (RTN)</option>
            </select>
          </label>
          <button onClick={handleApply} className="profitability-report__btn-apply">Apply Filters</button>
          {viewMode === 'by-month'
            ? <button onClick={handleExportMonthly} className="profitability-report__btn-export">📊 Export Monthly</button>
            : <button onClick={handleExport} className="profitability-report__btn-export">📊 Export to Excel</button>
          }
          <button onClick={handlePrint} className="profitability-report__btn-print">🖨️ Print</button>
        </div>

        <div className="profitability-report__view-toggle">
          {[
            { key: 'detailed',    label: '📋 Detailed View' },
            { key: 'by-customer', label: '👥 By Customer' },
            { key: 'by-item',     label: '📦 By Item' },
            { key: 'by-invoice',  label: '🧾 By Invoice' },
            { key: 'by-month',    label: '📅 By Month' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`profitability-report__view-btn ${viewMode === key ? 'profitability-report__view-btn--active' : ''}`}
              onClick={() => handleViewMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(loading || monthlyLoading) && <div className="profitability-report__loading">Loading report...</div>}

      {/* Summary Cards */}
      {summarySource && !(loading || monthlyLoading) && (
        <div className="profitability-report__summary-cards">
          <div className="profitability-report__summary-card profitability-report__summary-card--revenue">
            <h3 className="profitability-report__summary-title">Total Revenue</h3>
            <div className="profitability-report__summary-value">${fmt(summarySource.revenue)}</div>
          </div>
          <div className="profitability-report__summary-card profitability-report__summary-card--cost">
            <h3 className="profitability-report__summary-title">Total Cost</h3>
            <div className="profitability-report__summary-value">${fmt(summarySource.cost)}</div>
          </div>
          <div className="profitability-report__summary-card profitability-report__summary-card--profit">
            <h3 className="profitability-report__summary-title">Total Profit</h3>
            <div className={`profitability-report__summary-value ${profitClass(summarySource.profit)}`}>${fmt(summarySource.profit)}</div>
          </div>
          <div className="profitability-report__summary-card profitability-report__summary-card--margin">
            <h3 className="profitability-report__summary-title">Overall Margin</h3>
            <div className={`profitability-report__summary-value ${profitClass(summarySource.margin)}`}>{summarySource.margin.toFixed(2)}%</div>
          </div>
          {viewMode === 'by-month' && monthlyData?.grandTotal && (
            <div className="profitability-report__summary-card profitability-report__summary-card--invoices">
              <h3 className="profitability-report__summary-title">Total Invoices</h3>
              <div className="profitability-report__summary-value">{monthlyData.grandTotal.invoiceCount}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Hidden print content div ───────────────────────────────────────── */}
      <div ref={printRef} style={{ display: 'none' }}>
        {viewMode === 'detailed'    && data        && renderDetailedPrint()}
        {viewMode === 'by-customer' && data        && renderCustomerPrint()}
        {viewMode === 'by-item'     && data        && renderItemPrint()}
        {viewMode === 'by-invoice'  && data        && renderInvoicePrint()}
        {viewMode === 'by-month'    && monthlyData && renderMonthPrint()}
      </div>

      {data && !loading && (
        <>
          {/* ── DETAILED VIEW ─────────────────────────────────────────────── */}
          {viewMode === 'detailed' && (
            <div className="profitability-report__table-container">
              <table className="profitability-report__table">
                <thead>
                  <tr>
                    <th>Invoice #</th><th>Date</th><th>Type</th><th>Customer</th>
                    <th>Item</th><th>Description</th><th>Thickness</th><th>Dimensions</th>
                    <th>Origin</th><th>Unit Type</th><th>Qty</th><th>SQM</th>
                    <th>Unit Price</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, idx) => (
                    <tr key={idx} className={row.invoiceType === 'RTN' ? 'profitability-report__table-row--return' : ''}>
                      <td>{row.invoiceNumber}</td>
                      <td>{row.invoiceDate}</td>
                      <td><span className={`profitability-report__type-badge profitability-report__type-badge--${row.invoiceType}`}>{row.invoiceType}</span></td>
                      <td>{row.customerName}</td>
                      <td>{row.itemName}</td>
                      <td className="profitability-report__description-cell">{row.fullDescription}</td>
                      <td>{row.thickness ? row.thickness.toFixed(1) : '-'}</td>
                      <td>{row.dimensions || '-'}</td>
                      <td>{row.origin}</td>
                      <td><span className={`profitability-report__unit-badge profitability-report__unit-badge--${(row.unitType || 'sqm').toLowerCase()}`}>{fmtUnitType(row.unitType, row.sheetsPerBox)}</span></td>
                      <td>{row.quantity}</td>
                      <td>{row.sqm.toFixed(2)}</td>
                      <td>${fmt(row.unitPrice)}</td>
                      <td className="profitability-report__amount">${fmt(row.revenue)}</td>
                      <td className="profitability-report__amount">${fmt(row.cost)}</td>
                      <td className={`profitability-report__amount ${profitClass(row.profit)}`}>${fmt(row.profit)}</td>
                      <td className={profitClass(row.margin)}>{row.margin.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="profitability-report__totals-row">
                    <td colSpan="13"><strong>TOTALS</strong></td>
                    <td className="profitability-report__amount"><strong>${fmt(data.totals.revenue)}</strong></td>
                    <td className="profitability-report__amount"><strong>${fmt(data.totals.cost)}</strong></td>
                    <td className={`profitability-report__amount ${profitClass(data.totals.profit)}`}><strong>${fmt(data.totals.profit)}</strong></td>
                    <td className={profitClass(data.totals.margin)}><strong>{data.totals.margin.toFixed(2)}%</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── BY CUSTOMER VIEW ──────────────────────────────────────────── */}
          {viewMode === 'by-customer' && data.customerSummary && (
            <div className="profitability-report__customer-grouping">
              {data.customerSummary.map((customer) => (
                <div key={customer.customerId} className="profitability-report__customer-group">
                  <div className="profitability-report__customer-header" onClick={() => toggleCustomer(customer.customerId)}>
                    <div className="profitability-report__customer-info">
                      <span className="profitability-report__expand-icon">{expandedCustomers.has(customer.customerId) ? '▼' : '▶'}</span>
                      <h3 className="profitability-report__customer-name">{customer.customerName || 'Unknown Customer'}</h3>
                      <span className="profitability-report__item-count">({customer.itemCount} items)</span>
                    </div>
                    <div className="profitability-report__customer-totals">
                      <div className="profitability-report__total-item"><span>Revenue:</span><strong>${fmt(customer.revenue)}</strong></div>
                      <div className="profitability-report__total-item"><span>Cost:</span><strong>${fmt(customer.cost)}</strong></div>
                      <div className="profitability-report__total-item"><span>Profit:</span><strong className={profitClass(customer.profit)}>${fmt(customer.profit)}</strong></div>
                      <div className="profitability-report__total-item"><span>Margin:</span><strong className={profitClass(customer.margin)}>{customer.margin.toFixed(2)}%</strong></div>
                    </div>
                  </div>
                  {expandedCustomers.has(customer.customerId) && (
                    <div className="profitability-report__customer-items">
                      <table className="profitability-report__items-table">
                        <thead>
                          <tr><th>Item</th><th>Description</th><th>Thickness</th><th>Dimensions</th><th>Origin</th><th>Unit Type</th><th>Qty</th><th>SQM</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr>
                        </thead>
                        <tbody>
                          {customer.items.map((item) => (
                            <tr key={item.itemVariantId}>
                              <td>{item.itemName}</td>
                              <td className="profitability-report__description-cell">{item.fullDescription}</td>
                              <td>{item.thickness ? item.thickness.toFixed(1) : '-'}</td>
                              <td>{item.dimensions || '-'}</td>
                              <td>{item.origin}</td>
                              <td><span className={`profitability-report__unit-badge profitability-report__unit-badge--${(item.unitType || 'sqm').toLowerCase()}`}>{fmtUnitType(item.unitType, item.sheetsPerBox)}</span></td>
                              <td>{item.quantity.toFixed(2)}</td>
                              <td>{item.sqm.toFixed(2)}</td>
                              <td className="profitability-report__amount">${fmt(item.revenue)}</td>
                              <td className="profitability-report__amount">${fmt(item.cost)}</td>
                              <td className={`profitability-report__amount ${profitClass(item.profit)}`}>${fmt(item.profit)}</td>
                              <td className={profitClass(item.margin)}>{item.margin.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── BY ITEM VIEW ──────────────────────────────────────────────── */}
          {viewMode === 'by-item' && data.itemSummary && (
            <div className="profitability-report__item-grouping">
              {data.itemSummary.map((item) => (
                <div key={item.itemVariantId} className="profitability-report__item-group">
                  <div className="profitability-report__item-header" onClick={() => toggleItem(item.itemVariantId)}>
                    <div className="profitability-report__item-info">
                      <span className="profitability-report__expand-icon">{expandedItems.has(item.itemVariantId) ? '▼' : '▶'}</span>
                      <div className="profitability-report__item-details">
                        <div className="profitability-report__item-name-row">
                          <h3 className="profitability-report__item-name">{item.itemName}</h3>
                          <span className={`profitability-report__unit-badge profitability-report__unit-badge--${(item.unitType || 'sqm').toLowerCase()}`}>{fmtUnitType(item.unitType, item.sheetsPerBox)}</span>
                        </div>
                        <div className="profitability-report__item-meta">
                          {item.fullDescription && <span className="profitability-report__item-description">{item.fullDescription}</span>}
                          {item.thickness && <span className="profitability-report__item-thickness">{item.thickness.toFixed(1)}mm</span>}
                          {item.dimensions && <span className="profitability-report__item-dimensions">{item.dimensions}</span>}
                          {item.origin && <span className="profitability-report__item-origin">{item.origin}</span>}
                        </div>
                        <div className="profitability-report__item-stats">
                          <span>{item.customerCount} customers</span><span>•</span>
                          <span>{item.invoiceCount} invoices</span><span>•</span>
                          <span>{item.quantity.toFixed(2)} qty</span><span>•</span>
                          <span>{item.sqm.toFixed(2)} sqm</span>
                        </div>
                      </div>
                    </div>
                    <div className="profitability-report__item-totals">
                      <div className="profitability-report__total-item"><span>Revenue:</span><strong>${fmt(item.revenue)}</strong></div>
                      <div className="profitability-report__total-item"><span>Cost:</span><strong>${fmt(item.cost)}</strong></div>
                      <div className="profitability-report__total-item"><span>Profit:</span><strong className={profitClass(item.profit)}>${fmt(item.profit)}</strong></div>
                      <div className="profitability-report__total-item"><span>Margin:</span><strong className={profitClass(item.margin)}>{item.margin.toFixed(2)}%</strong></div>
                    </div>
                  </div>
                  {expandedItems.has(item.itemVariantId) && (
                    <div className="profitability-report__item-customers">
                      <h4 className="profitability-report__customers-title">Customers who bought this item:</h4>
                      <table className="profitability-report__customers-table">
                        <thead>
                          <tr><th>Customer</th><th>Qty</th><th>SQM</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr>
                        </thead>
                        <tbody>
                          {item.customers.map((cust) => (
                            <tr key={cust.customerId}>
                              <td>{cust.customerName}</td>
                              <td>{cust.quantity.toFixed(2)}</td>
                              <td>{cust.sqm.toFixed(2)}</td>
                              <td className="profitability-report__amount">${fmt(cust.revenue)}</td>
                              <td className="profitability-report__amount">${fmt(cust.cost)}</td>
                              <td className={`profitability-report__amount ${profitClass(cust.profit)}`}>${fmt(cust.profit)}</td>
                              <td className={profitClass(cust.margin)}>{cust.margin.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── BY INVOICE VIEW ───────────────────────────────────────────── */}
          {viewMode === 'by-invoice' && data.invoiceSummary && (
            <div className="profitability-report__invoice-grouping">
              {data.invoiceSummary.map((invoice) => (
                <div key={invoice.invoiceId} className="profitability-report__invoice-group">
                  <div
                    className={`profitability-report__invoice-header ${invoice.invoiceType === 'RTN' ? 'profitability-report__invoice-header--return' : ''}`}
                    onClick={() => toggleInvoice(invoice.invoiceId)}
                  >
                    <div className="profitability-report__invoice-identity">
                      <span className="profitability-report__expand-icon">{expandedInvoices.has(invoice.invoiceId) ? '▼' : '▶'}</span>
                      <div className="profitability-report__invoice-id-block">
                        <span className="profitability-report__invoice-number">{invoice.invoiceNumber}</span>
                        <span className={`profitability-report__type-badge profitability-report__type-badge--${invoice.invoiceType}`}>{invoice.invoiceType}</span>
                      </div>
                      <div className="profitability-report__invoice-meta">
                        <span className="profitability-report__invoice-date">{invoice.invoiceDate}</span>
                        <span className="profitability-report__invoice-customer">{invoice.customerName}</span>
                        <span className="profitability-report__invoice-item-count">{invoice.itemCount} item{invoice.itemCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="profitability-report__invoice-totals">
                      <div className="profitability-report__total-item"><span>Revenue:</span><strong>${fmt(invoice.revenue)}</strong></div>
                      <div className="profitability-report__total-item"><span>Cost:</span><strong>${fmt(invoice.cost)}</strong></div>
                      <div className="profitability-report__total-item"><span>Profit:</span><strong className={profitClass(invoice.profit)}>${fmt(invoice.profit)}</strong></div>
                      <div className="profitability-report__total-item"><span>Margin:</span><strong className={profitClass(invoice.margin)}>{invoice.margin.toFixed(2)}%</strong></div>
                    </div>
                  </div>
                  {expandedInvoices.has(invoice.invoiceId) && (
                    <div className="profitability-report__invoice-items">
                      <table className="profitability-report__items-table">
                        <thead>
                          <tr><th>Item</th><th>Description</th><th>Thickness</th><th>Dimensions</th><th>Origin</th><th>Unit Type</th><th>Qty</th><th>SQM</th><th>Unit Price</th><th>Avg Cost</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr>
                        </thead>
                        <tbody>
                          {invoice.items.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.itemName}</td>
                              <td className="profitability-report__description-cell">{item.fullDescription || '-'}</td>
                              <td>{item.thickness ? item.thickness.toFixed(1) : '-'}</td>
                              <td>{item.dimensions || '-'}</td>
                              <td>{item.origin || '-'}</td>
                              <td><span className={`profitability-report__unit-badge profitability-report__unit-badge--${(item.unitType || 'sqm').toLowerCase()}`}>{fmtUnitType(item.unitType, item.sheetsPerBox)}</span></td>
                              <td>{item.quantity.toFixed(2)}</td>
                              <td>{item.sqm.toFixed(2)}</td>
                              <td className="profitability-report__amount">${fmt(item.unitPrice)}</td>
                              <td className="profitability-report__amount">${fmt(item.averageCost)}</td>
                              <td className="profitability-report__amount">${fmt(item.revenue)}</td>
                              <td className="profitability-report__amount">${fmt(item.cost)}</td>
                              <td className={`profitability-report__amount ${profitClass(item.profit)}`}>${fmt(item.profit)}</td>
                              <td className={profitClass(item.margin)}>{item.margin.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="profitability-report__totals-row">
                            <td colSpan="10"><strong>Invoice Total</strong></td>
                            <td className="profitability-report__amount"><strong>${fmt(invoice.revenue)}</strong></td>
                            <td className="profitability-report__amount"><strong>${fmt(invoice.cost)}</strong></td>
                            <td className={`profitability-report__amount ${profitClass(invoice.profit)}`}><strong>${fmt(invoice.profit)}</strong></td>
                            <td className={profitClass(invoice.margin)}><strong>{invoice.margin.toFixed(2)}%</strong></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="profitability-report__footer">
            <p>Total Items: {data.count}</p>
            <p>Period: {filters.from} to {filters.to}</p>
            {viewMode === 'by-invoice' && data.invoiceSummary && (
              <p>Invoices: {data.invoiceSummary.length}</p>
            )}
          </div>
        </>
      )}

      {/* ── BY MONTH VIEW ─────────────────────────────────────────────────── */}
      {viewMode === 'by-month' && !monthlyLoading && monthlyData && (
        <div className="profitability-report__month-grouping">
          {monthlyData.months.map((month) => {
            const monthKey = `${month.year}-${month.month}`;
            const isExpanded = expandedMonths.has(monthKey);
            return (
              <div key={monthKey} className="profitability-report__month-group">
                <div className="profitability-report__month-header" onClick={() => toggleMonth(monthKey)}>
                  <div className="profitability-report__month-left">
                    <span className="profitability-report__expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    <h3 className="profitability-report__month-label">{month.monthLabel}</h3>
                    <span className="profitability-report__month-count">{month.totals.invoiceCount} invoice{month.totals.invoiceCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="profitability-report__month-totals">
                    <div className="profitability-report__total-item"><span>Revenue:</span><strong>${fmt(month.totals.revenue)}</strong></div>
                    <div className="profitability-report__total-item"><span>Cost:</span><strong>${fmt(month.totals.cost)}</strong></div>
                    <div className="profitability-report__total-item"><span>Profit:</span><strong className={profitClass(month.totals.profit)}>${fmt(month.totals.profit)}</strong></div>
                    <div className="profitability-report__total-item"><span>Margin:</span><strong className={profitClass(month.totals.margin)}>{month.totals.margin.toFixed(2)}%</strong></div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="profitability-report__month-invoices">
                    <table className="profitability-report__items-table">
                      <thead>
                        <tr>
                          <th>Invoice #</th><th>Date</th><th>Type</th><th>Customer</th><th>Items</th>
                          <th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th>
                          {monthlyData.vatInclusive && <th>VAT</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {month.invoices.map((inv) => (
                          <tr key={inv.invoiceId} className={inv.invoiceType === 'RTN' ? 'profitability-report__table-row--return' : ''}>
                            <td><strong>{inv.invoiceNumber}</strong></td>
                            <td>{inv.invoiceDate}</td>
                            <td><span className={`profitability-report__type-badge profitability-report__type-badge--${inv.invoiceType}`}>{inv.invoiceType}</span></td>
                            <td>{inv.customerName}</td>
                            <td>{inv.itemCount}</td>
                            <td className="profitability-report__amount">${fmt(inv.revenue)}</td>
                            <td className="profitability-report__amount">${fmt(inv.cost)}</td>
                            <td className={`profitability-report__amount ${profitClass(inv.profit)}`}>${fmt(inv.profit)}</td>
                            <td className={profitClass(inv.margin)}>{inv.margin.toFixed(2)}%</td>
                            {monthlyData.vatInclusive && (
                              <td>
                                {inv.vatStripped
                                  ? <span className="profitability-report__vat-stripped">Stripped</span>
                                  : <span className="profitability-report__vat-normal">{inv.vatPercentage}%</span>
                                }
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="profitability-report__totals-row">
                          <td colSpan="5"><strong>Month Total</strong></td>
                          <td className="profitability-report__amount"><strong>${fmt(month.totals.revenue)}</strong></td>
                          <td className="profitability-report__amount"><strong>${fmt(month.totals.cost)}</strong></td>
                          <td className={`profitability-report__amount ${profitClass(month.totals.profit)}`}><strong>${fmt(month.totals.profit)}</strong></td>
                          <td className={profitClass(month.totals.margin)}><strong>{month.totals.margin.toFixed(2)}%</strong></td>
                          {monthlyData.vatInclusive && <td />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          <div className="profitability-report__grand-total">
            <div className="profitability-report__grand-total-label">
              <strong>Grand Total</strong>
              <span className="profitability-report__month-count">{monthlyData.grandTotal.invoiceCount} invoices</span>
            </div>
            <div className="profitability-report__month-totals">
              <div className="profitability-report__total-item"><span>Revenue:</span><strong>${fmt(monthlyData.grandTotal.revenue)}</strong></div>
              <div className="profitability-report__total-item"><span>Cost:</span><strong>${fmt(monthlyData.grandTotal.cost)}</strong></div>
              <div className="profitability-report__total-item"><span>Profit:</span><strong className={profitClass(monthlyData.grandTotal.profit)}>${fmt(monthlyData.grandTotal.profit)}</strong></div>
              <div className="profitability-report__total-item"><span>Margin:</span><strong className={profitClass(monthlyData.grandTotal.margin)}>{monthlyData.grandTotal.margin.toFixed(2)}%</strong></div>
            </div>
          </div>

          <div className="profitability-report__footer">
            <p>Period: {filters.from} to {filters.to}</p>
            <p>Months: {monthlyData.months.length}</p>
            <p>Total Invoices: {monthlyData.grandTotal.invoiceCount}</p>
          </div>
        </div>
      )}

      {data && !loading && viewMode !== 'by-month' && data.rows.length === 0 && (
        <div className="profitability-report__no-data">No sales data found for the selected period.</div>
      )}
      {viewMode === 'by-month' && !monthlyLoading && monthlyData && monthlyData.months.length === 0 && (
        <div className="profitability-report__no-data">No invoices found for the selected period.</div>
      )}
    </div>
  );
};

export default ProfitabilityReport;