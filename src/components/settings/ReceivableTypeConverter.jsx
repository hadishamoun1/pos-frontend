import React, { useCallback, useRef, useState } from 'react';
import { axiosClient } from '../api/axiosClient';
import './InvoiceTypeConverter.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); };

export default function ReceivableTypeConverter() {
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate,   setToDate]   = useState(today());
  const [filterType, setFilterType] = useState('S'); // 'S' or 'RVR'

  const [entries,  setEntries]  = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading,  setLoading]  = useState(false);
  const [searchErr, setSearchErr] = useState('');

  const [converting,   setConverting]   = useState(false);
  const [progress,     setProgress]     = useState(null);
  const [result,       setResult]       = useState(null);

  const abortRef = useRef(false);

  const targetType = filterType === 'S' ? 'RVR' : 'S';

  const handleSearch = useCallback(async () => {
    setSearchErr(''); setEntries([]); setSelected(new Set()); setResult(null);
    setLoading(true);
    try {
      const res = await axiosClient.get('/recievables/filtered', {
        params: { type: filterType, from: fromDate, to: toDate, limit: 500 },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setEntries(data);
      if (!data.length) setSearchErr(`No type-${filterType} receivables found in this date range.`);
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
    if (selected.size === entries.length) setSelected(new Set());
    else setSelected(new Set(entries.map(e => e.id)));
  };

  const handleConvert = async () => {
    if (!selected.size) return;
    abortRef.current = false;
    setConverting(true); setResult(null);
    const ids = entries.filter(e => selected.has(e.id)).map(e => e.id);
    const errors = [];
    let done = 0;

    for (let idx = 0; idx < ids.length; idx++) {
      if (abortRef.current) break;
      const entry = entries.find(e => e.id === ids[idx]);
      setProgress({ current: idx + 1, total: ids.length, jvNumber: entry?.jvNumber ?? ids[idx] });
      try {
        await axiosClient.patch(`/recievables/${ids[idx]}/convert-type`, { newType: targetType });
        done++;
      } catch (e) {
        errors.push(`${entry?.jvNumber ?? ids[idx]}: ${e?.response?.data?.message || e.message}`);
      }
    }

    setResult({ done, total: ids.length, errors });
    setConverting(false); setProgress(null);
    setEntries(prev => prev.filter(e => !selected.has(e.id) || errors.some(err => err.startsWith(e.jvNumber))));
    setSelected(new Set());
  };

  const allSelected = entries.length > 0 && selected.size === entries.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="itc-page">
      <div className="itc-header">
        <h1 className="itc-title">Receivable Type Converter</h1>
        <p className="itc-subtitle">
          Convert receivables between type S (with off-record) and type RVR (official only), re-applying all accounting effects.
        </p>
      </div>

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
            <label>Show receivable type</label>
            <div className="itc-type-toggle">
              <button
                className={`itc-type-btn ${filterType === 'S' ? 'active' : ''}`}
                onClick={() => { setFilterType('S'); setEntries([]); setSelected(new Set()); }}
              >S — Sale (with OFR)</button>
              <button
                className={`itc-type-btn ${filterType === 'RVR' ? 'active' : ''}`}
                onClick={() => { setFilterType('RVR'); setEntries([]); setSelected(new Set()); }}
              >RVR — Official only</button>
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

      {entries.length > 0 && (
        <section className="itc-section">
          <div className="itc-section-title">
            2 · Select Receivables
            <span className="itc-badge itc-badge-blue">{entries.length} found</span>
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
                  <th>JV #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Currency</th>
                  <th>Pmt</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr
                    key={entry.id}
                    className={selected.has(entry.id) ? 'itc-row-selected' : ''}
                    onClick={() => toggleOne(entry.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleOne(entry.id)} />
                    </td>
                    <td className="itc-inv-num">{entry.jvNumber}</td>
                    <td>{entry.date ? String(entry.date).slice(0, 10) : ''}</td>
                    <td>{entry.customerName || <span className="itc-dim">—</span>}</td>
                    <td className="num">{fmt(entry.cashNumber)}</td>
                    <td>{entry.currency}</td>
                    <td>{entry.pmtType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                  Converting {progress?.current}/{progress?.total} — {progress?.jvNumber}…
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
                ⇄ Convert {selected.size} receivable{selected.size !== 1 ? 's' : ''} → {targetType}
              </button>
            )}
          </div>
        </section>
      )}

      {result && (
        <div className={`itc-result ${result.errors.length ? 'itc-result-warn' : 'itc-result-ok'}`}>
          <strong>{result.errors.length === 0 ? '✅ Done!' : '⚠ Completed with errors'}</strong>
          {' '}{result.done} of {result.total} receivables converted to {targetType}.
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
