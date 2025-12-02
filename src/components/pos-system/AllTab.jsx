// src/components/pos-system/AllTab.jsx
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
import "./AllTab.css";

const AllTab = forwardRef(function AllTab(
  { modalOpen, isActive, selectedMap, setSelectedMap },
  ref
) {
  const baseUrl = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

  // default list (flat)
  const [flatRows, setFlatRows] = useState([]);
  // search list (nested)
  const [nestedItems, setNestedItems] = useState([]);

  // input + chips
  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");

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
      try {
        ctl.abort();
      } catch {}
    }
    const next = new AbortController();
    abortRef.current = next;
    return next.signal;
  };

  const normalizeDigits = useCallback((s = "") => {
    return s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/،/g, ",");
  }, []);

  // robust Arabic normalization
  const normalizeArabic = useCallback((s = "") => {
    return s
      .replace(/[\u064B-\u065F]/g, "") // tashkeel
      .replace(/\u0640/g, "") // tatweel
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

  const normalizeEnvelope = useCallback(
    (raw) => {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const data =
          Array.isArray(raw.data)
            ? raw.data
            : Array.isArray(raw.items)
            ? raw.items
            : Array.isArray(raw.results)
            ? raw.results
            : [];
        let hm;
        if (typeof raw.hasMore === "boolean") hm = raw.hasMore;
        else if (raw.page != null && raw.totalPages != null)
          hm = Number(raw.page) < Number(raw.totalPages);
        else hm = data.length >= limit;
        return { data, hasMore: hm };
      }
      if (Array.isArray(raw)) return { data: raw, hasMore: raw.length >= limit };
      return { data: [], hasMore: false };
    },
    [limit]
  );

  // row -> payload to send back to POS page
  const rowToPayload = useCallback((row) => {
    const [variantStr, batchStr] = String(row.uniqueId).split("-");
    return {
      itemVariantId: Number(variantStr),
      batchId: Number(batchStr),
      itemName: row.itemName,
      type: row.type,
      thickness: row.thickness,
      length: row.length,
      width: row.width,
      sheetsPerBox: row.sheetsPerBox,
      origin: row.origin || "",
      condition: row.condition ?? "",
      dateReceived: row.dateReceived ?? "",
      balanceOFR: row.balanceOFR ?? "",
    };
  }, []);

  // ---------- fetchers ----------
  const fetchDefaultPage = useCallback(
    async (targetPage) => {
      if (!modalOpen || !isActive) return;
      setLoading(true);
      try {
        const signal = cancelInFlight();
        const url = `${baseUrl}/items/v2/filtered-items-all-batches`;
        const params = { page: targetPage, limit };
        const res = await axios.get(url, { params, signal });
        const { data: flat, hasMore: hm } = normalizeEnvelope(res.data);

        if (targetPage === 1) setFlatRows(flat || []);
        else setFlatRows((prev) => [...prev, ...(flat || [])]);

        setNestedItems([]);
        setPage(targetPage);
        setHasMore(Boolean(hm));
      } catch (err) {
        if (axios.isCancel?.(err)) return;
        console.error("Error fetching all-batches default:", err);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, isActive, limit, modalOpen, normalizeEnvelope]
  );

  const fetchDefault = useCallback(() => fetchDefaultPage(1), [fetchDefaultPage]);

  const fetchSearch = useCallback(async () => {
    if (!modalOpen || !isActive) return;
    setLoading(true);
    try {
      const signal = cancelInFlight();
      const url = `${baseUrl}/items/pos/search-modal`;

      const params = { page: 1, limit: 200, includeEmpty: 1 };

      if (nameChip) params.q = normalizeArabic(nameChip);

      const dimsOrNumber = dimsChip ? normalizeDigits(dimsChip.trim()) : "";
      if (dimsOrNumber) {
        if (looksLikeDims(dimsOrNumber)) params.dims = dimsOrNumber;
        else if (isPlainNumber(dimsOrNumber)) params.length = Number(dimsOrNumber);
      }

      const res = await axios.get(url, { params, signal });
      const nested = Array.isArray(res.data) ? res.data : [];

      setNestedItems(nested);
      setFlatRows([]);
      setHasMore(false);
      setPage(1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching all-batches search:", err);
      setNestedItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [
    baseUrl,
    dimsChip,
    isActive,
    isPlainNumber,
    looksLikeDims,
    modalOpen,
    nameChip,
    normalizeArabic,
    normalizeDigits,
  ]);

  // reset filters when modal opens (selection is in parent)
  useEffect(() => {
    if (!modalOpen) return;
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    setFlatRows([]);
    setNestedItems([]);
    setPage(1);
    setHasMore(false);
  }, [modalOpen]);

  // fetch on active tab + chips change
  useEffect(() => {
    if (!modalOpen || !isActive) return;

    if (nameChip || dimsChip) fetchSearch();
    else fetchDefault();

    return () => {
      if (abortRef.current?.abort) {
        try {
          abortRef.current.abort();
        } catch {}
      }
    };
  }, [modalOpen, isActive, nameChip, dimsChip, fetchDefault, fetchSearch]);

  // ---------- UI handlers ----------
  const handleEnter = (e) => {
    if (e.key !== "Enter") return;
    const raw = inputValue.trim();
    if (!raw) return;

    const withDigits = normalizeDigits(raw);

    if (looksLikeDims(withDigits)) {
      setDimsChip(withDigits);
      setInputValue("");
      return;
    }

    if (isPlainNumber(withDigits)) {
      setDimsChip(withDigits);
      setInputValue("");
      return;
    }

    setNameChip(normalizeArabic(withDigits));
    setInputValue("");
  };

  const toggleSelect = (row) => {
    if (!row.selectable) return;
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(row.uniqueId)) next.delete(row.uniqueId);
      else next.set(row.uniqueId, rowToPayload(row));
      return next;
    });
  };

  // ---------- build rows for render ----------
  const rowsFromFlat = useMemo(() => {
    if (!flatRows.length) return [];
    return flatRows.map((r) => {
      const variantId = Number(r.variantId);
      const batchId = Number(r.batchId);
      const selectable = Number.isFinite(variantId) && Number.isFinite(batchId);

      return {
        uniqueId: `${variantId}-${batchId}`,
        selectable,
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

  const rowsFromNested = useMemo(() => {
    if (!nestedItems.length) return [];
    const out = [];
    (nestedItems || []).forEach((item) => {
      (item.thicknesses || []).forEach((th) => {
        (th.variants || []).forEach((v) => {
          const variantId = Number(v.id);
          const hasRealVariantId = Number.isFinite(variantId);
          (v.batches || []).forEach((b) => {
            const batchId = Number(b.id);
            const selectable = hasRealVariantId && Number.isFinite(batchId);

            out.push({
              uniqueId: `${variantId}-${batchId}`,
              selectable,
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
            });
          });
        });
      });
    });
    return out;
  }, [nestedItems]);

  const inSearchMode = Boolean(nameChip || dimsChip);
  const rows = inSearchMode ? rowsFromNested : rowsFromFlat;

  useImperativeHandle(ref, () => ({
    collectSelected: () => Array.from(selectedMap.values()),
  }));

  return (
    <div className="all-tab-root">
      <div className="all-tab-item-input-row">
        <input
          type="text"
          placeholder="اكتب ثم Enter — مثال: 5.5ملم ابيض  |  225*321-012  |  225"
          className="all-tab-items-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleEnter}
          autoFocus
        />
        <div className="all-tab-chips">
          {nameChip && (
            <span className="all-chip" title={nameChip}>
              <span className="all-chip-label all-chip-label--name" dir="rtl">
                {nameChip}
              </span>
              <button
                className="all-chip-x"
                onClick={() => setNameChip("")}
                aria-label="Remove name filter"
              >
                ×
              </button>
            </span>
          )}
          {dimsChip && (
            <span className="all-chip" title={dimsChip}>
              <span className="all-chip-label all-chip-label--dims" dir="ltr">
                <bdi>{dimsChip}</bdi>
              </span>
              <button
                className="all-chip-x"
                onClick={() => setDimsChip("")}
                aria-label="Remove dims/length filter"
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

      <table className="all-tab-table">
        <thead>
          <tr>
            <th className="col-select">SELECT</th>
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
          {rows.map((r) => {
            const checked = selectedMap.has(r.uniqueId);
            return (
              <tr
                key={r.uniqueId}
                className={!r.selectable ? "all-row-disabled" : ""}
                title={!r.selectable ? "Unavailable for selection (missing real variant id)" : undefined}
              >
                <td className="cell-select">
                  <input
                    type="checkbox"
                    disabled={!r.selectable}
                    checked={checked}
                    onChange={() => toggleSelect(r)}
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
            );
          })}

          {rows.length === 0 && (
            <tr className="empty-row">
              <td className="empty-cell" colSpan={10}>
                No Data
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!inSearchMode && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <button
            className="all-save-button"
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
    </div>
  );
});

export default AllTab;
