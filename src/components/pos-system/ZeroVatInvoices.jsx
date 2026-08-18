import React, { useState } from 'react';
import { axiosClient } from '../api/axiosClient';
import '../settings/RVRBulkRandomizer.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ZeroVatInvoices() {
  const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [toDate,   setToDate]   = useState(() => new Date().toISOString().slice(0, 10));

  const [rows,       setRows]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searching,  setSearching]  = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);
  const [err,        setErr]        = useState('');
  const [searched,   setSearched]   = useState(false);

  const PAGE_SIZE = 200;

  const buildParams = (targetPage) => ({
    from: fromDate || undefined,
    to: toDate || undefined,
    page: targetPage,
    limit: PAGE_SIZE,
  });

  const handleSearch = async () => {
    setErr(''); setSearching(true); setSearched(true);
    try {
      const res = await axiosClient.get('/invoices/v1/zero-vat', { params: buildParams(1) });
      const { data, total: t, totalPages: tp } = res.data;
      setRows(data || []);
      setTotal(t || 0);
      setTotalPages(tp || 1);
      setPage(1);
      if (!data?.length) setErr('No 0% VAT invoices found in this range.');
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const loadMore = async () => {
    if (page >= totalPages) return;
    setLoadingMore(true);
    try {
      const res = await axiosClient.get('/invoices/v1/zero-vat', { params: buildParams(page + 1) });
      const { data } = res.data;
      setRows(prev => [...prev, ...(data || [])]);
      setPage(p => p + 1);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Load more failed.');
    } finally {
      setLoadingMore(false);
    }
  };

  const totalAmount = rows.reduce((s, r) => s + Number(r.grandTotal || 0), 0);

  return (
    <div className="rvr-page">
      <div className="rvr-header">
        <h1 className="rvr-title">0% VAT Invoices</h1>
        <p className="rvr-subtitle">S and RVR invoices recorded with a 0% VAT rate.</p>
      </div>

      {/* STEP 1: Parameters */}
      <section className="rvr-section">
        <div className="rvr-section-title">1 · Parameters</div>
        <div className="rvr-params-grid">
          <div className="rvr-field">
            <label>From Date</label>
            <input className="rvr-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="rvr-field">
            <label>To Date</label>
            <input className="rvr-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="rvr-field rvr-field-btn">
            <button className="rvr-btn rvr-btn-primary" onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
        {err && <div className="rvr-error">{err}</div>}
      </section>

      {/* STEP 2: Results */}
      {searched && rows.length > 0 && (
        <section className="rvr-section">
          <div className="rvr-section-title">
            2 · Results
            <span className="rvr-count-badge">{rows.length} / {total} loaded</span>
            <span className="rvr-count-badge rvr-badge-amber">Total: ${fmt(totalAmount)}</span>
          </div>
          <div className="rvr-table-wrap">
            <table className="rvr-table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Type</th><th>Date</th><th>Customer</th>
                  <th className="num">Subtotal</th><th className="num">VAT</th><th className="num">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="rvr-inv-num">{r.invoiceNumber}</td>
                    <td>{r.invoiceType}</td>
                    <td>{r.date}</td>
                    <td>{r.customerName || '—'}</td>
                    <td className="num">${fmt(r.totalWithoutVAT)}</td>
                    <td className="num">${fmt(r.totalVAT)}</td>
                    <td className="num">${fmt(r.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {page < totalPages && (
            <div className="rvr-generate-row">
              <button className="rvr-btn rvr-btn-outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : `Load More (${total - rows.length} remaining)`}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
