// src/pages/settings/DescriptionSettingsBase.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./styles/DescriptionSorting.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL?.replace(/\/+$/, "") || "";

/* ----------------- helpers ----------------- */
function highlight(text, q) {
  if (!q) return text;
  const t = String(text ?? "");
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return t;
  const before = t.slice(0, i);
  const mid = t.slice(i, i + q.length);
  const after = t.slice(i + q.length);
  return (
    <>
      {before}
      <span className="description-setting__mark">{mid}</span>
      {after}
    </>
  );
}

/** Format dimensions as 225*321-031 (length*width-SPB with 3-digit SPB). */
function fmtDims(len, wid, spb) {
  const L = Number(len) || 0;
  const W = Number(wid) || 0;
  const S = Number(spb);
  const hasDims = L > 0 && W > 0;
  const hasSpb = Number.isFinite(S) && S > 0;
  const spbStr = hasSpb ? `-${String(S).padStart(3, "0")}` : "";
  return hasDims ? `${L}*${W}${spbStr}` : hasSpb ? spbStr : "";
}

/**
 * Base component for description sorting pages.
 * Props:
 *   - resource: one of:
 *       "item-descriptions"           → uses your provided APIs
 *       "item-name-descriptions"      → same shape, if/when you expose similar endpoints
 *   - title: string shown in header
 */
