// src/components/pos-system/SqmPiecesTab.jsx
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { axiosClient } from "../api/axiosClient";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt2 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const THICKNESS_BUBBLES = ["3", "4", "5", "5.5", "6", "8", "10", "12", "15", "19"];

const normalizeDigits = (s = "") =>
  String(s)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/،/g, ",");

const looksLikeDims = (s) => {
  if (!s) return false;
  const t = normalizeDigits(s).trim();
  if (!t.includes("*")) return false;
  const [L, R] = t.split("*");
  return /^\s*\d+(\.\d+)?\s*$/.test(L) && /^\s*\d+(\.\d+)?\s*$/.test(R ?? "");
};

const isPlainNumber = (s) =>
  /^\d{1,5}(\.\d+)?$/.test(normalizeDigits(String(s || "")).trim());

const SqmPiecesTab = forwardRef(function SqmPiecesTab(
  {
    modalOpen,
    isActive,
    onSelectionCountChange,
    selectedMap: selectedMapProp,
    setSelectedMap: setSelectedMapProp,
  },
  ref
) {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");
  const [thicknessFilter, setThicknessFilter] = useState("");

  const [internalSelectedMap, setInternalSelectedMap] = useState(() => new Map());
  const selectedMap = selectedMapProp ?? internalSelectedMap;
  const setSelectedMap = setSelectedMapProp ?? setInternalSelectedMap;

  const abortRef = useRef(null);
  const searchInputRef = useRef(null);

  const cancelInFlight = () => {
    const ctl = abortRef.current;
    if (ctl && typeof ctl.abort === "function") {
      try { ctl.abort(); } catch {}
    }
    const next = new AbortController();
    abortRef.current = next;
    return next.signal;
  };

  const normalizeApiRows = (data) => {
    const rawRows = Array.isArray(data) ? data : data?.rows || [];
    return rawRows.map((r) => {
      const pieceId = r.sqmPieceId ?? r.id;
      return {
        ...r,
        id: pieceId,
        type: "sqm",
        sqmPieceId: pieceId,
        itemVariantId: r.itemVariantId,
        batchId: r.itemBatchId,
        thickness: r.thickness,
        itemName: r.itemName,
        length: r.length,
        width: r.width,
        piecesRemaining: r.piecesRemaining,
        transferNumber: r.transferNumber,
        label: r.label,
      };
    });
  };

  const isCanceled = (err) =>
    err?.name === "CanceledError" ||
    err?.code === "ERR_CANCELED" ||
    err?.message?.toLowerCase?.().includes("canceled") ||
    err?.message?.toLowerCase?.().includes("cancelled");

  const fetchPieces = async (query = "") => {
    if (!modalOpen || !isActive) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const signal = cancelInFlight();
      const res = await axiosClient.get(`/sqm-pieces/pos-pieces`, {
        params: { q: query.trim() || undefined },
        signal,
      });
      setAllRows(normalizeApiRows(res.data));
    } catch (err) {
      if (isCanceled(err)) return;
      console.error("Failed to load SQM pieces for POS search", err);
      setErrorMsg(
        err?.response?.data?.message || "Failed to load SQM pieces. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Reset on modal open
  useEffect(() => {
    if (!modalOpen) return;
    setSelectedMap(new Map());
    onSelectionCountChange?.(0);
  }, [modalOpen]);

  // Fetch when tab becomes active or nameChip changes
  useEffect(() => {
    if (!modalOpen || !isActive) return;
    fetchPieces(nameChip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, isActive, nameChip]);

  // Client-side filtering: thickness + dimensions
  const rows = useMemo(() => {
    let filtered = allRows;

    if (thicknessFilter) {
      filtered = filtered.filter(
        (r) => String(Number(r.thickness)) === thicknessFilter
      );
    }

    if (dimsChip) {
      const raw = normalizeDigits(dimsChip.trim());
      if (raw.includes("*")) {
        const [lStr, rStr] = raw.split("*");
        const L = parseFloat(lStr);
        const W = parseFloat(rStr);
        if (Number.isFinite(L) && Number.isFinite(W)) {
          filtered = filtered.filter(
            (r) =>
              (num(r.length) === L && num(r.width) === W) ||
              (num(r.length) === W && num(r.width) === L)
          );
        }
      } else {
        const N = parseFloat(raw);
        if (Number.isFinite(N)) {
          filtered = filtered.filter(
            (r) => num(r.length) === N || num(r.width) === N
          );
        }
      }
    }

    return filtered;
  }, [allRows, thicknessFilter, dimsChip]);

  useImperativeHandle(ref, () => ({
    collectSelected: () => Array.from(selectedMap.values()),
  }));

  const handleEnter = (e) => {
    if (e.key !== "Enter") return;
    const raw = normalizeDigits(inputValue.trim());
    if (!raw) return;

    const parts = raw.split(/\s+/).filter(Boolean);

    // Check for explicit L*W token
    const dimsToken = parts.find((p) => looksLikeDims(p));
    if (dimsToken) {
      setDimsChip(dimsToken);
      const rest = parts.filter((p) => p !== dimsToken).join(" ").trim();
      if (rest) setNameChip(rest);
      setInputValue("");
      return;
    }

    // Two plain numbers → treat as L*W
    const numIdxs = parts.reduce((acc, p, i) => {
      if (isPlainNumber(p)) acc.push(i);
      return acc;
    }, []);
    if (numIdxs.length >= 2) {
      setDimsChip(`${parts[numIdxs[0]]}*${parts[numIdxs[1]]}`);
      const rest = parts.filter((_, i) => !numIdxs.slice(0, 2).includes(i)).join(" ").trim();
      if (rest) setNameChip(rest);
      setInputValue("");
      return;
    }

    // One plain number → single dimension filter
    if (numIdxs.length === 1) {
      setDimsChip(parts[numIdxs[0]]);
      const rest = parts.filter((_, i) => i !== numIdxs[0]).join(" ").trim();
      if (rest) setNameChip(rest);
      setInputValue("");
      return;
    }

    // Pure text → name chip (sent to backend)
    setNameChip(raw);
    setInputValue("");
  };

  const clearEverything = () => {
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    setThicknessFilter("");
    setTimeout(() => searchInputRef.current?.focus?.(), 0);
  };

  const toggleRow = (row) => {
    const rowId = row.id;
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.set(rowId, row);
      onSelectionCountChange?.(next.size);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const visibleIds = rows.map((r) => r.id);
      const allVisibleSelected =
        rows.length > 0 && visibleIds.every((id) => next.has(id));
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        rows.forEach((r) => next.set(r.id, r));
      }
      onSelectionCountChange?.(next.size);
      return next;
    });
  };

  const allVisibleChecked =
    rows.length > 0 && rows.every((r) => selectedMap.has(r.id));
  const someVisibleChecked =
    rows.some((r) => selectedMap.has(r.id)) && !allVisibleChecked;

  return (
    <div className="sqm-pieces-tab">
      {/* ── Search input row ── */}
      <div className="search-modal-item-input-row">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            ref={searchInputRef}
            type="text"
            className="search-modal-items-input"
            placeholder="Search by item name, transfer # … then press Enter"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleEnter}
            autoFocus
          />
          <button
            type="button"
            className="search-clear-btn"
            onClick={clearEverything}
            title="Clear"
          >
            Clear
          </button>
        </div>

        <div className="search-modal-chips">
          {nameChip && (
            <span className="search-chip" title={nameChip}>
              <span className="search-chip-label search-chip-label--name" dir="rtl">
                {nameChip}
              </span>
              <button
                className="search-chip-x"
                onClick={() => setNameChip("")}
                aria-label="Remove name filter"
              >
                ×
              </button>
            </span>
          )}

          {dimsChip && (
            <span className="search-chip" title={dimsChip}>
              <span className="search-chip-label search-chip-label--dims" dir="ltr">
                <bdi>{dimsChip}</bdi>
              </span>
              <button
                className="search-chip-x"
                onClick={() => setDimsChip("")}
                aria-label="Remove dimension filter"
              >
                ×
              </button>
            </span>
          )}

          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
            Selected: {selectedMap.size}
          </span>
        </div>
      </div>

      {/* ── Thickness bubbles ── */}
      <div className="search-quick-bubbles-wrap">
        <div className="search-quick-bubbles-row thickness-row">
          {THICKNESS_BUBBLES.map((t) => {
            const active = thicknessFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setThicknessFilter(active ? "" : t)}
                className={"quick-bubble quick-bubble-thick" + (active ? " active" : "")}
              >
                {t} ملم
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && <div className="sqm-error-banner">{errorMsg}</div>}

      <table className="search-modal-table">
        <thead>
          <tr>
            <th className="col-select">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleChecked;
                }}
                onChange={toggleAllVisible}
              />
            </th>
            <th>Item</th>
            <th>Transfer #</th>
            <th>Length (cm)</th>
            <th>Width (cm)</th>
            <th>Pieces Rem.</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr className="empty-row">
              <td className="empty-cell" colSpan={6}>Loading SQM pieces…</td>
            </tr>
          ) : !rows.length ? (
            <tr className="empty-row">
              <td className="empty-cell" colSpan={6}>
                No SQM pieces found with remaining sqm &gt; 0.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const checked = selectedMap.has(row.id);
              const label =
                row.label ||
                ((row.thickness != null ? `${row.thickness}ملم ` : "") +
                  (row.itemName || ""));

              return (
                <tr key={row.id}>
                  <td className="cell-select">
                    <input
                      type="checkbox"
                      className="search-modal-select-checkbox"
                      checked={checked}
                      onChange={() => toggleRow(row)}
                    />
                  </td>
                  <td style={{ direction: "rtl", textAlign: "right" }}>{label}</td>
                  <td>{row.transferNumber || "-"}</td>
                  <td>{row.length != null ? num(row.length) : "-"}</td>
                  <td>{row.width != null ? num(row.width) : "-"}</td>
                  <td>{fmt2(row.piecesRemaining)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
});

export default SqmPiecesTab;
