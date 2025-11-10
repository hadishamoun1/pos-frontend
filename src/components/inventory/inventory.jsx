// src/inventory/InventoryBrowser.jsx
import React, { useEffect, useRef, useState } from "react";
import ReportModal from "./inventory-report-modal";
import "./inventory.css";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, "");
const LOW_STOCK_THRESHOLD = 5;

const normalizeDigits = (s) => {
  if (!s) return "";
  const map = {
    "٠": "0","١":"1","٢":"2","٣":"3","٤":"4",
    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4",
    "۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
  };
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
};
const normalizeArabicAlef = (s) => String(s || "").replace(/[أإآ]/g, "ا");
const TYPE_OPTIONS = ["", "box", "sheet", "sqm", "unit"];


function useCancelableFetch() {
  const abortRef = useRef();
  const cancel = () => {
    try { abortRef.current?.abort(); } catch {}
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };
  return { cancel };
}

const prettyDims = (L, W, SPB) => {
  const l = Math.floor(Number(L) || 0);
  const w = Math.floor(Number(W) || 0);
  const spb = Number(SPB) || 0;
  if (l && w) return spb ? `${l}×${w}-${String(spb).padStart(2,"0")}` : `${l}×${w}`;
  return "-";
};
const fmt2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// sqm -> quantity (fallback)
const sqmToQty = ({ itemType, lengthCm, widthCm, sheetsPerBox, valueSqm }) => {
  const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const L = toNum(lengthCm);
  const W = toNum(widthCm);
  const SPB = Math.max(1, toNum(sheetsPerBox));
  const perSheetSqm = L > 0 && W > 0 ? (L * W) / 10000 : 0;
  const type = String(itemType || "").toLowerCase();
  if (type === "box") {
    const perBoxSqm = perSheetSqm * SPB;
    return perBoxSqm > 0 ? toNum(valueSqm) / perBoxSqm : toNum(valueSqm);
  }
  if (type === "sheet") {
    return perSheetSqm > 0 ? toNum(valueSqm) / perSheetSqm : toNum(valueSqm);
  }
  return toNum(valueSqm);
};

// -------- Search chips → query params parser --------
const parseChipsToParams = (chips) => {
  let q = normalizeDigits(chips.join(" ").trim());
  q = q.replace(/[xX×]/g, "*").replace(/\s+/g, " ");
  let thickness, length, width, sheetsPerBox, itemName;

  const thkRe = /(\d+(?:\.\d+)?)\s*م?\s*ل?\s*م/;
  const thkM = q.match(thkRe);
  if (thkM) { thickness = Number(thkM[1]); q = q.replace(thkM[0], " "); }

  const dimRe = /(\d{2,4})\s*\*\s*(\d{2,4})(?:\s*-\s*(\d{1,3}))?/;
  const dimM = q.match(dimRe);
  if (dimM) {
    length = Number(dimM[1]);
    width = Number(dimM[2]);
    if (dimM[3] != null) sheetsPerBox = Number(dimM[3]);
    q = q.replace(dimM[0], " ");
  }

  const leftover = normalizeArabicAlef(q).trim().replace(/\s{2,}/g, " ");
  itemName = leftover || undefined;

  const params = {};
  if (Number.isFinite(thickness)) params.thickness = thickness;
  if (Number.isFinite(length)) params.length = length;
  if (Number.isFinite(width)) params.width = width;
  if (Number.isFinite(sheetsPerBox)) params.sheetsPerBox = sheetsPerBox;
  if (itemName) params.itemName = itemName;
  return params;
};

