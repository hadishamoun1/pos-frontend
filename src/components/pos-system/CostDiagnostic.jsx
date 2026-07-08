import React, { useState, useCallback } from 'react';
import { axiosClient } from '../api/axiosClient';
import './CostDiagnostic.css';

const now = new Date();
const DEFAULT_FROM = `${now.getFullYear()}-01-01`;
const DEFAULT_TO   = now.toISOString().slice(0, 10);

const CAUSE_CONFIG = {
  no_purchases:          { label: 'No Purchases',           color: 'red',    priority: 1 },
  no_received_purchases: { label: 'Not Received',           color: 'red',    priority: 2 },
  sold_before_purchased: { label: 'Sold Before Purchase',   color: 'orange', priority: 3 },
  unit_item_cost_zero:   { label: 'Unit Item — Zero Cost',  color: 'amber',  priority: 4 },
  all_ofr_missing:       { label: 'OFR Price Missing',      color: 'amber',  priority: 5 },
  partial_ofr_missing:   { label: 'Partial OFR Missing',    color: 'amber',  priority: 6 },
  unknown:               { label: 'Unexpected',             color: 'purple', priority: 7 },
};

const fmt2  = (n) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD  = (s) => s ? new Date(s).toLocaleDateString('en-GB') : '—';
const fmtDR = (s) => s ? s.toString().slice(0, 10) : '—';

