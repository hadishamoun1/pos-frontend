// src/components/inventory-activity/SearchBatchModal.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { axiosClient } from "../api/axiosClient";
import "./searchInventoryCheck.css";

const PAGE_SIZE = 100;

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const safeStr = (v) => (v == null ? "" : String(v));

const formatThkItem = (r) => {
  const thk = safeStr(r.thickness).trim();
  const name = safeStr(r.itemName).trim();
  if (!thk && !name) return "";
  if (thk && name) return `${thk}ملم ${name}`;
  if (thk) return `${thk}ملم`;
  return name;
};

const normalizeUnit = (r) => {
  const t = safeStr(r.type).trim().toLowerCase();
  if (t === "box") return "box";
  if (t === "sheet") return "sheet";
  if (t === "sqm" || t === "cvm" || t === "m2") return "sqm";
  if (safeNum(r.sheetsPerBox) > 0) return "box";
  if (safeNum(r.length) > 0 && safeNum(r.width) > 0) return "sheet";
  return t || "-";
};

const makeRowKey = (r) => {
  const hardId = r?.batchItemId ?? r?.rowId ?? r?.id ?? r?.itemBatchRowId ?? null;
  if (hardId != null) return `id:${String(hardId)}`;

  const parts = [
    `batch:${safeStr(r.batchId)}`,
    `variant:${safeStr(r.variantId)}`,
    `len:${safeStr(r.length)}`,
    `wid:${safeStr(r.width)}`,
    `spb:${safeStr(r.sheetsPerBox)}`,
    `cond:${safeStr(r.condition)}`,
    `date:${safeStr(r.dateReceived)}`,
    `type:${safeStr(r.type)}`,
  ];
  return parts.join("|");
};

