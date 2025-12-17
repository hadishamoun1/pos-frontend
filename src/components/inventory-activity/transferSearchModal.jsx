// TransferSearchModal.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./transferSearchModal.css";

/** format numbers: remove trailing .00 */
function fmtNum(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (Number.isInteger(n)) return String(n);
  // keep up to 2 decimals but trim zeros
  return n.toFixed(2).replace(/\.?0+$/, "");
}

const TransferSearchModal = ({
  isOpen,
  onClose,
  onSelect,
  existingKeys = new Set(),
  singleSelect = false,
}) => {
  const baseUrl = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

  const [inputValue, setInputValue] = useState("");
  const [qChip, setQChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");

  const [defaultItems, setDefaultItems] = useState([]);
  const [searchItems, setSearchItems] = useState([]);

  const [selectedSet, setSelectedSet] = useState(new Set());

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(null);
  const [totalRows, setTotalRows] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const limit = 100;

  const isSearchMode = Boolean(qChip || dimsChip);

  const resetPaging = useCallback(() => {
    setPage(1);
    setTotalPages(null);
    setTotalRows(null);
    setHasMore(false);
  }, []);

  const fetchDefaultPage = useCallback(
    async (pageToLoad, { replace } = { replace: false }) => {
      setLoading(true);
      try {
        const res = await axios.get(`${baseUrl}/items/v2/filtered-items`, {
          params: {
            page: pageToLoad,
            limit,
            instockOnly: true,
            includeDesc: true,
          },
        });

        const pageData = Array.isArray(res?.data?.data) ? res.data.data : [];
        const pageFromApi = Number(res?.data?.page ?? pageToLoad);
        const totalPagesFromApi =
          res?.data?.totalPages != null ? Number(res.data.totalPages) : null;
        const totalRowsFromApi =
          res?.data?.total != null ? Number(res.data.total) : null;

        const hasMoreFromApi =
          totalPagesFromApi != null ? pageFromApi < Number(totalPagesFromApi) : false;

        setHasMore(Boolean(hasMoreFromApi));
        setPage(pageFromApi);
        setTotalPages(totalPagesFromApi);
        setTotalRows(totalRowsFromApi);

        setDefaultItems((prev) => (replace ? pageData : [...prev, ...pageData]));
      } catch (e) {
        console.error(e);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, limit]
  );

  const fetchSearchPage = useCallback(
    async (pageToLoad, { replace } = { replace: false }) => {
      // if nothing pinned yet, don’t search
      if (!qChip && !dimsChip) return;

      setLoading(true);
      try {
        const res = await axios.get(`${baseUrl}/items/pos/search-modal-instock`, {
          params: {
            q: qChip || undefined,
            dims: dimsChip || undefined,
            page: pageToLoad,
            limit,
          },
        });

        // your search api returns an array (based on what you pasted)
        const pageData = Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res?.data)
          ? res.data
          : [];

        const pageFromApi = Number(res?.data?.page ?? pageToLoad);
        const totalPagesFromApi =
          res?.data?.totalPages != null ? Number(res.data.totalPages) : null;
        const totalRowsFromApi =
          res?.data?.total != null ? Number(res.data.total) : null;

        const hasMoreFromApi =
          totalPagesFromApi != null ? pageFromApi < Number(totalPagesFromApi) : false;

        setHasMore(Boolean(hasMoreFromApi));
        setPage(pageFromApi);
        setTotalPages(totalPagesFromApi);
        setTotalRows(totalRowsFromApi);

        setSearchItems((prev) => (replace ? pageData : [...prev, ...pageData]));
      } catch (e) {
        console.error(e);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, qChip, dimsChip, limit]
  );

  // reset everything when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setInputValue("");
    setSelectedSet(new Set());

    setQChip("");
    setDimsChip("");

    setDefaultItems([]);
    setSearchItems([]);

    resetPaging();
    fetchDefaultPage(1, { replace: true });
  }, [isOpen, fetchDefaultPage, resetPaging]);

  // when switching between modes (chips on/off), refetch from page 1
  useEffect(() => {
    if (!isOpen) return;

    setSelectedSet(new Set());
    resetPaging();

    if (isSearchMode) {
      setSearchItems([]);
      fetchSearchPage(1, { replace: true });
    } else {
      setDefaultItems([]);
      fetchDefaultPage(1, { replace: true });
    }
  }, [isSearchMode, isOpen, fetchSearchPage, fetchDefaultPage, resetPaging]);

  const rows = useMemo(() => {
    // MODE 1: default (already flat from /v2/filtered-items)
    if (!isSearchMode) {
      return (defaultItems || []).map((item) => {
        const realDesc = item.realDescription || {};
        const key = `${item.variantId}-${item.batchId}`;

        return {
          key,
          itemId: item.itemId,
          itemName: item.itemName,
          thickness: item.thickness,
          length: item.length,
          width: item.width,
          sheetsPerBox: item.sheetsPerBox,
          origin: item.origin,
          itemVariantType: item.type,
          itemVariantId: item.variantId,
          variantId: item.variantId, // keep both
          itemNameDescriptionId: realDesc.id,
          categoryName: realDesc.categoryName,
          subCategory: realDesc.subCategory,
          batchId: item.batchId,
          itemBatchId: item.batchId,
          condition: item.condition,
          dateReceived: item.dateReceived,
          balanceOFR: item.balanceOFR,
        };
      });
    }

    // MODE 2: search (nested -> flatten)
    const out = [];
    const list = Array.isArray(searchItems) ? searchItems : [];

    for (const it of list) {
      const itemId = it?.id ?? null;
      const itemName = it?.itemName ?? "";
      const thicknesses = Array.isArray(it?.thicknesses) ? it.thicknesses : [];

      for (const th of thicknesses) {
        const thickness = th?.thickness ?? null;
        const variants = Array.isArray(th?.variants) ? th.variants : [];

        for (const v of variants) {
          const variantId = v?.id ?? v?.variantId ?? null;
          const length = v?.length ?? null;
          const width = v?.width ?? null;
          const sheetsPerBox = v?.sheetsPerBox ?? null;
          const origin = v?.origin ?? it?.origin ?? "";
          const itemVariantType =
            v?.itemType ?? v?.type ?? it?.itemType ?? it?.type ?? "";

          const batches = Array.isArray(v?.batches) ? v.batches : [];
          for (const b of batches) {
            const batchId = b?.id ?? b?.batchId ?? null;
            const key = `${variantId}-${batchId}`;

            out.push({
              key,

              // ✅ IMPORTANT FIX (so parent can merge like non-search mode)
              itemVariantId: variantId,
              variantId: variantId,

              // keep item id too (doesn't hurt)
              itemId,

              itemName,
              thickness,
              length,
              width,
              sheetsPerBox,
              origin,
              itemVariantType,

              batchId,
              itemBatchId: batchId,

              condition: b?.condition ?? "",
              dateReceived: b?.dateReceived ?? null,
              balanceOFR: b?.balanceOFR ?? 0,
            });
          }
        }
      }
    }

    return out;
  }, [isSearchMode, defaultItems, searchItems]);

  const toggleSelect = useCallback(
    (r) => {
      if (!r?.key) return;
      if (existingKeys.has(r.key)) return;

      setSelectedSet((prev) => {
        const next = new Set(prev);

        if (singleSelect) {
          // single select means: only allow one, and unselect if clicked again
          if (next.has(r.key)) return new Set();
          return new Set([r.key]);
        }

        if (next.has(r.key)) next.delete(r.key);
        else next.add(r.key);
        return next;
      });
    },
    [existingKeys, singleSelect]
  );

  const handleOk = useCallback(() => {
    const chosen = rows.filter((r) => selectedSet.has(r.key));
    onSelect(chosen);
    onClose();
  }, [rows, selectedSet, onSelect, onClose]);

  const onLoadMore = useCallback(() => {
    if (loading || !hasMore) return;
    if (isSearchMode) fetchSearchPage(page + 1, { replace: false });
    else fetchDefaultPage(page + 1, { replace: false });
  }, [loading, hasMore, isSearchMode, page, fetchSearchPage, fetchDefaultPage]);

  const pinToken = () => {
    const raw = String(inputValue || "").trim();
    if (!raw) return;

    // behavior:
    // - first Enter => qChip
    // - second Enter => dimsChip
    // - third Enter => replace qChip and clear dimsChip (forces new search flow)
    if (qChip && dimsChip) {
      setQChip(raw);
      setDimsChip("");
      setInputValue("");
      return;
    }

    if (qChip && !dimsChip) {
      setDimsChip(raw);
      setInputValue("");
      return;
    }

    setQChip(raw);
    setInputValue("");
  };

  const removeChip = (which) => {
    if (which === "q") setQChip("");
    if (which === "dims") setDimsChip("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      pinToken();
    }
    if (e.key === "Escape") onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="transfer-search-modal-overlay" onClick={onClose}>
      <div className="transfer-search-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="transfer-search-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="transfer-search-modal-topbar">
          <div className="transfer-search-modal-title">
            Select Items {isSearchMode ? "(Search)" : "(All Items)"}
          </div>

          <div className="transfer-search-modal-searchrow">
            <input
              type="text"
              className="transfer-search-modal-input"
              placeholder={
                !qChip
                  ? "Type thickness + name (مثال: 5.5ملم ابيض) ثم Enter"
                  : !dimsChip
                  ? "Type dims (225*321) or (225*321-026 للبوكس) ثم Enter"
                  : "Press Enter to replace Q, or remove chips to reset"
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />

            <div className="transfer-search-modal-pins">
              {qChip && (
                <span className="pin-chip" title={qChip}>
                  <span className="pin-chip-label">Q:</span>
                  <span className="pin-chip-text">{qChip}</span>
                  <button className="pin-chip-x" onClick={() => removeChip("q")} type="button">
                    ×
                  </button>
                </span>
              )}

              {dimsChip && (
                <span className="pin-chip" title={dimsChip}>
                  <span className="pin-chip-label">DIMS:</span>
                  <span className="pin-chip-text">{dimsChip}</span>
                  <button className="pin-chip-x" onClick={() => removeChip("dims")} type="button">
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="transfer-search-modal-table-wrapper">
          <table className="transfer-search-modal-table">
            <thead>
              <tr>
                <th className="col-check"></th>
                <th className="col-name">Item Name</th>
                <th>Length</th>
                <th>Width</th>
                <th>Sheets/Box</th>
                <th>Origin</th>
                <th>Type</th>
                <th>Condition</th>
                <th>Date Received</th>
                <th>Balance OFR</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const already = existingKeys.has(r.key);
                const checked = singleSelect ? false : already || selectedSet.has(r.key);

                return (
                  <tr key={r.key} className={already ? "row-disabled" : ""}>
                    <td className="cell-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={already}
                        onChange={() => toggleSelect(r)}
                      />
                    </td>

                    <td className="cell-name" style={{ direction: "rtl", textAlign: "right" }}>
                      {`${fmtNum(r.thickness)} ملم ${r.itemName ?? ""}`.trim()}
                    </td>

                    <td>{fmtNum(r.length)}</td>
                    <td>{fmtNum(r.width)}</td>
                    <td>{fmtNum(r.sheetsPerBox)}</td>
                    <td>{r.origin}</td>
                    <td>{r.itemVariantType}</td>
                    <td>{r.condition}</td>
                    <td>{r.dateReceived}</td>
                    <td>{r.balanceOFR}</td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-cell">
                    {isSearchMode ? "No results" : "No items loaded"}
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={10} className="empty-cell">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!singleSelect && (
          <div className="transfer-search-modal-footer">
            <div className="transfer-search-modal-meta">
              Page {page}
              {totalPages ? ` / ${totalPages}` : ""} • Loaded {rows.length}
              {typeof totalRows === "number" ? ` / ${totalRows}` : ""}
            </div>

            <div className="transfer-search-modal-actions">
              <button
                className="transfer-search-modal-btn secondary"
                onClick={onLoadMore}
                disabled={loading || !hasMore}
                type="button"
              >
                {loading ? "Loading..." : hasMore ? "Load more" : "No more"}
              </button>

              <button
                className="transfer-search-modal-btn primary"
                onClick={handleOk}
                disabled={selectedSet.size === 0}
              >
                OK ({selectedSet.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferSearchModal;
