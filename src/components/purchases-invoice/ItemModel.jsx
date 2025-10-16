// ItemModal.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, ""); // e.g. http://192.168.68.105:3000

const ItemModal = ({ selectedItems, handleCheckboxChange, closeItemModal }) => {
  const [items, setItems] = useState([]); // nested items as returned by API
  const [page, setPage] = useState(1);
  const [limit] = useState(100);           // your Postman test uses 50
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef();

  // Cancel any in-flight request (avoids race conditions)
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
    }
    return s;
  }, [selectedItems]);

  const isVariantSelected = useCallback(
    (variantId) => selectedIdSet.has(variantId),
    [selectedIdSet]
  );

  // ---------- normalize server response ----------
  const normalize = useCallback((json) => {
    // Expected: { page, limit, hasMore, data: [...] }
    // Because server prunes empty variants, `hasMore` can be false even when there are more pages.
    // So: if we received ANY items, we optimistically allow "Load more".
    if (json && typeof json === "object") {
      const data = Array.isArray(json.data) ? json.data : [];
      // prefer server's hasMore if true, otherwise fallback to "data.length > 0"
      const more = json.hasMore === true ? true : data.length > 0;
      return { data, hasMore: more };
    }
    if (Array.isArray(json)) {
      return { data: json, hasMore: json.length > 0 };
    }
    return { data: [], hasMore: false };
  }, []);

  // ---------- fetch a page (exact URL you tested) ----------
  const fetchPage = useCallback(
    async (targetPage) => {
      setLoading(true);
      try {
        const signal = cancelInFlight();
        const url = `${baseUrl}/items/v1/filtered-items?page=${targetPage}&limit=${limit}&includeEmpty=0`;
        const res = await fetch(url, { signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error("Fetch failed:", res.status, res.statusText, txt);
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        console.log("[ItemModal] payload (page " + targetPage + "):", json);

        const { data: pageData, hasMore: more } = normalize(json);

        if (targetPage === 1) {
          setItems(pageData || []);
        } else {
          setItems((prev) => [...prev, ...(pageData || [])]);
        }

        setHasMore(Boolean(more));     // allow more if we received anything
        setPage(targetPage);
      } catch (e) {
        if (e?.name !== "AbortError") {
          console.error("Fetch page failed:", e);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, limit, normalize]
  );

  // Load first page when the modal opens
  useEffect(() => {
    fetchPage(1);
    return () => {
      try { abortRef.current?.abort(); } catch {}
    };
  }, [fetchPage]);

  // ---------- flatten nested items -> rows by variant ----------
  const rows = useMemo(() => {
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
          out.push({
            key: `${item.id}-${id}`,
            variantId: id,
            combinedName: `${Number.isFinite(thicknessVal) ? thicknessVal : 0} ملم ${itemName}`,
            type,
            origin: v?.origin ?? "",
            length: Number(v?.length ?? 0),
            width: Number(v?.width ?? 0),
            sheetsPerBox: Number(v?.sheetsPerBox ?? 0) || "",
            // payloads used by parent state updater
            payloadItem: { itemName, type },
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

  const onToggle = useCallback(
    (r) => handleCheckboxChange(r.payloadItem, r.payloadVariant),
    [handleCheckboxChange]
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Select Items and Dimensions</h3>

        <div className="modal-items-table-container">
          <table className="modal-items-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Item (with thickness)</th>
                <th>Type</th>
                <th>Origin</th>
                <th>Length (cm)</th>
                <th>Width (cm)</th>
                <th>Sheets/Box</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="checkbox-cell">
                    <input
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

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>
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
            onClick={() => fetchPage(page + 1)}
            className="save-button"
          >
            {loading ? "Loading..." : hasMore ? "Load more" : "No more items"}
          </button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            Page {page} • Showing {rows.length} rows
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