export default function DescriptionSettingsBase({ resource, title }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [withCounts, setWithCounts] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // Drawer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerRow, setViewerRow] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerErr, setViewerErr] = useState("");
  const [viewerData, setViewerData] = useState([]); // flat from API

  // ===== fetch list =====
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // LIST endpoint:
      // GET /items/<resource>?q=&withCounts=1
      const url = new URL(`${API_BASE}/items/item-descriptions`);
      if (q) url.searchParams.set("q", q);
      if (withCounts) url.searchParams.set("withCounts", "1");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setIsDirty(false);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [q, withCounts, resource]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // local reorder
  const [order, setOrder] = useState([]);
  useEffect(() => {
    setOrder(rows.map((r) => r.id));
  }, [rows]);

  const onDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", String(id));
  };
  const onDragOver = (e) => e.preventDefault();

  const onDrop = (e, targetId) => {
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetId) return;

    const current = [...order];
    const from = current.indexOf(draggedId);
    const to = current.indexOf(targetId);
    if (from === -1 || to === -1) return;

    current.splice(from, 1);
    current.splice(to, 0, draggedId);
    setOrder(current);
    setIsDirty(true);

    // reflect locally
    const map = new Map(rows.map((r) => [r.id, r]));
    const nextRows = current.map((id) => map.get(id)).filter(Boolean);
    setRows(nextRows);
  };

  // ===== save reorder =====
  const saveOrder = async () => {
    try {
      setLoading(true);
      setErr("");
      // PUT /items/<resource>/reorder  with body { order: number[] }
      const res = await fetch(`${API_BASE}/items/item-descriptions/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const metaText = useMemo(() => {
    const total = rows.length;
    const withV = rows.filter((r) => (r.variantsCount ?? 0) > 0).length;
    return `${withV}/${total} have variants`;
  }, [rows]);

  // ===== open viewer =====
  const openViewer = async (descRow) => {
    setViewerRow(descRow);
    setViewerErr("");
    setViewerData([]);
    setViewerOpen(true);
    try {
      setViewerLoading(true);
      // GET /items/<resource>/:descId/variants?limit=500&page=1&q=
      const url = new URL(`${API_BASE}/items/item-descriptions/${descRow.id}/variants`);
      url.searchParams.set("limit", "500");
      url.searchParams.set("page", "1");
      if (q) url.searchParams.set("q", q);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const js = await res.json();
      const arr = Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : [];
      setViewerData(arr);
    } catch (e) {
      setViewerErr(String(e?.message || e));
    } finally {
      setViewerLoading(false);
    }
  };

  // Group viewer data → Item → Thickness (sorted)
  const viewerGrouped = useMemo(() => {
    const out = [];
    const byItem = new Map();
    for (const row of viewerData) {
      const keyItem = row.itemName || "(Unnamed)";
      if (!byItem.has(keyItem)) {
        const obj = { itemName: keyItem, thicknesses: new Map() };
        byItem.set(keyItem, obj);
        out.push(obj);
      }
      const itemObj = byItem.get(keyItem);
      const th = Number(row.thickness || 0);
      if (!itemObj.thicknesses.has(th)) {
        itemObj.thicknesses.set(th, []);
      }
      itemObj.thicknesses.get(th).push(row);
    }
    return out.map((item) => {
      const thArr = Array.from(item.thicknesses.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([thVal, variants]) => ({
          thickness: thVal,
          variants: variants
            .slice()
            .sort((a, b) =>
              a.length === b.length ? a.width - b.width : a.length - b.length
            ),
        }));
      return { itemName: item.itemName, thicknesses: thArr };
    });
  }, [viewerData]);

  return (
    <div className="description-setting">
      <header className="description-setting__header">
        <h3 className="description-setting__title">{title}</h3>
        <div className="description-setting__actions">
          <button
            className={`description-setting__btn description-setting__btn--primary ${isDirty ? "is-dirty" : ""}`}
            disabled={!isDirty || loading}
            onClick={saveOrder}
            title="Save sort order"
          >
            Save Order
          </button>
          <button
            className="description-setting__btn description-setting__btn--ghost"
            onClick={fetchData}
            disabled={loading}
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="description-setting__toolbar">
        <div className="description-setting__search">
          <input
            className="description-setting__search-input"
            placeholder="Search: item number, category, subcategory, color, or design…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <label className="description-setting__toggle">
          <input
            type="checkbox"
            checked={withCounts}
            onChange={(e) => setWithCounts(e.target.checked)}
          />
          show counts
        </label>

        <div className="description-setting__meta">
          <span className="description-setting__count">{rows.length}</span> total &middot; {metaText}
        </div>
      </div>

      {err && <div className="description-setting__error">Error: {err}</div>}

      {!rows.length && !loading ? (
        <div className="description-setting__empty">No descriptions found.</div>
      ) : (
        <div className="description-setting__list">
          {rows.map((r) => {
            const title =
              [r.categoryName, r.subCategory, r.colorName, r.designName]
                .filter(Boolean)
                .join(" | ") || "(Untitled)";

            return (
              <div
                key={r.id}
                className="description-setting__row"
                draggable
                onDragStart={(e) => onDragStart(e, r.id)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, r.id)}
                title="Drag to reorder"
              >
                <div className="description-setting__row-handle">⋮⋮</div>

                <div className="description-setting__row-main">
                  <div className="description-setting__row-title">
                    {highlight(title, q)}
                  </div>

                  <div className="description-setting__row-sub">
                    {/* itemNumber pill */}
                    {r.itemNumber ? (
                      <span className="description-setting__badge">
                        {highlight(r.itemNumber, q)}
                      </span>
                    ) : (
                      <span className="description-setting__badge" title="No item number">
                        —
                      </span>
                    )}

                    {/* id */}
                    <span className="description-setting__chip">ID: {r.id}</span>

                    {/* optional count */}
                    {withCounts && (
                      <span className="description-setting__chip">
                        Variants: {r.variantsCount ?? 0}
                      </span>
                    )}
                  </div>
                </div>

                <div className="description-setting__row-side">
                  <button
                    className="description-setting__btn"
                    onClick={() => openViewer(r)}
                    title="View variants in this description"
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* === Slide-over viewer === */}
      {viewerOpen && (
        <div className="description-setting__viewer" aria-modal="true" role="dialog">
          <div
            className="description-setting__viewer-backdrop"
            onClick={() => setViewerOpen(false)}
          />
          <aside className="description-setting__viewer-panel">
            <div className="description-setting__viewer-header">
              <div>
                <div className="description-setting__viewer-title">
                  {viewerRow
                    ? [viewerRow.categoryName, viewerRow.subCategory, viewerRow.colorName, viewerRow.designName]
                        .filter(Boolean)
                        .join(" | ") || "(Untitled)"
                    : "Description"}
                </div>
                <div className="description-setting__viewer-sub">
                  {viewerRow?.itemNumber ? `#${viewerRow.itemNumber}` : "—"} &middot; ID {viewerRow?.id}
                </div>
              </div>
              <button className="description-setting__btn" onClick={() => setViewerOpen(false)}>
                Close
              </button>
            </div>

            <div className="description-setting__viewer-body">
              {viewerErr && <div className="description-setting__error">Error: {viewerErr}</div>}
              {viewerLoading ? (
                <div className="description-setting__empty">Loading…</div>
              ) : viewerData.length === 0 ? (
                <div className="description-setting__empty">No variants found for this description.</div>
              ) : (
                <div className="description-setting__viewer-groups">
                  {viewerGrouped.map((grp) => (
                    <div key={grp.itemName} className="description-setting__viewer-group">
                      <div className="description-setting__viewer-group-title">
                        {grp.itemName}
                      </div>

                      {grp.thicknesses.map((th) => (
                        <div
                          className="description-setting__viewer-th"
                          key={`${grp.itemName}-${th.thickness}`}
                        >
                          <div className="description-setting__viewer-th-head">
                            Thickness: <strong>{th.thickness}</strong>
                          </div>

                          <div className="description-setting__viewer-variants">
                            {th.variants.map((v) => (
                              <div className="description-setting__viewer-variant" key={v.variantId ?? v.id}>
                                <div className="description-setting__viewer-variant-title">
                                  {fmtDims(v.length, v.width, v.sheetsPerBox) || "(No size)"}
                                </div>
                                <div className="description-setting__viewer-variant-sub">
                                  <span className="description-setting__chip">
                                    Origin: {v.origin || "—"}
                                  </span>
                                  <span className="description-setting__chip">
                                    VarID: {v.variantId ?? v.id}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
