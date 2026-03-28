// src/components/cuts-control/CutsQueuePage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./CutsQueuePage.css";
import { axiosClient } from "../api/axiosClient";

const fmtNum = (n, digits = 2) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toISOString().slice(0, 10);
};

const tagFor = (changed) => {
  const yes = Object.values(changed || {}).some(Boolean);
  return yes
    ? { label: "changed", cls: "tag tag--warn" }
    : { label: "same", cls: "tag tag--ok" };
};

export default function CutsQueuePage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, hasMore: false });
  const [expanded, setExpanded] = useState(() => new Set());

  // Track which invoiceItemIds are currently being trashed
  const [trashing, setTrashing] = useState(() => new Set());

  const debounceRef = useRef(null);

  const fetchList = useCallback(
    async (opts = {}) => {
      const effectivePage  = Number(opts.page  ?? page);
      const effectiveLimit = Number(opts.limit ?? limit);

      setLoading(true);
      setErr("");

      try {
        const params = { page: effectivePage, limit: effectiveLimit };
        if (status) params.status = status;
        if (q.trim()) params.q = q.trim();

        const res  = await axiosClient.get("/transfers/v1/invoice-cuts", { params });
        const json = res?.data || {};
        const data = Array.isArray(json?.data) ? json.data : [];

        setRows(data);
        setMeta({
          total:      Number(json?.total ?? 0),
          totalPages: Number(json?.totalPages ?? 1),
          hasMore:    Boolean(json?.hasMore),
        });
        setPage(Number(json?.page  ?? effectivePage));
        setLimit(Number(json?.limit ?? effectiveLimit));
      } catch (e) {
        setRows([]);
        setMeta({ total: 0, totalPages: 1, hasMore: false });
        const msg  = e?.response?.data?.message;
        const nice =
          (Array.isArray(msg) ? msg.join(", ") : msg) ||
          e?.response?.data?.error ||
          e?.message ||
          String(e);
        setErr(String(nice));
      } finally {
        setLoading(false);
      }
    },
    [page, limit, status, q],
  );

  useEffect(() => {
    fetchList({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchList({ page: 1 });
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [q, status, limit, fetchList]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Trash handler ──────────────────────────────────────────────────────────
  const handleTrash = async (invoiceItemId, remainingSqm) => {
    const confirmed = window.confirm(
      `Trash ${fmtNum(remainingSqm, 4)} sqm as Cuts Loss?\n\n` +
      `This will create a CT (Cuts Transfer) and deduct the remaining sqm from stock.`
    );
    if (!confirmed) return;

    setTrashing((prev) => new Set(prev).add(invoiceItemId));
    try {
      await axiosClient.post("/transfers/v1/cuts/trash", { invoiceItemId });
      // Refresh so the resolved row updates
      await fetchList({ page });
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Unknown error";
      alert(`Failed to trash: ${Array.isArray(msg) ? msg.join(", ") : msg}`);
    } finally {
      setTrashing((prev) => {
        const next = new Set(prev);
        next.delete(invoiceItemId);
        return next;
      });
    }
  };

  const totalChanged = useMemo(
    () => rows.filter((r) => Object.values(r?.changed || {}).some(Boolean)).length,
    [rows],
  );

  const exportCsv = () => {
    const cols = [
      "invoiceDate", "invoiceNumber", "customerName", "itemName", "thickness",
      "origin", "sold_sqm", "sold_qty",
      "snapshot_length", "snapshot_width", "snapshot_spb",
      "original_length", "original_width", "original_spb",
      "remaining_sqm", "changed_length", "changed_width", "changed_spb",
    ];
    const lines = [cols.join(",")];

    for (const r of rows) {
      const snap = r?.snapshotDims || {};
      const orig = r?.originalDims || {};
      const ch   = r?.changed || {};
      const row  = [
        fmtDate(r?.invoiceDate), r?.invoiceNumber ?? "",
        (r?.customerName ?? "").replaceAll(",", " "),
        (r?.itemName     ?? "").replaceAll(",", " "),
        r?.thickness ?? "",
        r?.origin ?? "",
        r?.sold?.sqm ?? "", r?.sold?.quantity ?? "",
        snap?.length ?? "", snap?.width ?? "", snap?.sheetsPerBox ?? "",
        orig?.length ?? "", orig?.width ?? "", orig?.sheetsPerBox ?? "",
        r?.remainingSqm ?? "",
        ch?.length ? 1 : 0, ch?.width ? 1 : 0, ch?.sheetsPerBox ? 1 : 0,
      ];
      lines.push(row.map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`).join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `cuts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="cuts-page">
      {/* ── Header ── */}
      <div className="cuts-header">
        <div>
          <h1 className="cuts-title">Cuts Queue</h1>
          <p className="cuts-sub">
            Invoice items where dimensions were cut (box &amp; sheet only).
            Trash the remaining sqm to create a <strong>CT</strong> transfer and
            deduct the loss from stock.
          </p>
        </div>
        <div className="cuts-header-actions">
          <button className="btn btn-ghost" onClick={() => fetchList({ page })} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn btn-dark" onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="cuts-toolbar">
        <div className="field field--grow">
          <label>Search</label>
          <input
            type="text"
            placeholder="Invoice #, customer, item name, origin…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="field">
          <label>Page size</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-top">Total</div>
            <div className="stat-val">{fmtNum(meta.total, 0)}</div>
          </div>
          <div className="stat">
            <div className="stat-top">This page</div>
            <div className="stat-val">{fmtNum(rows.length, 0)}</div>
          </div>
          <div className="stat">
            <div className="stat-top">Changed here</div>
            <div className="stat-val">{fmtNum(totalChanged, 0)}</div>
          </div>
        </div>
      </div>

      {err && (
        <div className="alert">
          <div className="alert-title">Error</div>
          <pre className="alert-body">{err}</pre>
        </div>
      )}

      {/* ── Table ── */}
      <div className="cuts-card">
        <div className="cuts-table-wrap">
          <table className="cuts-table">
            <thead>
              <tr>
                <th style={{ width: 52 }}></th>
                <th>Date</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Item</th>
                <th>Snapshot → Original</th>
                <th className="ta-right">Remaining SQM</th>
                <th>Changed?</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={9} className="empty">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="empty">No rows found.</td></tr>
              ) : (
                rows.map((r) => {
                  const id        = Number(r?.invoiceItemId ?? r?.id);
                  const isOpen    = expanded.has(id);
                  const snap      = r?.snapshotDims || {};
                  const orig      = r?.originalDims || {};
                  const changed   = r?.changed || {};
                  const remaining = Number(r?.remainingSqm ?? 0);
                  const resolved  = !!r?.sqmCutResolved;
                  const isTrashing = trashing.has(id);

                  const snapText = snap?.length != null && snap?.width != null
                    ? `${fmtNum(snap.length, 0)}×${fmtNum(snap.width, 0)}${
                        snap?.sheetsPerBox
                          ? `-${String(Math.round(Number(snap.sheetsPerBox) || 0)).padStart(3, "0")}`
                          : ""
                      }`
                    : "—";

                  const origText = orig?.length != null && orig?.width != null
                    ? `${fmtNum(orig.length, 0)}×${fmtNum(orig.width, 0)}${
                        orig?.sheetsPerBox
                          ? `-${String(Math.round(Number(orig.sheetsPerBox) || 0)).padStart(3, "0")}`
                          : ""
                      }`
                    : "—";

                  const tg = tagFor(changed);

                  return (
                    <React.Fragment key={`row-${id}`}>
                      <tr className={isOpen ? "row-open" : ""}>
                        {/* expand */}
                        <td>
                          <button className="iconbtn" onClick={() => toggleExpand(id)} title="Details">
                            {isOpen ? "–" : "+"}
                          </button>
                        </td>

                        {/* date */}
                        <td className="mono">{fmtDate(r?.invoiceDate)}</td>

                        {/* invoice */}
                        <td>
                          <div className="mono">{r?.invoiceNumber || "—"}</div>
                          <div className="muted mono">ID {r?.invoiceId ?? "—"}</div>
                        </td>

                        {/* customer */}
                        <td>{r?.customerName || "—"}</td>

                        {/* item — thickness + name side by side */}
                        <td>
                          <div className="itemName">
                            {r?.thickness ? `${r.thickness}ملم ` : ""}
                            {r?.itemName || "—"}
                          </div>
                          <div className="muted">
                            {r?.itemType?.toUpperCase() || ""} · Origin: {r?.origin || "—"}
                          </div>
                        </td>

                        {/* dims */}
                        <td>
                          <div className="dimsLine">
                            <span className="dims">{snapText}</span>
                            <span className="arrow">→</span>
                            <span className="dims">{origText}</span>
                          </div>
                        </td>

                        {/* remaining sqm */}
                        <td className="ta-right">
                          {remaining > 0
                            ? <strong className="remaining-sqm">{fmtNum(remaining, 4)}</strong>
                            : <span className="muted">{fmtNum(remaining, 4)}</span>
                          }
                        </td>

                        {/* changed tag */}
                        <td><span className={tg.cls}>{tg.label}</span></td>

                        {/* action */}
                        <td>
                          {resolved ? (
                            <span className="tag tag--ok">✓ resolved</span>
                          ) : remaining > 0 ? (
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={isTrashing}
                              onClick={() => handleTrash(id, remaining)}
                              title={`Trash ${fmtNum(remaining, 4)} sqm as Cuts Loss (CT transfer)`}
                            >
                              {isTrashing ? "…" : "🗑 Trash remaining"}
                            </button>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>

                      {/* expanded detail */}
                      {isOpen && (
                        <tr className="row-details">
                          <td colSpan={9}>
                            <div className="detailsGrid">
                              {/* Invoice item */}
                              <div className="detailBox">
                                <div className="detailTitle">Invoice item</div>
                                <div className="detailLine">
                                  <span className="muted">invoiceItemId:</span>
                                  <b className="mono">{r?.invoiceItemId ?? "—"}</b>
                                </div>
                                <div className="detailLine">
                                  <span className="muted">batch:</span>
                                  <b className="mono">{r?.itemBatchId ?? "—"}</b>
                                </div>
                                <div className="detailLine">
                                  <span className="muted">sold sqm:</span>
                                  <b>{fmtNum(r?.sold?.sqm, 4)}</b>
                                </div>
                                <div className="detailLine">
                                  <span className="muted">sold qty:</span>
                                  <b>{fmtNum(r?.sold?.quantity, 0)}</b>
                                </div>
                                <div className="detailLine">
                                  <span className="muted">remaining:</span>
                                  <b className={remaining > 0 ? "remaining-sqm" : ""}>
                                    {fmtNum(remaining, 4)} sqm
                                  </b>
                                </div>
                              </div>

                              {/* Snapshot dims */}
                              <div className="detailBox">
                                <div className="detailTitle">Snapshot (sold)</div>
                                <div className="detailLine">
                                  <span className="muted">length:</span>
                                  <b>{fmtNum(snap?.length, 0)}</b>
                                </div>
                                <div className="detailLine">
                                  <span className="muted">width:</span>
                                  <b>{fmtNum(snap?.width, 0)}</b>
                                </div>
                                <div className="detailLine">
                                  <span className="muted">SPB:</span>
                                  <b>{snap?.sheetsPerBox ?? "—"}</b>
                                </div>
                              </div>

                              {/* Original dims */}
                              <div className="detailBox">
                                <div className="detailTitle">Original variant</div>
                                <div className="detailLine">
                                  <span className="muted">length:</span>
                                  <b>{fmtNum(orig?.length, 0)}</b>
                                </div>
                                <div className="detailLine">
                                  <span className="muted">width:</span>
                                  <b>{fmtNum(orig?.width, 0)}</b>
                                </div>
                                <div className="detailLine">
                                  <span className="muted">SPB:</span>
                                  <b>{orig?.sheetsPerBox ?? "—"}</b>
                                </div>
                              </div>
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

        {/* Pager */}
        <div className="cuts-footer">
          <div className="muted">
            Page <b>{page}</b> / <b>{meta.totalPages}</b>
          </div>
          <div className="pager">
            <button className="btn btn-ghost" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <button className="btn btn-ghost" disabled={loading || page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
            <button className="btn btn-dark" disabled={loading} onClick={() => fetchList({ page })}>
              {loading ? "Loading…" : "Load"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}