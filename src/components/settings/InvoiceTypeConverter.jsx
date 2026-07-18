import React, { useCallback, useRef, useState } from 'react';
import { axiosClient } from '../api/axiosClient';
import './InvoiceTypeConverter.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); };

export default function InvoiceTypeConverter() {
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate,   setToDate]   = useState(today());
  const [filterType, setFilterType] = useState('S'); // 'S' or 'RVR'

  const [invoices,  setInvoices]  = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [loading,   setLoading]   = useState(false);
  const [searchErr, setSearchErr] = useState('');

  const [converting,   setConverting]   = useState(false);
  const [progress,     setProgress]     = useState(null); // { current, total, invoiceNumber }
  const [result,       setResult]       = useState(null); // { done, total, errors[] }

  const abortRef = useRef(false);

  const targetType = filterType === 'S' ? 'RVR' : 'S';

  const handleSearch = useCallback(async () => {
    setSearchErr(''); setInvoices([]); setSelected(new Set()); setResult(null);
    setLoading(true);
    try {
      const res = await axiosClient.get('/invoices/details', {
        params: { type: filterType, from: fromDate, to: toDate, limit: 500 },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setInvoices(data);
      if (!data.length) setSearchErr(`No ${filterType} invoices found in this date range.`);
    } catch (e) {
      setSearchErr(e?.response?.data?.message || e.message || 'Search failed.');
    } finally { setLoading(false); }
  }, [fromDate, toDate, filterType]);

  const toggleOne = (id) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const toggleAll = () => {
    if (selected.size === invoices.length) setSelected(new Set());
    else setSelected(new Set(invoices.map(i => i.id)));
  };

  const handleConvert = async () => {
    if (!selected.size) return;
    abortRef.current = false;
    setConverting(true); setResult(null);
    const ids = invoices.filter(i => selected.has(i.id)).map(i => i.id);
    const errors = [];
    let done = 0;

    for (let idx = 0; idx < ids.length; idx++) {
      if (abortRef.current) break;
      const inv = invoices.find(i => i.id === ids[idx]);
      setProgress({ current: idx + 1, total: ids.length, invoiceNumber: inv?.invoiceNumber ?? ids[idx] });
      try {
        await axiosClient.patch(`/invoices/${ids[idx]}/convert-type`, { newType: targetType });
        done++;
      } catch (e) {
        errors.push(`${inv?.invoiceNumber ?? ids[idx]}: ${e?.response?.data?.message || e.message}`);
      }
    }

    setResult({ done, total: ids.length, errors });
    setConverting(false); setProgress(null);
    // Remove converted invoices from the list
    setInvoices(prev => prev.filter(i => !selected.has(i.id) || errors.some(e => e.startsWith(i.invoiceNumber))));
    setSelected(new Set());
  };

  const allSelected = invoices.length > 0 && selected.size === invoices.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="itc-page">
      <div className="itc-header">
        <h1 className="itc-title">Invoice Type Converter</h1>
        <p className="itc-subtitle">Convert invoices between type S (Sale) and type RVR, re-applying all accounting and inventory effects.</p>
      </div>

      {/* Filters */}
      <section className="itc-section">
        <div className="itc-section-title">1 · Search</div>
        <div className="itc-filters">
          <div className="itc-field">
            <label>From</label>
            <input className="itc-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="itc-field">
            <label>To</label>
            <input className="itc-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="itc-field">
            <label>Show invoice type</label>
            <div className="itc-type-toggle">
              <button
                className={`itc-type-btn ${filterType === 'S' ? 'active' : ''}`}
                onClick={() => { setFilterType('S'); setInvoices([]); setSelected(new Set()); }}
              >S — Sale</button>
              <button
                className={`itc-type-btn ${filterType === 'RVR' ? 'active' : ''}`}
                onClick={() => { setFilterType('RVR'); setInvoices([]); setSelected(new Set()); }}
              >RVR — Receivable</button>
            </div>
          </div>
          <div className="itc-field itc-field-btn">
            <button className="itc-btn itc-btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching…' : '🔍 Search'}
            </button>
          </div>
        </div>
        {searchErr && <div className="itc-error">{searchErr}</div>}
      </section>

      {/* Invoice table */}
      {invoices.length > 0 && (
        <section className="itc-section">
          <div className="itc-section-title">
            2 · Select Invoices
            <span className="itc-badge itc-badge-blue">{invoices.length} found</span>
            {selected.size > 0 && <span className="itc-badge itc-badge-green">{selected.size} selected</span>}
          </div>

          <div className="itc-table-wrap">
            <table className="itc-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="num">Grand Total</th>
                  <th className="num">Items</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr
                    key={inv.id}
                    className={selected.has(inv.id) ? 'itc-row-selected' : ''}
                    onClick={() => toggleOne(inv.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleOne(inv.id)} />
                    </td>
                    <td className="itc-inv-num">{inv.invoiceNumber}</td>
                    <td>{inv.date}</td>
                    <td>{inv.customer?.name || <span className="itc-dim">—</span>}</td>
                    <td className="num">${fmt(inv.totals?.grandTotal)}</td>
                    <td className="num">{inv.items?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Convert action */}
          <div className="itc-action-row">
            {converting ? (
              <>
                <div className="itc-progress-bar-wrap">
                  <div
                    className="itc-progress-bar"
                    style={{ width: `${Math.round(((progress?.current ?? 0) / (progress?.total ?? 1)) * 100)}%` }}
                  />
                </div>
                <span className="itc-progress-label">
                  Converting {progress?.current}/{progress?.total} — {progress?.invoiceNumber}…
                </span>
                <button className="itc-btn itc-btn-danger" onClick={() => { abortRef.current = true; }}>
                  Stop
                </button>
              </>
            ) : (
              <button
                className="itc-btn itc-btn-confirm"
                disabled={selected.size === 0}
                onClick={handleConvert}
              >
                ⇄ Convert {selected.size} invoice{selected.size !== 1 ? 's' : ''} → {targetType}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Result */}
      {result && (
        <div className={`itc-result ${result.errors.length ? 'itc-result-warn' : 'itc-result-ok'}`}>
          <strong>{result.errors.length === 0 ? '✅ Done!' : '⚠ Completed with errors'}</strong>
          {' '}{result.done} of {result.total} invoices converted to {targetType}.
          {result.errors.length > 0 && (
            <ul className="itc-err-list">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
