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

  // -------- SQM Repeat Modal (NO alert/prompt) --------
  const [repeatModal, setRepeatModal] = useState({
    open: false,
    row: null,
    label: "",
    value: "1",
  });
  const repeatInputRef = useRef(null);

  useEffect(() => {
    if (repeatModal.open) {
      // focus input next tick
      setTimeout(() => repeatInputRef.current?.focus?.(), 0);
    }
  }, [repeatModal.open]);

  const closeRepeatModal = () => {
    setRepeatModal({ open: false, row: null, label: "", value: "1" });
  };

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
        console.error("Error fetching all-batches default page:", err);
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

  useEffect(() => {
    if (!modalOpen) return;

    setFlatRows([]);
    setNestedItems([]);
    setInputValue("");
    setNameChip("");
    setDimsChip("");
    setPage(1);
    setHasMore(false);

    return () => abortRef.current?.abort?.();
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen || !isActive) return;
    if (nameChip || dimsChip) fetchSearch();
    else fetchDefault();
  }, [modalOpen, isActive, nameChip, dimsChip, fetchDefault, fetchSearch]);

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

  const clearNameChip = () => setNameChip("");
  const clearDimsChip = () => setDimsChip("");

  const toggleSelect = (row) => {
    if (!row.selectable) return;

    setSelectedMap((prev) => {
      const next = new Map(prev);

      if (next.has(row.uniqueId)) {
        next.delete(row.uniqueId);
        return next;
      }

      const t = String(row.type || "").toLowerCase();
      if (t === "sqm") {
        // open modal instead of prompt
        const label = `${parseFloat(String(row.thickness))} ملم ${row.itemName}`;
        setRepeatModal({ open: true, row, label, value: "1" });
        return prev; // do not select yet, wait user confirm
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
                  onChange={(e) =>
                    setRepeatModal((p) => ({ ...p, value: e.target.value }))
                  }
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
                  {checked && String(r.type || "").toLowerCase() === "sqm" && (
                    <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.8 }}>x{rep}</span>
                  )}
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
