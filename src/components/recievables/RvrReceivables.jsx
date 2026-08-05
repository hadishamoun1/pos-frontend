import React, { useMemo, useState } from 'react';
import { axiosClient } from '../api/axiosClient';
import '../settings/RVRBulkRandomizer.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RvrReceivables() {
  const [fromDate,       setFromDate]       = useState(() => `${new Date().getFullYear()}-01-01`);
  const [toDate,         setToDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [customerFilter, setCustomerFilter] = useState('');
  const [cashNumber,     setCashNumber]     = useState('');

  const [rows,       setRows]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [searching,  setSearching]  = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);
  const [searchErr,  setSearchErr]  = useState('');
  const [searched,   setSearched]   = useState(false);

  // RVR invoices in the same date range, used to match each receivable to the
  // invoice it was collected for (created 1:1, same date, but never FK-linked).
  const [invoices, setInvoices] = useState([]);

  // receivableId -> invoiceId, picked in this session but not yet applied
  const [assignments, setAssignments] = useState(new Map());

  const [linking,       setLinking]       = useState(false);
  const [linkProgress,  setLinkProgress]  = useState(null);
  const [linkResult,    setLinkResult]    = useState(null);

  const PAGE_SIZE = 200;

  const buildParams = (offset) => {
    const params = { limit: PAGE_SIZE, offset, type: 'RVR' };
    if (fromDate) params.dateFrom = fromDate;
    if (toDate) params.dateTo = toDate;
    if (customerFilter.trim()) params.customer = customerFilter.trim();
    if (cashNumber.trim()) params.cashNumber = cashNumber.trim();
    return params;
  };

  const fetchInvoices = async () => {
    try {
      const res = await axiosClient.get('/invoices/details', {
        params: { type: 'RVR', from: fromDate, to: toDate, limit: 500 },
      });
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch {
      setInvoices([]);
    }
  };

  const handleSearch = async () => {
    setSearchErr(''); setSearching(true); setSearched(true);
    setAssignments(new Map()); setLinkResult(null);
    try {
      const [recRes] = await Promise.all([
        axiosClient.get('/recievables/v1/summary', { params: buildParams(0) }),
        fetchInvoices(),
      ]);
      const { data, total: serverTotal } = recRes.data;
      setRows(data || []);
      setTotal(serverTotal || 0);
      setNextOffset(PAGE_SIZE);
      if (!data?.length) setSearchErr('No RVR receivables found in this range.');
    } catch (e) {
      setSearchErr(e?.response?.data?.message || e.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await axiosClient.get('/recievables/v1/summary', { params: buildParams(nextOffset) });
      const { data } = res.data;
      setRows((prev) => [...prev, ...(data || [])]);
      setNextOffset((prev) => prev + PAGE_SIZE);
    } catch (e) {
      setSearchErr(e?.response?.data?.message || e.message || 'Load more failed.');
    } finally {
      setLoadingMore(false);
    }
  };

  // date (YYYY-MM-DD) -> invoices on that date
  const invoicesByDate = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      const d = String(inv.date).slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(inv);
    }
    return map;
  }, [invoices]);

  // invoice IDs already spoken for — either already linked on another receivable
  // (from the DB) or picked in this session for another row.
  const usedInvoiceIds = useMemo(() => {
    const set = new Set();
    for (const r of rows) if (r.invoiceId) set.add(r.invoiceId);
    for (const invId of assignments.values()) set.add(invId);
    return set;
  }, [rows, assignments]);

  const candidatesFor = (row) => {
    const d = String(row.date).slice(0, 10);
    const all = invoicesByDate.get(d) || [];
    const picked = assignments.get(row.id);
    return all.filter((inv) => inv.id === picked || !usedInvoiceIds.has(inv.id));
  };

  const setAssignment = (receivableId, invoiceId) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      if (invoiceId) next.set(receivableId, Number(invoiceId));
      else next.delete(receivableId);
      return next;
    });
  };

  const handleApplyLinks = async () => {
    const targets = rows.filter((r) => assignments.has(r.id));
    if (!targets.length) return;

    setLinking(true); setLinkResult(null);
    const errors = [];
    let done = 0;
    for (const r of targets) {
      setLinkProgress({ current: done + 1, total: targets.length, cashNumber: r.cashNumber });
      try {
        await axiosClient.patch(`/recievables/${r.id}/link-invoice`, {
          invoiceId: assignments.get(r.id),
        });
        done++;
      } catch (e) {
        errors.push(`Cash #${r.cashNumber}: ${e?.response?.data?.message || e.message}`);
        done++;
      }
    }
    setLinking(false);
    setLinkProgress(null);
    setLinkResult({ done, total: targets.length, errors });
    setAssignments(new Map());
    // refresh so amounts/links reflect what actually got saved
    handleSearch();
  };

  const totalAmount = rows.reduce((s, r) => s + Number(r.amountExchanged || 0), 0);
  const pendingCount = [...assignments.keys()].length;

  return (
    <div className="rvr-page">
      <div className="rvr-header">
        <h1 className="rvr-title">RVR Receivables</h1>
        <p className="rvr-subtitle">Browse receipt entries collected against RVR invoices.</p>
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
          <div className="rvr-field">
            <label>Customer</label>
            <input className="rvr-input" type="text" value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} placeholder="Customer name…" />
          </div>
          <div className="rvr-field">
            <label>Cash Number</label>
            <input className="rvr-input" type="text" value={cashNumber} onChange={e => setCashNumber(e.target.value)} placeholder="Cash number…" />
          </div>
          <div className="rvr-field rvr-field-btn">
            <button className="rvr-btn rvr-btn-primary" onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching…' : 'Search RVR Receivables'}
            </button>
          </div>
        </div>
        {searchErr && <div className="rvr-error">{searchErr}</div>}
      </section>

      {/* STEP 2: Results */}
      {searched && rows.length > 0 && (
        <section className="rvr-section">
          <div className="rvr-section-title">
            2 · Results
            <span className="rvr-count-badge">{rows.length} / {total} loaded</span>
            <span className="rvr-count-badge rvr-badge-green">Total: ${fmt(totalAmount)}</span>
          </div>
          <div className="rvr-table-wrap">
            <table className="rvr-table">
              <thead>
                <tr>
                  <th>Cash #</th><th>Date</th><th>Customer</th>
                  <th className="num">Amount</th><th>Currency</th>
                  <th>Payment Type</th><th>JV Number</th>
                  <th>Invoice</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const linkedInvoice = r.invoiceId ? invoices.find(i => i.id === r.invoiceId) : null;
                  const candidates = r.invoiceId ? [] : candidatesFor(r);
                  const noMatch = !r.invoiceId && (invoicesByDate.get(String(r.date).slice(0, 10)) || []).length === 0;

                  return (
                    <tr key={r.id}>
                      <td className="rvr-inv-num">{r.cashNumber}</td>
                      <td>{r.date}</td>
                      <td>{r.customerName || '—'}</td>
                      <td className="num">${fmt(r.amountExchanged)}</td>
                      <td>{r.currency}</td>
                      <td>{r.pmtType}</td>
                      <td>{r.jvNumber}</td>
                      <td>
                        {r.invoiceId ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            ✓ {linkedInvoice?.invoiceNumber || `#${r.invoiceId}`}
                            {linkedInvoice && ` ($${fmt(linkedInvoice.totals?.grandTotal)})`}
                          </span>
                        ) : noMatch ? (
                          <span style={{ color: '#dc2626', fontSize: 12 }}>⚠ No RVR invoice found for this date</span>
                        ) : (
                          <select
                            className="rvr-filter-select"
                            value={assignments.get(r.id) || ''}
                            onChange={e => setAssignment(r.id, e.target.value)}
                          >
                            <option value="">— select invoice —</option>
                            {candidates.map(inv => (
                              <option key={inv.id} value={inv.id}>
                                {inv.invoiceNumber} (${fmt(inv.totals?.grandTotal)})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{r.comments}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rvr-generate-row">
            {rows.length < total && (
              <button className="rvr-btn rvr-btn-outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : `Load More (${total - rows.length} remaining)`}
              </button>
            )}
            <button
              className="rvr-btn rvr-btn-confirm"
              onClick={handleApplyLinks}
              disabled={linking || pendingCount === 0}
            >
              {linking
                ? (linkProgress ? `Linking ${linkProgress.current}/${linkProgress.total} — Cash #${linkProgress.cashNumber}…` : 'Linking…')
                : `🔗 Apply Invoice Links (${pendingCount})`}
            </button>
          </div>
          {linkResult && (
            <div className={`rvr-result ${linkResult.errors.length ? 'rvr-result-warn' : 'rvr-result-ok'}`}>
              <strong>{linkResult.errors.length === 0 ? '✅ All done!' : '⚠ Completed with errors'}</strong>
              <span> — {linkResult.done} of {linkResult.total} receivables linked.</span>
              {linkResult.errors.length > 0 && (
                <ul className="rvr-error-list">
                  {linkResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
