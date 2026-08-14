import React, { useEffect, useState } from 'react';
import { axiosClient } from '../api/axiosClient';
import '../settings/RVRBulkRandomizer.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WarehouseStockPanel() {
  const [mode, setMode] = useState('empty'); // 'empty' | 'all'
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [q, setQ] = useState('');

  const [warehouses, setWarehouses] = useState([]);
  const [rows,       setRows]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);
  const [err,        setErr]        = useState('');
  const [savingId,   setSavingId]   = useState(null);

  const PAGE_SIZE = 200;

  useEffect(() => {
    axiosClient.get('/warehouses')
      .then(res => setWarehouses(Array.isArray(res.data) ? res.data : []))
      .catch(() => setWarehouses([]));
  }, []);

  const buildParams = (targetPage) => {
    const params = { page: targetPage, limit: PAGE_SIZE };
    if (mode === 'empty') params.emptyOnly = 'true';
    else if (warehouseFilter) params.warehouse = warehouseFilter;
    if (q.trim()) params.q = q.trim();
    return params;
  };

  const runSearch = async () => {
    setErr(''); setLoading(true);
    try {
      const res = await axiosClient.get('/warehouses/v1/stock-panel', { params: buildParams(1) });
      const { data, total: t, totalPages: tp } = res.data;
      setRows(data || []);
      setTotal(t || 0);
      setTotalPages(tp || 1);
      setPage(1);
      if (!data?.length) setErr(mode === 'empty' ? 'No batches without a warehouse found.' : 'No stock found.');
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  // Re-run whenever the mode or warehouse filter changes; text search still needs the button/Enter.
  useEffect(() => { runSearch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode, warehouseFilter]);

  const loadMore = async () => {
    if (page >= totalPages) return;
    setLoadingMore(true);
    try {
      const res = await axiosClient.get('/warehouses/v1/stock-panel', { params: buildParams(page + 1) });
      const { data, page: p } = res.data;
      setRows(prev => [...prev, ...(data || [])]);
      setPage(p || page + 1);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Load more failed.');
    } finally {
      setLoadingMore(false);
    }
  };

  const changeWarehouse = async (batchId, newWarehouse) => {
    setSavingId(batchId);
    try {
      await axiosClient.patch(`/warehouses/v1/batches/${batchId}/warehouse`, { warehouse: newWarehouse || null });
      setRows(prev => {
        // in "empty" mode the row no longer belongs once it has a warehouse — drop it;
        // in "all" mode with a specific warehouse filter, drop it if it no longer matches.
        if (mode === 'empty') return prev.filter(r => r.batchId !== batchId);
        if (warehouseFilter && newWarehouse !== warehouseFilter) return prev.filter(r => r.batchId !== batchId);
        return prev.map(r => r.batchId === batchId ? { ...r, warehouse: newWarehouse || null } : r);
      });
      setTotal(t => Math.max(0, t - (mode === 'empty' || (warehouseFilter && newWarehouse !== warehouseFilter) ? 1 : 0)));
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Failed to update warehouse.');
    } finally {
      setSavingId(null);
    }
  };

  const dimsLabel = (r) => {
    if (r.length > 0 && r.width > 0) {
      return r.type === 'box'
        ? `${r.length}×${r.width}-${String(r.sheetsPerBox || 0).padStart(3, '0')}`
        : `${r.length}×${r.width}`;
    }
    return r.length > 0 ? String(r.length) : '';
  };

  const qtyLabel = (r) => {
    const isSqmBased = r.type === 'box' || r.type === 'sheet';
    return isSqmBased ? `${fmt(r.balanceOFR)} sqm` : fmt(r.balance);
  };

  return (
    <div className="rvr-page">
      <div className="rvr-header">
        <h1 className="rvr-title">Warehouse Stock</h1>
        <p className="rvr-subtitle">Find stock sitting with no warehouse assigned, or browse all stock by warehouse — and reassign it.</p>
      </div>

      {/* STEP 1: Parameters */}
      <section className="rvr-section">
        <div className="rvr-section-title">1 · Parameters</div>
        <div className="rvr-params-grid">
          <div className="rvr-field">
            <label>View</label>
            <select className="rvr-input" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="empty">Items with empty warehouse</option>
              <option value="all">All items by warehouse</option>
            </select>
          </div>
          {mode === 'all' && (
            <div className="rvr-field">
              <label>Warehouse</label>
              <select className="rvr-input" value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}>
                <option value="">All warehouses</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.name}>{w.name}{w.isHome ? ' (home)' : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="rvr-field">
            <label>Search Item</label>
            <input
              className="rvr-input" type="text" value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
              placeholder="Item name…"
            />
          </div>
          <div className="rvr-field rvr-field-btn">
            <button className="rvr-btn rvr-btn-primary" onClick={runSearch} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
        {err && <div className="rvr-error">{err}</div>}
      </section>

      {/* STEP 2: Results */}
      {rows.length > 0 && (
        <section className="rvr-section">
          <div className="rvr-section-title">
            2 · Results
            <span className="rvr-count-badge">{rows.length} / {total} loaded</span>
          </div>
          <div className="rvr-table-wrap">
            <table className="rvr-table">
              <thead>
                <tr>
                  <th>Item</th><th>Thickness</th><th>Dimensions</th><th>Origin</th>
                  <th>Condition</th><th>Date Rcvd</th>
                  <th className="num">Qty</th>
                  <th>Warehouse</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.batchId}>
                    <td dir="rtl">{r.itemName || '—'}</td>
                    <td>{r.type !== 'unit' && r.thickness ? `${parseFloat(String(r.thickness))} ملم` : '—'}</td>
                    <td className="rvr-dims-cell">{dimsLabel(r)}</td>
                    <td>{r.origin}</td>
                    <td>{r.condition}</td>
                    <td>{r.dateReceived}</td>
                    <td className="num">{qtyLabel(r)}</td>
                    <td>
                      <select
                        className="rvr-filter-select"
                        value={r.warehouse || ''}
                        disabled={savingId === r.batchId}
                        onChange={e => changeWarehouse(r.batchId, e.target.value)}
                      >
                        <option value="">— unassigned —</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.name}>{w.name}{w.isHome ? ' (home)' : ''}</option>
                        ))}
                      </select>
                      {savingId === r.batchId && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.6 }}>saving…</span>}
                    </td>
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
