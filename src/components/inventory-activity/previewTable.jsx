// PreviewTable.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import EditCountModal from "./editModal";
import "./previewTable.css";

/* =========================
   Helpers
   ========================= */
const normalizeDigits = (s) => {
  if (!s) return "";
  const map = {
    "٠": "0","١":"1","٢":"2","٣":"3","٤":"4",
    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4",
    "۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
  };
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
};
const normalizeArabicAlef = (s) => String(s || "").replace(/[أإآ]/g, "ا");

const parseChip = (rawChip) => {
  // Extracts thickness, (L*W-SPB), and leftover tokens as itemName tokens
  let src = normalizeDigits(String(rawChip || "").trim())
    .replace(/[xX×]/g, "*")
    .replace(/\s+/g, " ");

  // thickness "5.5ملم" / "5.5 مم"
  const thkM = src.match(/(\d+(?:\.\d+)?)\s*م?\s*ل?\s*م/);
  const thickness = thkM ? Number(thkM[1]) : undefined;
  if (thkM) src = src.replace(thkM[0], " ");

  // dimension "225*321-027" (SPB optional)
  const dimM = src.match(/(\d{2,4})\s*\*\s*(\d{2,4})(?:\s*-\s*(\d{1,3}))?/);
  const length = dimM ? Number(dimM[1]) : undefined;
  const width = dimM ? Number(dimM[2]) : undefined;
  const sheetsPerBox = dimM && dimM[3] != null ? Number(dimM[3]) : undefined;
  if (dimM) src = src.replace(dimM[0], " ");

  const leftover = normalizeArabicAlef(src).trim();
  const nameTokens = leftover ? leftover.split(/\s+/).filter(Boolean) : [];

  return { thickness, length, width, sheetsPerBox, nameTokens };
};

const toDateInputValue = (v) => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v);

  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "";

  // convert to local date yyyy-mm-dd (prevents off-by-one from timezone)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const mergeChipParams = (chips) => {
  // Combine all chips → one params object
  const out = {
    q: chips.join(" ").trim(), // still pass q for backend robustness
    itemName: "",              // aggregated tokens
  };
  const tokens = [];

  chips.forEach((c) => {
    const parsed = parseChip(c);
    if (Number.isFinite(parsed.thickness)) out.thickness = parsed.thickness;
    if (Number.isFinite(parsed.length)) out.length = parsed.length;
    if (Number.isFinite(parsed.width)) out.width = parsed.width;
    if (Number.isFinite(parsed.sheetsPerBox)) out.sheetsPerBox = parsed.sheetsPerBox;
    if (parsed.nameTokens?.length) tokens.push(...parsed.nameTokens);
  });

  if (tokens.length) out.itemName = tokens.join(" ");
  return out;
};

// Map /search rows (already shaped like filtered) → view rows (identity)
const mapSearchRowToView = (r) => ({
  id: r.id ?? null,
  itemVariantName: r.itemVariantName,
  thickness: r.thickness,
  length: r.length,
  width: r.width,
  sheetsPerBox: r.sheetsPerBox,
  origin: r.origin,
  itemVariantType: r.itemVariantType,
  date: toDateInputValue(r.date),
  count: r.count ?? null,
  sqm: r.sqm ?? null,
  type: r.type ?? null,
  finalCost: r.finalCost ?? null,
  finalCostOfr: r.finalCostOfr ?? null,
  itemBatches: Array.isArray(r.itemBatches) ? r.itemBatches : [],
});

const mapFilteredRowToView = (r) => ({
  id: r.id,
  itemVariantName: r.itemVariantName,
  thickness: r.thickness,
  length: r.length,
  width: r.width,
  sheetsPerBox: r.sheetsPerBox,
  origin: r.origin,
  itemVariantType: r.itemVariantType,
  date: toDateInputValue(r.date),
  count: r.count,
  sqm: r.sqm,
  type: r.type,
  finalCost: r.finalCost,
  finalCostOfr: r.finalCostOfr,
  itemBatches: Array.isArray(r.itemBatches) ? r.itemBatches : [],
});

/* =========================
   Component
   ========================= */
