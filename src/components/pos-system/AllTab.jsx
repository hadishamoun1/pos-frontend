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
import axios from "axios"; // keep only for axios.isCancel
import { axiosClient } from "../api/axiosClient"; // ✅ use api client
import "./AllTab.css";

const AllTab = forwardRef(function AllTab(
  { modalOpen, isActive, selectedMap, setSelectedMap, homeWarehouse },
  ref
) {
  const [flatRows, setFlatRows] = useState([]);
  const [nestedItems, setNestedItems] = useState([]);

  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef(null);

  // keep input focused when clicking bubbles
  const searchInputRef = useRef(null);

  // -------- SQM Repeat Modal (NO alert/prompt) --------
  const [repeatModal, setRepeatModal] = useState({
    open: false,
    row: null,
    label: "",
    value: "1",
  });
  const repeatInputRef = useRef(null);

  useEffect(() => {
    if (repeatModal.open) setTimeout(() => repeatInputRef.current?.focus?.(), 0);
  }, [repeatModal.open]);

  const closeRepeatModal = () => {
    setRepeatModal({ open: false, row: null, label: "", value: "1" });
  };

  // ✅ SAME bubbles as StockTab
  const QUICK_BUBBLES = useMemo(
    () => [
      "ابيض",
      "اسود",
      "برونز",
      "برش",
      "مرايا",
      "مغش",
      "تريبلكس",
      "كريستال",
      "عاكس",
      "مشرط",
      "ازرق",
      "اخضر",
      "غامق",
      "فاتح",
      "صليب",
      "دلتا",
    ],
    []
  );

  const THICKNESS_BUBBLES = useMemo(
    () => ["3", "4", "5", "5.5", "6", "8", "10", "12", "15", "19"],
    []
  );

  // ✅ fixed list (removed ",," and duplicate 225)
  const DIM_BUBBLES = useMemo(
    () => [
      "160",
      "161",
      "165",
      "170",
      "180",
      "183",
      "190",
      "200",
      "202",
      "205",
      "210",
      "214",
      "215",
      "225",
      "235",
      "240",
      "244",
      "245",
      "250",
      "255",
      "260",
      "321",
      "330",
      "366",
    ],
    []
  );

  // ✅ click order across all rows
  const [quickOrder, setQuickOrder] = useState([]);

  const cancelInFlight = () => {
    const ctl = abortRef.current;
    if (ctl?.abort) {
      try {
        ctl.abort();
      } catch {}
    }
    const next = new AbortController();
    abortRef.current = next;
    return next.signal;
  };

  const normalizeDigits = useCallback((s = "") => {
    return String(s)
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
      .replace(/،/g, ",");
  }, []);

  const normalizeArabic = useCallback((s = "") => {
    return String(s || "")
      .replace(/[\u064B-\u065F]/g, "")
      .replace(/\u0640/g, "")
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
        const data = Array.isArray(raw.data)
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

  const rowToPayload = useCallback((row, repeat = 1) => {
    const [variantStr, batchStr] = String(row.uniqueId).split("-");
    return {
      uniqueId: row.uniqueId,
      repeat: Number(repeat) || 1,
      source: "all",

      itemVariantId: Number(variantStr),
      batchId: Number(batchStr),
      itemName: row.itemName,
      type: row.type,
      thickness: row.thickness,
      length: row.length,
      width: row.width,
      sheetsPerBox: row.sheetsPerBox,

      itemType: row.itemType ?? row.type,
      stockMode: row.stockMode ?? "sqm",

      origin: row.origin || "",
      condition: row.condition ?? "",
      dateReceived: row.dateReceived ?? "",
      balanceOFR: row.balanceOFR ?? "",
    };
  }, []);

  const confirmRepeatModal = () => {
    const row = repeatModal.row;
    if (!row) return closeRepeatModal();

    let rep = Math.floor(Number(String(repeatModal.value || "1").trim()));
    if (!Number.isFinite(rep) || rep <= 0) rep = 1;

    setSelectedMap((prev) => {
      const next = new Map(prev);
      next.set(row.uniqueId, rowToPayload(row, rep));
      return next;
    });

    closeRepeatModal();
  };

  const fetchDefaultPage = useCallback(
    async (targetPage) => {
      if (!modalOpen || !isActive) return;

      setLoading(true);
      try {
        const signal = cancelInFlight();
        const url = `/items/v2/filtered-items-all-batches`;
        const params: any = { page: targetPage, limit };
        if (homeWarehouse) params.warehouse = homeWarehouse;
        const res = await axiosClient.get(url, { params, signal });
        const { data: flat, hasMore: hm } = normalizeEnvelope(res.data);

        if (targetPage === 1) setFlatRows(flat || []);
        else setFlatRows((prev) => [...prev, ...(flat || [])]);

        setNestedItems([]);
        setPage(targetPage);
        setHasMore(Boolean(hm));
      } catch (err) {
        if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED") return;
        console.error("Error fetching all-batches default page:", err);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [isActive, limit, modalOpen, normalizeEnvelope, homeWarehouse]
  );

  const fetchDefault = useCallback(() => fetchDefaultPage(1), [fetchDefaultPage]);

  const fetchSearch = useCallback(async () => {
    if (!modalOpen || !isActive) return;

    setLoading(true);
    try {
      const signal = cancelInFlight();
      const url = `/items/pos/search-modal`;
      const params: any = { page: 1, limit: 200, includeEmpty: 1 };
      if (homeWarehouse) params.warehouse = homeWarehouse;

      if (nameChip) params.q = normalizeArabic(nameChip);

      const raw = dimsChip ? normalizeDigits(dimsChip.trim()) : "";
      if (raw) {
        if (looksLikeDims(raw)) params.dims = raw;
        else if (isPlainNumber(raw)) params.length = Number(raw);
      }

      const res = await axiosClient.get(url, { params, signal });
      const nested = Array.isArray(res.data) ? res.data : [];

      setNestedItems(nested);
      setFlatRows([]);
      setHasMore(false);
      setPage(1);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED") return;
      console.error("Error fetching all-batches search:", err);
      setNestedItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [
    dimsChip,
    isActive,
    isPlainNumber,
    looksLikeDims,
    modalOpen,
    nameChip,
    normalizeArabic,
    normalizeDigits,
    homeWarehouse,
  ]);

  // ✅ clear everything (input + chips + bubbles)
  const clearEverything = useCallback(() => {
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    setQuickOrder([]);
    setTimeout(() => searchInputRef.current?.focus?.(), 0);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    setFlatRows([]);
    setNestedItems([]);
    clearEverything();
    setPage(1);
    setHasMore(false);

    return () => abortRef.current?.abort?.();
  }, [modalOpen, clearEverything]);

  useEffect(() => {
    if (!modalOpen || !isActive) return;
    if (nameChip || dimsChip) fetchSearch();
    else fetchDefault();
  }, [modalOpen, isActive, nameChip, dimsChip, fetchDefault, fetchSearch]);

  const orderToText = useCallback((ord) => {
    return (ord || [])
      .map((k) => {
        if (k.startsWith("N:")) return k.slice(2);
        if (k.startsWith("T:")) return `${k.slice(2)}ملم`;
        if (k.startsWith("D:")) return k.slice(2);
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }, []);

  const handleEnter = useCallback(
    (e) => {
      if (e.key !== "Enter") return;
      const raw0 = inputValue.trim();
      if (!raw0) return;

      const raw = normalizeDigits(raw0).trim();
      const parts = raw.split(/\s+/).filter(Boolean);

      setQuickOrder([]);

      const dimsToken = parts.find((p) => p.includes("*") && looksLikeDims(p));
      if (dimsToken) {
        setDimsChip(dimsToken);
        const rest = parts.filter((p) => p !== dimsToken).join(" ").trim();
        if (rest) setNameChip(normalizeArabic(rest));
        setInputValue("");
        return;
      }

      const numIdx = [];
      for (let i = 0; i < parts.length; i++) {
        if (isPlainNumber(parts[i])) numIdx.push(i);
      }

      if (numIdx.length >= 2) {
        const a = parts[numIdx[0]];
        const b = parts[numIdx[1]];
        setDimsChip(`${a}*${b}`);

        const restParts = parts.slice();
        restParts.splice(numIdx[1], 1);
        restParts.splice(numIdx[0], 1);

        const rest = restParts.join(" ").trim();
        if (rest) setNameChip(normalizeArabic(rest));
        setInputValue("");
        return;
      }

      if (numIdx.length === 1) {
        const n = parts[numIdx[0]];
        setDimsChip(n);

        const restParts = parts.slice();
        restParts.splice(numIdx[0], 1);

        const rest = restParts.join(" ").trim();
        if (rest) setNameChip(normalizeArabic(rest));
        setInputValue("");
        return;
      }

      setNameChip(normalizeArabic(raw));
      setInputValue("");
    },
    [
      inputValue,
      isPlainNumber,
      looksLikeDims,
      normalizeArabic,
      normalizeDigits,
      setDimsChip,
      setNameChip,
    ]
  );

  // ✅ right click triggers same behavior as Enter
  const triggerEnterSearch = useCallback(() => {
    if (!String(inputValue || "").trim()) return;
    handleEnter({ key: "Enter" });
  }, [handleEnter, inputValue]);

  const clearNameChip = () => setNameChip("");
  const clearDimsChip = () => setDimsChip("");

  const isNameActive = useCallback(
    (token) => quickOrder.includes(`N:${token}`),
    [quickOrder]
  );

  const activeThickness = useMemo(() => {
    const t = quickOrder.find((x) => x.startsWith("T:"));
    return t ? t.slice(2) : null;
  }, [quickOrder]);

  const isDimActive = useCallback(
    (n) => quickOrder.includes(`D:${String(n)}`),
    [quickOrder]
  );

  const toggleNameBubble = (token) => {
    const t = String(token || "").trim();
    if (!t) return;

    setQuickOrder((prev) => {
      const key = `N:${t}`;
      const next = prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key];
      setInputValue(orderToText(next));
      setTimeout(() => searchInputRef.current?.focus?.(), 0);
      return next;
    });
  };

  const toggleThicknessBubble = (th) => {
    const t = String(th || "").trim();
    if (!t) return;

    setQuickOrder((prev) => {
      const key = `T:${t}`;
      const withoutAny = prev.filter((x) => !x.startsWith("T:"));
      const wasSame = prev.includes(key);
      const next = wasSame ? withoutAny : [...withoutAny, key];
      setInputValue(orderToText(next));
      setTimeout(() => searchInputRef.current?.focus?.(), 0);
      return next;
    });
  };

  const toggleDimBubble = (num) => {
    const t = String(num || "").trim();
    if (!t) return;

    setQuickOrder((prev) => {
      const key = `D:${t}`;

      if (prev.includes(key)) {
        const next = prev.filter((x) => x !== key);
        setInputValue(orderToText(next));
        setTimeout(() => searchInputRef.current?.focus?.(), 0);
        return next;
      }

      const dims = prev.filter((x) => x.startsWith("D:"));
      let next = prev;

      if (dims.length >= 2) {
        const oldest = dims[0];
        next = next.filter((x) => x !== oldest);
      }

      next = [...next, key];

      setInputValue(orderToText(next));
      setTimeout(() => searchInputRef.current?.focus?.(), 0);
      return next;
    });
  };

  const toggleSelect = (row) => {
    if (!row.selectable) return;

    setSelectedMap((prev) => {
      const next = new Map(prev);

      if (next.has(row.uniqueId)) {
        next.delete(row.uniqueId);
        return next;
      }

      const t = String(row.type || "").toLowerCase();

      if (t === "sqm" || t === "unit") {
        const label =
          t === "unit"
            ? `${row.itemName ?? ""}`.trim()
            : `${parseFloat(String(row.thickness))} ملم ${row.itemName ?? ""}`.trim();

        setRepeatModal({ open: true, row, label, value: "1" });
        return prev;
      }

      next.set(row.uniqueId, rowToPayload(row, 1));
      return next;
    });
  };

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

        itemType: r.itemType ?? r.type,
        stockMode: r.stockMode ?? "sqm",

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

              itemType: item.itemType ?? item.type,
              stockMode: item.stockMode ?? "sqm",

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

  const selectedTotal = useMemo(() => {
    let total = 0;
    (selectedMap || new Map()).forEach((v) => (total += Number(v?.repeat || 1)));
    return total;
  }, [selectedMap]);

  useImperativeHandle(ref, () => ({
    collectSelected: () => {
      const out = [];
      for (const v of (selectedMap || new Map()).values()) {
        const rep = Math.max(1, Number(v?.repeat || 1));
        for (let i = 0; i < rep; i++) {
          out.push({ ...v, _repeatIndex: i + 1, _repeatTotal: rep });
        }
      }
      return out;
    },
  }));

  return (
    <div className="all-tab-root">
      {/* -------- Repeat Modal -------- */}
      {repeatModal.open && (
        <div
          className="repeat-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeRepeatModal();
          }}
        >
          <div
            className="repeat-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="repeat-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="repeat-modal-header">
              <div className="repeat-modal-title" id="repeat-title">
                SQM Repetitions
              </div>
              <button className="repeat-modal-x" onClick={closeRepeatModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="repeat-modal-body">
              <div className="repeat-modal-label">{repeatModal.label}</div>

              <div className="repeat-modal-field">
                <label className="repeat-modal-field-label">How many times?</label>
                <input
                  ref={repeatInputRef}
                  className="repeat-modal-input"
                  type="number"
                  min="1"
                  step="1"
                  value={repeatModal.value}
                  onChange={(e) => setRepeatModal((p) => ({ ...p, value: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRepeatModal();
                    if (e.key === "Escape") closeRepeatModal();
                  }}
                />
              </div>
            </div>

            <div className="repeat-modal-footer">
              <button className="repeat-modal-btn ghost" onClick={closeRepeatModal}>
                Cancel
              </button>
              <button className="repeat-modal-btn primary" onClick={confirmRepeatModal}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ right click anywhere here triggers the search */}
      <div
        className="all-tab-item-input-row"
        onContextMenu={(e) => {
          e.preventDefault();
          triggerEnterSearch();
        }}
      >
        {/* input + clear */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="اكتب ثم Enter — مثال: 5.5ملم ابيض  |  225*321-012  |  225 321"
            className="all-tab-items-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleEnter}
            onContextMenu={(e) => {
              e.preventDefault();
              triggerEnterSearch();
            }}
            autoFocus
          />

          <button
            type="button"
            className="all-clear-btn"
            onClick={clearEverything}
            title="Clear"
            aria-label="Clear search"
          >
            Clear
          </button>
        </div>

        <div className="all-tab-chips">
          {nameChip && (
            <span className="all-chip" title={nameChip}>
              <span className="all-chip-label all-chip-label--name" dir="rtl">
                {nameChip}
              </span>
              <button className="all-chip-x" onClick={clearNameChip} aria-label="Remove name filter">
                ×
              </button>
            </span>
          )}

          {dimsChip && (
            <span className="all-chip" title={dimsChip}>
              <span className="all-chip-label all-chip-label--dims" dir="ltr">
                <bdi>{dimsChip}</bdi>
              </span>
              <button className="all-chip-x" onClick={clearDimsChip} aria-label="Remove dims/length filter">
                ×
              </button>
            </span>
          )}

          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
            Selected: {selectedTotal}
          </span>
        </div>
      </div>

      {/* ✅ Sticky bubbles block (3 lines) + right click trigger */}
      <div
        className="all-quick-bubbles-wrap"
        onContextMenu={(e) => {
          e.preventDefault();
          triggerEnterSearch();
        }}
      >
        <div className="all-quick-bubbles-row">
          {QUICK_BUBBLES.map((token) => {
            const active = isNameActive(token);
            return (
              <button
                key={token}
                type="button"
                onClick={() => toggleNameBubble(token)}
                className={"all-quick-bubble" + (active ? " active" : "")}
              >
                {token}
              </button>
            );
          })}
        </div>

        <div className="all-quick-bubbles-row thickness-row">
          {THICKNESS_BUBBLES.map((t) => {
            const active = activeThickness === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleThicknessBubble(t)}
                className={"all-quick-bubble all-quick-bubble-thick" + (active ? " active" : "")}
              >
                {t} ملم
              </button>
            );
          })}
        </div>

        <div className="all-quick-bubbles-row dims-row">
          {DIM_BUBBLES.map((n) => {
            const active = isDimActive(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleDimBubble(n)}
                className={"all-quick-bubble all-quick-bubble-dim" + (active ? " active" : "")}
              >
                {n}
              </button>
            );
          })}
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
            const rep = checked ? Number(selectedMap.get(r.uniqueId)?.repeat || 1) : 1;

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
                  {checked && ["sqm", "unit"].includes(String(r.type || "").toLowerCase()) && (
                    <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.8 }}>x{rep}</span>
                  )}
                </td>

                <td style={{ direction: "rtl", textAlign: "right" }}>
                  {String(r.type || "").toLowerCase() === "unit"
                    ? `${r.itemName ?? ""}`.trim()
                    : `${parseFloat(String(r.thickness))} ملم ${r.itemName ?? ""}`.trim()}
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