export default function InventoryBrowser() {
  const { cancel } = useCancelableFetch();

  // Filters / paging
  const [qInput, setQInput] = useState("");
  const [chips, setChips] = useState([]);
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  // Per-variant totals
  const [qtyMap, setQtyMap] = useState(new Map());
  const [sqmMap, setSqmMap] = useState(new Map());
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState(null);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batches, setBatches] = useState([]);
 
  const [drawerVariantTotalQty, setDrawerVariantTotalQty] = useState(0);
  const [drawerVariantTotalSqm, setDrawerVariantTotalSqm] = useState(0);

  // Toggles
  const [includeZeros, setIncludeZeros] = useState(false);
  const [showBoth, setShowBoth] = useState(true);

  // Report (full dataset)
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRows, setReportRows] = useState([]);
  const [reportQtyMap, setReportQtyMap] = useState(new Map());
  const [reportSqmMap, setReportSqmMap] = useState(new Map());
  const reportAbortRef = useRef();


  const newReportSignal = () => {
    try { reportAbortRef.current?.abort(); } catch {}
    reportAbortRef.current = new AbortController();
    return reportAbortRef.current.signal;
  };

  // Debounce (not critical for chips; kept for UX)
  useEffect(() => {
    const t = setTimeout(() => {}, 250);
    return () => clearTimeout(t);
  }, [qInput]);

  const buildQ = () => normalizeDigits(chips.join(" ").trim());

  const addChipFromInput = () => {
    const raw = normalizeDigits(qInput).trim().replace(/\s+/g, " ");
    if (!raw) return;
    setChips((prev) => (prev.includes(raw) ? prev : [...prev, raw]));
    setQInput("");
    setPage(1);
  };
  const removeChip = (idx) => {
    setChips((prev) => {
      const next = prev.slice();
      next.splice(idx, 1);
      return next;
    });
    setPage(1);
  };
  const clearChips = () => { setChips([]); setPage(1); };

  const fetchFromLedger = async () => {
    setLoading(true);
    setBalancesLoading(true);
    try {
      const signal = cancel();
      const url = new URL(`${baseUrl}/items/v1/variant-ledger`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));

      const parsed = parseChipsToParams(chips);
      if (parsed.itemName) url.searchParams.set("itemName", parsed.itemName);
      if (parsed.thickness != null) url.searchParams.set("thickness", String(parsed.thickness));
      if (parsed.length != null) url.searchParams.set("length", String(parsed.length));
      if (parsed.width != null) url.searchParams.set("width", String(parsed.width));
      if (parsed.sheetsPerBox != null) url.searchParams.set("sheetsPerBox", String(parsed.sheetsPerBox));

      const qFinal = buildQ();
      if (qFinal) url.searchParams.set("q", qFinal);
      if (type) url.searchParams.set("type", type);
      url.searchParams.set("includeZeros", String(includeZeros));

      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      const filtered = includeZeros
        ? data
        : data.filter((r) => {
            const qty = Number(r?.ofrTotalsUnits?.balance ?? NaN);
            const sqm = Number(r?.ofrTotalsSqm?.balanceOFR ?? NaN);
            return (qty > 0) || (sqm > 0);
          });

      setRows(filtered);

      const qMap = new Map();
      const sMap = new Map();
      for (const r of filtered) {
        const vid = Number(r.variantId ?? r.id);
        const sqmVal = Number(
          r?.ofrTotalsSqm?.balanceOFR != null ? r.ofrTotalsSqm.balanceOFR : r?.totalBalanceOFR ?? 0
        );

        let qty = Number(
          r?.ofrTotalsUnits?.balance != null ? r.ofrTotalsUnits.balance : NaN
        );
        if (!Number.isFinite(qty)) {
          qty = sqmToQty({
            itemType: r.type,
            lengthCm: r.length,
            widthCm: r.width,
            sheetsPerBox: r.sheetsPerBox,
            valueSqm: sqmVal,
          });
        }

        if (Number.isFinite(qty)) qMap.set(vid, Number(qty.toFixed(2)));
        if (Number.isFinite(sqmVal)) sMap.set(vid, Number(sqmVal.toFixed(2)));
      }
      setQtyMap(qMap);
      setSqmMap(sMap);

      const reportedTotal = Number(json?.totalRows ?? json?.total);
      if (Number.isFinite(reportedTotal) && reportedTotal >= 0) {
        setTotalRows(reportedTotal);
      } else {
        setTotalRows((page - 1) * limit + data.length);
      }
      setHasMore(Boolean(json?.hasMore ?? (data.length === limit)));
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error("Fetch ledger failed:", e);
        setRows([]);
        setQtyMap(new Map());
        setSqmMap(new Map());
        setHasMore(false);
      }
    } finally {
      setBalancesLoading(false);
      setLoading(false);
    }
  };

  const fetchAllForReport = async () => {
    setReportLoading(true);
    try {
      const signal = newReportSignal();

      // Build base URL with same filters as the table
      const base = new URL(`${baseUrl}/items/v1/variant-ledger`);
      const parsed = parseChipsToParams(chips);
      if (parsed.itemName) base.searchParams.set("itemName", parsed.itemName);
      if (parsed.thickness != null) base.searchParams.set("thickness", String(parsed.thickness));
      if (parsed.length != null) base.searchParams.set("length", String(parsed.length));
      if (parsed.width != null) base.searchParams.set("width", String(parsed.width));
      if (parsed.sheetsPerBox != null) base.searchParams.set("sheetsPerBox", String(parsed.sheetsPerBox));
      const qFinal = buildQ();
      if (qFinal) base.searchParams.set("q", qFinal);
      if (type) base.searchParams.set("type", type);
      base.searchParams.set("includeZeros", String(includeZeros));

      const BIG_LIMIT = 500; // bump to 1000 if your API allows
      let agg = [];
      let pg = 1;
      let hasMoreAll = true;

      while (hasMoreAll) {
        const url = new URL(base.toString());
        url.searchParams.set("page", String(pg));
        url.searchParams.set("limit", String(BIG_LIMIT));

        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        const filtered = includeZeros
          ? data
          : data.filter((r) => {
              const qty = Number(r?.ofrTotalsUnits?.balance ?? NaN);
              const sqm = Number(r?.ofrTotalsSqm?.balanceOFR ?? NaN);
              return (qty > 0) || (sqm > 0);
            });

        agg = agg.concat(filtered); // preserve API order

        const inferredHasMore = json?.hasMore ?? (data.length === BIG_LIMIT);
        hasMoreAll = Boolean(inferredHasMore);
        pg += 1;
      }

      // Build qty/sqm maps for ALL rows (same logic you use for the page)
      const qMap = new Map();
      const sMap = new Map();
      for (const r of agg) {
        const vid = Number(r.variantId ?? r.id);
        const sqmVal = Number(
          r?.ofrTotalsSqm?.balanceOFR != null ? r.ofrTotalsSqm.balanceOFR : r?.totalBalanceOFR ?? 0
        );
        let qty = Number(
          r?.ofrTotalsUnits?.balance != null ? r.ofrTotalsUnits.balance : NaN
        );
        if (!Number.isFinite(qty)) {
          qty = sqmToQty({
            itemType: r.type,
            lengthCm: r.length,
            widthCm: r.width,
            sheetsPerBox: r.sheetsPerBox,
            valueSqm: sqmVal,
          });
        }
        if (Number.isFinite(qty)) qMap.set(vid, Number(qty.toFixed(2)));
        if (Number.isFinite(sqmVal)) sMap.set(vid, Number(sqmVal.toFixed(2)));
      }

      setReportRows(agg);
      setReportQtyMap(qMap);
      setReportSqmMap(sMap);
      setReportOpen(true);
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error("Report fetch failed:", e);
        setReportRows([]);
        setReportQtyMap(new Map());
        setReportSqmMap(new Map());
        setReportOpen(true); // open with "No data" so user can retry
      }
    } finally {
      setReportLoading(false);
    }
 };

  

  useEffect(() => {
    fetchFromLedger(); // eslint-disable-line react-hooks/exhaustive-deps
  }, [chips, type, page, limit, includeZeros]);

  const batchQtyUnits = (batch, header) => {
    if (batch?.balanceOFR !== undefined && batch?.balanceOFR !== null) {
      const n = Number(batch.balanceOFR);
      if (Number.isFinite(n)) return n;
    }
    if (batch?.balanceOFRSqm !== undefined && batch?.balanceOFRSqm !== null) {
      const sqmN = Number(batch.balanceOFRSqm);
      if (Number.isFinite(sqmN)) {
        return sqmToQty({
          itemType: header?.type,
          lengthCm: header?.length,
          widthCm: header?.width,
          sheetsPerBox: header?.sheetsPerBox,
          valueSqm: sqmN,
        });
      }
    }
    const sqm =
      Number(batch?.startOFR ?? 0) +
      Number(batch?.inOFR ?? 0) - Number(batch?.outOFR ?? 0);
    return sqmToQty({
      itemType: header?.type,
      lengthCm: header?.length,
      widthCm: header?.width,
      sheetsPerBox: header?.sheetsPerBox,
      valueSqm: sqm,
    });
  };

  const openBatchesFor = (variantRow) => {
    setDrawerVariant(variantRow);
    setDrawerOpen(true);
    setBatchesLoading(true);
    setBatches([]);
    setDrawerVariantTotalQty(0);
    setDrawerVariantTotalSqm(0);

    const sqmVal =
      variantRow?.ofrTotalsSqm?.balanceOFR != null
        ? Number(variantRow.ofrTotalsSqm.balanceOFR)
        : Number(variantRow?.totalBalanceOFR ?? 0);

    let totalQty =
      variantRow?.ofrTotalsUnits?.balance != null
        ? Number(variantRow.ofrTotalsUnits.balance)
        : undefined;

    if (totalQty === undefined) {
      totalQty = sqmToQty({
        itemType: variantRow.type,
        lengthCm: variantRow.length,
        widthCm: variantRow.width,
        sheetsPerBox: variantRow.sheetsPerBox,
        valueSqm: sqmVal,
      });
    }

    const rawBatches = Array.isArray(variantRow?.batches) ? variantRow.batches : [];
    const enriched = rawBatches.map((b) => {
      const q = batchQtyUnits(b, variantRow);
      return { ...b, __qty: Number(q?.toFixed?.(2) ?? 0) };
    });

    const filtered = (includeZeros ? enriched : enriched.filter((b) => b.__qty > 0))
      .slice()
      .sort((a, b) => {
        const ad = a.dateReceived || ""; const bd = b.dateReceived || "";
        if (ad && bd) return String(bd).localeCompare(String(ad));
        if (ad && !bd) return -1;
        if (!ad && bd) return 1;
        return String(a.condition || "").localeCompare(String(b.condition || ""));
      });

    setDrawerVariantTotalQty(Number.isFinite(totalQty) ? Number(totalQty.toFixed(2)) : 0);
    setDrawerVariantTotalSqm(Number.isFinite(sqmVal) ? Number(sqmVal.toFixed(2)) : 0);
    setBatches(filtered);
    setBatchesLoading(false);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerVariant(null);
    setBatches([]);
    setDrawerVariantTotalQty(0);
    setDrawerVariantTotalSqm(0);
  };

  const exportCsv = () => {
    const headers = [
      "Item (Thk)","Dimensions","Type","Sheets/Box","Origin","Balance (Qty)","Balance (sqm)"
    ];
    const lines = [headers.join(",")];

    rows.forEach((r) => {
      // For CSV, combine the two fields too
      const itemWithThk = `${fmt2(r.thickness)}ملم ${r.itemName ?? ""}`.trim();
      const spbForDims = (String(r.type).toLowerCase() === "sheet" || String(r.type).toLowerCase() === "sqm") ? 0 : r.sheetsPerBox;
      const dims = prettyDims(r.length, r.width, spbForDims);

      const qty = qtyMap.get(Number(r.variantId ?? r.id));
      const sqm = sqmMap.get(Number(r.variantId ?? r.id));
      const row = [
        itemWithThk.replace(/"/g, '""'),
        dims,
        String(r.type || "").toUpperCase(),
        (String(r.type).toLowerCase() === "sheet" || String(r.type).toLowerCase() === "sqm") ? "" : (Number(r.sheetsPerBox) || ""),
        r.origin || "",
        Number.isFinite(Number(qty)) ? qty : "",
        Number.isFinite(Number(sqm)) ? sqm : "",
      ];
      lines.push(
        row.map((cell) =>
          typeof cell === "string" && (cell.includes(",") || cell.includes('"') || cell.includes("\n"))
            ? `"${cell}"`
            : String(cell)
        ).join(",")
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    a.download = `inventory_page_${page}_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const unitLabelFor = (t) => {
    const s = String(t || "").toLowerCase();
    if (s === "box") return "Boxes";
    if (s === "sheet") return "Sheets";
    if (s === "sqm") return "sqm";
    return "Units";
  };

  const onSearchInputKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addChipFromInput(); }
  };

  // ---------- HEADER (chips to the right of input) ----------
  const header = (
    <div className="invb-toolbar">
      <div className="invb-row invb-row--wrap invb-row--gap">
        <div className="invb-search-bar" dir="rtl">
          {/* Chips line (right side) */}
          <div className="invb-chipsline">
            {chips.map((c, idx) => (
              <span key={`${c}-${idx}`} className="chip">
                {c}
                <button
                  type="button"
                  className="chip-x"
                  aria-label="Remove"
                  onClick={() => removeChip(idx)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Search input (narrower) */}
          <input
            className="invb-input invb-input--narrow"
            placeholder="ابحث… (Enter → pin) مثال: 5.5ملم ابيض 225*321-023"
            dir="rtl"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={onSearchInputKeyDown}
          />

          {/* Actions */}
          <div className="invb-search-actions">
            <button className="invb-btn" onClick={addChipFromInput}>Add</button>
            {chips.length > 0 && (
              <button className="invb-btn invb-btn--ghost" onClick={clearChips}>
                Clear
              </button>
            )}
          </div>
        </div>

        <select
          className="invb-select"
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t || "any"} value={t}>
              {t ? t.toUpperCase() : "Any Type"}
            </option>
          ))}
        </select>

        <label className="invb-chk">
          <input
            type="checkbox"
            checked={includeZeros}
            onChange={(e) => { setIncludeZeros(e.target.checked); setPage(1); }}
          />
          Show zero/negative
        </label>

        <label className="invb-chk">
          <input
            type="checkbox"
            checked={showBoth}
            onChange={(e) => setShowBoth(e.target.checked)}
          />
          Show SQM column
        </label>

        <button className="invb-btn" onClick={exportCsv} style={{ marginInlineStart: "auto" }}>
          ⬇ Export CSV (page)
        </button>
           <button className="invb-btn" onClick={fetchAllForReport}>
          📝 Report
        </button>
      </div>

      <div className="invb-row">
        <span className="invb-hint">
          {loading
            ? "Loading…"
            : `Page ${page} • ${hasMore ? `${page * limit}+ variants` : `${totalRows} variants`}${balancesLoading ? " • computing totals…" : ""}`}
        </span>
        <div className="invb-pager">
          <button
            className="invb-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
          >
            ◀ Prev
          </button>
          <button
            className="invb-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || !hasMore}
          >
            Next ▶
          </button>
          <select
            className="invb-select"
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  // Number of columns now that we merged Item + Thk:
  const colCount = 7 + (showBoth ? 1 : 0);

  return (
    <div className="invb-container">
      <h2 className="invb-title">Inventory → Variants</h2>
      {header}

      <div className="invb-tablewrap">
        <table className="invb-table invb-table--compact invb-table--striped">
          <thead>
            <tr>
              <th>Item</th>
              {/* Removed Thk column; show combined in Item cell */}
              <th className="ta-center">Dimensions</th>
              <th className="ta-center">Type</th>
              <th className="ta-center">SPB</th>
              <th>Origin</th>
              <th className="ta-right">Balance (Qty)</th>
              {showBoth && <th className="ta-right">Balance (SQM)</th>}
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} style={{ textAlign: "center", opacity: 0.7 }}>Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} style={{ textAlign: "center", opacity: 0.7 }}>No variants found.</td>
              </tr>
            ) : (
              rows.map((r) => {
                const vid = Number(r.variantId ?? r.id);
                const qty = qtyMap.get(vid);
                const sqm = sqmMap.get(vid);
                const hasQty = qty !== undefined && qty !== null;
                const lowStock = hasQty && Number(qty) < LOW_STOCK_THRESHOLD;

                const typeLower = String(r.type || "").toLowerCase();
                const spbForDims = (typeLower === "sheet" || typeLower === "sqm") ? 0 : r.sheetsPerBox;
                const spbCell =
                  (typeLower === "sheet" || typeLower === "sqm")
                    ? "" : (typeLower === "sheet" ? 1 : Number(r.sheetsPerBox) || "");

                return (
                  <tr key={vid} className={lowStock ? "invb-row--low" : ""}>
                    {/* Item + Thickness together (RTL so it reads nicely) */}
                    <td style={{ direction: "rtl", textAlign: "right", maxWidth: 360 }} className="truncate">
                      {`${fmt2(r.thickness)}ملم ${r.itemName}`}
                    </td>

                    <td className="ta-center">
                      {prettyDims(r.length, r.width, spbForDims)}
                    </td>

                    <td className="ta-center">{String(r.type || "").toUpperCase()}</td>

                    <td className="ta-center">{spbCell}</td>

                    <td className="truncate">{r.origin || ""}</td>

                    <td className="ta-right">
                      {balancesLoading && qty === undefined ? "…" :
                        qty === undefined ? "—" : (
                          <span className={`qty-pill ${Number(qty) < LOW_STOCK_THRESHOLD ? "low" : ""}`}>
                            {fmt2(qty)}{" "}
                            <span className="u-muted">{unitLabelFor(r.type)}</span>
                          </span>
                        )}
                    </td>

                    {showBoth && (
                      <td className="ta-right u-muted">
                        {balancesLoading && sqm === undefined ? "…" : (sqm === undefined ? "—" : fmt2(sqm))}
                      </td>
                    )}

                    <td>
                      <button className="invb-btn small" onClick={() => openBatchesFor(r)}>View</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <div className="invb-drawer-overlay" onClick={closeDrawer}>
          <aside className="invb-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="invb-drawer-head">
              <div>
                <div className="invb-drawer-title">Batches</div>
                <div className="invb-drawer-sub">
                  {drawerVariant?.itemName} — {fmt2(drawerVariant?.thickness)} ملم — {prettyDims(drawerVariant?.length, drawerVariant?.width, (String(drawerVariant?.type).toLowerCase() === "sheet" || String(drawerVariant?.type).toLowerCase() === "sqm") ? 0 : drawerVariant?.sheetsPerBox)} — {String(drawerVariant?.type || "").toUpperCase()}
                </div>
              </div>
              <button className="invb-btn" onClick={closeDrawer}>✕</button>
            </div>

            <div className="invb-drawer-body">
              <div className="invb-totalsbar">
                <div>
                  <div className="label">Total Balance (Qty)</div>
                  <div className="value">{fmt2(drawerVariantTotalQty)}</div>
                </div>
                <div className="sep" />
                <div>
                  <div className="label">Total Balance (SQM)</div>
                  <div className="value">{fmt2(drawerVariantTotalSqm)}</div>
                </div>
              </div>

              {batchesLoading ? (
                <div className="invb-skel" />
              ) : batches.length === 0 ? (
                <div className="invb-empty">No batches for this variant.</div>
              ) : (
                <table className="invb-batch-table">
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>Condition</th>
                      <th>Date Received</th>
                      <th className="ta-right">Balance (Qty)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id ?? b.batchId}>
                        <td>{b.id ?? b.batchId}</td>
                        <td>{b.condition || ""}</td>
                        <td>{b.dateReceived || ""}</td>
                        <td className="ta-right">
                          <span className={`qty-pill ${Number(b.__qty) < LOW_STOCK_THRESHOLD ? "low" : ""}`}>
                            {fmt2(b.__qty)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </div>
      )}
<ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        rows={reportRows}
        qtyMap={reportQtyMap}
        sqmMap={reportSqmMap}
        defaultIncludeZeros={includeZeros}
        loading={reportLoading}
      />
    </div>
  );
}