const PreviewTable = () => {
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // UI state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // selection + modal
  const [selected, setSelected] = useState(new Set());
  const [editOpen, setEditOpen] = useState(false);

  // ✅ NEW: delete flow state
  const [deleting, setDeleting] = useState(false);

  // search chips
  const [chips, setChips] = useState([]);
  const [qInput, setQInput] = useState("");

  // Fetchers
  const fetchFiltered = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${baseUrl}/inventory-count/v1/filtered`);
      const mapped = Array.isArray(data) ? data.map(mapFilteredRowToView) : [];
      setRows(mapped);
    } catch (e) {
      console.error("Failed to fetch count transactions", e);
      setError("Failed to load data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const fetchSearch = useCallback(async () => {
    const params = mergeChipParams(chips);
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${baseUrl}/inventory-count/v1/search`, {
        params: {
          ...(params.q ? { q: params.q } : {}),
          ...(params.itemName ? { itemName: params.itemName } : {}),
          ...(Number.isFinite(params.thickness) ? { thickness: params.thickness } : {}),
          ...(Number.isFinite(params.length) ? { length: params.length } : {}),
          ...(Number.isFinite(params.width) ? { width: params.width } : {}),
          ...(Number.isFinite(params.sheetsPerBox) ? { sheetsPerBox: params.sheetsPerBox } : {}),
          page: 1,
          limit: 200,
        },
      });

      const arr = Array.isArray(data?.data) ? data.data : [];
      const mapped = arr.map(mapSearchRowToView);
      setRows(mapped);
    } catch (e) {
      console.error("Search failed", e);
      setError("Search failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, chips]);

  // Initial load (no chips → filtered)
  useEffect(() => {
    if (chips.length === 0) fetchFiltered();
  }, [chips.length, fetchFiltered]);

  // Re-run search when chips change (if any)
  useEffect(() => {
    if (chips.length > 0) fetchSearch();
  }, [chips, fetchSearch]);

  // Chip actions
  const addChipFromInput = () => {
    const raw = normalizeDigits(qInput).trim().replace(/\s+/g, " ");
    if (!raw) return;
    setChips((prev) => (prev.includes(raw) ? prev : [...prev, raw]));
    setQInput("");
    setSelected(new Set()); // clear selection on new query
  };
  const removeChip = (idx) => {
    setChips((prev) => {
      const next = prev.slice();
      next.splice(idx, 1);
      return next;
    });
    setSelected(new Set());
  };
  const clearChips = () => {
    setChips([]);
    setQInput("");
    setSelected(new Set());
  };

  const onSearchInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addChipFromInput();
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  // ✅ NEW: Delete selected counts
  const handleDeleteSelected = async () => {
    const ids = Array.from(selected).filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) return;

    const ok = window.confirm(
      `Delete ${ids.length} count(s)?\nThis will also delete related inventory transactions and recompute batch/variant totals.`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      // NOTE: Adjust URL to match your NestJS route
      // Expected payload: { ids: number[] }
      await axios.post(`${baseUrl}/inventory-count/v1/delete-counts-strict`, { ids });

      // remove from UI immediately
      setRows((prev) => prev.filter((r) => !selected.has(r.id)));
      setSelected(new Set());

      // optional refresh to be 100% sure server recompute is reflected
      if (chips.length > 0) await fetchSearch();
      else await fetchFiltered();
    } catch (e) {
      console.error("Delete failed", e);
      alert(
        "Delete failed.\nIf any selected count does not have a related inventory transaction, the server will throw an error."
      );
    } finally {
      setDeleting(false);
    }
  };

  const selectedRows = rows
    .filter((r) => selected.has(r.id))
    .map((r) => ({
      ...r,
      itemBatchId: r.itemBatches?.[0]?.id || null,
    }));

  /* ---------- Render ---------- */
  if (loading && rows.length === 0) {
    return (
      <div className="count-preview-container">
        <div className="count-preview-header">
          <div className="count-preview-search-bar" dir="rtl">
            <div className="count-preview-chipsline">
              {chips.map((c, idx) => (
                <span className="count-preview-chip" key={`${c}-${idx}`}>
                  {c}
                  <button
                    className="count-preview-chip-x"
                    onClick={() => removeChip(idx)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              className="count-preview-search-input"
              placeholder="ابحث… (Enter → pin) مثال: 5.5ملم ابيض  •  ثم أضف 225*321-027 كـ chip ثانية للتصفية"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={onSearchInputKeyDown}
            />
            <div className="count-preview-search-actions">
              <button className="count-preview-chip-btn" onClick={addChipFromInput}>Add</button>
              {chips.length > 0 && (
                <button className="count-preview-chip-btn ghost" onClick={clearChips}>Clear</button>
              )}
            </div>
          </div>
        </div>
        <div className="count-preview-loading">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="count-preview-container">
        <div className="count-preview-header">
          <div className="count-preview-search-bar" dir="rtl">
            <div className="count-preview-chipsline">
              {chips.map((c, idx) => (
                <span className="count-preview-chip" key={`${c}-${idx}`}>
                  {c}
                  <button
                    className="count-preview-chip-x"
                    onClick={() => removeChip(idx)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              className="count-preview-search-input"
              placeholder="ابحث… (Enter → pin)"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={onSearchInputKeyDown}
            />
            <div className="count-preview-search-actions">
              <button className="count-preview-chip-btn" onClick={addChipFromInput}>Add</button>
              {chips.length > 0 && (
                <button className="count-preview-chip-btn ghost" onClick={clearChips}>Clear</button>
              )}
            </div>
          </div>
        </div>
        <div className="count-preview-error">{error}</div>
      </div>
    );
  }

  const disableActions = deleting || loading;

  return (
    <>
      <div className="count-preview-container">
        <div className="count-preview-header">
          {/* Search with chips */}
          <div className="count-preview-search-bar" dir="rtl">
            <div className="count-preview-chipsline">
              {chips.map((c, idx) => (
                <span className="count-preview-chip" key={`${c}-${idx}`}>
                  {c}
                  <button
                    className="count-preview-chip-x"
                    onClick={() => removeChip(idx)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              className="count-preview-search-input"
              placeholder="ابحث… (Enter → pin) مثال: 5.5ملم ابيض  •  ثم أضف 225*321-027 كـ chip ثانية للتصفية"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={onSearchInputKeyDown}
            />
            <div className="count-preview-search-actions">
              <button className="count-preview-chip-btn" onClick={addChipFromInput}>Add</button>
              {chips.length > 0 && (
                <button className="count-preview-chip-btn ghost" onClick={clearChips}>Clear</button>
              )}
            </div>
          </div>

          {/* Edit + Delete buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="count-preview-edit-btn"
              onClick={() => setEditOpen(true)}
              disabled={selected.size === 0 || disableActions}
            >
              Edit
            </button>

            {/* ✅ NEW DELETE BUTTON */}
            <button
              className="count-preview-edit-btn"
              onClick={handleDeleteSelected}
              disabled={selected.size === 0 || disableActions}
              title="Deletes selected InventoryCount(s) + related InventoryTransaction(s), then recomputes totals"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="count-preview-table">
          <thead>
            <tr>
              <th>Select</th>
              <th className="count-preview-itemname">Item Name</th>
              <th>Dimensions</th>
              <th>Origin</th>
              <th>Unit</th>
              <th>Date</th>
              <th>Count</th>
              <th>SQM</th>
              <th>Type</th>
              <th>Final Cost</th>
              <th>Final OFR</th>
              <th>Condition</th>
              <th>Date Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: "center", opacity: 0.7 }}>
                  No rows.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const itemName = `${r.thickness} ملم ${r.itemVariantName}`;
                let dimension = `${r.length}×${r.width}`;
                if (r.itemVariantType === "box") {
                  const p = String(r.sheetsPerBox).padStart(2, "0");
                  dimension += `-${p}`;
                }
                const firstBatch = r.itemBatches?.[0] || {};
                return (
                  <tr key={r.id ?? `${r.itemVariantName}-${r.length}-${r.width}-${r.sheetsPerBox}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        disabled={disableActions || r.id == null}
                      />
                    </td>
                    <td className="count-preview-itemname">{itemName}</td>
                    <td>{dimension}</td>
                    <td>{r.origin || ""}</td>
                    <td>{r.itemVariantType}</td>
                    <td>{r.date ?? "-"}</td>
                    <td>{r.count ?? "-"}</td>
                    <td>{r.sqm ?? "-"}</td>
                    <td>{r.type ?? "-"}</td>
                    <td>{r.finalCost != null ? r.finalCost : "-"}</td>
                    <td>{r.finalCostOfr != null ? r.finalCostOfr : "-"}</td>
                    <td>{firstBatch.condition || "-"}</td>
                    <td>{firstBatch.dateReceived || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <EditCountModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          initialRows={selectedRows}
        />
      )}
    </>
  );
};

export default PreviewTable;
