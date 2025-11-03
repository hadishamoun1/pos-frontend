// src/recievables/CountOpeningSearchModal.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./countOpeningSearchModal.css";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, "");

const DEBOUNCE_MS = 300;

/* Normalize Arabic/Extended Arabic-Indic digits to ASCII 0-9 */
const normalizeDigits = (s) => {
  if (!s) return "";
  const map = {
    // Arabic-Indic
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
    // Extended Arabic-Indic (Persian/Urdu)
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
  };
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
};

const CountOpeningSearchModal = ({ isOpen, onClose, onSelectItems }) => {
  const [items, setItems] = useState([]);        // nested items from /filtered-items
  const [flatRows, setFlatRows] = useState([]);  // flat rows from /variant-search
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef();

  // 🔎 search UI state
  const [searchText, setSearchText] = useState("");
  const [mode, setMode] = useState("list"); // "list" | "search"
  const [searchPage, setSearchPage] = useState(1);

  // 🔖 pinned search terms (always stored with English digits)
  const [pinnedTerms, setPinnedTerms] = useState([]);

  // Build the query the API sees (pinned + live)
  const combinedQuery = useMemo(() => {
    const live = normalizeDigits(String(searchText || "").trim());
    return [...pinnedTerms, ...(live ? [live] : [])].join(" ").trim();
  }, [pinnedTerms, searchText]);

  // Heuristic: if user has pinned some non-dims text, treat a plain number as LENGTH
  const preferPlainAsLength = useMemo(() => pinnedTerms.length > 0, [pinnedTerms]);

  // ---------- DIMS parsing helpers ----------
  const extractDimsParts = useCallback((text, preferLengthPlain) => {
    const empty = {
      dims: null,
      length: null,
      width: null,
      spb: null,
      isBox: false,
      foundSingle: false,
      tokenToStrip: null,
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

    // Single dimension tokens
    const tokens = t.split(/\s+/).filter(Boolean);
    let single = null;
    for (const tok of tokens) {
      const w1 = tok.match(/^\*\s*(\d{2,5})$/);
      const w2 = tok.match(/^(?:w|W|عرض)\s*:?(\d{2,5})$/);
      const w3 = tok.match(/^(\d{2,5})(?:w|W)$/);
      if (w1 || w2 || w3) {
        const W = Number((w1?.[1] || w2?.[1] || w3?.[1]));
        single = { dims: null, length: null, width: W, spb: null, isBox: false, foundSingle: true, tokenToStrip: tok };
        continue;
      }
      const l1 = tok.match(/^(\d{2,5})\*$/);
      if (l1) {
        const L = Number(l1[1]);
        single = { dims: null, length: L, width: null, spb: null, isBox: false, foundSingle: true, tokenToStrip: tok };
        continue;
      }
      const plain = tok.match(/^(\d{2,5})$/);
      if (plain) {
        const n = Number(plain[1]);
        if (preferLengthPlain) {
          single = { dims: null, length: n, width: null, spb: null, isBox: false, foundSingle: true, tokenToStrip: tok };
        } else {
          single = { dims: null, length: null, width: n, spb: null, isBox: false, foundSingle: true, tokenToStrip: tok };
        }
      }
    }
    return single || empty;
  }, []);

  const stripDims = useCallback((text, tokenToStrip) => {
    if (!text) return "";
    let out = text
      .replace(/(\d{2,5})\s*\*\s*(\d{2,5})(?:\s*-\s*0*(\d{1,4}))?/g, " ");
    if (tokenToStrip) {
      const esc = tokenToStrip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|\\s)${esc}(?=\\s|$)`, "g");
      out = out.replace(re, " ");
    }
    return out.replace(/\s+/g, " ").trim();
  }, []);

  // Parse combined query (already digit-normalized by computed combinedQuery)
  const dimsInfo = useMemo(
    () => extractDimsParts(combinedQuery, preferPlainAsLength),
    [combinedQuery, preferPlainAsLength, extractDimsParts]
  );
  const qSansDims = useMemo(
    () => stripDims(combinedQuery, dimsInfo.tokenToStrip),
    [combinedQuery, dimsInfo.tokenToStrip, stripDims]
  );

  // Pin/unpin — always normalize digits for storage + display
  const pinTerm = useCallback((term) => {
    const t = normalizeDigits(String(term || "").trim());
    if (!t) return;
    setPinnedTerms((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setSearchText("");
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

  // ---------- normalize server responses ----------
  const normalizeListResponse = useCallback((json) => {
    if (json && typeof json === "object") {
      const data = Array.isArray(json.data) ? json.data : [];
      const more = json.hasMore === true ? true : data.length > 0;
      return { data, hasMore: more };
    }
    if (Array.isArray(json)) return { data: json, hasMore: json.length > 0 };
    return { data: [], hasMore: false };
  }, []);

  const normalizeSearchResponse = useCallback((json) => {
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
        const { data: pageData, hasMore: more } = normalizeListResponse(json);
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
    [limit, normalizeListResponse]
  );

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
        const { data: pageData, hasMore: more } = normalizeSearchResponse(json);
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
    [limit, normalizeSearchResponse]
  );

  // Load first page when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSearchText("");
    setPinnedTerms([]);
    setFlatRows([]);
    setMode("list");
    setPage(1);
    setSearchPage(1);
    fetchListPage(1);
    return () => {
      try { abortRef.current?.abort(); } catch {}
    };
  }, [isOpen, fetchListPage]);

  // ---------- debounce search vs list ----------
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

  // ---------- flatten nested to rows (list mode) ----------
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
      };
    });
  }, [flatRows]);

  const rows = mode === "search" ? searchRows : listRows;

  // Client-side filter (list mode only; search mode is server-driven)
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

  // ---------- selection that persists across searches ----------
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const selectedCacheRef = useRef(new Map()); // key -> row snapshot

  const buildPayloadFromRow = (r) => {
    const box = r.type === "box" ? 1 : "";
    const sheet = r.type === "sheet" ? 1 : r.sheetsPerBox;
    const Lm = Number(r.length) / 100;
    const Wm = Number(r.width) / 100;
    const sqm =
      r.type === "box"
        ? (Lm && Wm ? (Lm * Wm * Number(box) * Number(sheet)).toFixed(2) : "")
        : r.type === "sheet"
        ? (Lm && Wm ? (Lm * Wm * Number(sheet)).toFixed(2) : "")
        : "";

    return {
      itemVariantId: r.variantId,
      origin: r.origin,
      item: r.combinedName, // "5.5 ملم ابيض"
      type: r.type,
      length: Math.floor(Number(r.length)),
      width: Math.floor(Number(r.width)),
      sheetsPerBox: r.sheetsPerBox,
      box,
      sheet,
      sqm,
      uniqueId: r.key,
    };
  };

  const toggleSelect = (key) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
      selectedCacheRef.current.delete(key);
    } else {
      next.add(key);
      const rowNow =
        (mode === "search" ? searchRows : listRows).find((r) => r.key === key) ||
        rows.find((r) => r.key === key);
      if (rowNow) selectedCacheRef.current.set(key, rowNow);
    }
    setSelectedKeys(next);
  };

  // Refresh cached snapshots with fresher rows (if they reappear)
  useEffect(() => {
    if (!rows?.length || selectedKeys.size === 0) return;
    const byKey = new Map(rows.map((r) => [r.key, r]));
    for (const key of selectedKeys) {
      const fresh = byKey.get(key);
      if (fresh) selectedCacheRef.current.set(key, fresh);
    }
  }, [rows, selectedKeys]);

  // OK handler → use cache+current rows for all selections
  const handleOk = () => {
    const allKeys = Array.from(selectedKeys);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const selectedData = allKeys
      .map((key) => byKey.get(key) || selectedCacheRef.current.get(key))
      .filter(Boolean)
      .map((r) => buildPayloadFromRow(r));

    onSelectItems(selectedData);
    onClose();
  };

  // Load more (list or search)
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

  if (!isOpen) return null;

  return (
    <div className="count-opening-search-modal-overlay" role="dialog" aria-modal="true">
      <div className="count-opening-search-modal-content">

        {/* Header */}
        <div className="count-opening-search-modal-header">
          <h2 className="count-opening-search-modal-title">Search</h2>
          <div className="count-opening-search-modal-buttons">
            <button
              className="count-opening-search-modal-close-button"
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="count-opening-search-modal-ok-button"
              onClick={handleOk}
              disabled={selectedKeys.size === 0}
            >
              OK
            </button>
          </div>
        </div>

        {/* Sticky input bar — chips BESIDE the input; force RTL for mixed content */}
        <div className="count-opening-search-modal-inputbar">
          <input
            className="count-opening-search-modal-input rtl-mixed"
            dir="rtl"
            placeholder="اكتب ثم اضغط Enter لتثبيت (مثال: 5.5ملم ابيض 225*321-022)"
            value={normalizeDigits(searchText)}
            onChange={(e) => setSearchText(normalizeDigits(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                pinTerm(searchText);
              }
            }}
          />
          <div className="count-opening-search-modal-pins">
            {pinnedTerms.map((term) => (
              <span className="count-opening-search-modal-chip" key={term} title={term}>
                <span className="count-opening-search-modal-chiptext rtl-mixed" dir="rtl">
                  {normalizeDigits(term)}
                </span>
                <button
                  className="count-opening-search-modal-chipx"
                  type="button"
                  aria-label={`Remove ${term}`}
                  onClick={() => unpinTerm(term)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Scroll table */}
        <div className="count-opening-search-modal-scrollarea">
          <table className="count-opening-search-modal-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Origin</th>
                <th>Item</th>
                <th>Type</th>
                <th>Length</th>
                <th>Width</th>
                <th>Sheets/Box</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>
                    لا توجد نتائج.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <input
                        type="checkbox"
                        className="count-opening-search-modal-select-checkbox"
                        checked={selectedKeys.has(r.key)}
                        onChange={() => toggleSelect(r.key)}
                      />
                    </td>
                    <td>{r.origin}</td>
                    <td style={{ direction: "rtl", textAlign: "right" }}>{r.combinedName}</td>
                    <td>{r.type}</td>
                    <td>{Math.floor(r.length)}</td>
                    <td>{Math.floor(r.width)}</td>
                    <td>{r.sheetsPerBox}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Load more bar */}
          <div className="count-opening-search-modal-loadmore">
            <button
              disabled={loading || !hasMore}
              aria-busy={loading ? "true" : "false"}
              onClick={onLoadMore}
              className="count-opening-search-modal-loadmore-button"
              type="button"
            >
              {loading ? "Loading..." : hasMore ? "Load more" : "No more items"}
            </button>
            <span className="count-opening-search-modal-pagehint">
              {mode === "search" ? `Search page ${searchPage}` : `Page ${page}`} • Showing {filteredRows.length} rows
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CountOpeningSearchModal;
