// ItemModal.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./styles/model.css";
import { axiosClient } from "../api/axiosClient"; // ✅ added (named export)

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, ""); // e.g. http://192.168.68.105:3000

const DEBOUNCE_MS = 300;

const ItemModal = ({ selectedItems, handleCheckboxChange, closeItemModal }) => {
  // We now keep ONE unified "rows" array for the table (both list + search fill it)
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("list"); // "list" | "search"
  const [searchPage, setSearchPage] = useState(1);
  const abortRef = useRef();

  // 🔎 search UI
  const [searchText, setSearchText] = useState("");
  const [pinnedTerms, setPinnedTerms] = useState([]);

  const combinedQuery = useMemo(() => {
    const live = String(searchText || "").trim();
    return [...pinnedTerms, ...(live ? [live] : [])].join(" ").trim();
  }, [pinnedTerms, searchText]);

  const preferPlainAsLength = useMemo(
    () => pinnedTerms.length > 0,
    [pinnedTerms]
  );

  // ---------- helpers: parse dims ----------
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
    let m,
      lastFull = null;
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

    // Single tokens
    const tokens = t.split(/\s+/).filter(Boolean);
    let single = null;
    for (const tok of tokens) {
      const w1 = tok.match(/^\*\s*(\d{2,5})$/); // *321
      const w2 = tok.match(/^(?:w|W|عرض)\s*:?(\d{2,5})$/); // W321 / عرض321 / W:321
      const w3 = tok.match(/^(\d{2,5})(?:w|W)$/); // 321W
      if (w1 || w2 || w3) {
        const W = Number(w1?.[1] || w2?.[1] || w3?.[1]);
        single = {
          dims: null,
          length: null,
          width: W,
          spb: null,
          isBox: false,
          foundSingle: true,
          tokenToStrip: tok,
        };
        continue;
      }
      const l1 = tok.match(/^(\d{2,5})\*$/); // 225*
      if (l1) {
        const L = Number(l1[1]);
        single = {
          dims: null,
          length: L,
          width: null,
          spb: null,
          isBox: false,
          foundSingle: true,
          tokenToStrip: tok,
        };
        continue;
      }
      const plain = tok.match(/^(\d{2,5})$/); // 225
      if (plain) {
        const n = Number(plain[1]);
        if (preferLengthPlain) {
          single = {
            dims: null,
            length: n,
            width: null,
            spb: null,
            isBox: false,
            foundSingle: true,
            tokenToStrip: tok,
          };
        } else {
          single = {
            dims: null,
            length: null,
            width: n,
            spb: null,
            isBox: false,
            foundSingle: true,
            tokenToStrip: tok,
          };
        }
        continue;
      }
    }
    return single || empty;
  }, []);

  const stripDims = useCallback((text, tokenToStrip) => {
    if (!text) return "";
    let out = text.replace(
      /(\d{2,5})\s*\*\s*(\d{2,5})(?:\s*-\s*0*(\d{1,4}))?/g,
      " "
    );
    if (tokenToStrip) {
      const esc = tokenToStrip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|\\s)${esc}(?=\\s|$)`, "g");
      out = out.replace(re, " ");
    }
    return out.replace(/\s+/g, " ").trim();
  }, []);

  const dimsInfo = useMemo(
    () => extractDimsParts(combinedQuery, preferPlainAsLength),
    [combinedQuery, preferPlainAsLength, extractDimsParts]
  );

  const qSansDims = useMemo(
    () => stripDims(combinedQuery, dimsInfo.tokenToStrip),
    [combinedQuery, dimsInfo.tokenToStrip, stripDims]
  );

  const pinTerm = useCallback((term) => {
    const t = String(term || "").trim();
    if (!t) return;
    setPinnedTerms((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setSearchText("");
  }, []);

  const unpinTerm = useCallback((term) => {
    setPinnedTerms((prev) => prev.filter((x) => x !== term));
  }, []);

  // ---------- selection lookup ----------
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

  // ---------- request cancel ----------
  const cancelInFlight = () => {
    try {
      abortRef.current?.abort();
    } catch {}
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  // ---------- row builders ----------
  const buildRow = (rec) => {
    // Unified builder that tolerates both search/list records
    // (variantId or id) + (itemName, type, thickness, origin, length, width, sheetsPerBox)
    const variantId = Number(rec.variantId ?? rec.id);
    const thicknessVal = Number(rec.thickness ?? 0);
    const itemName = rec.itemName || "";
    const type = rec.type || "";
    const combinedName = `${
      Number.isFinite(thicknessVal) ? thicknessVal : 0
    } ملم ${itemName}`;

    return {
      key: `${rec.itemId ?? "x"}-${variantId}`,
      variantId,
      combinedName,
      type,
      origin: rec.origin ?? "",
      length: Number(rec.length ?? 0),
      width: Number(rec.width ?? 0),
      sheetsPerBox: Number(rec.sheetsPerBox ?? 0) || "",
      payloadItem: { itemName, type, combinedName },
      payloadVariant: {
        id: variantId,
        origin: rec.origin ?? "",
        length: Number(rec.length ?? 0),
        width: Number(rec.width ?? 0),
        sheetsPerBox: Number(rec.sheetsPerBox ?? 0),
        thickness: thicknessVal,
        dimensionId: variantId,
      },
    };
  };

  const flattenGrouped = (groups) => {
    // groups: [{ realDescription: {...}, variants: [ {...} ] }, ...]
    // We flatten to flat variant records; you can keep rd on each row if you want later
    const out = [];
    for (const g of groups || []) {
      const rd = g?.realDescription || null;
      for (const v of g?.variants || []) {
        out.push(buildRow({ ...v, realDescription: rd }));
      }
    }
    return out;
  };

  const flattenOldNested = (itemsLike) => {
    // old: items -> thicknesses -> variants
    const out = [];
    for (const item of itemsLike || []) {
      const itemName = item?.itemName ?? "";
      const type = item?.type ?? "";
      for (const th of item?.thicknesses || []) {
        const thicknessVal = Number(th?.thickness ?? 0);
        for (const v of th?.variants || []) {
          const rec = {
            variantId: v?.id,
            length: Number(v?.length ?? 0),
            width: Number(v?.width ?? 0),
            sheetsPerBox: Number(v?.sheetsPerBox ?? 0),
            origin: v?.origin ?? "",
            thicknessId: th?.id,
            thickness: thicknessVal,
            itemId: item?.id,
            itemName,
            type,
          };
          out.push(buildRow(rec));
        }
      }
    }
    return out;
  };

  // ---------- normalizers ----------
  const normalizeListToRows = useCallback(
    (json) => {
      // Accept either:
      // - old list shape: { data: [ {id,itemName,type, thicknesses:[ {id, thickness, variants:[...] } ] } ] }
      // - new grouped shape: { data: [ { realDescription:{...}, variants:[...] }, ... ] }
      let more = false;
      let flat = [];

      if (json && typeof json === "object") {
        const data = Array.isArray(json.data) ? json.data : [];
        more = Boolean(json.hasMore);

        const looksGrouped =
          data.length > 0 &&
          typeof data[0] === "object" &&
          ("realDescription" in data[0] ||
            ("variants" in data[0] && !("thicknesses" in data[0])));

        if (looksGrouped) {
          flat = flattenGrouped(data);
        } else {
          flat = flattenOldNested(data);
        }
      }

      return { rows: flat, hasMore: more };
    },
    []
  );

  const normalizeSearchToRows = useCallback(
    (json) => {
      // Accept either flat or grouped search response
      let more = false;
      let flat = [];

      if (json && typeof json === "object") {
        const data = Array.isArray(json.data) ? json.data : [];
        more = Boolean(
          json.hasMore ?? (json.page * json.limit < (json.totalRows || 0))
        );

        const looksGrouped =
          data.length > 0 &&
          typeof data[0] === "object" &&
          ("realDescription" in data[0] ||
            ("variants" in data[0] && !("itemId" in data[0])));

        if (looksGrouped) {
          flat = flattenGrouped(data);
        } else {
          // already flat search results
          flat = data.map(buildRow);
        }
      }

      return { rows: flat, hasMore: more };
    },
    []
  );

  // ---------- API calls ----------
  const fetchListPage = useCallback(
    async (targetPage) => {
      setLoading(true);
      try {
        const signal = cancelInFlight();
        const url = `${baseUrl}/items/v1/filtered-items?page=${targetPage}&limit=${limit}&includeEmpty=0`;

        // ✅ replaced fetch with axiosClient
        const res = await axiosClient.get(url, { signal });
        const json = res.data;

        const { rows: pageRows, hasMore: more } = normalizeListToRows(json);
        if (targetPage === 1) setRows(pageRows || []);
        else setRows((prev) => [...prev, ...(pageRows || [])]);
        setHasMore(Boolean(more));
        setPage(targetPage);
      } catch (e) {
        if (e?.name !== "AbortError" && e?.code !== "ERR_CANCELED") {
          console.error("Fetch list page failed:", e);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [limit, normalizeListToRows]
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

        // ✅ replaced fetch with axiosClient
        const res = await axiosClient.get(url, { signal });
        const json = res.data;

        const { rows: pageRows, hasMore: more } = normalizeSearchToRows(json);
        if (targetPage === 1) setRows(pageRows || []);
        else setRows((prev) => [...prev, ...(pageRows || [])]);
        setHasMore(Boolean(more));
        setSearchPage(targetPage);
      } catch (e) {
        if (e?.name !== "AbortError" && e?.code !== "ERR_CANCELED") {
          console.error("Fetch search page failed:", e);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [limit, normalizeSearchToRows]
  );

  // initial load
  useEffect(() => {
    fetchListPage(1);
    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, [fetchListPage]);

  // debounce search
  useEffect(() => {
    const hasAny =
      Boolean(qSansDims) ||
      Boolean(dimsInfo.dims) ||
      typeof dimsInfo.length === "number" ||
      typeof dimsInfo.width === "number";

    if (!hasAny) {
      setMode("list");
      setRows([]); // will refill from list call
      setSearchPage(1);
      fetchListPage(1);
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

  // optional client-side filter in list mode (search mode is already server-filtered)
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

  // selection payload
  const onToggle = useCallback(
    (r) => {
      const payloadItem = { ...r.payloadItem, combinedName: r.combinedName };
      const payloadVariant = { ...r.payloadVariant };
      console.log(
        "%c[MODAL->PARENT] handleCheckboxChange payloadItem",
        "color:#0A84FF;font-weight:bold;",
        payloadItem
      );
      console.log(
        "%c[MODAL->PARENT] handleCheckboxChange payloadVariant",
        "color:#0A84FF;font-weight:bold;",
        payloadVariant
      );
      handleCheckboxChange(payloadItem, payloadVariant);
    },
    [handleCheckboxChange]
  );

  // load more
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
  }, [
    loading,
    hasMore,
    mode,
    qSansDims,
    dimsInfo,
    searchPage,
    page,
    fetchSearchPage,
    fetchListPage,
  ]);

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
                  <td style={{ direction: "rtl", textAlign: "right" }}>
                    {r.combinedName}
                  </td>
                  <td>{r.type}</td>
                  <td>{r.origin}</td>
                  <td>{r.length}</td>
                  <td>{r.width}</td>
                  <td>{r.sheetsPerBox}</td>
                </tr>
              ))}

              {!loading && filteredRows.length === 0 && (
                <tr className="empty-row">
                  <td
                    className="empty-cell"
                    colSpan={7}
                    style={{ textAlign: "center", opacity: 0.7 }}
                  >
                    لا توجد نتائج.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div
          style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 16px" }}
        >
          <button
            disabled={loading || !hasMore}
            onClick={onLoadMore}
            className="save-button"
          >
            {loading ? "Loading..." : hasMore ? "Load more" : "No more items"}
          </button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            {mode === "search" ? `Search page ${searchPage}` : `Page ${page}`} •
            Showing {filteredRows.length} rows
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
