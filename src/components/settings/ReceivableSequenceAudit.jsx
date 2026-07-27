import React, { useCallback, useState } from 'react';
import { axiosClient } from '../api/axiosClient';
import './InvoiceTypeConverter.css';
import './ReceivableSequenceAudit.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReceivableSequenceAudit() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // editing state: { entryId, value, saving, error }
  const [editing, setEditing] = useState({});

  const handleLoad = useCallback(async () => {
    setErr(''); setData(null);
    setLoading(true);
    try {
      const res = await axiosClient.get('/recievables/sequence-audit', { params: { year } });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  const startEdit = (entry) => {
    setEditing(prev => ({
      ...prev,
      [entry.entryId]: { value: entry.jvNumber, saving: false, error: null },
    }));
  };

  const cancelEdit = (entryId) => {
    setEditing(prev => { const n = { ...prev }; delete n[entryId]; return n; });
  };

  const saveEdit = async (entry) => {
    const ed = editing[entry.entryId];
    if (!ed) return;
    const newNum = (ed.value || '').trim();
    if (!newNum) return;

    setEditing(prev => ({ ...prev, [entry.entryId]: { ...prev[entry.entryId], saving: true, error: null } }));
    try {
      await axiosClient.patch(`/recievables/${entry.entryId}/fix-jv-number`, { jvNumber: newNum });
      // refresh
      cancelEdit(entry.entryId);
      await handleLoad();
    } catch (e) {
      setEditing(prev => ({
        ...prev,
        [entry.entryId]: { ...prev[entry.entryId], saving: false, error: e?.response?.data?.message || e.message || 'Save failed.' },
      }));
    }
  };

  const gapCount = data ? data.entries.filter(e => e.isGap).length : 0;
  const outOfOrderCount = data ? data.entries.filter(e => e.seq !== e.expectedSeq).length : 0;

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  return (
    <div className="itc-page rsa-page">
      <div className="itc-header">
        <h1 className="itc-title">Receivable Sequence Audit</h1>
        <p className="itc-subtitle">
          Shows all RV journal voucher numbers in order. Gaps (skipped numbers) are highlighted. You can correct any entry's number directly.
        </p>
      </div>

      <section className="itc-section">
        <div className="itc-section-title">Year</div>
        <div className="itc-filters">
          <div className="itc-field">
            <label>Financial Year</label>
            <select
              className="itc-input"
              value={year}
              onChange={e => setYear(e.target.value)}
            >
              {yearOptions.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <div className="itc-field itc-field-btn">
            <button className="itc-btn itc-btn-primary" onClick={handleLoad} disabled={loading}>
              {loading ? 'Loading…' : '🔍 Load Sequence'}
            </button>
          </div>
        </div>
        {err && <div className="itc-error">{err}</div>}
      </section>

      {data && (
        <section className="itc-section">
          <div className="itc-section-title">
            Sequence for {data.prefix}
            <span className="itc-badge itc-badge-blue">{data.total} entries</span>
            {gapCount > 0 && (
              <span className="itc-badge rsa-badge-gap">{gapCount} gap{gapCount !== 1 ? 's' : ''}</span>
            )}
            {outOfOrderCount === 0 && gapCount === 0 && (
              <span className="itc-badge rsa-badge-ok">✓ Sequence OK</span>
            )}
          </div>

          <div className="itc-table-wrap">
            <table className="itc-table rsa-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>JV Number</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Curr</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Fix</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry, idx) => {
                  const ed = entry.entryId != null ? editing[entry.entryId] : null;
                  const isEditing = !!ed;

                  // Build gap rows before this entry
                  const gapRows = [];
                  if (entry.isGap) {
                    for (let s = entry.expectedSeq; s < entry.seq; s++) {
                      const padded = String(s).padStart(3, '0');
                      gapRows.push(
                        <tr key={`gap-${s}`} className="rsa-gap-row">
                          <td className="rsa-gap-cell" colSpan={9}>
                            <span className="rsa-gap-label">⚠ Missing: {data.prefix}-{padded}</span>
                          </td>
                        </tr>
                      );
                    }
                  }

                  const isWrong = entry.seq !== entry.expectedSeq;
                  const recommendedNum = `${data.prefix}-${String(entry.expectedSeq).padStart(3, '0')}`;

                  return (
                    <React.Fragment key={entry.jvId}>
                      {gapRows}
                      <tr className={isWrong ? 'rsa-wrong-row' : ''}>
                        <td className="rsa-seq">{idx + 1}</td>
                        <td className="itc-inv-num">
                          {isEditing ? (
                            <div className="rsa-edit-cell">
                              <input
                                className="rsa-edit-input"
                                value={ed.value}
                                onChange={e => setEditing(prev => ({
                                  ...prev,
                                  [entry.entryId]: { ...prev[entry.entryId], value: e.target.value },
                                }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveEdit(entry);
                                  if (e.key === 'Escape') cancelEdit(entry.entryId);
                                }}
                                autoFocus
                                placeholder={recommendedNum}
                              />
                              {entry.seq !== entry.expectedSeq && (
                                <button
                                  type="button"
                                  className="rsa-hint-btn"
                                  title={`Apply recommended: ${recommendedNum}`}
                                  onClick={() => setEditing(prev => ({
                                    ...prev,
                                    [entry.entryId]: { ...prev[entry.entryId], value: recommendedNum },
                                  }))}
                                >
                                  → {recommendedNum}
                                </button>
                              )}
                              {ed.error && <div className="rsa-edit-error">{ed.error}</div>}
                            </div>
                          ) : (
                            <span title={isWrong ? `Expected: ${recommendedNum}` : ''}>
                              {entry.jvNumber}
                              {isWrong && (
                                <span className="rsa-wrong-badge" title={`Expected ${recommendedNum}`}>
                                  ⚠
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td>{entry.date ? String(entry.date).slice(0, 10) : '—'}</td>
                        <td>{entry.customerName || <span className="itc-dim">—</span>}</td>
                        <td className="num">{entry.cashNumber != null ? fmt(entry.cashNumber) : '—'}</td>
                        <td>{entry.currency || '—'}</td>
                        <td>
                          <span className={`rsa-type-badge rsa-type-${(entry.type || '').toLowerCase()}`}>
                            {entry.type || '—'}
                          </span>
                        </td>
                        <td>
                          {isWrong ? (
                            <span className="rsa-status-wrong">Wrong — expected {recommendedNum}</span>
                          ) : (
                            <span className="rsa-status-ok">✓</span>
                          )}
                        </td>
                        <td>
                          {entry.entryId != null && (
                            isEditing ? (
                              <div className="rsa-btn-group">
                                <button
                                  className="itc-btn itc-btn-confirm rsa-sm-btn"
                                  disabled={ed.saving}
                                  onClick={() => saveEdit(entry)}
                                >
                                  {ed.saving ? '…' : 'Save'}
                                </button>
                                <button
                                  className="itc-btn itc-btn-danger rsa-sm-btn"
                                  disabled={ed.saving}
                                  onClick={() => cancelEdit(entry.entryId)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                className="itc-btn itc-btn-primary rsa-sm-btn"
                                onClick={() => startEdit(entry)}
                              >
                                Edit
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
