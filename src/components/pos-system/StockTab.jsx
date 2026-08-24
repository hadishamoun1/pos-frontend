// src/components/pos-system/StockTab.jsx
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
import { axiosClient } from "../api/axiosClient";
import { useTranslation } from "../hooks/useTranslation"; // ✅ ADD THIS

/* ----------------- Light Repeat Modal (no prompt) ----------------- */
function RepeatModal({ open, label, defaultValue = 1, onCancel, onConfirm }) {
  const { t } = useTranslation(); // ✅ ADD THIS
  const [val, setVal] = useState(String(defaultValue));
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setVal(String(defaultValue ?? 1));
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [open, defaultValue]);

  if (!open) return null;

  const parseCount = () => {
    const n = Math.floor(Number(String(val).trim()));
    if (!Number.isFinite(n) || n <= 0) return 1;
    return n;
  };

  const submit = () => onConfirm(parseCount());

  return (
    <div
      className="repeat-modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="repeat-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="repeat-modal-header">
          <div className="repeat-modal-title">{t('stockTab.sqmRepetitions')}</div> {/* ✅ CHANGED */}
          <button className="repeat-modal-x" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="repeat-modal-body">
          <div className="repeat-modal-label">{label}</div>

          <div className="repeat-modal-field">
            <div className="repeat-modal-field-label">
              {t('stockTab.howManyTimes')} {/* ✅ CHANGED */}
            </div>
            <input
              ref={inputRef}
              className="repeat-modal-input"
              type="number"
              min={1}
              step={1}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") onCancel();
              }}
            />
          </div>
        </div>

        <div className="repeat-modal-footer">
          <button className="repeat-modal-btn ghost" onClick={onCancel}>
            {t('stockTab.cancel')} {/* ✅ CHANGED */}
          </button>
          <button className="repeat-modal-btn primary" onClick={submit}>
            {t('stockTab.ok')} {/* ✅ CHANGED */}
          </button>
        </div>
      </div>
    </div>
  );
}

