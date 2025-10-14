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
  // config
  const baseUrl = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

  // state
  const [items, setItems] = useState([]); // nested structure
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");

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

  const normalizeDigits = useCallback(
    (s = "") =>
      s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/،/g, ","),
    []
  );

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

  const normalizeFlatToNested = useCallback((flatRows = []) => {
    const itemsMap = new Map();

    flatRows.forEach((row) => {
      const itemKey = row.itemId;
      if (!itemsMap.has(itemKey)) {
        itemsMap.set(itemKey, {
          id: row.itemId,
          itemName: row.itemName,
          type: row.type,
          thicknesses: [],
        });
      }
      const item = itemsMap.get(itemKey);

      // thickness
      const thVal = Number(row.thickness);
      let th = item.thicknesses.find((t) => Number(t.thickness) === thVal);
      if (!th) {
        th = { id: `${row.itemId}-${thVal}`, thickness: thVal, variants: [] };
        item.thicknesses.push(th);
      }

      // variant signature
      const vSig = `${Number(row.length)}|${Number(row.width)}|${Number(
        row.sheetsPerBox
      )}|${row.origin || ""}|${row.itemNameDescriptionId || ""}`;

      let v = th.variants.find(
        (vv) =>
          `${Number(vv.length)}|${Number(vv.width)}|${Number(
            vv.sheetsPerBox
          )}|${vv.origin || ""}|${vv.itemNameDescriptionId || ""}` === vSig
      );

      const toNum = (val) => {
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
        };

      if (!v) {
        const realId =
          toNum(row.variantId) ??
          toNum(row.itemVariantId) ??
          toNum(row.ItemVariantId) ??
          null;

        v = {
          id: realId ?? `v-${row.itemId}-${thVal}-${vSig}`,
          length: Number(row.length),
          width: Number(row.width),
          sheetsPerBox: Number(row.sheetsPerBox),
          origin: row.origin,
          itemNameDescriptionId: row.itemNameDescriptionId,
          itemNameDescription: row.itemNameDescription || null,
          batches: [],
        };
        th.variants.push(v);
      }

      if (Array.isArray(row.batches)) {
        row.batches.forEach((b) => {
          v.batches.push({
            id: b.id,
            condition: b.condition,
            dateReceived: b.dateReceived,
            balanceOFR: b.balanceOFR,
          });
        });
      }
    });

    return Array.from(itemsMap.values());
  }, []);

  // ---------- data fetch ----------
  const fetchDefault = useCallback(async () => {
    try {
      const signal = cancelInFlight();
      const url = `${baseUrl}/items/v2/filtered-items`;
      const params = { page: 1, limit: 200, includeEmpty: 1 };
      const res = await axios.get(url, { params, signal });
      const raw = Array.isArray(res.data) ? res.data : res.data?.data || res.data || [];
      const nested = normalizeFlatToNested(raw);
      setItems(nested || []);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching default items:", err);
      setItems([]);
    }
  }, [baseUrl, normalizeFlatToNested]);

  const fetchSearch = useCallback(async () => {
    try {
      const signal = cancelInFlight();
      const url = `${baseUrl}/items/pos/search-modal`;
      const params = { page: 1, limit: 200, includeEmpty: 1 };
      if (nameChip) params.q = nameChip.trim();
      if (dimsChip) params.dims = normalizeDigits(dimsChip.trim());
      const res = await axios.get(url, { params, signal });
      setItems(res.data || []);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching search:", err);
      setItems([]);
    }
  }, [baseUrl, nameChip, dimsChip, normalizeDigits]);

  // ---------- effects ----------
  useEffect(() => {
    if (!isOpen) return;
    setSelectedItems(new Set());
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    onSelectionCountChange?.(0);
    fetchDefault();
    return () => {
      if (abortRef.current && typeof abortRef.current.abort === "function") {
        try {
          abortRef.current.abort();
        } catch {}
      }
    };
  }, [isOpen, fetchDefault, onSelectionCountChange]);

  useEffect(() => {
    if (!isOpen) return;
    if (nameChip || dimsChip) fetchSearch();
    else fetchDefault();
  }, [isOpen, nameChip, dimsChip, fetchDefault, fetchSearch]);

  // ---------- UI handlers ----------
  const handleEnter = (e) => {
    if (e.key !== "Enter") return;
    const raw = inputValue.trim();
    if (!raw) return;
    const text = normalizeDigits(raw);

    if (looksLikeDims(text)) setDimsChip(text);
    else setNameChip(text);

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

  // ---------- rows ----------
  const rows = useMemo(() => {
    return (items || []).flatMap((item) =>
      (item.thicknesses || []).flatMap((thickness) =>
        (thickness.variants || []).flatMap((variant) => {
          const variantIdNum = Number(variant.id);
          const hasRealVariantId = Number.isFinite(variantIdNum);

          if (!variant.batches || variant.batches.length === 0) {
            return [
              {
                uniqueId: `${variant.id}`,
                selectable: false,
                itemName: item.itemName,
                type: item.type,
                thickness: thickness.thickness,
                length: Math.floor(Number(variant.length)),
                width: Math.floor(Number(variant.width)),
                sheetsPerBox: Number(variant.sheetsPerBox),
                origin: variant.origin,
                condition: "",
                dateReceived: "",
                balanceOFR: "",
              },
            ];
          }

          return variant.batches.map((batch) => ({
            uniqueId: `${variant.id}-${batch.id}`,
            selectable: hasRealVariantId,
            itemName: item.itemName,
            type: item.type,
            thickness: thickness.thickness,
            length: Math.floor(Number(variant.length)),
            width: Math.floor(Number(variant.width)),
            sheetsPerBox: Number(variant.sheetsPerBox),
            origin: variant.origin,
            condition: batch.condition,
            dateReceived: batch.dateReceived,
            balanceOFR: batch.balanceOFR,
          }));
        })
      )
    );
  }, [items]);

  // ---------- expose to parent ----------
  useImperativeHandle(ref, () => ({
    collectSelected: () => {
      const selectedData = [];
      items.forEach((item) => {
        (item.thicknesses || []).forEach((thickness) => {
          (thickness.variants || []).forEach((variant) => {
            const variantIdNum = Number(variant.id);
            if (!Number.isFinite(variantIdNum)) return;

            (variant.batches || []).forEach((batch) => {
              const uniqueId = `${variant.id}-${batch.id}`;
              if (selectedItems.has(uniqueId)) {
                selectedData.push({
                  itemVariantId: variantIdNum,
                  itemName: item.itemName,
                  type: item.type,
                  thickness: thickness.thickness,
                  length: parseFloat(variant.length),
                  width: parseFloat(variant.width),
                  sheetsPerBox: variant.sheetsPerBox,
                  origin: variant.origin,
                  condition: batch.condition,
                  dateReceived: batch.dateReceived,
                  balanceOFR: batch.balanceOFR,
                  batchId: batch.id,
                });
              }
            });
          });
        });
      });
      return selectedData;
    },
  }));

  // ---------- render ----------
  return (
    <>
      {/* Input + chips row (pinned) */}
      <div className="search-modal-item-input-row">
        <input
          type="text"
          placeholder="مثال: 5.5ملم ابيض   ثم Enter — وبعدها 225*321-012 ثم Enter"
          className="search-modal-items-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleEnter}
          autoFocus
        />

        {/* Chips */}
        <div className="search-modal-chips">
          {nameChip && (
            <span className="search-chip" title={nameChip}>
              <span className="search-chip-label search-chip-label--name" dir="rtl">
                {nameChip}
              </span>
              <button
                className="search-chip-x"
                onClick={clearNameChip}
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
                onClick={clearDimsChip}
                aria-label="Remove dims filter"
              >
                ×
              </button>
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
            <th>BALANCE OFR</th>
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
                {`${parseFloat(r.thickness)} ملم ${r.itemName}`}
              </td>
              <td>{r.type}</td>
              <td>{r.length}</td>
              <td>{r.width}</td>
              <td>{r.sheetsPerBox}</td>
              <td>{r.origin}</td>
              <td>{r.condition}</td>
              <td>{r.dateReceived}</td>
              <td>{r.balanceOFR}</td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr className="empty-row">
              {/* match 10 headers */}
              <td className="empty-cell" colSpan={10}>
                No Data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
});

export default StockTab;
