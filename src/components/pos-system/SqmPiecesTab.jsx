// src/components/pos-system/SqmPiecesTab.jsx
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import axios from "axios";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, "");

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt2 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SqmPiecesTab = forwardRef(function SqmPiecesTab(
  { modalOpen, isActive, onSelectionCountChange },
  ref
) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ✅ persistent selection map: pieceId -> payload
  const [selectedMap, setSelectedMap] = useState(() => new Map());

  // abort in-flight
  const abortRef = useRef(null);
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
        id: pieceId,                  // stable key
        type: "sqm",
        sqmPieceId: pieceId,
        itemVariantId: r.itemVariantId,
        batchId: r.itemBatchId,       // ✅ used by POS table
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

  const fetchPieces = async (query = "") => {
    if (!modalOpen || !isActive) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const signal = cancelInFlight();
      const res = await axios.get(`${baseUrl}/sqm-pieces/pos-pieces`, {
        params: { q: query.trim() || undefined },
        signal,
      });

      const normalized = normalizeApiRows(res.data);
      setRows(normalized);
      // ✅ DO NOT clear selection here
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Failed to load SQM pieces for POS search", err);
      setErrorMsg(err?.response?.data?.message || "Failed to load SQM pieces. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Reset selection ONLY when modal opens
  useEffect(() => {
    if (!modalOpen) return;
    setSelectedMap(new Map());
    onSelectionCountChange?.(0);
    // also reset UI rows/search if you want:
    // setSearchText("");
    // setRows([]);
  }, [modalOpen, onSelectionCountChange]);

  // When SQM tab becomes active, load rows
  useEffect(() => {
    if (!modalOpen || !isActive) return;
    fetchPieces(searchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, isActive]);

  // expose collectSelected() to parent
  useImperativeHandle(ref, () => ({
    collectSelected: () => Array.from(selectedMap.values()),
  }));

  const toggleRow = (row) => {
    const rowId = row.id;
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.set(rowId, row); // store full payload
      onSelectionCountChange?.(next.size);
      return next;
    });
  };

  // Select/Deselect ALL **visible** rows only (don’t wipe selections from other searches)
  const toggleAllVisible = () => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const visibleIds = rows.map((r) => r.id);

      const allVisibleSelected =
        rows.length > 0 && visibleIds.every((id) => next.has(id));

      if (allVisibleSelected) {
        // remove only visible
        visibleIds.forEach((id) => next.delete(id));
      } else {
        // add only visible
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
    <div>
      <div className="search-modal-item-input-row">
        <input
          type="text"
          className="search-modal-items-input"
          placeholder="Search SQM pieces by item, transfer..."
          value={searchText}
          onChange={(e) => {
            const value = e.target.value;
            setSearchText(value);
            // live search while active
            if (modalOpen && isActive) fetchPieces(value);
          }}
        />
        <div className="search-modal-chips">
          <span style={{ fontSize: 12, opacity: 0.75 }}>
            Selected: {selectedMap.size}
          </span>
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
              <td className="empty-cell" colSpan={6}>
                Loading SQM pieces…
              </td>
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
                ((row.thickness != null ? `${row.thickness}ملم ` : "") + (row.itemName || ""));

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
