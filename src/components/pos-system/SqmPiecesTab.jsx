// src/components/pos-system/SqmPiecesTab.jsx
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
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
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const SqmPiecesTab = forwardRef(function SqmPiecesTab(
  { isOpen, onSelectionCountChange },
  ref
) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Load pieces with remaining > 0
  const fetchPieces = async (query = "") => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axios.get(`${baseUrl}/sqm-pieces/pos-pieces`, {
        params: {
          // onlyRemaining can be ignored by backend, we already filter sqmRemaining > 0 there
          q: query.trim() || undefined,
        },
      });

      const data = res.data || [];
      const rawRows = Array.isArray(data) ? data : data.rows || [];

      // 🔹 Ensure each row has type: "sqm" (even if backend forgot)
      const normalized = rawRows.map((r) => ({
         ...r,
         id: r.sqmPieceId ?? r.id,
        type: r.type || "sqm",
       sqmPieceId: r.sqmPieceId ?? r.id,   // SqmPiece.id
       itemVariantId: r.itemVariantId,     // from API
       batchId: r.itemBatchId, 
      }));

      setRows(normalized);
      setSelectedIds(new Set());
      onSelectionCountChange(0);
    } catch (err) {
      console.error("Failed to load SQM pieces for POS search", err);
      setErrorMsg(
        err?.response?.data?.message ||
          "Failed to load SQM pieces. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // When tab opens, load
  useEffect(() => {
    if (!isOpen) return;
    fetchPieces(searchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // expose collectSelected() to parent
  useImperativeHandle(ref, () => ({
    collectSelected: () => {
      const ids = selectedIds;
      return rows.filter((r) => ids.has(r.id));
    },
  }));

  const toggleRow = (rowId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      onSelectionCountChange(next.size);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      let next;
      if (prev.size === rows.length) {
        next = new Set();
      } else {
        next = new Set(rows.map((r) => r.id));
      }
      onSelectionCountChange(next.size);
      return next;
    });
  };

  const allChecked = rows.length > 0 && selectedIds.size === rows.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < rows.length;

  return (
    <div>
      {/* Sticky filter row (reuses existing styles) */}
      <div className="search-modal-item-input-row">
        <input
          type="text"
          className="search-modal-items-input"
          placeholder="Search SQM pieces by item, transfer..."
          value={searchText}
          onChange={(e) => {
            const value = e.target.value;
            setSearchText(value);
            // live search
            fetchPieces(value);
          }}
        />
        <div className="search-modal-chips">
          <span className="search-chip">
            <span className="search-chip-label search-chip-label--dims">
              Showing pieces with remaining sqm &gt; 0 only
            </span>
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
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
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
              const key = row.id;
              const checked = selectedIds.has(key);

              const label =
                row.label ||
                ((row.thickness != null ? `${row.thickness}ملم ` : "") +
                  (row.itemName || ""));

              return (
                <tr key={key}>
                  <td className="cell-select">
                    <input
                      type="checkbox"
                      className="search-modal-select-checkbox"
                      checked={checked}
                      onChange={() => toggleRow(key)}
                    />
                  </td>
                  <td style={{ direction: "rtl", textAlign: "right" }}>
                    {label}
                  </td>
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
