// ItemModal.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./styles/model.css";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, ""); // e.g. http://192.168.68.105:3000

const DEBOUNCE_MS = 300;

const ItemModal = ({ selectedItems, handleCheckboxChange, closeItemModal }) => {
  const [items, setItems] = useState([]);            // nested items from /filtered-items
  const [flatRows, setFlatRows] = useState([]);      // flat rows from /variant-search
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef();

  // 🔎 search UI state
  const [searchText, setSearchText] = useState("");
  const [mode, setMode] = useState("list"); // "list" | "search"
  const [searchPage, setSearchPage] = useState(1);

  // 🔖 pinned search terms
  const [pinnedTerms, setPinnedTerms] = useState([]); // e.g. ["5.5ملم", "ابيض"]

  // Build the query shown/typed
  const combinedQuery = useMemo(() => {
    const live = String(searchText || "").trim();
    return [...pinnedTerms, ...(live ? [live] : [])].join(" ").trim();
  }, [pinnedTerms, searchText]);

  // Heuristic: if user has pinned some non-dims text, treat a plain number as LENGTH
  const preferPlainAsLength = useMemo(() => pinnedTerms.length > 0, [pinnedTerms]);

  // ---------- DIMS parsing helpers ----------
  // Extract last dims occurrence: 225*321 or 225*321-025, or single-dimension tokens.
  const extractDimsParts = useCallback((text, preferLengthPlain) => {
    const empty = {
      dims: null,
      length: null,
      width: null,
      spb: null,
      isBox: false,
      foundSingle: false,
      tokenToStrip: null, // exact token to remove from q if single match
    };
    if (!text) return empty;
    const t = String(text);

    // Full L*W(-SPB)
    const reFull = /(\d{2,5})\s*\*\s*(\d{2,5})(?:\s*-\s*0*(\d{1,4}))?/g;
    let m, lastFull = null;
    while ((m = reFull.exec(t)) !== null) {
      const L = m[1];
      const W = m[2];
      const SPB = m[3];
      lastFull = {
        dims: `${L}*${W}${SPB ? `-${SPB}` : ""}`,
        length: Number(L),
        width: Number(W),
        spb: SPB ? Number(SPB) : null,
        isBox: !!SPB,
        foundSingle: false,
        tokenToStrip: null,
      };
    }
    if (lastFull) return lastFull;

    // If no full dims, try single dimension tokens (use the LAST one found)
    const tokens = t.split(/\s+/).filter(Boolean);
    let single = null;
    for (const tok of tokens) {
      // width-only patterns
      const w1 = tok.match(/^\*\s*(\d{2,5})$/);                 // *321
      const w2 = tok.match(/^(?:w|W|عرض)\s*:?(\d{2,5})$/);      // W321 / عرض321 / W:321
      const w3 = tok.match(/^(\d{2,5})(?:w|W)$/);               // 321W
      if (w1 || w2 || w3) {
        const W = Number((w1?.[1] || w2?.[1] || w3?.[1]));
        single = { dims: null, length: null, width: W, spb: null, isBox: false, foundSingle: true, tokenToStrip: tok };
        continue;
      }

      // length-only explicit: "225*"
      const l1 = tok.match(/^(\d{2,5})\*$/);                    // 225*
      if (l1) {
        const L = Number(l1[1]);
        single = { dims: null, length: L, width: null, spb: null, isBox: false, foundSingle: true, tokenToStrip: tok };
        continue;
      }

      // PLAIN number: treat as LENGTH if preferLengthPlain, otherwise WIDTH
      const plain = tok.match(/^(\d{2,5})$/);                   // 225
      if (plain) {
        const n = Number(plain[1]);
        if (preferLengthPlain) {
          single = { dims: null, length: n, width: null, spb: null, isBox: false, foundSingle: true, tokenToStrip: tok };
        } else {
          single = { dims: null, length: null, width: n, spb: null, isBox: false, foundSingle: true, tokenToStrip: tok };
        }
        continue;
      }
    }
    return single || empty;
  }, []);

  // Remove dims tokens from the name part of q
  const stripDims = useCallback((text, tokenToStrip) => {
    if (!text) return "";
    let out = text
      // remove any full dims like 225*321 or 225*321-025
      .replace(/(\d{2,5})\s*\*\s*(\d{2,5})(?:\s*-\s*0*(\d{1,4}))?/g, " ");

    // remove the exact single token we parsed (e.g. "225*", "*321", "225", "W321")
    if (tokenToStrip) {
      // use regex that matches the standalone token (start/end or spaces)
      const esc = tokenToStrip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|\\s)${esc}(?=\\s|$)`, "g");
      out = out.replace(re, " ");
    }

    return out.replace(/\s+/g, " ").trim();
  }, []);

  // Parse the combinedQuery into dims/length/width/spb
  const dimsInfo = useMemo(
    () => extractDimsParts(combinedQuery, preferPlainAsLength),
    [combinedQuery, preferPlainAsLength, extractDimsParts]
  );

  const qSansDims = useMemo(
    () => stripDims(combinedQuery, dimsInfo.tokenToStrip),
    [combinedQuery, dimsInfo.tokenToStrip, stripDims]
  );

  // Pin/unpin
  const pinTerm = useCallback((term) => {
    const t = String(term || "").trim();
    if (!t) return;
    setPinnedTerms((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setSearchText(""); // clear input after pinning
  }, []);

  const unpinTerm = useCallback((term) => {
    setPinnedTerms((prev) => prev.filter((x) => x !== term));
  }, []);

  // Cancel in-flight
  const cancelInFlight = () => {
    try { abortRef.current?.abort(); } catch {}
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  // ---------- selection lookup by variant id ----------
  const selectedIdSet = useMemo(() => {
    const s = new Set();
    for (const sel of selectedItems || []) {
      if (sel?.dimensionId != null) s.add(sel.dimensionId);
      else if (sel?.payloadVariant?.id != null) s.add(sel.payloadVariant.id);
      else if (sel?.variantId != null) s.add(sel.variantId);
    }
    return s;
  }, [selectedItems]);

  const isVariantSelected = useCallback(
    (variantId) => selectedIdSet.has(variantId),
    [selectedIdSet]
  );

  // ---------- normalize server response ----------
  const normalizeList = useCallback((json) => {
    if (json && typeof json === "object") {
      const data = Array.isArray(json.data) ? json.data : [];
      const more = json.hasMore === true ? true : data.length > 0;
      return { data, hasMore: more };
    }
    if (Array.isArray(json)) return { data: json, hasMore: json.length > 0 };
    return { data: [], hasMore: false };
  }, []);

  const normalizeSearch = useCallback((json) => {
    if (json && typeof json === "object") {
      const data = Array.isArray(json.data) ? json.data : [];
      const more = Boolean(json.hasMore ?? (json.page * json.limit < (json.totalRows || 0)));
      return { data, hasMore: more };
    }
    return { data: [], hasMore: false };
  }, []);

  // ---------- API calls ----------
  const fetchListPage = useCallback(
    async (targetPage) => {
      setLoading(true);
      try {
        const signal = cancelInFlight();
        const url = `${baseUrl}/items/v1/filtered-items?page=${targetPage}&limit=${limit}&includeEmpty=0`;
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const json = await res.json();
        const { data: pageData, hasMore: more } = normalizeList(json);
        if (targetPage === 1) setItems(pageData || []);
        else setItems((prev) => [...prev, ...(pageData || [])]);
        setHasMore(Boolean(more));
        setPage(targetPage);
      } catch (e) {
        if (e?.name !== "AbortError") {
          console.error("Fetch list page failed:", e);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [limit, normalizeList]
  );

  // Accept qSansDims + optional dims + optional length/width; append &type=box when dims has -SPB
  const fetchSearchPage = useCallback(
    async (targetPage, qNoDims, dims, isBox, lengthOnly, widthOnly) => {
      setLoading(true);
      try {
        const signal = cancelInFlight();
        const parts = [
          `q=${encodeURIComponent(qNoDims || "")}`,
          `page=${targetPage}`,
          `limit=${limit}`,
        ];
        if (dims) parts.push(`dims=${encodeURIComponent(dims)}`);
        if (isBox) parts.push(`type=box`);
        if (typeof lengthOnly === "number") parts.push(`length=${lengthOnly}`);
        if (typeof widthOnly === "number") parts.push(`width=${widthOnly}`);

        const url = `${baseUrl}/items/v1/variant-search?${parts.join("&")}`;
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const json = await res.json();
        const { data: pageData, hasMore: more } = normalizeSearch(json);
        if (targetPage === 1) setFlatRows(pageData || []);
        else setFlatRows((prev) => [...prev, ...(pageData || [])]);
        setHasMore(Boolean(more));
        setSearchPage(targetPage);
      } catch (e) {
        if (e?.name !== "AbortError") {
          console.error("Fetch search page failed:", e);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [limit, normalizeSearch]
  );

  // Load first page when the modal opens
  useEffect(() => {
    fetchListPage(1);
    return () => {
      try { abortRef.current?.abort(); } catch {}
    };
  }, [fetchListPage]);

  // ---------- debounce search ----------
  useEffect(() => {
    const hasAny =
      Boolean(qSansDims) ||
      Boolean(dimsInfo.dims) ||
      typeof dimsInfo.length === "number" ||
      typeof dimsInfo.width === "number";

    if (!hasAny) {
      setMode("list");
      setFlatRows([]);
      setSearchPage(1);
      if (!items?.length) fetchListPage(1);
      return;
    }

    setMode("search");
    const t = setTimeout(() => {
      fetchSearchPage(
        1,
        qSansDims,
        dimsInfo.dims,
        dimsInfo.isBox,
        typeof dimsInfo.length === "number" ? dimsInfo.length : undefined,
        typeof dimsInfo.width === "number" ? dimsInfo.width : undefined
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSansDims, dimsInfo]);

  // ---------- flatten nested items -> rows by variant (list mode) ----------
  const listRows = useMemo(() => {
    const out = [];
    for (const item of items || []) {
      const itemName = item?.itemName ?? "";
      const type = item?.type ?? "";
      const ths = item?.thicknesses || [];
      for (const th of ths) {
        const thicknessVal = Number(th?.thickness ?? 0);
        const vars = th?.variants || [];
        for (const v of vars) {
          const id = v?.id;
          if (id == null) continue;
          const combinedName = `${Number.isFinite(thicknessVal) ? thicknessVal : 0} ملم ${itemName}`;
          out.push({
            key: `${item.id}-${id}`,
            variantId: id,
            combinedName,
            type,
            origin: v?.origin ?? "",
            length: Number(v?.length ?? 0),
            width: Number(v?.width ?? 0),
            sheetsPerBox: Number(v?.sheetsPerBox ?? 0) || "",
            payloadItem: { itemName, type, combinedName }, // <— include combined
            payloadVariant: {
              id,
              origin: v?.origin ?? "",
              length: Number(v?.length ?? 0),
              width: Number(v?.width ?? 0),
              sheetsPerBox: Number(v?.sheetsPerBox ?? 0),
              thickness: thicknessVal,
              dimensionId: id,
            },
          });
        }
      }
    }
    return out;
  }, [items]);

  // ---------- map flat API rows -> table rows (search mode) ----------
  const searchRows = useMemo(() => {
    return (flatRows || []).map((r) => {
      const thicknessVal = Number(r.thickness ?? 0);
      const combinedName = `${Number.isFinite(thicknessVal) ? thicknessVal : 0} ملم ${r.itemName || ""}`;
      return {
        key: `${r.itemId}-${r.variantId}`,
        variantId: Number(r.variantId),
        combinedName,
        type: r.type || "",
        origin: r.origin ?? "",
        length: Number(r.length ?? 0),
        width: Number(r.width ?? 0),
        sheetsPerBox: Number(r.sheetsPerBox ?? 0) || "",
        payloadItem: { itemName: r.itemName || "", type: r.type || "", combinedName }, // <— include combined
        payloadVariant: {
          id: Number(r.variantId),
          origin: r.origin ?? "",
          length: Number(r.length ?? 0),
          width: Number(r.width ?? 0),
          sheetsPerBox: Number(r.sheetsPerBox ?? 0),
          thickness: thicknessVal,
          dimensionId: Number(r.variantId),
        },
      };
    });
  }, [flatRows]);

  // Active rows
  const rows = mode === "search" ? searchRows : listRows;

  // optional client-side filter on list mode (server filters in search mode)
  const filteredRows = useMemo(() => {
    const q = String(combinedQuery || "").trim().toLowerCase();
    if (!q) return rows;
    if (mode === "search") return rows;
    return rows.filter((r) => {
      const haystack = [
        r.combinedName,
        r.type,
        r.origin,
        r.length,
        r.width,
        r.sheetsPerBox,
        r.variantId,
      ]
        .join(" ")
        .toString()
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, combinedQuery, mode]);

  // ✅ LOG THE EXACT PAYLOAD WE SEND UP
  const onToggle = useCallback(
    (r) => {
      const payloadItem = { ...r.payloadItem, combinedName: r.combinedName };
      const payloadVariant = { ...r.payloadVariant };
      // Clear, readable console output:
      // (Shows exactly what the Table's parent gets when a user selects/deselects)
      console.log("%c[MODAL->PARENT] handleCheckboxChange payloadItem", "color:#0A84FF;font-weight:bold;", payloadItem);
      console.log("%c[MODAL->PARENT] handleCheckboxChange payloadVariant", "color:#0A84FF;font-weight:bold;", payloadVariant);
      handleCheckboxChange(payloadItem, payloadVariant);
    },
    [handleCheckboxChange]
  );

  // "Load more" – keep passing qSansDims + dims + optional length/width
  const onLoadMore = useCallback(() => {
    if (loading || !hasMore) return;
    if (mode === "search") {
      const hasAny =
        Boolean(qSansDims) ||
        Boolean(dimsInfo.dims) ||
        typeof dimsInfo.length === "number" ||
        typeof dimsInfo.width === "number";
      if (!hasAny) return;
      fetchSearchPage(
        searchPage + 1,
        qSansDims,
        dimsInfo.dims,
        dimsInfo.isBox,
        typeof dimsInfo.length === "number" ? dimsInfo.length : undefined,
        typeof dimsInfo.width === "number" ? dimsInfo.width : undefined
      );
    } else {
      fetchListPage(page + 1);
    }
  }, [loading, hasMore, mode, qSansDims, dimsInfo, searchPage, page, fetchSearchPage, fetchListPage]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content item-modal">
        <h3>Select Items and Dimensions</h3>

        {/* 🔎 Sticky search row */}
        <div className="search-modal-item-input-row">
          <input
            className="search-modal-items-input"
            placeholder="اكتب ثم اضغط Enter لتثبيت البحث (مثال: 5.5ملم ابيض 225*321-025)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const t = String(searchText || "").trim();
                if (t) pinTerm(t);
              }
            }}
          />

          {/* 🔖 pinned search chips */}
          {pinnedTerms.length > 0 && (
            <div className="pinned-chips">
              {pinnedTerms.map((term) => (
                <span className="pinned-chip" key={term} title={term}>
                  <span className="pinned-chip-text">{term}</span>
                  <button
                    className="pinned-chip-x"
                    type="button"
                    aria-label={`Remove ${term}`}
                    onClick={() => unpinTerm(term)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="modal-items-table-container">
          <table className="modal-items-table search-modal-table">
            <thead>
              <tr>
                <th className="col-select">Select</th>
                <th>Item (with thickness)</th>
                <th>Type</th>
                <th>Origin</th>
                <th>Length (cm)</th>
                <th>Width (cm)</th>
                <th>Sheets/Box</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.key}>
                  <td className="checkbox-cell cell-select">
                    <input
                      className="search-modal-select-checkbox"
                      type="checkbox"
                      checked={isVariantSelected(r.variantId)}
                      onChange={() => onToggle(r)}
                    />
                  </td>
                  <td style={{ direction: "rtl", textAlign: "right" }}>{r.combinedName}</td>
                  <td>{r.type}</td>
                  <td>{r.origin}</td>
                  <td>{r.length}</td>
                  <td>{r.width}</td>
                  <td>{r.sheetsPerBox}</td>
                </tr>
              ))}

              {!loading && filteredRows.length === 0 && (
                <tr className="empty-row">
                  <td className="empty-cell" colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>
                    لا توجد نتائج.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 16px" }}>
          <button
            disabled={loading || !hasMore}
            onClick={onLoadMore}
            className="save-button"
          >
            {loading ? "Loading..." : hasMore ? "Load more" : "No more items"}
          </button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            {mode === "search" ? `Search page ${searchPage}` : `Page ${page}`} • Showing {filteredRows.length} rows
          </span>
        </div>

        <button className="close-modal-button" onClick={closeItemModal}>
          Close
        </button>
      </div>
    </div>
  );
};

export default ItemModal;
