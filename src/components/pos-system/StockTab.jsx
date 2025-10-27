import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";

const StockTab = forwardRef(function StockTab(
  { isOpen, onSelectionCountChange },
  ref
) {
  // ---- config
  const baseUrl = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

  // ---- state
  // default list (v2/filtered-items) comes FLAT + already ordered by backend
  const [flatRows, setFlatRows] = useState([]);
  // search list (pos/search-modal-instock) comes NESTED from the API
  const [nestedItems, setNestedItems] = useState([]);

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState(""); // can be dims string OR plain number

  // pagination (default list only)
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef(null);

  // ---------- helpers ----------
  const cancelInFlight = () => {
    const ctl = abortRef.current;
    if (ctl && typeof ctl.abort === "function") {
      try { ctl.abort(); } catch {}
    }
    const next = new AbortController();
    abortRef.current = next;
    return next.signal;
  };

  // Map Arabic digits → Latin, normalize punctuation
  const normalizeDigits = useCallback((s = "") => {
    return s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/،/g, ",");
  }, []);

  // Fold Alif forms for tolerant Arabic name matching
  const normalizeArabic = useCallback((s = "") => {
    return s.replace(/أ|إ|آ/g, "ا").trim();
  }, []);

  // 225*321-012 or 200*300
  const looksLikeDims = useCallback((s) => {
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
  }, [normalizeDigits]);

  // NEW: plain number -> treat as LENGTH
  const isPlainNumber = useCallback((s) => {
    if (!s) return false;
    const t = normalizeDigits(String(s)).trim();
    return /^\d{1,5}(\.\d+)?$/.test(t);
  }, [normalizeDigits]);

  // normalize any API result to { data: [], hasMore: boolean }
  const normalizeEnvelope = useCallback((raw) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const data =
        Array.isArray(raw.data) ? raw.data :
        Array.isArray(raw.items) ? raw.items :
        Array.isArray(raw.results) ? raw.results : [];
      let hm;
      if (typeof raw.hasMore === "boolean") hm = raw.hasMore;
      else if (raw.page != null && raw.totalPages != null) hm = Number(raw.page) < Number(raw.totalPages);
      else hm = data.length >= limit;
      return { data, hasMore: hm };
    }
    if (Array.isArray(raw)) return { data: raw, hasMore: raw.length >= limit };
    return { data: [], hasMore: false };
  }, [limit]);

  // ---------- default list (FLAT) ----------
  const fetchDefaultPage = useCallback(async (targetPage) => {
    setLoading(true);
    try {
      const signal = cancelInFlight();
      const url = `${baseUrl}/items/v2/filtered-items`;
      const params = { page: targetPage, limit }; // zero-stock filtered by backend
      const res = await axios.get(url, { params, signal });
      const { data: flat, hasMore: hm } = normalizeEnvelope(res.data);

      if (targetPage === 1) setFlatRows(flat || []);
      else setFlatRows((prev) => [...prev, ...(flat || [])]); // append to preserve backend order

      setNestedItems([]); // clear search data
      setPage(targetPage);
      setHasMore(Boolean(hm));
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching default page:", err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, limit, normalizeEnvelope]);

  const fetchDefault = useCallback(() => fetchDefaultPage(1), [fetchDefaultPage]);

  // ---------- search list (NESTED) ----------
  const fetchSearch = useCallback(async () => {
    setLoading(true);
    try {
      const signal = cancelInFlight();
      const url = `${baseUrl}/items/pos/search-modal-instock`;
      // Build params for in-stock nested search:
      // - q: Arabic-normalized name if provided
      // - dims: "225*321-012" if user entered dims
      // - length: 225 if user entered just a number
      const params = { page: 1, limit: 200 };

      if (nameChip) params.q = normalizeArabic(nameChip);

      const rawDims = dimsChip ? normalizeDigits(dimsChip.trim()) : "";
      if (rawDims) {
        if (looksLikeDims(rawDims)) {
          params.dims = rawDims;
        } else if (isPlainNumber(rawDims)) {
          params.length = Number(rawDims); // plain "225" → length filter
        }
      }

      const res = await axios.get(url, { params, signal });
      const nested = Array.isArray(res.data) ? res.data : [];

      setNestedItems(nested);
      setFlatRows([]);    // clear flat rows in search mode
      setHasMore(false);  // search: no "Load more"
      setPage(1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching search:", err);
      setNestedItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, nameChip, dimsChip, normalizeArabic, normalizeDigits, looksLikeDims, isPlainNumber]);

  // ---------- effects ----------
  useEffect(() => {
    if (!isOpen) return;
    setSelectedItems(new Set());
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    onSelectionCountChange?.(0);
    setPage(1);
    setHasMore(false);
    setFlatRows([]);
    setNestedItems([]);
    fetchDefault();
    return () => {
      if (abortRef.current && typeof abortRef.current.abort === "function") {
        try { abortRef.current.abort(); } catch {}
      }
    };
  }, [isOpen, fetchDefault, onSelectionCountChange]);

  useEffect(() => {
    if (!isOpen) return;
    if (nameChip || dimsChip) {
      fetchSearch();
    } else {
      setFlatRows([]);
      setNestedItems([]);
      setPage(1);
      setHasMore(false);
      fetchDefault();
    }
  }, [isOpen, nameChip, dimsChip, fetchDefault, fetchSearch]);

  // ---------- UI handlers ----------
  const handleEnter = (e) => {
    if (e.key !== "Enter") return;
    const raw = inputValue.trim();
    if (!raw) return;
    const withDigits = normalizeDigits(raw);

    // If it looks like dims → pin as dims
    if (looksLikeDims(withDigits)) {
      setDimsChip(withDigits);
      setInputValue("");
      return;
    }

    // If it's a plain number → pin as numeric (length)
    if (isPlainNumber(withDigits)) {
      setDimsChip(withDigits); // fetchSearch will treat this as length
      setInputValue("");
      return;
    }

    // Otherwise treat as NAME (Arabic-normalized for nicer matching)
    setNameChip(normalizeArabic(withDigits));
    setInputValue("");
  };

  const clearNameChip = () => setNameChip("");
  const clearDimsChip = () => setDimsChip("");

  const toggleSelect = (uniqueId, selectable) => {
    if (!selectable) return;
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(uniqueId)) next.delete(uniqueId);
      else next.add(uniqueId);
      onSelectionCountChange?.(next.size);
      return next;
    });
  };

  // ---------- build rows for render ----------
  // Default (flat) mode: API already returns one row per batch — just map it.
  const rowsFromFlat = useMemo(() => {
    if (!flatRows.length) return [];
    return flatRows.map((r) => {
      const hasRealVariantId = Number.isFinite(Number(r.variantId));
      return {
        uniqueId: `${r.variantId}-${r.batchId ?? "n"}`,
        selectable: hasRealVariantId,
        itemName: r.itemName,
        type: r.type,
        thickness: r.thickness,
        length: Math.floor(Number(r.length || 0)),
        width: Math.floor(Number(r.width || 0)),
        sheetsPerBox: Number(r.sheetsPerBox || 0),
        origin: r.origin || "",
        condition: r.condition ?? "",
        dateReceived: r.dateReceived ?? "",
        balanceOFR: r.balanceOFR ?? "",
      };
    });
  }, [flatRows]);

  // Search (nested) mode: variants that have batches (in-stock)
  const rowsFromNested = useMemo(() => {
    if (!nestedItems.length) return [];
    const out = [];
    (nestedItems || []).forEach((item) => {
      (item.thicknesses || []).forEach((th) => {
        (th.variants || []).forEach((v) => {
          if (!Array.isArray(v.batches) || v.batches.length === 0) return;
          const hasRealVariantId = Number.isFinite(Number(v.id));
          v.batches.forEach((b) =>
            out.push({
              uniqueId: `${v.id}-${b.id}`,
              selectable: hasRealVariantId,
              itemName: item.itemName,
              type: item.type,
              thickness: th.thickness,
              length: Math.floor(Number(v.length)),
              width: Math.floor(Number(v.width)),
              sheetsPerBox: Number(v.sheetsPerBox),
              origin: v.origin,
              condition: b.condition,
              dateReceived: b.dateReceived,
              balanceOFR: b.balanceOFR,
            })
          );
        });
      });
    });
    return out;
  }, [nestedItems]);

  const inSearchMode = Boolean(nameChip || dimsChip);
  const rows = inSearchMode ? rowsFromNested : rowsFromFlat;

  // ---------- expose to parent ----------
  useImperativeHandle(ref, () => ({
    collectSelected: () => {
      const selectedData = [];
      rows.forEach((r) => {
        if (selectedItems.has(r.uniqueId) && r.selectable) {
          selectedData.push({
            itemVariantId: Number(r.uniqueId.split("-")[0]),
            itemName: r.itemName,
            type: r.type,
            thickness: r.thickness,
            length: r.length,
            width: r.width,
            sheetsPerBox: r.sheetsPerBox,
            origin: r.origin,
            condition: r.condition,
            dateReceived: r.dateReceived,
            balanceOFR: r.balanceOFR,
            batchId: r.uniqueId.includes("-") ? Number(r.uniqueId.split("-")[1]) : null,
          });
        }
      });
      return selectedData;
    },
  }));

  // ---------- render ----------
  return (
    <>
      {/* Input + chips row */}
      <div className="search-modal-item-input-row">
        <input
          type="text"
          placeholder="اكتب ثم Enter — مثال: 5.5ملم ابيض  |  225*321-012  |  225"
          className="search-modal-items-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleEnter}
          autoFocus
        />
        <div className="search-modal-chips">
          {nameChip && (
            <span className="search-chip" title={nameChip}>
              <span className="search-chip-label search-chip-label--name" dir="rtl">
                {nameChip}
              </span>
              <button className="search-chip-x" onClick={clearNameChip} aria-label="Remove name filter">×</button>
            </span>
          )}
          {dimsChip && (
            <span className="search-chip" title={dimsChip}>
              <span className="search-chip-label search-chip-label--dims" dir="ltr">
                <bdi>{dimsChip}</bdi>
              </span>
              <button className="search-chip-x" onClick={clearDimsChip} aria-label="Remove dims/length filter">×</button>
            </span>
          )}
        </div>
      </div>

      <table className="search-modal-table">
        <thead>
          <tr>
            <th>SELECT</th>
            <th>ITEM</th>
            <th>TYPE</th>
            <th>LENGTH</th>
            <th>WIDTH</th>
            <th>SHEETS/BOX</th>
            <th>ORIGIN</th>
            <th>CONDITION</th>
            <th>DATE RECEIVED</th>
            <th>STOCK</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.uniqueId}
              className={!r.selectable ? "row-disabled" : ""}
              title={!r.selectable ? "Unavailable for selection (missing real variant id or no stock)" : undefined}
            >
              <td className="cell-select">
                <input
                  type="checkbox"
                  disabled={!r.selectable}
                  checked={r.selectable ? selectedItems.has(r.uniqueId) : false}
                  onChange={() => toggleSelect(r.uniqueId, r.selectable)}
                />
              </td>
              <td style={{ direction: "rtl", textAlign: "right" }}>
                {`${parseFloat(String(r.thickness))} ملم ${r.itemName}`}
              </td>
              <td>{r.type}</td>
              <td>{r.length ?? ""}</td>
              <td>{r.width ?? ""}</td>
              <td>{r.type === "box" ? r.sheetsPerBox : ""}</td>
              <td>{r.origin ?? ""}</td>
              <td>{r.condition ?? ""}</td>
              <td>{r.dateReceived ?? ""}</td>
              <td>{r.balanceOFR ?? ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr className="empty-row">
              <td className="empty-cell" colSpan={10}>No Data</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Load more footer (only for default list) */}
      {!inSearchMode && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <button
            className="save-button"
            disabled={loading || !hasMore}
            onClick={() => fetchDefaultPage(page + 1)}
          >
            {loading ? "Loading..." : hasMore ? "Load more" : "No more items"}
          </button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            Page {page} • Showing {rows.length} rows
          </span>
        </div>
      )}
    </>
  );
});

export default StockTab;
