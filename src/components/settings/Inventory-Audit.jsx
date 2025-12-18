import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./styles/Inventory-Audit.css";

const RAW_API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

// existing audit endpoint
const AUDIT_API = `${RAW_API_BASE}/inventory/audit/ofr/all`;

// ✅ fix-one endpoint (the one you asked for)
const FIX_ONE_API = `${RAW_API_BASE}/inventory/audit/ofr/fix`;

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}
function fmt2(v) {
  const x = n(v, 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function abs(v) {
  const x = n(v, 0);
  return x < 0 ? -x : x;
}

// display: 5.5ملم ابيض
function buildDisplayName(row) {
  const mm = row?.thicknessMm;
  const itemName = row?.itemName || "";
  const mmStr = Number.isFinite(Number(mm)) ? String(Number(mm)) : "";
  const parts = [];
  if (mmStr) parts.push(`${mmStr}ملم`);
  if (itemName) parts.push(itemName);
  return parts.join(" ");
}

const COLS = [
  { key: "displayName", label: "Item", numeric: false },
  { key: "ledgerStartOFR", label: "Ledger Start", numeric: true },
  { key: "ledgerInOFR", label: "Ledger In", numeric: true },
  { key: "ledgerOutOFR", label: "Ledger Out", numeric: true },
  { key: "ledgerBalanceOFR", label: "Ledger Balance", numeric: true },
  { key: "cachedStartOFR", label: "Cached Start", numeric: true },
  { key: "cachedInOFR", label: "Cached In", numeric: true },
  { key: "cachedOutOFR", label: "Cached Out", numeric: true },
  { key: "cachedBalanceOFR", label: "Cached Balance", numeric: true },
  { key: "diffBalanceOFR", label: "Δ Balance", numeric: true },
  { key: "diffOutOFR", label: "Δ Out", numeric: true },
];

export default function InventoryAuditPage() {
  const [variantId, setVariantId] = useState("");
  const [tolerance, setTolerance] = useState("0.01");
  const [quickFilter, setQuickFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);

  const [expanded, setExpanded] = useState(() => new Set());
  const [sort, setSort] = useState({ key: "diffBalanceOFR", dir: "desc" });

  // ✅ Fix modal / toast state
  const [fixOpen, setFixOpen] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixErr, setFixErr] = useState("");
  const [fixRow, setFixRow] = useState(null); // original row (from audit list)
  const [fixPreview, setFixPreview] = useState(null); // response.row from fix-one
  const [toast, setToast] = useState({ show: false, type: "success", msg: "" });

  const params = useMemo(() => {
    const p = {};
    const tol = Number(tolerance);
    if (Number.isFinite(tol)) p.tolerance = tol;

    const vid = Number(variantId);
    if (variantId !== "" && Number.isFinite(vid) && vid > 0) p.variantId = vid;

    return p;
  }, [tolerance, variantId]);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(AUDIT_API, { params });
      const rawRows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const withNames = rawRows.map((r) => ({
        ...r,
        displayName: buildDisplayName(r) || `#${r.itemVariantId}`,
      }));
      setMeta(res.data?.meta || null);
      setRows(withNames);
      setExpanded(new Set());
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load audit data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tolNum = Number(tolerance);
  const effectiveTol = Number.isFinite(tolNum) ? tolNum : 0.01;

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function diffClass(diff) {
    const d = abs(diff);
    if (d <= effectiveTol) return "inventory-audit-diff-ok";
    if (d <= effectiveTol * 10) return "inventory-audit-diff-warn";
    return "inventory-audit-diff-bad";
  }

  function onSort(colKey) {
    setSort((s) => {
      if (s.key !== colKey) return { key: colKey, dir: "desc" };
      return { key: colKey, dir: s.dir === "asc" ? "desc" : "asc" };
    });
  }

  function sortIndicator(colKey) {
    if (sort.key !== colKey) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  function copyJson(obj) {
    try {
      navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
      showToast("success", "Copied JSON to clipboard");
    } catch {
      showToast("error", "Clipboard failed");
    }
  }

  function showToast(type, msg) {
    setToast({ show: true, type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 2200);
  }

  const visibleRows = useMemo(() => {
    const q = (quickFilter || "").trim();
    if (!q) return rows;

    const qq = q.toLowerCase();
    return rows.filter((r) => {
      const name = String(r.displayName || "").toLowerCase();
      const id = String(r.itemVariantId ?? "");
      return name.includes(qq) || id.includes(qq);
    });
  }, [rows, quickFilter]);

  const sortedRows = useMemo(() => {
    const arr = [...visibleRows];
    const { key, dir } = sort;

    arr.sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];

      if (key === "displayName") {
        const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        return dir === "asc" ? cmp : -cmp;
      }

      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);

      const aIsNum = Number.isFinite(an);
      const bIsNum = Number.isFinite(bn);

      let cmp = 0;
      if (aIsNum && bIsNum) cmp = an - bn;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));

      return dir === "asc" ? cmp : -cmp;
    });

    return arr;
  }, [visibleRows, sort]);

  const ghostCount = rows.length;

  // -----------------------------
  // ✅ FIX API (preview + apply)
  // -----------------------------
  async function openFixPreview(row) {
    setFixErr("");
    setFixRow(row);
    setFixPreview(null);
    setFixOpen(true);
    setFixLoading(true);

    try {
      const res = await axios.post(FIX_ONE_API, {
        itemVariantId: row.itemVariantId,
        tolerance: effectiveTol,
        dryRun: true,
      });

      const rr = res.data?.row || null;
      // ensure displayName
      const withName = rr
        ? {
            ...rr,
            displayName: buildDisplayName(rr) || row.displayName || `#${row.itemVariantId}`,
          }
        : null;

      setFixPreview(withName);
    } catch (e) {
      setFixErr(e?.response?.data?.message || e?.message || "Preview failed");
    } finally {
      setFixLoading(false);
    }
  }

  async function applyFixNow() {
    if (!fixRow) return;
    setFixErr("");
    setFixLoading(true);

    try {
      const res = await axios.post(FIX_ONE_API, {
        itemVariantId: fixRow.itemVariantId,
        tolerance: effectiveTol,
        dryRun: false,
      });

      const updated = res.data?.meta?.updated ?? 0;
      if (updated) showToast("success", "Fixed ghost stock for this item");
      else showToast("success", "Already matching within tolerance");

      setFixOpen(false);
      setFixPreview(null);
      setFixRow(null);

      // refresh list
      await fetchData();
    } catch (e) {
      setFixErr(e?.response?.data?.message || e?.message || "Fix failed");
      showToast("error", "Fix failed");
    } finally {
      setFixLoading(false);
    }
  }

  function closeFixModal() {
    if (fixLoading) return;
    setFixOpen(false);
    setFixPreview(null);
    setFixRow(null);
    setFixErr("");
  }

  return (
    <div className="inventory-audit-page">
      {/* toast */}
      {toast.show ? (
        <div className={`inventory-audit-toast inventory-audit-toast-${toast.type}`}>
          {toast.msg}
        </div>
      ) : null}

      {/* fix modal */}
      {fixOpen ? (
        <div className="inventory-audit-modal-overlay" onClick={closeFixModal}>
          <div className="inventory-audit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inventory-audit-modal-head">
              <div>
                <div className="inventory-audit-modal-title">Fix Ghost Stock</div>
                <div className="inventory-audit-modal-sub">
                  This will update <b>ItemVariant total*OFR</b> to match <b>InventoryTransaction.sqmofr</b>.
                </div>
              </div>

              <button
                className="inventory-audit-btn inventory-audit-btn-ghost"
                onClick={closeFixModal}
                disabled={fixLoading}
              >
                Close
              </button>
            </div>

            {fixErr ? (
              <div className="inventory-audit-alert inventory-audit-alert-error" style={{ marginTop: 10 }}>
                <div className="inventory-audit-alert-title">Error</div>
                <div className="inventory-audit-alert-body">{fixErr}</div>
              </div>
            ) : null}

            <div className="inventory-audit-modal-body">
              <div className="inventory-audit-modal-kpi">
                <div className="inventory-audit-modal-kpi-label">Item</div>
                <div className="inventory-audit-modal-kpi-value">
                  {fixPreview?.displayName || fixRow?.displayName || (fixRow ? `#${fixRow.itemVariantId}` : "-")}
                </div>
              </div>

              <div className="inventory-audit-modal-grid">
                <div className="inventory-audit-modal-card">
                  <div className="inventory-audit-modal-card-title">Ledger (sqmofr)</div>
                  <div className="inventory-audit-modal-kv">
                    <div>Start</div><div>{fixPreview ? fmt2(fixPreview.ledgerStartOFR) : "…"}</div>
                    <div>In</div><div>{fixPreview ? fmt2(fixPreview.ledgerInOFR) : "…"}</div>
                    <div>Out (mag)</div><div>{fixPreview ? fmt2(fixPreview.ledgerOutOFR) : "…"}</div>
                    <div>Balance</div><div>{fixPreview ? fmt2(fixPreview.ledgerBalanceOFR) : "…"}</div>
                  </div>
                </div>

                <div className="inventory-audit-modal-card">
                  <div className="inventory-audit-modal-card-title">Cached (ItemVariant)</div>
                  <div className="inventory-audit-modal-kv">
                    <div>Start</div><div>{fixPreview ? fmt2(fixPreview.cachedStartOFR) : "…"}</div>
                    <div>In</div><div>{fixPreview ? fmt2(fixPreview.cachedInOFR) : "…"}</div>
                    <div>Out</div><div>{fixPreview ? fmt2(fixPreview.cachedOutOFR) : "…"}</div>
                    <div>Balance</div><div>{fixPreview ? fmt2(fixPreview.cachedBalanceOFR) : "…"}</div>
                  </div>
                </div>

                <div className="inventory-audit-modal-card">
                  <div className="inventory-audit-modal-card-title">Will be set to</div>
                  <div className="inventory-audit-modal-kv">
                    <div>totalStartOFR</div><div>{fixPreview ? fmt2(fixPreview.fixTo?.totalStartOFR) : "…"}</div>
                    <div>totalInOFR</div><div>{fixPreview ? fmt2(fixPreview.fixTo?.totalInOFR) : "…"}</div>
                    <div>totalOutOFR</div><div>{fixPreview ? fmt2(fixPreview.fixTo?.totalOutOFR) : "…"}</div>
                    <div>totalBalanceOFR</div><div>{fixPreview ? fmt2(fixPreview.fixTo?.totalBalanceOFR) : "…"}</div>
                  </div>

                  <div className="inventory-audit-modal-actions">
                    <button
                      className="inventory-audit-btn inventory-audit-btn-ghost"
                      onClick={() => fixPreview && copyJson(fixPreview)}
                      disabled={!fixPreview || fixLoading}
                    >
                      Copy preview JSON
                    </button>

                    <button
                      className="inventory-audit-btn inventory-audit-btn-primary"
                      onClick={applyFixNow}
                      disabled={fixLoading || !fixRow}
                      title="Apply fix (updates ItemVariant totals)"
                    >
                      {fixLoading ? "Applying…" : "Apply Fix"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="inventory-audit-modal-footnote">
                Tolerance used: <b>{effectiveTol}</b>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* page header */}
      <div className="inventory-audit-header">
        <div>
          <h1 className="inventory-audit-title">Inventory OFR Audit</h1>
          <p className="inventory-audit-subtitle">
            Shows <b>ghost stock only</b> (ledger ≠ cached) using <b>sqmofr</b>. Display uses <b>Thickness + Item Name</b>.
          </p>
        </div>

        <div className="inventory-audit-actions">
          <button
            className="inventory-audit-btn inventory-audit-btn-ghost"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="inventory-audit-grid">
        <div className="inventory-audit-card">
          <div className="inventory-audit-card-title">Overview</div>

          <div className="inventory-audit-kpi-row">
            <div className="inventory-audit-kpi">
              <div className="inventory-audit-kpi-label">Ghost variants</div>
              <div
                className={`inventory-audit-kpi-value ${
                  ghostCount ? "inventory-audit-kpi-bad" : "inventory-audit-kpi-ok"
                }`}
              >
                {ghostCount}
              </div>
            </div>

            <div className="inventory-audit-kpi">
              <div className="inventory-audit-kpi-label">Tolerance</div>
              <div className="inventory-audit-kpi-value">{effectiveTol}</div>
            </div>

            <div className="inventory-audit-kpi">
              <div className="inventory-audit-kpi-label">Returned (API)</div>
              <div className="inventory-audit-kpi-value">{meta?.returned ?? rows.length}</div>
            </div>
          </div>

          <div className="inventory-audit-meta-line">
            <span>onlyMismatch: true</span>
            <span>endpoint: ofr/all</span>
          </div>
        </div>

        <div className="inventory-audit-card">
          <div className="inventory-audit-card-title">Filters</div>

          <div className="inventory-audit-form-row">
            <div className="inventory-audit-field">
              <div className="inventory-audit-field-label">Variant ID (server)</div>
              <input
                className="inventory-audit-input"
                placeholder="e.g. 111"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>

            <div className="inventory-audit-field">
              <div className="inventory-audit-field-label">Tolerance (server)</div>
              <input
                className="inventory-audit-input"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                placeholder="0.01"
              />
            </div>

            <button
              className="inventory-audit-btn inventory-audit-btn-primary"
              onClick={fetchData}
              disabled={loading}
            >
              Apply
            </button>

            <div className="inventory-audit-field" style={{ minWidth: 260 }}>
              <div className="inventory-audit-field-label">Quick filter (local: name/id)</div>
              <input
                className="inventory-audit-input"
                placeholder="مثال: 5.5ملم ابيض أو 111"
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="inventory-audit-alert inventory-audit-alert-error">
          <div className="inventory-audit-alert-title">Error</div>
          <div className="inventory-audit-alert-body">{error}</div>
        </div>
      ) : null}

      <div className="inventory-audit-card inventory-audit-table-card">
        <div className="inventory-audit-table-toolbar">
          <div className="inventory-audit-table-title">Ghost stock results</div>
          <div className="inventory-audit-table-hint">
            Click a row to expand details. Click headers to sort. Δ = (ledger - cached).
          </div>
        </div>

        <div className="inventory-audit-table-wrap">
          <table className="inventory-audit-table">
            <thead>
              <tr>
                <th className="inventory-audit-sticky-col">Details</th>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className={c.numeric ? "inventory-audit-th-num" : ""}
                    onClick={() => onSort(c.key)}
                    role="button"
                    title="Sort"
                  >
                    {c.label}
                    <span className="inventory-audit-sort-ind">{sortIndicator(c.key)}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLS.length + 1} className="inventory-audit-empty">
                    Loading…
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 1} className="inventory-audit-empty">
                    No ghost stock found (ledger matches cached within tolerance).
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => {
                  const id = r.itemVariantId;
                  const open = expanded.has(id);

                  const balanceCls = diffClass(r.diffBalanceOFR);
                  const outCls = diffClass(r.diffOutOFR);

                  return (
                    <React.Fragment key={id}>
                      <tr
                        className="inventory-audit-row inventory-audit-row-mismatch"
                        onClick={() => toggleExpand(id)}
                      >
                        <td className="inventory-audit-sticky-col">
                          <button
                            className="inventory-audit-expander"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(id);
                            }}
                            aria-label="Toggle details"
                          >
                            {open ? "▾" : "▸"}
                          </button>
                        </td>

                        <td>
                          <div style={{ fontWeight: 900 }}>{r.displayName}</div>
                          <div style={{ fontSize: 12, color: "rgba(15,23,42,.55)" }}>#{id}</div>
                        </td>

                        <td className="inventory-audit-td-num">{fmt2(r.ledgerStartOFR)}</td>
                        <td className="inventory-audit-td-num">{fmt2(r.ledgerInOFR)}</td>
                        <td className="inventory-audit-td-num">{fmt2(r.ledgerOutOFR)}</td>
                        <td className="inventory-audit-td-num">{fmt2(r.ledgerBalanceOFR)}</td>

                        <td className="inventory-audit-td-num">{fmt2(r.cachedStartOFR)}</td>
                        <td className="inventory-audit-td-num">{fmt2(r.cachedInOFR)}</td>
                        <td className="inventory-audit-td-num">{fmt2(r.cachedOutOFR)}</td>
                        <td className="inventory-audit-td-num">{fmt2(r.cachedBalanceOFR)}</td>

                        <td className={`inventory-audit-td-num ${balanceCls}`}>{fmt2(r.diffBalanceOFR)}</td>
                        <td className={`inventory-audit-td-num ${outCls}`}>{fmt2(r.diffOutOFR)}</td>
                      </tr>

                      {open ? (
                        <tr className="inventory-audit-detail-row">
                          <td colSpan={COLS.length + 1}>
                            <div className="inventory-audit-detail-grid">
                              <div className="inventory-audit-detail-card">
                                <div className="inventory-audit-detail-title">Ledger (sqmofr)</div>
                                <div className="inventory-audit-detail-kv">
                                  <div>Start</div><div>{fmt2(r.ledgerStartOFR)}</div>
                                  <div>In</div><div>{fmt2(r.ledgerInOFR)}</div>
                                  <div>Out (mag)</div><div>{fmt2(r.ledgerOutOFR)}</div>
                                  <div>Balance</div><div>{fmt2(r.ledgerBalanceOFR)}</div>
                                </div>
                              </div>

                              <div className="inventory-audit-detail-card">
                                <div className="inventory-audit-detail-title">Cached (ItemVariant)</div>
                                <div className="inventory-audit-detail-kv">
                                  <div>Start</div><div>{fmt2(r.cachedStartOFR)}</div>
                                  <div>In</div><div>{fmt2(r.cachedInOFR)}</div>
                                  <div>Out</div><div>{fmt2(r.cachedOutOFR)}</div>
                                  <div>Balance</div><div>{fmt2(r.cachedBalanceOFR)}</div>
                                </div>
                              </div>

                              <div className="inventory-audit-detail-card">
                                <div className="inventory-audit-detail-title">Diffs</div>
                                <div className="inventory-audit-detail-kv">
                                  <div>Δ Start</div><div className={diffClass(r.diffStartOFR)}>{fmt2(r.diffStartOFR)}</div>
                                  <div>Δ In</div><div className={diffClass(r.diffInOFR)}>{fmt2(r.diffInOFR)}</div>
                                  <div>Δ Out</div><div className={diffClass(r.diffOutOFR)}>{fmt2(r.diffOutOFR)}</div>
                                  <div>Δ Balance</div><div className={diffClass(r.diffBalanceOFR)}>{fmt2(r.diffBalanceOFR)}</div>
                                </div>

                                <div className="inventory-audit-detail-note">
                                  Cached formula check: <b>cachedStart + cachedIn - cachedOut</b> ={" "}
                                  <b>{fmt2(r.cachedBalanceFormulaOFR)}</b> (diff:{" "}
                                  <b className={diffClass(r.diffCachedBalanceFormulaOFR)}>
                                    {fmt2(r.diffCachedBalanceFormulaOFR)}
                                  </b>)
                                </div>

                                <div className="inventory-audit-detail-actions">
                                  {/* ✅ NEW: preview fix */}
                                  <button
                                    className="inventory-audit-btn inventory-audit-btn-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openFixPreview(r);
                                    }}
                                    title="Preview + apply fix (update ItemVariant totals)"
                                  >
                                    Fix
                                  </button>

                                  <button
                                    className="inventory-audit-btn inventory-audit-btn-ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyJson(r);
                                    }}
                                  >
                                    Copy row JSON
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="inventory-audit-footer-note">
        Display name is built as: <b>Thickness + "ملم" + Item Name</b>. Δ values are <b>(ledger - cached)</b>.
      </div>
    </div>
  );
}
