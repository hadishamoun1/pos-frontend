// src/components/settings/ItemBatchesSettings.jsx
import React, { useEffect, useMemo, useState } from "react";
import NotificationModal from "../recievables/NotificationModal"; 
import './styles/ItemBatchesSettings.css'

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, "");

async function getJSON(path) {
  const res = await fetch(`${baseUrl}${path}`, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}
async function postJSON(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Flatten /items/v1/filtered-items (items → thicknesses → variants) into rows */
function flattenItemTree(items) {
  const rows = [];
  for (const it of items ?? []) {
    for (const th of it.thicknesses ?? []) {
      for (const v of th.variants ?? []) {
        rows.push({
          variantId: Number(v.id),
          itemId: Number(it.id),
          itemName: String(it.itemName),
          type: String(it.type),
          thicknessId: Number(th.id),
          thickness: Number(th.thickness),
          length: Number(v.length ?? 0),
          width: Number(v.width ?? 0),
          sheetsPerBox: Number(v.sheetsPerBox ?? 0),
          origin: v.origin ?? "",
          description: v.itemNameDescription
            ? {
                id: v.itemNameDescription.id ?? null,
                itemNumber: v.itemNameDescription.itemNumber ?? null,
                categoryName: v.itemNameDescription.categoryName ?? null,
                subCategory: v.itemNameDescription.subCategory ?? null,
                colorName: v.itemNameDescription.colorName ?? null,
                designName: v.itemNameDescription.designName ?? null,
              }
            : null,
        });
      }
    }
  }
  return rows;
}

export default function ItemBatchesSettings() {
  const [page, setPage] = useState(1);
  const [limit] = useState(100); // aligns with your controller defaults
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState(new Map()); // page -> rows[]
  const [hasMore, setHasMore] = useState(false);

  // selection
  const [selected, setSelected] = useState(() => new Set()); // variantIds
  const [force, setForce] = useState(false);

  // success/error modal
  const [modal, setModal] = useState({ open: false, type: "success", message: "" });

  // fetch one page
  const fetchPage = async (p) => {
    setLoading(true);
    try {
      const data = await getJSON(
        `/items/v1/filtered-items?page=${p}&limit=${limit}&includeEmpty=false`
      );
      const rows = flattenItemTree(data?.data || []);
      setPages((old) => {
        const next = new Map(old);
        next.set(p, rows);
        return next;
      });
      setHasMore(!!data?.hasMore);
    } catch (e) {
      setModal({
        open: true,
        type: "error",
        message: e?.message ? `Load failed: ${e.message}` : "Load failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pages.has(page)) fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const rows = useMemo(() => pages.get(page) || [], [pages, page]);

  // selection helpers
  const toggleOne = (variantId) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(variantId) ? next.delete(variantId) : next.add(variantId);
      return next;
    });

  const selectPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.variantId));
      return next;
    });

  const unselectPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => next.delete(r.variantId));
      return next;
    });

  const selectAllLoaded = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const [, list] of pages) list.forEach((r) => next.add(r.variantId));
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  // helpers: build a friendly success message
  const buildSuccessMessage = (result) => {
    // Expecting shapes like: { created, skipped, results: [...] } from your service
    if (!result || typeof result !== "object") return "Done.";
    const created = Number(result.created ?? 0);
    const skipped = Number(result.skipped ?? 0);
    const total = Number.isFinite(created + skipped) ? created + skipped : undefined;

    const parts = [];
    if (Number.isFinite(created)) parts.push(`Created: ${created}`);
    if (Number.isFinite(skipped)) parts.push(`Skipped: ${skipped}`);
    if (!parts.length) return "Done.";
    return total ? `${parts.join(" · ")} (Total processed: ${total})` : parts.join(" · ");
  };

  // actions
  const seedSelected = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const payload = { variantIds: Array.from(selected.values()) };
      if (force) payload.force = true;
      const data = await postJSON(`/items/batches/seed-clean`, payload);
      setModal({ open: true, type: "success", message: buildSuccessMessage(data) });
    } catch (e) {
      setModal({
        open: true,
        type: "error",
        message: e?.message ? `Operation failed: ${e.message}` : "Operation failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const seedAll = async () => {
    setLoading(true);
    try {
      const payload = force ? { all: true, force: true } : { all: true };
      const data = await postJSON(`/items/batches/seed-clean`, payload);
      setModal({ open: true, type: "success", message: buildSuccessMessage(data) });
    } catch (e) {
      setModal({
        open: true,
        type: "error",
        message: e?.message ? `Operation failed: ${e.message}` : "Operation failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="items-create-batches panel">
      <h2 className="items-create-batches__title">Item Batches</h2>
      <p className="items-create-batches__subtitle">
        Browse variants from <code>/items/v1/filtered-items</code>, select, then
        create one <b>Clean</b> batch per variant (empty date, zeros). Idempotent
        by default.
      </p>

      <div className="items-create-batches__toolbar icb-card">
        <div className="items-create-batches__pager">
          <button
            className="icb-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page === 1}
          >
            Prev
          </button>
          <span className="items-create-batches__page">Page {page}</span>
          <button
            className="icb-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || !hasMore}
          >
            Next
          </button>
        </div>

        <div className="items-create-batches__grow" />

        <label className="items-create-batches__force">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          <span>Force create even if Clean/empty exists</span>
        </label>

        <button
          className="icb-btn icb-btn--primary"
          onClick={seedSelected}
          disabled={loading || selected.size === 0}
        >
          Seed {selected.size} selected
        </button>
        <button className="icb-btn" onClick={seedAll} disabled={loading}>
          Seed ALL
        </button>
      </div>

      <div className="icb-card">
        <div className="items-create-batches__selectbar">
          <button
            className="icb-btn"
            onClick={selectPage}
            disabled={loading || rows.length === 0}
          >
            Select page
          </button>
          <button
            className="icb-btn"
            onClick={unselectPage}
            disabled={loading || rows.length === 0}
          >
            Unselect page
          </button>
          <button
            className="icb-btn"
            onClick={selectAllLoaded}
            disabled={loading || pages.size === 0}
          >
            Select all loaded
          </button>
          <button
            className="icb-btn"
            onClick={clearSelection}
            disabled={loading || selected.size === 0}
          >
            Clear
          </button>
        </div>

        <div className="items-create-batches__tablewrap">
          <table className="icb-table">
            <thead>
              <tr>
                <th style={{ width: 56 }}>Pick</th>
                <th>Name (Th)</th>{/* merged column: 5.5ملم ابيض */}
                <th>Type</th>
                <th>Dims (cm)</th>
                <th>SPB</th>
                <th>Origin</th>
                <th>Desc</th>
                <th>Variant ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="items-create-batches__empty">
                    {loading ? "Loading..." : "No variants on this page."}
                  </td>
                </tr>
              )}

              {rows.map((r) => {
                const desc = r.description
                  ? [
                      r.description.itemNumber,
                      r.description.categoryName,
                      r.description.subCategory,
                      r.description.colorName,
                      r.description.designName,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "";

                const checked = selected.has(r.variantId);
                const nameWithTh = Number.isFinite(r.thickness)
                  ? `${r.thickness}ملم ${r.itemName}`
                  : r.itemName;

                return (
                  <tr
                    key={r.variantId}
                    className={checked ? "is-selected" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(r.variantId)}
                      />
                    </td>

                    {/* RTL-friendly thickness + name */}
                    <td className="items-create-batches__name-rtl">
                      {nameWithTh}
                    </td>

                    <td>{r.type}</td>

                    <td>
                      {r.length > 0 && r.width > 0
                        ? `${r.length} × ${r.width}`
                        : "-"}
                    </td>
                    <td>{r.sheetsPerBox || "-"}</td>
                    <td>{r.origin || "-"}</td>
                    <td className="items-create-batches__desc">
                      {desc || "-"}
                    </td>
                    <td>{r.variantId}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification Modal */}
      {modal.open && (
        <NotificationModal
          type={modal.type}                  // "success" | "error" | "warning"
          message={modal.message}
          onClose={() => setModal((m) => ({ ...m, open: false }))}
          onConfirm={() => setModal((m) => ({ ...m, open: false }))}
          confirmLabel="OK"
          cancelLabel={null}
        />
      )}
    </div>
  );
}