const SearchBatchModal = ({
  isOpen,
  onClose,

  // ✅ support both names so it never crashes
  onSelect,
  onSelectItems,

  // optional: exclude source batch from list
  excludeBatchId = null,
}) => {
  // ✅ SAME single input as StockTab
  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selectedMap, setSelectedMap] = useState({}); // { [rowKey]: true }

  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const cancelInFlight = () => {
    const ctl = abortRef.current;
    if (ctl?.abort) {
      try {
        ctl.abort();
      } catch {}
    }
    const next = new AbortController();
    abortRef.current = next;
    return next.signal;
  };

  const normalizeDigits = useCallback((s = "") => {
    return String(s)
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
      .replace(/،/g, ",");
  }, []);

  const normalizeArabic = useCallback((s = "") => {
    return String(s || "")
      .replace(/[\u064B-\u065F]/g, "")
      .replace(/\u0640/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ئ/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const looksLikeDims = useCallback(
    (s) => {
      if (!s) return false;
      const t = normalizeDigits(s).trim();
      if (!t.includes("*")) return false;
      const [L, rest] = t.split("*");
      if (!L || !rest) return false;
      if (!/^\s*\d+(\.\d+)?\s*$/.test(L)) return false;
      const parts = rest.split("-");
      if (!/^\s*\d+(\.\d+)?\s*$/.test(parts[0] || "")) return false;
      if (parts[1] && !/^\s*\d+\s*$/.test(parts[1])) return false;
      return true;
    },
    [normalizeDigits]
  );

  const isPlainNumber = useCallback(
    (s) => {
      if (!s) return false;
      const t = normalizeDigits(String(s)).trim();
      return /^\d{1,5}(\.\d+)?$/.test(t);
    },
    [normalizeDigits]
  );

  const clearEverything = useCallback(() => {
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setInputValue("");
    setNameChip("");
    setDimsChip("");

    setPage(1);
    setRows([]);
    setHasMore(false);
    setErr("");

    setSelectedMap({});
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [isOpen]);

  const inSearchMode = Boolean(nameChip || dimsChip);

  const fetchDefaultPage = useCallback(
    async (targetPage) => {
      if (!isOpen) return;
      setLoading(true);
      setErr("");
      try {
        const signal = cancelInFlight();

        const res = await axiosClient.get(`/items/v2/filtered-items`, {
          params: { page: targetPage, limit: PAGE_SIZE },
          signal,
        });

        const payload = res?.data || {};
        const list = Array.isArray(payload?.data) ? payload.data : [];

        const cleaned = excludeBatchId
          ? list.filter((r) => Number(r.batchId) !== Number(excludeBatchId))
          : list;

        setRows((prev) => (targetPage === 1 ? cleaned : [...prev, ...cleaned]));
        setHasMore(!!payload?.hasMore);
        setPage(targetPage);
      } catch (e) {
        if (axios.isCancel?.(e)) return;
        setErr(e?.response?.data?.message || e?.message || "Failed to load batches");
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [excludeBatchId, isOpen]
  );

  const fetchSearchFromApi = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setErr("");
    try {
      const signal = cancelInFlight();

      const params = { page: 1, limit: 200 };

      if (nameChip) params.q = normalizeArabic(nameChip);

      const raw = dimsChip ? normalizeDigits(dimsChip.trim()) : "";
      if (raw) {
        if (looksLikeDims(raw)) params.dims = raw;
        else if (isPlainNumber(raw)) params.length = Number(raw);
      }

      // ✅ SAME API AS STOCK TAB
      const res = await axiosClient.get(`/items/pos/search-modal-instock`, {
        params,
        signal,
      });

      const nested = Array.isArray(res.data) ? res.data : [];

      const out = [];
      (nested || []).forEach((item) => {
        (item.thicknesses || []).forEach((th) => {
          (th.variants || []).forEach((v) => {
            if (!Array.isArray(v.batches) || v.batches.length === 0) return;

            v.batches.forEach((b) => {
              const row = {
                variantId: v.id,
                batchId: b.id,

                itemName: item.itemName,
                type: item.type,
                thickness: th.thickness,

                length: v.length,
                width: v.width,
                sheetsPerBox: v.sheetsPerBox,

                condition: b.condition,
                dateReceived: b.dateReceived,
                balanceOFR: b.balanceOFR,
              };

              if (
                excludeBatchId &&
                Number(row.batchId) === Number(excludeBatchId)
              ) {
                return;
              }

              out.push(row);
            });
          });
        });
      });

      setRows(out);
      setHasMore(false);
      setPage(1);
    } catch (e) {
      if (axios.isCancel?.(e)) return;
      setErr(e?.response?.data?.message || e?.message || "Search failed");
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [
    dimsChip,
    excludeBatchId,
    isOpen,
    isPlainNumber,
    looksLikeDims,
    nameChip,
    normalizeArabic,
    normalizeDigits,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    if (inSearchMode) {
      fetchSearchFromApi();
      return () => abortRef.current?.abort?.();
    }

    fetchDefaultPage(1);
    return () => abortRef.current?.abort?.();
  }, [fetchDefaultPage, fetchSearchFromApi, inSearchMode, isOpen]);

  const handleEnter = (e) => {
    if (e.key !== "Enter") return;

    const raw0 = inputValue.trim();
    if (!raw0) return;

    const raw = normalizeDigits(raw0).trim();
    const parts = raw.split(/\s+/).filter(Boolean);

    const dimsToken = parts.find((p) => p.includes("*") && looksLikeDims(p));
    if (dimsToken) {
      setDimsChip(dimsToken);
      const rest = parts.filter((p) => p !== dimsToken).join(" ").trim();
      if (rest) setNameChip(normalizeArabic(rest));
      setInputValue("");
      return;
    }

    const numIdx = [];
    for (let i = 0; i < parts.length; i++) {
      if (isPlainNumber(parts[i])) numIdx.push(i);
    }

    if (numIdx.length >= 2) {
      const a = parts[numIdx[0]];
      const b = parts[numIdx[1]];
      setDimsChip(`${a}*${b}`);

      const restParts = parts.slice();
      restParts.splice(numIdx[1], 1);
      restParts.splice(numIdx[0], 1);

      const rest = restParts.join(" ").trim();
      if (rest) setNameChip(normalizeArabic(rest));

      setInputValue("");
      return;
    }

    if (numIdx.length === 1) {
      const n = parts[numIdx[0]];
      setDimsChip(n);

      const restParts = parts.slice();
      restParts.splice(numIdx[0], 1);

      const rest = restParts.join(" ").trim();
      if (rest) setNameChip(normalizeArabic(rest));

      setInputValue("");
      return;
    }

    setNameChip(normalizeArabic(raw));
    setInputValue("");
  };

  const triggerEnterSearch = useCallback(() => {
    if (!String(inputValue || "").trim()) return;
    handleEnter({ key: "Enter" });
  }, [handleEnter, inputValue]);

  useEffect(() => {
    if (!isOpen) return;
    if (!inSearchMode) return;
    fetchSearchFromApi();
  }, [fetchSearchFromApi, inSearchMode, isOpen]);

  const selectedCount = useMemo(
    () => Object.values(selectedMap).filter(Boolean).length,
    [selectedMap]
  );

  const toggleRow = (rowKey) => {
    setSelectedMap((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => !!selectedMap[makeRowKey(r)]);

  const toggleSelectAllVisible = () => {
    if (rows.length === 0) return;

    if (allVisibleSelected) {
      setSelectedMap((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          delete next[makeRowKey(r)];
        });
        return next;
      });
    } else {
      setSelectedMap((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          next[makeRowKey(r)] = true;
        });
        return next;
      });
    }
  };

  const handleOk = () => {
    const selected = rows
      .filter((r) => !!selectedMap[makeRowKey(r)])
      .map((r) => ({
        batchId: r.batchId,
        dateReceived: r.dateReceived ?? null,
        condition: r.condition ?? null,
        balanceOFR: r.balanceOFR ?? null,

        itemName: r.itemName,
        thickness: r.thickness,
        type: r.type,
        variantId: r.variantId,

        length: r.length,
        width: r.width,
        sheetsPerBox: r.sheetsPerBox,
        unit: normalizeUnit(r),
      }));

    // ✅ call whichever callback exists (prevents crash)
    const cb =
      typeof onSelect === "function"
        ? onSelect
        : typeof onSelectItems === "function"
        ? onSelectItems
        : null;

    if (!cb) {
      console.warn(
        "SearchBatchModal: missing callback. Pass `onSelect` or `onSelectItems`."
      );
      // don’t crash; just close
      onClose?.();
      return;
    }

    cb(selected);
    onClose?.();
  };

  const doRefresh = () => {
    setSelectedMap({});
    setErr("");
    abortRef.current?.abort?.();

    if (inSearchMode) fetchSearchFromApi();
    else fetchDefaultPage(1);
  };

  if (!isOpen) return null;

  return (
    <div
      className="search-batch-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="search-batch-content" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-batch-header">
          <div className="search-batch-title">Choose Batch</div>
          <button className="search-batch-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="search-batch-actions">
          <button type="button" className="search-batch-btn" onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className="search-batch-btn primary"
            onClick={handleOk}
            disabled={selectedCount === 0}
          >
            OK ({selectedCount})
          </button>
        </div>

        <div
          className="search-batch-input-row"
          onContextMenu={(e) => {
            e.preventDefault();
            triggerEnterSearch();
          }}
        >
          <div className="search-batch-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="search-batch-input"
              placeholder="اكتب ثم Enter — مثال: 5.5ملم ابيض  |  225*321-012  |  225 321"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleEnter}
              autoFocus
            />

            <button
              type="button"
              className="search-batch-clear"
              onClick={clearEverything}
              title="Clear"
            >
              Clear
            </button>

            <button
              type="button"
              className="search-batch-refresh"
              onClick={doRefresh}
              disabled={loading}
              title="Refresh"
            >
              Refresh
            </button>
          </div>

          <div className="search-batch-chips">
            {nameChip && (
              <span className="search-batch-chip" title={nameChip}>
                <span className="search-batch-chip-label" dir="rtl">
                  {nameChip}
                </span>
                <button
                  className="search-batch-chip-x"
                  onClick={() => setNameChip("")}
                  aria-label="Remove name filter"
                  type="button"
                >
                  ×
                </button>
              </span>
            )}

            {dimsChip && (
              <span className="search-batch-chip" title={dimsChip}>
                <span className="search-batch-chip-label" dir="ltr">
                  <bdi>{dimsChip}</bdi>
                </span>
                <button
                  className="search-batch-chip-x"
                  onClick={() => setDimsChip("")}
                  aria-label="Remove dims/length filter"
                  type="button"
                >
                  ×
                </button>
              </span>
            )}

            <span className="search-batch-meta">
              {(nameChip || dimsChip) ? "Search API" : "Browse"} • Rows: {rows.length}
            </span>
          </div>

          {err ? <div className="search-batch-error">{String(err)}</div> : null}
        </div>

        <div className="search-batch-body">
          <table className="search-batch-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={!!allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible"
                  />
                </th>
                <th className="col-item">Thk + Item</th>
                <th className="col-unit">Unit</th>
                <th className="col-len">Length</th>
                <th className="col-wid">Width</th>
                <th className="col-spb">Sheets/Box</th>
                <th className="col-date">Date Received</th>
                <th className="col-cond">Condition</th>
                <th className="col-bal">Balance</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const unit = normalizeUnit(r);
                const length = safeNum(r.length) > 0 ? safeNum(r.length) : "";
                const width = safeNum(r.width) > 0 ? safeNum(r.width) : "";
                const spb =
                  unit === "box" && safeNum(r.sheetsPerBox) > 0
                    ? safeNum(r.sheetsPerBox)
                    : "";

                const rowKey = makeRowKey(r);
                const checked = !!selectedMap[rowKey];

                return (
                  <tr key={rowKey}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(rowKey)}
                        aria-label="Select row"
                      />
                    </td>

                    <td className="col-item rtl">{formatThkItem(r)}</td>
                    <td className="col-unit">{unit}</td>
                    <td className="col-len">{length || "-"}</td>
                    <td className="col-wid">{width || "-"}</td>
                    <td className="col-spb">
                      {spb || (unit === "box" ? "0" : "-")}
                    </td>
                    <td className="col-date">{safeStr(r.dateReceived)}</td>
                    <td className="col-cond">{safeStr(r.condition)}</td>
                    <td className="col-bal">{safeStr(r.balanceOFR)}</td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="search-batch-empty">
                    No results
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="search-batch-footer">
            {loading ? (
              <div className="search-batch-muted">Loading...</div>
            ) : !(nameChip || dimsChip) && hasMore ? (
              <button
                type="button"
                className="search-batch-btn"
                onClick={() => fetchDefaultPage(page + 1)}
              >
                Load more
              </button>
            ) : (
              <div className="search-batch-muted">
                {(nameChip || dimsChip) ? "Search results" : "End"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchBatchModal;
