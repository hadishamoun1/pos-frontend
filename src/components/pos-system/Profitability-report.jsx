// src/components/reports/ProfitabilityReport.jsx
import React, { useState, useEffect } from 'react';
import { axiosClient } from '../api/axiosClient';
import './Profitability-report.css';

const ProfitabilityReport = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [viewMode, setViewMode] = useState('detailed'); // 'detailed' or 'by-customer' or 'by-item'
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());
  const [expandedItems, setExpandedItems] = useState(new Set());
  
  // ✅ Filters
  const now = new Date();
  const currentYear = now.getFullYear();
  const [filters, setFilters] = useState({
    from: `${currentYear}-01-01`,
    to: now.toISOString().slice(0, 10),
    customerId: '',
    invoiceType: 'ALL',
  });

  // ✅ Load customers for filter dropdown
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

  // ✅ Load report
  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.customerId) params.append('customerId', filters.customerId);
      if (filters.invoiceType) params.append('invoiceType', filters.invoiceType);

      const res = await axiosClient.get(`/reports/profitability?${params}`);
      setData(res?.data || null);
    } catch (err) {
      console.error('Error loading profitability report:', err);
      alert('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadReport();
  }, []);

  // ✅ Filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Apply filters
  const handleApplyFilters = () => {
    loadReport();
  };

  // ✅ Toggle customer expansion
  const toggleCustomer = (customerId) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  // ✅ Toggle item expansion
  const toggleItem = (itemVariantId) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemVariantId)) {
        next.delete(itemVariantId);
      } else {
        next.add(itemVariantId);
      }
      return next;
    });
  };

  // ✅ Export to Excel
  const handleExport = () => {
    if (!data?.rows?.length) {
      alert('No data to export');
      return;
    }

    // Create CSV content
    const headers = [
      'Invoice #',
      'Date',
      'Type',
      'Customer',
      'Item',
      'Description',
      'Thickness',
      'Dimensions',
      'Origin',
      'Quantity',
      'SQM',
      'Unit Price',
      'Revenue',
      'Cost',
      'Profit',
      'Margin %',
    ];

    const rows = data.rows.map((r) => [
      r.invoiceNumber,
      r.invoiceDate,
      r.invoiceType,
      r.customerName,
      r.itemName,
      r.fullDescription,
      r.thickness ?? '',
      r.dimensions,
      r.origin,
      r.quantity,
      r.sqm,
      r.unitPrice.toFixed(2),
      r.revenue.toFixed(2),
      r.cost.toFixed(2),
      r.profit.toFixed(2),
      r.margin.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      '',
      'TOTALS',
      `,,,,,,,,,,,"${data.totals.revenue.toFixed(2)}","${data.totals.cost.toFixed(2)}","${data.totals.profit.toFixed(2)}","${data.totals.margin.toFixed(2)}"`,
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profitability-report-${filters.from}-${filters.to}.csv`;
    link.click();
  };

  // ✅ Format currency
  const fmt = (num) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="profitability-report">
      <h1 className="profitability-report__title">Profitability Report</h1>

      {/* ✅ Filters */}
      <div className="profitability-report__filters">
        <div className="profitability-report__filter-row">
          <label className="profitability-report__filter-label">
            From:
            <input
              type="date"
              name="from"
              value={filters.from}
              onChange={handleFilterChange}
              className="profitability-report__filter-input"
            />
          </label>

          <label className="profitability-report__filter-label">
            To:
            <input
              type="date"
              name="to"
              value={filters.to}
              onChange={handleFilterChange}
              className="profitability-report__filter-input"
            />
          </label>

          <label className="profitability-report__filter-label">
            Customer:
            <select
              name="customerId"
              value={filters.customerId}
              onChange={handleFilterChange}
              className="profitability-report__filter-select"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerName}
                </option>
              ))}
            </select>
          </label>

          <label className="profitability-report__filter-label">
            Type:
            <select
              name="invoiceType"
              value={filters.invoiceType}
              onChange={handleFilterChange}
              className="profitability-report__filter-select"
            >
              <option value="ALL">All Types</option>
              <option value="S">Sales (S)</option>
              <option value="G">Glass (G)</option>
              <option value="RVR">RVR</option>
              <option value="RTN">Returns (RTN)</option>
            </select>
          </label>

          <button onClick={handleApplyFilters} className="profitability-report__btn-apply">
            Apply Filters
          </button>

          <button onClick={handleExport} className="profitability-report__btn-export">
            📊 Export to Excel
          </button>
        </div>

        {/* ✅ View Mode Toggle */}
        <div className="profitability-report__view-toggle">
          <button
            className={`profitability-report__view-btn ${viewMode === 'detailed' ? 'profitability-report__view-btn--active' : ''}`}
            onClick={() => setViewMode('detailed')}
          >
            📋 Detailed View
          </button>
          <button
            className={`profitability-report__view-btn ${viewMode === 'by-customer' ? 'profitability-report__view-btn--active' : ''}`}
            onClick={() => setViewMode('by-customer')}
          >
            👥 By Customer
          </button>
          <button
            className={`profitability-report__view-btn ${viewMode === 'by-item' ? 'profitability-report__view-btn--active' : ''}`}
            onClick={() => setViewMode('by-item')}
          >
            📦 By Item
          </button>
        </div>
      </div>

      {/* ✅ Loading */}
      {loading && <div className="profitability-report__loading">Loading report...</div>}

      {/* ✅ Summary Cards */}
      {data && !loading && (
        <>
          <div className="profitability-report__summary-cards">
            <div className="profitability-report__summary-card profitability-report__summary-card--revenue">
              <h3 className="profitability-report__summary-title">Total Revenue</h3>
              <div className="profitability-report__summary-value">${fmt(data.totals.revenue)}</div>
            </div>

            <div className="profitability-report__summary-card profitability-report__summary-card--cost">
              <h3 className="profitability-report__summary-title">Total Cost</h3>
              <div className="profitability-report__summary-value">${fmt(data.totals.cost)}</div>
            </div>

            <div className="profitability-report__summary-card profitability-report__summary-card--profit">
              <h3 className="profitability-report__summary-title">Total Profit</h3>
              <div className={`profitability-report__summary-value ${data.totals.profit < 0 ? 'profitability-report__summary-value--negative' : 'profitability-report__summary-value--positive'}`}>
                ${fmt(data.totals.profit)}
              </div>
            </div>

            <div className="profitability-report__summary-card profitability-report__summary-card--margin">
              <h3 className="profitability-report__summary-title">Overall Margin</h3>
              <div className={`profitability-report__summary-value ${data.totals.margin < 0 ? 'profitability-report__summary-value--negative' : 'profitability-report__summary-value--positive'}`}>
                {data.totals.margin.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* ✅ DETAILED VIEW */}
          {viewMode === 'detailed' && (
            <div className="profitability-report__table-container">
              <table className="profitability-report__table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Customer</th>
                    <th>Item</th>
                    <th>Description</th>
                    <th>Thickness</th>
                    <th>Dimensions</th>
                    <th>Origin</th>
                    <th>Qty</th>
                    <th>SQM</th>
                    <th>Unit Price</th>
                    <th>Revenue</th>
                    <th>Cost</th>
                    <th>Profit</th>
                    <th>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, idx) => (
                    <tr key={idx} className={row.invoiceType === 'RTN' ? 'profitability-report__table-row--return' : ''}>
                      <td>{row.invoiceNumber}</td>
                      <td>{row.invoiceDate}</td>
                      <td>
                        <span className={`profitability-report__type-badge profitability-report__type-badge--${row.invoiceType}`}>
                          {row.invoiceType}
                        </span>
                      </td>
                      <td>{row.customerName}</td>
                      <td>{row.itemName}</td>
                      <td className="profitability-report__description-cell">{row.fullDescription}</td>
                      <td>{row.thickness ? row.thickness.toFixed(1) : '-'}</td>
                      <td>{row.dimensions || '-'}</td>
                      <td>{row.origin}</td>
                      <td>{row.quantity}</td>
                      <td>{row.sqm.toFixed(2)}</td>
                      <td>${fmt(row.unitPrice)}</td>
                      <td className="profitability-report__amount">${fmt(row.revenue)}</td>
                      <td className="profitability-report__amount">${fmt(row.cost)}</td>
                      <td className={`profitability-report__amount ${row.profit < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive'}`}>
                        ${fmt(row.profit)}
                      </td>
                      <td className={row.margin < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive'}>
                        {row.margin.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="profitability-report__totals-row">
                    <td colSpan="12">
                      <strong>TOTALS</strong>
                    </td>
                    <td className="profitability-report__amount">
                      <strong>${fmt(data.totals.revenue)}</strong>
                    </td>
                    <td className="profitability-report__amount">
                      <strong>${fmt(data.totals.cost)}</strong>
                    </td>
                    <td className={`profitability-report__amount ${data.totals.profit < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive'}`}>
                      <strong>${fmt(data.totals.profit)}</strong>
                    </td>
                    <td className={data.totals.margin < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive'}>
                      <strong>{data.totals.margin.toFixed(2)}%</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ✅ BY CUSTOMER VIEW */}
          {viewMode === 'by-customer' && data.customerSummary && (
            <div className="profitability-report__customer-grouping">
              {data.customerSummary.map((customer) => (
                <div key={customer.customerId} className="profitability-report__customer-group">
                  <div
                    className="profitability-report__customer-header"
                    onClick={() => toggleCustomer(customer.customerId)}
                  >
                    <div className="profitability-report__customer-info">
                      <span className="profitability-report__expand-icon">
                        {expandedCustomers.has(customer.customerId) ? '▼' : '▶'}
                      </span>
                      <h3 className="profitability-report__customer-name">{customer.customerName || 'Unknown Customer'}</h3>
                      <span className="profitability-report__item-count">({customer.itemCount} items)</span>
                    </div>
                    <div className="profitability-report__customer-totals">
                      <div className="profitability-report__total-item">
                        <span>Revenue:</span>
                        <strong>${fmt(customer.revenue)}</strong>
                      </div>
                      <div className="profitability-report__total-item">
                        <span>Cost:</span>
                        <strong>${fmt(customer.cost)}</strong>
                      </div>
                      <div className="profitability-report__total-item">
                        <span>Profit:</span>
                        <strong className={customer.profit < 0 ? 'profitability-report__total-item--negative' : 'profitability-report__total-item--positive'}>
                          ${fmt(customer.profit)}
                        </strong>
                      </div>
                      <div className="profitability-report__total-item">
                        <span>Margin:</span>
                        <strong className={customer.margin < 0 ? 'profitability-report__total-item--negative' : 'profitability-report__total-item--positive'}>
                          {customer.margin.toFixed(2)}%
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* ✅ Expanded Items */}
                  {expandedCustomers.has(customer.customerId) && (
                    <div className="profitability-report__customer-items">
                      <table className="profitability-report__items-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Description</th>
                            <th>Thickness</th>
                            <th>Dimensions</th>
                            <th>Origin</th>
                            <th>Qty</th>
                            <th>SQM</th>
                            <th>Revenue</th>
                            <th>Cost</th>
                            <th>Profit</th>
                            <th>Margin %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customer.items.map((item) => (
                            <tr key={item.itemVariantId}>
                              <td>{item.itemName}</td>
                              <td className="profitability-report__description-cell">{item.fullDescription}</td>
                              <td>{item.thickness ? item.thickness.toFixed(1) : '-'}</td>
                              <td>{item.dimensions || '-'}</td>
                              <td>{item.origin}</td>
                              <td>{item.quantity.toFixed(2)}</td>
                              <td>{item.sqm.toFixed(2)}</td>
                              <td className="profitability-report__amount">${fmt(item.revenue)}</td>
                              <td className="profitability-report__amount">${fmt(item.cost)}</td>
                              <td className={`profitability-report__amount ${item.profit < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive'}`}>
                                ${fmt(item.profit)}
                              </td>
                              <td className={item.margin < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive'}>
                                {item.margin.toFixed(2)}%
                              </td>
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

          {/* ✅ BY ITEM VIEW */}
          {viewMode === 'by-item' && data.itemSummary && (
            <div className="profitability-report__item-grouping">
              {data.itemSummary.map((item) => (
                <div key={item.itemVariantId} className="profitability-report__item-group">
                  <div
                    className="profitability-report__item-header"
                    onClick={() => toggleItem(item.itemVariantId)}
                  >
                    <div className="profitability-report__item-info">
                      <span className="profitability-report__expand-icon">
                        {expandedItems.has(item.itemVariantId) ? '▼' : '▶'}
                      </span>
                      <div className="profitability-report__item-details">
                        <h3 className="profitability-report__item-name">{item.itemName}</h3>
                        <div className="profitability-report__item-meta">
                          {item.fullDescription && (
                            <span className="profitability-report__item-description">{item.fullDescription}</span>
                          )}
                          {item.thickness && (
                            <span className="profitability-report__item-thickness">
                              {item.thickness.toFixed(1)}mm
                            </span>
                          )}
                          {item.dimensions && (
                            <span className="profitability-report__item-dimensions">{item.dimensions}</span>
                          )}
                          {item.origin && (
                            <span className="profitability-report__item-origin">{item.origin}</span>
                          )}
                        </div>
                        <div className="profitability-report__item-stats">
                          <span>{item.customerCount} customers</span>
                          <span>•</span>
                          <span>{item.invoiceCount} invoices</span>
                          <span>•</span>
                          <span>{item.quantity.toFixed(2)} qty</span>
                          <span>•</span>
                          <span>{item.sqm.toFixed(2)} sqm</span>
                        </div>
                      </div>
                    </div>
                    <div className="profitability-report__item-totals">
                      <div className="profitability-report__total-item">
                        <span>Revenue:</span>
                        <strong>${fmt(item.revenue)}</strong>
                      </div>
                      <div className="profitability-report__total-item">
                        <span>Cost:</span>
                        <strong>${fmt(item.cost)}</strong>
                      </div>
                      <div className="profitability-report__total-item">
                        <span>Profit:</span>
                        <strong className={item.profit < 0 ? 'profitability-report__total-item--negative' : 'profitability-report__total-item--positive'}>
                          ${fmt(item.profit)}
                        </strong>
                      </div>
                      <div className="profitability-report__total-item">
                        <span>Margin:</span>
                        <strong className={item.margin < 0 ? 'profitability-report__total-item--negative' : 'profitability-report__total-item--positive'}>
                          {item.margin.toFixed(2)}%
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* ✅ Expanded Customers who bought this item */}
                  {expandedItems.has(item.itemVariantId) && (
                    <div className="profitability-report__item-customers">
                      <h4 className="profitability-report__customers-title">Customers who bought this item:</h4>
                      <table className="profitability-report__customers-table">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Qty</th>
                            <th>SQM</th>
                            <th>Revenue</th>
                            <th>Cost</th>
                            <th>Profit</th>
                            <th>Margin %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.customers.map((cust) => (
                            <tr key={cust.customerId}>
                              <td>{cust.customerName}</td>
                              <td>{cust.quantity.toFixed(2)}</td>
                              <td>{cust.sqm.toFixed(2)}</td>
                              <td className="profitability-report__amount">${fmt(cust.revenue)}</td>
                              <td className="profitability-report__amount">${fmt(cust.cost)}</td>
                              <td className={`profitability-report__amount ${cust.profit < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive'}`}>
                                ${fmt(cust.profit)}
                              </td>
                              <td className={cust.margin < 0 ? 'profitability-report__amount--negative' : 'profitability-report__amount--positive'}>
                                {cust.margin.toFixed(2)}%
                              </td>
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

          <div className="profitability-report__footer">
            <p>Total Items: {data.count}</p>
            <p>
              Period: {filters.from} to {filters.to}
            </p>
          </div>
        </>
      )}

      {/* ✅ No Data */}
      {data && !loading && data.rows.length === 0 && (
        <div className="profitability-report__no-data">No sales data found for the selected period.</div>
      )}
    </div>
  );
};

export default ProfitabilityReport;