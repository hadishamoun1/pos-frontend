import React, { useEffect, useMemo, useState } from "react";
import "./styles/InvoiceAuditPage.css";
import { axiosClient } from "../api/axiosClient"; // ✅ adjust path if needed

function toYMD(d) {
  if (!d) return "";
  try {
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return "";
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, "0");
    const day = String(dd.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

function fmtDate(d) {
  if (!d) return "";
  try {
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return String(d);
    return dd.toLocaleDateString();
  } catch {
    return String(d);
  }
}

export default function InvoiceAuditPage() {
  const today = useMemo(() => toYMD(new Date()), []);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);

  const [onlyFailed, setOnlyFailed] = useState(true);
  const [deepStock, setDeepStock] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  const params = useMemo(() => {
    const p = {
      page,
      limit,
      onlyFailed: onlyFailed ? 1 : 0,
      deepStock: deepStock ? 1 : 0,
    };
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [from, to, page, limit, onlyFailed, deepStock]);

  const fetchAudit = async () => {
    setLoading(true);
    setErr("");
    try {
      // ✅ Your backend endpoint: GET /audit/invoices
      // axiosClient has baseURL=/api so this becomes /api/audit/invoices
      const res = await axiosClient.get(`/audit/invoices`, { params });
      setData(res.data || null);
      setExpandedInvoiceId(null);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load audit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, onlyFailed, deepStock, from, to]);

  const results = Array.isArray(data?.results) ? data.results : [];
  const stats = data?.stats || { OK: 0, WARN: 0, FAIL: 0 };
  const meta = data?.meta || {};

  const canPrev = page > 1;
  const canNext = results.length === limit; // simple heuristic

  return (
    <div className="invoice-audit-page">
      <div className="invoice-audit-head">
        <div>
          <div className="invoice-audit-title">Invoice Audit</div>
          <div className="invoice-audit-subtitle">
            Re-checks invoices live (Invoice + JV + Inventory Transactions + optional stock sanity)
          </div>
        </div>

        <div className="invoice-audit-actions">
          <button className="invoice-audit-btn" onClick={fetchAudit} disabled={loading}>
            {loading ? "Checking..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="invoice-audit-filters">
        <div className="invoice-audit-filter">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>

        <div className="invoice-audit-filter">
          <label>To</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>

        <div className="invoice-audit-filter invoice-audit-check">
          <label>
            <input
              type="checkbox"
              checked={onlyFailed}
              onChange={(e) => { setOnlyFailed(e.target.checked); setPage(1); }}
            />
            Only broken (WARN/FAIL)
          </label>
        </div>

        <div className="invoice-audit-filter invoice-audit-check">
          <label>
            <input
              type="checkbox"
              checked={deepStock}
              onChange={(e) => { setDeepStock(e.target.checked); setPage(1); }}
            />
            Deep stock checks (batch formula + negative warnings)
          </label>
        </div>

        <div className="invoice-audit-filter">
          <label>Limit</label>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value) || 50); setPage(1); }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      <div className="invoice-audit-stats">
        <div className="invoice-audit-stat ok">
          <div className="k">OK</div>
          <div className="v">{stats.OK ?? 0}</div>
        </div>
        <div className="invoice-audit-stat warn">
          <div className="k">WARN</div>
          <div className="v">{stats.WARN ?? 0}</div>
        </div>
        <div className="invoice-audit-stat fail">
          <div className="k">FAIL</div>
          <div className="v">{stats.FAIL ?? 0}</div>
        </div>

        <div className="invoice-audit-meta">
          <div><b>Page:</b> {meta.page ?? page}</div>
          <div><b>Limit:</b> {meta.limit ?? limit}</div>
          <div><b>Total invoices (range):</b> {meta.totalInvoices ?? "-"}</div>
        </div>
      </div>

      {err ? <div className="invoice-audit-error">{err}</div> : null}

      <div className="invoice-audit-table-wrap">
        <table className="invoice-audit-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Date</th>
              <th>Type</th>
              <th>Invoice #</th>
              <th className="tr">Items</th>
              <th className="tr">Sub</th>
              <th className="tr">VAT</th>
              <th className="tr">Grand</th>
              <th className="tr">Issues</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="invoice-audit-muted">
                  Checking...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={10} className="invoice-audit-muted">
                  No results.
                </td>
              </tr>
            ) : (
              results.map((r) => {
                const issues = Array.isArray(r.issues) ? r.issues : [];
                const totals = r?.summary?.totals || {};
                const isOpen = expandedInvoiceId === r.invoiceId;

                return (
                  <React.Fragment key={`audit-${r.invoiceId}`}>
                    <tr className={`row-${String(r.status || "OK").toLowerCase()}`}>
                      <td>
                        <span className={`invoice-audit-pill ${String(r.status || "OK").toLowerCase()}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{fmtDate(r.date)}</td>
                      <td>{r.invoiceType || "-"}</td>
                      <td>{r.invoiceNumber || "-"}</td>

                      <td className="tr">{r?.summary?.itemsCount ?? "-"}</td>

                      <td className="tr">{totals.sumWithoutVat ?? "-"}</td>
                      <td className="tr">{totals.sumVat ?? "-"}</td>
                      <td className="tr">{totals.sumGrand ?? "-"}</td>

                      <td className="tr">{issues.length}</td>

                      <td className="tr">
                        <button
                          className="invoice-audit-mini-btn"
                          onClick={() => setExpandedInvoiceId(isOpen ? null : r.invoiceId)}
                        >
                          {isOpen ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="invoice-audit-details-row">
                        <td colSpan={10}>
                          <div className="invoice-audit-details">
                            <div className="invoice-audit-details-title">
                              Issues for invoice #{r.invoiceNumber} (id {r.invoiceId})
                            </div>

                            {issues.length === 0 ? (
                              <div className="invoice-audit-muted">No issues.</div>
                            ) : (
                              <ul className="invoice-audit-issues">
                                {issues.map((x, idx) => (
                                  <li key={`${r.invoiceId}-i-${idx}`} className={`lvl-${x.level || "WARN"}`}>
                                    <div className="code">
                                      <b>{x.code}</b> <span className="lvl">({x.level})</span>
                                    </div>
                                    <div className="msg">{x.message}</div>
                                    {x.meta ? (
                                      <pre className="meta">{JSON.stringify(x.meta, null, 2)}</pre>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="invoice-audit-pager">
        <button
          className="invoice-audit-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={loading || !canPrev}
        >
          Prev
        </button>

        <div className="invoice-audit-page-num">Page {page}</div>

        <button
          className="invoice-audit-btn"
          onClick={() => setPage((p) => p + 1)}
          disabled={loading || !canNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}