export default function CostDiagnostic() {
  const [from, setFrom]       = useState(DEFAULT_FROM);
  const [to, setTo]           = useState(DEFAULT_TO);
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [filterCause, setFilterCause] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setData(null);
    setExpanded(new Set());
    try {
      const res = await axiosClient.get(
        `/reports/cost-diagnostic?from=${from}&to=${to}`
      );
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load diagnostic data');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const toggleRow = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Summary counts by cause
  const causeSummary = data
    ? Object.entries(CAUSE_CONFIG).map(([key, cfg]) => ({
        key,
        ...cfg,
        count: data.items.filter((i) => i.cause === key).length,
      })).filter((c) => c.count > 0)
    : [];

  const visibleItems = data
    ? (filterCause === 'ALL'
        ? data.items
        : data.items.filter((i) => i.cause === filterCause))
    : [];

  const isUnit = (item) =>
    item.itemType === 'unit' || item.stockMode === 'QTY' || item.stockMode === 'unit';

  return (
    <div className="cd">
      {/* ── Header ── */}
      <div className="cd-header">
        <h1 className="cd-title">Zero-Cost Diagnostic</h1>
        <p className="cd-subtitle">
          Identifies items sold with <strong>averageCost = 0</strong> and explains why
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="cd-filters">
        <div className="cd-filter-group">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="cd-filter-group">
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="cd-run-btn" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Run Diagnostic'}
        </button>
      </div>

      {error && <div className="cd-error">{error}</div>}

      {data && (
        <>
          {/* ── Summary cards ── */}
          <div className="cd-summary">
            <div className="cd-summary-total">
              <span className="cd-summary-total-num">{data.totalZeroCostItems}</span>
              <span className="cd-summary-total-label">items with zero cost</span>
            </div>
            <div className="cd-cause-cards">
              {causeSummary.map((c) => (
                <button
                  key={c.key}
                  className={`cd-cause-card cd-cause-card--${c.color}${filterCause === c.key ? ' cd-cause-card--active' : ''}`}
                  onClick={() => setFilterCause((f) => f === c.key ? 'ALL' : c.key)}
                >
                  <span className="cd-cause-card-count">{c.count}</span>
                  <span className="cd-cause-card-label">{c.label}</span>
                </button>
              ))}
              {filterCause !== 'ALL' && (
                <button className="cd-cause-card cd-cause-card--clear" onClick={() => setFilterCause('ALL')}>
                  Clear filter
                </button>
              )}
            </div>
          </div>

          {/* ── Table ── */}
          {visibleItems.length === 0 ? (
            <div className="cd-empty">No items match the current filter.</div>
          ) : (
            <div className="cd-table-wrap">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>Item</th>
                    <th>Type</th>
                    <th className="num">Zero-cost Sales</th>
                    <th className="num">Qty / SQM Sold</th>
                    <th>First Zero Sale</th>
                    <th>First Purchase</th>
                    <th>Cause</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const open = expanded.has(item.variantId);
                    const cfg  = CAUSE_CONFIG[item.cause] ?? { label: item.cause, color: 'gray' };
                    const unit = isUnit(item);
                    return (
                      <React.Fragment key={item.variantId}>
                        <tr
                          className={`cd-row cd-row--${cfg.color}${open ? ' cd-row--open' : ''}`}
                          onClick={() => toggleRow(item.variantId)}
                        >
                          <td className="cd-expand-cell">
                            <span className="cd-chevron">{open ? '▼' : '▶'}</span>
                          </td>
                          <td className="cd-item-name">{item.itemName}</td>
                          <td>
                            <span className="cd-type-badge">
                              {unit ? 'Unit' : item.stockMode ?? item.itemType ?? '—'}
                            </span>
                          </td>
                          <td className="num">{item.zeroCostSales}</td>
                          <td className="num">
                            {fmt2(item.totalQtySold)}{' '}
                            <span className="cd-unit-label">{unit ? 'pcs' : 'sqm'}</span>
                          </td>
                          <td>{fmtD(item.firstZeroSaleDate)}</td>
                          <td>{item.firstPurchaseDate ? fmtD(item.firstPurchaseDate) : <span className="cd-none">None</span>}</td>
                          <td>
                            <span className={`cd-cause-badge cd-cause-badge--${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>

                        {open && (
                          <tr className="cd-detail-row">
                            <td colSpan={8}>
                              <div className="cd-detail">
                                <div className="cd-cause-explain">
                                  <strong>Root cause:</strong> {item.causeLabel}
                                </div>

                                {item.purchases.length === 0 ? (
                                  <p className="cd-no-purchases">No purchase invoices found for this item.</p>
                                ) : (
                                  <table className="cd-purchases-table">
                                    <thead>
                                      <tr>
                                        <th>Invoice #</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th className="num">{unit ? 'Qty' : 'SQM OFR'}</th>
                                        <th className="num">Final OFR</th>
                                        <th className="num">Total OFR</th>
                                        <th className="num">Total Amount (VM)</th>
                                        <th className="num">Avg Cost (after recompute)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.purchases.map((p) => {
                                        const hasCost = p.finalOFR > 0;
                                        const isReceived = p.status === 'Recieved';
                                        return (
                                          <tr
                                            key={p.invoiceId}
                                            className={`cd-purchase-row${!hasCost && isReceived ? ' cd-purchase-row--no-cost' : ''}${!isReceived ? ' cd-purchase-row--not-received' : ''}`}
                                          >
                                            <td className="cd-po-num">{p.invoiceId}</td>
                                            <td>{fmtDR(p.date)}</td>
                                            <td>
                                              <span className={`cd-status-badge${isReceived ? ' cd-status-badge--received' : ' cd-status-badge--pending'}`}>
                                                {p.status}
                                              </span>
                                            </td>
                                            <td className="num">{unit ? fmt2(p.quantity) : fmt2(p.sqmOfr)}</td>
                                            <td className={`num${!hasCost ? ' cd-zero' : ''}`}>{fmt2(p.finalOFR)}</td>
                                            <td className="num">{fmt2(p.totalOFR)}</td>
                                            <td className="num">{fmt2(p.totalAmount)}</td>
                                            <td className={`num${(p.averageCost ?? 0) === 0 ? ' cd-zero' : ' cd-has-cost'}`}>
                                              {p.averageCost != null ? fmt2(p.averageCost) : '—'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="cd-intro">
          <p>Set a date range and click <strong>Run Diagnostic</strong> to find all items with zero average cost in sales invoices.</p>
          <p>For each item you will see:</p>
          <ul>
            <li>The root cause (missing OFR price, sold before purchased, no purchase exists, etc.)</li>
            <li>The full purchase invoice history with <code>finalOFR</code> values</li>
            <li>The computed <code>averageCost</code> after the last recompute</li>
          </ul>
        </div>
      )}
    </div>
  );
}
