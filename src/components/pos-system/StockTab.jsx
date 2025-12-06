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

/* ----------------- Light Repeat Modal (no prompt) ----------------- */
function RepeatModal({ open, label, defaultValue = 1, onCancel, onConfirm }) {
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
          <div className="repeat-modal-title">SQM repetitions</div>
          <button className="repeat-modal-x" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="repeat-modal-body">
          <div className="repeat-modal-label">{label}</div>

          <div className="repeat-modal-field">
            <div className="repeat-modal-field-label">
              How many times do you want to add it?
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
            Cancel
          </button>
          <button className="repeat-modal-btn primary" onClick={submit}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

const StockTab = forwardRef(function StockTab(
  { modalOpen, isActive, selectedMap, setSelectedMap },
  ref
) {
  const baseUrl = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

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

  // modal state for SQM repeat
  const [repeatOpen, setRepeatOpen] = useState(false);
  const pendingRowRef = useRef(null);

  // ✅ Name bubbles
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

  // ✅ Thickness bubbles (edit as you like)
  const THICKNESS_BUBBLES = useMemo(
    () => ["3", "4", "5", "5.5", "6", "8", "10", "12", "15", "19"],
    []
  );

  // ✅ ONE ordered list for "click order" across BOTH rows
  // items are like: "N:ابيض" or "T:6"
  const [quickOrder, setQuickOrder] = useState([]);

  // keep input focused when clicking bubbles
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
      balanceOFR: row.balanceOFR ?? "",
    };
  }, []);

  const fetchDefaultPage = useCallback(
    async (targetPage) => {
      if (!modalOpen || !isActive) return;
      setLoading(true);
      try {
        const signal = cancelInFlight();
        const url = `${baseUrl}/items/v2/filtered-items`;
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
        console.error("Error fetching stock default:", err);
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
      const url = `${baseUrl}/items/pos/search-modal-instock`;
      const params = { page: 1, limit: 200 };

      if (nameChip) params.q = normalizeArabic(nameChip);

      const raw = dimsChip ? normalizeDigits(dimsChip.trim()) : "";
      if (raw) {
        if (looksLikeDims(raw)) params.dims = raw;
        else if (isPlainNumber(raw)) params.length = Number(raw);
      }

      const res = await axios.get(url, { params, signal });
      const nested = Array.isArray(res.data) ? res.data : [];

      setNestedItems(nested);
      setFlatRows([]);
      setHasMore(false);
      setPage(1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching stock search:", err);
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

  // reset ONLY filters when modal opens (selection lives in parent)
  useEffect(() => {
    if (!modalOpen) return;
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    setFlatRows([]);
    setNestedItems([]);
    setPage(1);
    setHasMore(false);
    setRepeatOpen(false);
    pendingRowRef.current = null;

    // ✅ reset bubbles order
    setQuickOrder([]);
  }, [modalOpen]);

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
        if (k.startsWith("T:")) return `${k.slice(2)}ملم`; // no space -> matches your example "5.5ملم"
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }, []);

  const handleEnter = (e) => {
    if (e.key !== "Enter") return;
    const raw = inputValue.trim();
    if (!raw) return;
    const withDigits = normalizeDigits(raw);

    // clear bubbles because we "committed" the search into chips
    setQuickOrder([]);

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

  // ✅ Active helpers
  const isNameActive = useCallback(
    (token) => quickOrder.includes(`N:${token}`),
    [quickOrder]
  );

  const activeThickness = useMemo(() => {
    const t = quickOrder.find((x) => x.startsWith("T:"));
    return t ? t.slice(2) : null;
  }, [quickOrder]);

  // ✅ Name bubble toggle (keeps CLICK ORDER)
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

  // ✅ Thickness bubble toggle (single thickness)
  // - clicking another thickness replaces the old one and goes to the END (latest click)
  const toggleThicknessBubble = (th) => {
    const t = String(th || "").trim();
    if (!t) return;

    setQuickOrder((prev) => {
      const key = `T:${t}`;
      const withoutAnyThickness = prev.filter((x) => !x.startsWith("T:"));

      // if same thickness was active => remove it
      const wasSameActive = prev.includes(key);
      const next = wasSameActive ? withoutAnyThickness : [...withoutAnyThickness, key];

      setInputValue(orderToText(next));
      setTimeout(() => searchInputRef.current?.focus?.(), 0);

      return next;
    });
  };

  const toggleSelect = (row) => {
    if (!row.selectable) return;

    // unselect immediately
    if (selectedMap.has(row.uniqueId)) {
      setSelectedMap((prev) => {
        const next = new Map(prev);
        next.delete(row.uniqueId);
        return next;
      });
      return;
    }

    // SQM + UNIT -> open modal for repeat
    const t = String(row.type || "").toLowerCase();
    if (t === "sqm" || t === "unit") {
      pendingRowRef.current = row;
      setRepeatOpen(true);
      return;
    }

    // normal select
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
              length: Math.floor(Number(v.length)),
              width: Math.floor(Number(v.width)),
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

      <div className="search-modal-item-input-row">
        <input
          ref={searchInputRef}
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

          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
            Selected: {selectedTotal}
          </span>
        </div>
      </div>

      {/* ✅ Sticky bubbles block (names row then thickness row) */}
      <div className="search-quick-bubbles-wrap">
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

        {/* ✅ NEW: thickness bubbles line */}
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
          {rows.map((r) => {
            const checked = selectedMap.has(r.uniqueId);
            const rep = checked ? Number(selectedMap.get(r.uniqueId)?.repeat || 1) : 1;

            return (
              <tr key={r.uniqueId} className={!r.selectable ? "row-disabled" : ""}>
                <td className="cell-select">
                  <input
                    type="checkbox"
                    disabled={!r.selectable}
                    checked={checked}
                    onChange={() => toggleSelect(r)}
                  />
                  {checked && String(r.type || "").toLowerCase() === "sqm" && (
                    <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.8 }}>
                      x{rep}
                    </span>
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
