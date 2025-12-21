import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles/invoiceDisplayName.css";
import { axiosClient } from "../api/axiosClient"; 

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const norm = (s) => String(s ?? "").trim();

// ✅ endpoints (relative only)
const ENDPOINTS = {
  real: "/invoices/v1/invoice-display-names-real",
  description: "/invoices/invoice-display-names-description", // if yours is /invoices/v1/... change it
};

export default function InvoiceDisplayNamesPanel() {
  const [mode, setMode] = useState("real"); // 'real' | 'description'

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const [onlyChanged, setOnlyChanged] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [confirmFillOpen, setConfirmFillOpen] = useState(false);

  const originalMapRef = useRef(new Map()); // id -> original string (or "")
  const abortRef = useRef(null);

  const clearMessageSoon = () => {
    setTimeout(() => setMessage({ type: "", text: "" }), 2500);
  };

  // ✅ just the path (no baseUrl)
  const currentListPath = useMemo(() => {
    return ENDPOINTS[mode] || ENDPOINTS.real;
  }, [mode]);

  const fetchRows = async (q) => {
    try {
      setMessage({ type: "", text: "" });
      setLoading(true);

      // cancel previous request
      try {
        if (abortRef.current) abortRef.current.abort();
      } catch {}
      abortRef.current = new AbortController();

      const res = await axiosClient.get(currentListPath, {
        params: { q: q || undefined },
        signal: abortRef.current.signal,
      });

      const list = Array.isArray(res.data) ? res.data : [];
      const orig = new Map();
      for (const r of list) {
        orig.set(Number(r.itemVariantId), norm(r.invoiceDisplayName));
      }
      originalMapRef.current = orig;

      setRows(
        list.map((r) => ({
          ...r,
          invoiceDisplayName: norm(r.invoiceDisplayName),
          _dirty: false,
        }))
      );
    } catch (err) {
      if (err?.name === "CanceledError") return;
      console.error("Failed to load invoice display names:", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  // initial fetch
  useEffect(() => {
    fetchRows("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentListPath]);

  // Debounced search auto-fetch
  useEffect(() => {
    fetchRows(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, currentListPath]);

  const computeFallbackName = (row) =>
    (row.thickness != null ? `${parseFloat(row.thickness)} ملم ` : "") +
    (row.itemName || "");

  const setRowDisplayName = (index, nextValue) => {
    setRows((prev) => {
      const copy = [...prev];
      const row = { ...copy[index] };

      const v = norm(nextValue);
      row.invoiceDisplayName = v;

      const id = Number(row.itemVariantId);
      const orig = originalMapRef.current.get(id) ?? "";
      row._dirty = v !== orig;

      copy[index] = row;
      return copy;
    });
  };

  const dirtyCount = useMemo(
    () => rows.reduce((acc, r) => acc + (r._dirty ? 1 : 0), 0),
    [rows]
  );

  const filteredRows = useMemo(() => {
    if (!onlyChanged) return rows;
    return rows.filter((r) => r._dirty);
  }, [rows, onlyChanged]);

  const missingCountInView = useMemo(
    () => rows.reduce((acc, r) => acc + (!norm(r.invoiceDisplayName) ? 1 : 0), 0),
    [rows]
  );

  const handleSave = async () => {
    const dirtyItems = rows
      .filter((r) => r._dirty)
      .map((r) => ({
        itemVariantId: Number(r.itemVariantId),
        invoiceDisplayName: norm(r.invoiceDisplayName) || null,
      }));

    if (!dirtyItems.length) {
      setMessage({ type: "info", text: "No changes to save." });
      clearMessageSoon();
      return;
    }

    try {
      setSaving(true);
      setMessage({ type: "", text: "" });

      // ✅ relative path only
      const res = await axiosClient.put(`/invoices/v1/invoice-display-names`, {
        items: dirtyItems,
      });

      setMessage({
        type: "success",
        text: `Saved (${res.data?.updated ?? dirtyItems.length}).`,
      });
      clearMessageSoon();

      await fetchRows(debouncedSearch);
    } catch (err) {
      console.error("Failed to save invoice display names:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || err.message || "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevertRow = (index) => {
    setRows((prev) => {
      const copy = [...prev];
      const row = { ...copy[index] };
      const id = Number(row.itemVariantId);
      const orig = originalMapRef.current.get(id) ?? "";
      row.invoiceDisplayName = orig;
      row._dirty = false;
      copy[index] = row;
      return copy;
    });
  };

  const handleClearAllChanges = () => {
    setRows((prev) =>
      prev.map((r) => {
        const id = Number(r.itemVariantId);
        const orig = originalMapRef.current.get(id) ?? "";
        return { ...r, invoiceDisplayName: orig, _dirty: false };
      })
    );
    setMessage({ type: "info", text: "Changes cleared." });
    clearMessageSoon();
  };

  const handleFillDefaults = async () => {
    if (dirtyCount) {
      setMessage({
        type: "error",
        text: "You have unsaved changes. Save or clear them before filling defaults.",
      });
      clearMessageSoon();
      return;
    }

    try {
      setFilling(true);
      setMessage({ type: "", text: "" });

      // ✅ relative path only
      const res = await axiosClient.put(
        `/invoices/v1/invoice-display-names/fill-defaults`
      );

      const updated = res.data?.updated ?? 0;
      setMessage({
        type: "success",
        text: updated
          ? `Filled defaults for ${updated} items.`
          : "No missing items found (already filled).",
      });
      clearMessageSoon();

      await fetchRows(debouncedSearch);
    } catch (err) {
      console.error("Failed to fill defaults:", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to fill defaults",
      });
    } finally {
      setFilling(false);
      setConfirmFillOpen(false);
    }
  };

  const handleSwitchMode = (nextMode) => {
    if (nextMode === mode) return;

    if (dirtyCount) {
      setMessage({
        type: "error",
        text: "You have unsaved changes. Save or clear before switching list mode.",
      });
      clearMessageSoon();
      return;
    }

    setMode(nextMode);
  };

  return (
    <div className="invnames">
      {confirmFillOpen ? (
        <div
          className="invnames__modalBackdrop"
          onMouseDown={() => setConfirmFillOpen(false)}
        >
          <div
            className="invnames__modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="invnames__modalTitle">Fill missing defaults?</div>
            <div className="invnames__modalText">
              This will set a default invoice display name for all variants where it is missing
              (example: <b>{`<thickness> ملم <itemName>`}</b>).
              <br />
              <span className="invnames__muted">It won’t overwrite existing custom names.</span>
            </div>
            <div className="invnames__modalActions">
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmFillOpen(false)}
                disabled={filling}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleFillDefaults}
                disabled={filling}
              >
                {filling ? "Filling…" : "Fill Defaults"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="invnames__header">
        <div>
          <div className="invnames__title">Invoice Display Names</div>
          <div className="invnames__subtitle">
            Customize the item name shown on invoices.
          </div>

          <div className="invnames__modeToggle" style={{ marginTop: 10 }}>
            <button
              className={`btn btn--tiny ${mode === "real" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => handleSwitchMode("real")}
              disabled={loading || saving || filling}
              type="button"
              title="Order by RealDescription sort index"
            >
              Real
            </button>
            <button
              className={`btn btn--tiny ${mode === "description" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => handleSwitchMode("description")}
              disabled={loading || saving || filling}
              type="button"
              title="Order by ItemNameDescription sort index"
            >
              Description
            </button>

            <span className="invnames__muted" style={{ marginLeft: 10 }}>
              Showing: <b>{mode === "real" ? "RealDescription" : "ItemNameDescription"}</b>
            </span>
          </div>
        </div>

        <div className="invnames__actions">
          <div className="invnames__badge" title="Unsaved changes">
            <span
              className={`dot ${dirtyCount ? "dot--warn" : "dot--muted"}`}
            />
            {dirtyCount} changed
          </div>

          <button
            className="btn btn--ghost"
            onClick={handleClearAllChanges}
            disabled={!dirtyCount || loading || saving || filling}
            title="Revert all unsaved edits"
          >
            Clear changes
          </button>

          <button
            className="btn btn--ghost"
            onClick={() => setConfirmFillOpen(true)}
            disabled={loading || saving || filling}
            title={dirtyCount ? "Save or clear changes first" : "Fill missing defaults"}
          >
            {filling ? "Filling…" : "Fill missing defaults"}
            {missingCountInView ? ` (${missingCountInView})` : ""}
          </button>

          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={!dirtyCount || loading || saving || filling}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="invnames__toolbar">
        <div className="invnames__search">
          <span className="invnames__searchIcon">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search (${mode === "real" ? "real" : "description"} list)…`}
            spellCheck={false}
            disabled={loading || saving || filling}
          />
          {search ? (
            <button
              className="invnames__clear"
              onClick={() => setSearch("")}
              title="Clear search"
              type="button"
            >
              ✕
            </button>
          ) : null}
        </div>

        <label className="invnames__toggle">
          <input
            type="checkbox"
            checked={onlyChanged}
            onChange={(e) => setOnlyChanged(e.target.checked)}
            disabled={loading || saving || filling}
          />
          <span>Only changed</span>
        </label>
      </div>

      {message.text ? (
        <div
          className={`invnames__message invnames__message--${
            message.type || "info"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="invnames__tableWrap">
        <table className="invnames__table">
          <thead>
            <tr>
              <th style={{ width: 54 }}>#</th>
              <th style={{ width: 110 }}>Thickness</th>
              <th>System Name</th>
              <th style={{ width: 140 }}>Origin</th>
              <th style={{ width: 420 }}>Invoice Display Name</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <div className="invnames__loading">
                    <span className="spinner" />
                    Loading items…
                  </div>
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="invnames__empty">
                    <div className="invnames__emptyTitle">No results</div>
                    <div className="invnames__emptyText">
                      Try a different search, or disable “Only changed”.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const fallback = computeFallbackName(row);
                const chosen = norm(row.invoiceDisplayName) || fallback;

                const id = Number(row.itemVariantId);
                const orig = originalMapRef.current.get(id) ?? "";
                const isDirty = row._dirty;

                return (
                  <tr
                    key={row.itemVariantId}
                    className={isDirty ? "isDirty" : ""}
                  >
                    <td className="mono">
                      <span
                        className={`pill ${
                          isDirty ? "pill--warn" : "pill--muted"
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>

                    <td className="mono">{row.thickness ?? "-"}</td>

                    <td>
                      <div className="invnames__sysName">{row.itemName || "-"}</div>
                      <div className="invnames__muted">{fallback}</div>
                    </td>

                    <td className="mono">{row.origin || "-"}</td>

                    <td>
                      <div className="invnames__editCell">
                        <input
                          className="invnames__input"
                          value={row.invoiceDisplayName ?? ""}
                          placeholder={fallback}
                          onChange={(e) => setRowDisplayName(idx, e.target.value)}
                          disabled={saving || filling}
                        />

                        <button
                          className="btn btn--tiny btn--ghost"
                          onClick={() => handleRevertRow(idx)}
                          disabled={!isDirty || saving || filling}
                          title="Revert this row"
                          type="button"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="invnames__preview">
                        <span className="invnames__previewLabel">Preview:</span>{" "}
                        <span className="invnames__previewText">{chosen}</span>
                        {isDirty ? (
                          <span className="invnames__changedHint">
                            (was: {orig ? orig : "default"})
                          </span>
                        ) : !norm(row.invoiceDisplayName) ? (
                          <span className="invnames__changedHint">
                            (using default)
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="invnames__footer">
        <div className="invnames__muted">
          Tip: leave it empty to use the default “{`<thickness> ملم <itemName>`}”.
        </div>
        <button
          className="btn btn--primary"
          onClick={handleSave}
          disabled={!dirtyCount || loading || saving || filling}
        >
          {saving ? "Saving…" : `Save (${dirtyCount})`}
        </button>
      </div>
    </div>
  );
}