const StockTab = forwardRef(function StockTab(
  { modalOpen, isActive, selectedMap, setSelectedMap, homeWarehouse, mediaOnly },
  ref
) {
  const { t } = useTranslation(); // ✅ ADD THIS LINE
  
  const [flatRows, setFlatRows] = useState([]);
  const [nestedItems, setNestedItems] = useState([]);

  // Full-size photo preview for the "Pictured Items" (mediaOnly) tab
  const [previewImage, setPreviewImage] = useState(null);

  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef(null);

  const [repeatOpen, setRepeatOpen] = useState(false);
  const pendingRowRef = useRef(null);

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

  const ORIGIN_BUBBLES = useMemo(
    () => ["China", "Italy", "Turkey", "Egypt", "Spain"],
    []
  );

  const [quickOrder, setQuickOrder] = useState([]);

  const searchInputRef = useRef(null);

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
      source: "stock",
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
      stockQty: row.stockQty ?? "",
    };
  }, []);

  const flattenVariants = useCallback((variants) => {
    const out = [];
    for (const v of (variants || [])) {
      const isService = String(v.stockMode || "").toLowerCase() === "none";
      const stockQty = Number(v.ones?.balance ?? 0);
      if (!isService && !(stockQty > 0)) continue;

      for (const b of (v.batches || [])) {
        const batchBal = Number(b.balanceOFR ?? 0);
        if (!isService && !(batchBal > 0)) continue;

        out.push({
          variantId: v.variantId,
          batchId: b.id,
          itemName: v.itemName,
          type: v.type,
          thickness: v.thickness,
          length: v.length,
          width: v.width,
          sheetsPerBox: v.sheetsPerBox,
          origin: v.origin,
          stockMode: v.stockMode,
          condition: b.condition,
          dateReceived: b.dateReceived,
          stockQty: isService ? "" : Number(b.balanceOFR ?? 0),
          productDescription: v.productDescription ?? null,
          pictureUrl: v.pictureUrl ?? null,
        });
      }
    }
    return out;
  }, []);

  const fetchDefaultPage = useCallback(
    async (targetPage) => {
      if (!modalOpen || !isActive) return;
      setLoading(true);
      try {
        const signal = cancelInFlight();
        const whParams = homeWarehouse ? { warehouse: homeWarehouse } : {};
        const mediaParams = mediaOnly ? { hasMedia: true } : {};
        const res = await axiosClient.get("/items/v1/real-variant-ledger", {
          params: { page: targetPage, limit, includeSqm: true, ...whParams, ...mediaParams },
          signal,
        });
        const { data: variants, hasMore: hm } = normalizeEnvelope(res.data);
        const flat = flattenVariants(variants);

        if (targetPage === 1) setFlatRows(flat);
        else setFlatRows((prev) => [...prev, ...flat]);

        setNestedItems([]);
        setPage(targetPage);
        setHasMore(Boolean(hm));
      } catch (err) {
        if (axios.isCancel?.(err)) return;
        console.error("Error fetching stock default:", err);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [isActive, limit, modalOpen, normalizeEnvelope, flattenVariants, homeWarehouse, mediaOnly]
  );

  const fetchDefault = useCallback(() => fetchDefaultPage(1), [fetchDefaultPage]);

  const fetchSearch = useCallback(async () => {
    if (!modalOpen || !isActive) return;
    setLoading(true);
    try {
      const signal = cancelInFlight();
      const params = { page: 1, limit: 200 };

      if (nameChip) params.q = normalizeArabic(nameChip);

      const raw = dimsChip ? normalizeDigits(dimsChip.trim()) : "";
      if (raw) {
        if (looksLikeDims(raw)) {
          params.q = [params.q, raw].filter(Boolean).join(" ");
        } else if (isPlainNumber(raw)) {
          params.length = Number(raw);
        }
      }

      if (homeWarehouse) params.warehouse = homeWarehouse;
      if (mediaOnly) params.hasMedia = true;
      const res = await axiosClient.get("/items/v1/real-variant-ledger", { params: { ...params, includeSqm: true }, signal });
      const { data: variants } = normalizeEnvelope(res.data);
      const flat = flattenVariants(variants);

      setFlatRows(flat);
      setNestedItems([]);
      setHasMore(false);
      setPage(1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching stock search:", err);
      setFlatRows([]);
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
    normalizeEnvelope,
    flattenVariants,
    homeWarehouse,
    mediaOnly,
  ]);

  const clearEverything = useCallback(() => {
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    setOriginFilter("");
    setTypeFilter("");
    setQuickOrder([]);
    setTimeout(() => searchInputRef.current?.focus?.(), 0);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    clearEverything();
    setFlatRows([]);
    setNestedItems([]);
    setPage(1);
    setHasMore(false);
    setRepeatOpen(false);
    pendingRowRef.current = null;
  }, [modalOpen, clearEverything]);

  useEffect(() => {
    if (!modalOpen || !isActive) return;
    if (nameChip || dimsChip) fetchSearch();
    else fetchDefault();
    return () => abortRef.current?.abort?.();
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

  const handleEnter = (e) => {
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
  };

  const triggerEnterSearch = useCallback(() => {
    if (!String(inputValue || "").trim()) return;
    handleEnter({ key: "Enter" });
  }, [handleEnter, inputValue]);

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
      const withoutAnyThickness = prev.filter((x) => !x.startsWith("T:"));
      const wasSameActive = prev.includes(key);
      const next = wasSameActive ? withoutAnyThickness : [...withoutAnyThickness, key];

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

    if (selectedMap.has(row.uniqueId)) {
      setSelectedMap((prev) => {
        const next = new Map(prev);
        next.delete(row.uniqueId);
        return next;
      });
      return;
    }

    const t = String(row.type || "").toLowerCase();
    if (t === "sqm" || t === "unit") {
      pendingRowRef.current = row;
      setRepeatOpen(true);
      return;
    }

    setSelectedMap((prev) => {
      const next = new Map(prev);
      next.set(row.uniqueId, rowToPayload(row, 1));
      return next;
    });
  };

  const confirmRepeat = (repeatCount) => {
    const row = pendingRowRef.current;
    pendingRowRef.current = null;
    setRepeatOpen(false);
    if (!row) return;

    setSelectedMap((prev) => {
      const next = new Map(prev);
      next.set(row.uniqueId, rowToPayload(row, repeatCount));
      return next;
    });
  };

  const cancelRepeat = () => {
    pendingRowRef.current = null;
    setRepeatOpen(false);
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
        length: Number(r.length || 0),
        width: Number(r.width || 0),
        sheetsPerBox: Number(r.sheetsPerBox || 0),
        itemType: r.itemType ?? r.type,
        stockMode: r.stockMode ?? "sqm",
        origin: r.origin || "",
        condition: r.condition ?? "",
        dateReceived: r.dateReceived ?? "",
        stockQty: r.stockQty ?? "",
        productDescription: r.productDescription ?? null,
        pictureUrl: r.pictureUrl ?? null,
      };
    });
  }, [flatRows]);

  const rowsFromNested = useMemo(() => {
    if (!nestedItems.length) return [];
    const out = [];
    (nestedItems || []).forEach((item) => {
      (item.thicknesses || []).forEach((th) => {
        (th.variants || []).forEach((v) => {
          if (!Array.isArray(v.batches) || v.batches.length === 0) return;
          const variantId = Number(v.id);
          const hasRealVariantId = Number.isFinite(variantId);
          v.batches.forEach((b) => {
            const batchId = Number(b.id);
            const selectable = hasRealVariantId && Number.isFinite(batchId);
            out.push({
              uniqueId: `${variantId}-${batchId}`,
              selectable,
              itemName: item.itemName,
              type: item.type,
              thickness: th.thickness,
              length: Number(v.length),
              width: Number(v.width),
              sheetsPerBox: Number(v.sheetsPerBox),
              origin: v.origin,
              itemType: item.itemType ?? item.type,
              stockMode: item.stockMode ?? "sqm",
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
  const unfilteredRows = rowsFromFlat;
  
  const rows = useMemo(() => {
    let filtered = unfilteredRows;
    
    if (originFilter) {
      filtered = filtered.filter(row => {
        const rowOrigin = String(row.origin || "").trim();
        return rowOrigin.toLowerCase() === originFilter.toLowerCase();
      });
    }
    
    if (typeFilter) {
      filtered = filtered.filter(row => {
        const rowType = String(row.type || "").toLowerCase();
        return rowType === typeFilter.toLowerCase();
      });
    }
    
    return filtered;
  }, [unfilteredRows, originFilter, typeFilter]);

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

  const pendingLabel = useMemo(() => {
    const row = pendingRowRef.current;
    if (!row) return "";
    const t = String(row.type || "").toLowerCase();
    return t === "unit"
      ? `${row.itemName ?? ""}`.trim()
      : `${parseFloat(String(row.thickness))} ملم ${row.itemName ?? ""}`.trim();
  }, [repeatOpen]);

  return (
    <>
      <RepeatModal
        open={repeatOpen}
        label={pendingLabel}
        defaultValue={1}
        onCancel={cancelRepeat}
        onConfirm={confirmRepeat}
      />

      <div
        className="search-modal-item-input-row"
        onContextMenu={(e) => {
          e.preventDefault();
          triggerEnterSearch();
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t('stockTab.searchPlaceholder')} 
            className="search-modal-items-input"
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
            className="search-clear-btn"
            onClick={clearEverything}
            title={t('stockTab.clear')} 
            aria-label={t('stockTab.clear')} 
          >
            {t('stockTab.clear')} 
          </button>
        </div>

        <div className="search-modal-chips">
          {nameChip && (
            <span className="search-chip" title={nameChip}>
              <span className="search-chip-label search-chip-label--name" dir="rtl">
                {nameChip}
              </span>
              <button
                className="search-chip-x"
                onClick={() => setNameChip("")}
                aria-label="Remove name filter"
              >
                ×
              </button>
            </span>
          )}

          {dimsChip && (
            <span className="search-chip" title={dimsChip}>
              <span className="search-chip-label search-chip-label--dims" dir="ltr">
                <bdi>{dimsChip}</bdi>
              </span>
              <button
                className="search-chip-x"
                onClick={() => setDimsChip("")}
                aria-label="Remove dims/length filter"
              >
                ×
              </button>
            </span>
          )}

          <select 
            value={originFilter} 
            onChange={(e) => setOriginFilter(e.target.value)}
            style={{ 
              padding: '4px 8px', 
              fontSize: '13px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              backgroundColor: originFilter ? '#e8f4f8' : 'white',
              cursor: 'pointer'
            }}
          >
            <option value="">{t('stockTab.allOrigins')}</option> {/* ✅ CHANGED */}
            <option value="China">China</option>
            <option value="Italy">Italy</option>
            <option value="Trakya">Trakya</option>
            <option value="Sphinx">Sphinx</option>
            <option value="SISECAM">SISECAM</option>
            <option value="Corpotrad">Corpotrad</option>
            <option value="Sahand">Sahand</option>
            <option value="GrandStar">GrandStar</option>
            <option value="S.G">S.G</option>
            <option value="Bisheng Techno">Bisheng Techno</option>
            <option value="Qingdao">Qingdao</option>
            <option value="King Tai">King Tai</option>
            <option value="Guardian">Guardian</option>
            <option value="AGC">AGC</option>
            <option value="Cario">Cario</option>
          </select>

          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ 
              padding: '4px 8px', 
              fontSize: '13px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              backgroundColor: typeFilter ? '#e8f4f8' : 'white',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            <option value="">{t('stockTab.allTypes')}</option> {/* ✅ CHANGED */}
            <option value="box">Box</option>
            <option value="sheet">Sheet</option>
            <option value="sqm">SQM</option>
            <option value="unit">Unit</option>
          </select>

          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
            {t('stockTab.selected')}: {selectedTotal} {/* ✅ CHANGED */}
          </span>
        </div>
      </div>

      <div
        className="search-quick-bubbles-wrap"
        onContextMenu={(e) => {
          e.preventDefault();
          triggerEnterSearch();
        }}
      >
        <div className="search-quick-bubbles-row">
          {QUICK_BUBBLES.map((token) => {
            const active = isNameActive(token);
            return (
              <button
                key={token}
                type="button"
                onClick={() => toggleNameBubble(token)}
                className={"quick-bubble" + (active ? " active" : "")}
              >
                {token}
              </button>
            );
          })}
        </div>

        <div className="search-quick-bubbles-row thickness-row">
          {THICKNESS_BUBBLES.map((t) => {
            const active = activeThickness === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleThicknessBubble(t)}
                className={"quick-bubble quick-bubble-thick" + (active ? " active" : "")}
              >
                {t} ملم
              </button>
            );
          })}
        </div>

        <div className="search-quick-bubbles-row dims-row">
          {DIM_BUBBLES.map((n) => {
            const active = isDimActive(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleDimBubble(n)}
                className={"quick-bubble quick-bubble-dim" + (active ? " active" : "")}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {mediaOnly ? (
        <div className="media-grid">
          {rows.map((r) => {
            const checked = selectedMap.has(r.uniqueId);
            const typeLower = String(r.type || "").toLowerCase();
            const isBox = typeLower === "box";
            const isSheet = typeLower === "sheet";

            let dimensionsDisplay = "";
            if (isBox) {
              dimensionsDisplay = `${r.length ?? ""}×${r.width ?? ""}-${String(r.sheetsPerBox || 0).padStart(3, "0")}`;
            } else if (isSheet) {
              dimensionsDisplay = `${r.length ?? ""}×${r.width ?? ""}`;
            } else {
              dimensionsDisplay = r.length && r.width ? `${r.length}×${r.width}` : (r.length ?? "");
            }

            const displayName =
              typeLower === "unit"
                ? `${r.itemName ?? ""}`.trim()
                : `${parseFloat(String(r.thickness))} ملم ${r.itemName ?? ""}`.trim();

            const imgUrl = r.pictureUrl ? `${axiosClient.defaults.baseURL}${r.pictureUrl}` : null;

            return (
              <div
                key={r.uniqueId}
                className={`media-card${checked ? " selected" : ""}${!r.selectable ? " disabled" : ""}`}
                onClick={() => r.selectable && toggleSelect(r)}
              >
                <div className="media-card-check">
                  <input type="checkbox" checked={checked} disabled={!r.selectable} readOnly />
                </div>

                <div className="media-card-image">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt=""
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage({ url: imgUrl, itemName: r.itemName, productDescription: r.productDescription });
                      }}
                    />
                  ) : (
                    <div className="media-card-noimg">No photo</div>
                  )}
                </div>

                <div className="media-card-body">
                  <div className="media-card-name" dir="rtl">{displayName}</div>

                  <div className="media-card-dims-row">
                    {dimensionsDisplay && <span className="media-card-dims">{dimensionsDisplay}</span>}
                    {r.type && <span className="media-card-type-badge">{r.type}</span>}
                  </div>

                  {r.origin && (
                    <div className="media-card-kv">
                      <span className="media-card-kv-label">{t('stockTab.origin')}:</span>
                      <span className="media-card-kv-value">{r.origin}</span>
                    </div>
                  )}

                  {r.stockQty !== "" && r.stockQty != null && (
                    <div className="media-card-kv">
                      <span className="media-card-kv-label">{t('stockTab.stockBox')}/{t('stockTab.stockSheet')}:</span>
                      <span className="media-card-kv-value">{r.stockQty}</span>
                    </div>
                  )}
                  {r.productDescription && (
                    <div className="media-card-desc" dir="rtl">{r.productDescription}</div>
                  )}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="media-grid-empty">{t('stockTab.noData')}</div>
          )}
        </div>
      ) : (
      <table className="search-modal-table">
        <thead>
          <tr>
            <th className="col-select">{t('stockTab.select')}</th> {/* ✅ CHANGED */}
            <th className="col-item">{t('stockTab.item')}</th> {/* ✅ CHANGED */}
            <th className="col-type">{t('stockTab.type')}</th> {/* ✅ CHANGED */}
            <th className="col-length">{t('stockTab.length')}</th> {/* ✅ CHANGED */}
            <th className="col-stock-box">{t('stockTab.stockBox')}</th> {/* ✅ CHANGED */}
            <th className="col-stock-sheet">{t('stockTab.stockSheet')}</th> {/* ✅ CHANGED */}
            <th className="col-origin">{t('stockTab.origin')}</th> {/* ✅ CHANGED */}
            <th className="col-condition">{t('stockTab.condition')}</th> {/* ✅ CHANGED */}
            <th className="col-date">{t('stockTab.dateReceived')}</th> {/* ✅ CHANGED */}
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => {
            const checked = selectedMap.has(r.uniqueId);
            const rep = checked ? Number(selectedMap.get(r.uniqueId)?.repeat || 1) : 1;

            const typeLower = String(r.type || "").toLowerCase();
            const isBox = typeLower === "box";
            const isSheet = typeLower === "sheet";

            let dimensionsDisplay = "";
            if (isBox) {
              dimensionsDisplay = `${r.length ?? ""}×${r.width ?? ""}-${String(r.sheetsPerBox || 0).padStart(3, "0")}`;
            } else if (isSheet) {
              dimensionsDisplay = `${r.length ?? ""}×${r.width ?? ""}`;
            } else {
              if (r.length && r.width) {
                dimensionsDisplay = `${r.length ?? ""}×${r.width ?? ""}`;
              } else {
                dimensionsDisplay = r.length ?? "";
              }
            }

            const stockBox = isBox ? (r.stockQty ?? "") : "";
            const stockSheet = isSheet ? (r.stockQty ?? "") : "";

            return (
              <tr key={r.uniqueId} className={!r.selectable ? "row-disabled" : ""}>
                <td className="cell-select">
                  <input
                    type="checkbox"
                    disabled={!r.selectable}
                    checked={checked}
                    onChange={() => toggleSelect(r)}
                  />
                  {checked && typeLower === "sqm" && (
                    <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.8 }}>
                      x{rep}
                    </span>
                  )}
                </td>

                <td style={{ direction: "rtl", textAlign: "right" }}>
                  {typeLower === "unit"
                    ? `${r.itemName ?? ""}`.trim()
                    : `${parseFloat(String(r.thickness))} ملم ${r.itemName ?? ""}`.trim()}
                </td>

                <td>{r.type}</td>
                <td>{dimensionsDisplay}</td>
                <td>{stockBox}</td>
                <td>{stockSheet}</td>
                <td>{r.origin ?? ""}</td>
                <td>{r.condition ?? ""}</td>
                <td>{r.dateReceived ?? ""}</td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr className="empty-row">
              <td className="empty-cell" colSpan={9}>
                {t('stockTab.noData')} {/* ✅ CHANGED */}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      )}

      {!inSearchMode && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <button
            className="save-button"
            disabled={loading || !hasMore}
            onClick={() => fetchDefaultPage(page + 1)}
          >
            {loading ? t('stockTab.loading') : hasMore ? t('stockTab.loadMore') : t('stockTab.noMoreItems')} {/* ✅ CHANGED */}
          </button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            {t('stockTab.page')} {page} • {t('stockTab.showing')} {rows.length} {t('stockTab.rows')} {/* ✅ CHANGED */}
          </span>
        </div>
      )}

      {previewImage && (
        <div className="media-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="media-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="media-preview-close"
              onClick={() => setPreviewImage(null)}
              aria-label="Close"
            >
              ×
            </button>

            <div className="media-preview-image-wrap">
              <img src={previewImage.url} alt="" />
            </div>

            {(previewImage.itemName || previewImage.productDescription) && (
              <div className="media-preview-info">
                {previewImage.itemName && (
                  <div className="media-preview-name" dir="rtl">{previewImage.itemName}</div>
                )}
                {previewImage.productDescription && (
                  <div className="media-preview-desc" dir="rtl">{previewImage.productDescription}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

export default StockTab;