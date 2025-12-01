// src/inventory/InventoryBrowser.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import ReportModal from "./inventory-report-modal";
import "./inventory.css";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, "");
const LOW_STOCK_THRESHOLD = 5;

const normalizeDigits = (s) => {
  if (!s) return "";
  const map = {
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4",
    "۵":"5","۶":"6","۷":"۷","۸":"8","۹":"9",
  };
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
};
const normalizeArabicAlef = (s) => String(s || "").replace(/أ|إ|آ/g, "ا");
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
  if (l && w) return spb ? `${l}×${w}-${String(spb).padStart(3,"0")}` : `${l}×${w}`;
  return "-";
};
const fmt2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// helpers for sqm ↔ qty conversions (box/sheet <-> sqm)
const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const perSheetSqmOf = (lengthCm, widthCm) => {
  const L = toNum(lengthCm), W = toNum(widthCm);
  return L > 0 && W > 0 ? (L * W) / 10000 : 0;
};
const sqmToQty = ({ itemType, lengthCm, widthCm, sheetsPerBox, valueSqm }) => {
  const SPB = Math.max(1, toNum(sheetsPerBox));
  const perSheetSqm = perSheetSqmOf(lengthCm, widthCm);
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
const qtyToSqm = ({ itemType, lengthCm, widthCm, sheetsPerBox, valueQty }) => {
  const SPB = Math.max(1, toNum(sheetsPerBox));
  const perSheetSqm = perSheetSqmOf(lengthCm, widthCm);
  const type = String(itemType || "").toLowerCase();
  if (type === "box") return toNum(valueQty) * perSheetSqm * SPB;
  if (type === "sheet") return toNum(valueQty) * perSheetSqm;
  return toNum(valueQty);
};

/** Mode-aware totals */
const deriveBalances = (row, mode) => {
  const typeLower = String(row?.type || "").toLowerCase();

  const nonOfr = row?.ofrTotalsUnits?.balance;
  const onesBal = row?.ones?.balance;
  const nonOfrBal = Number.isFinite(Number(nonOfr)) ? Number(nonOfr)
                   : Number.isFinite(Number(onesBal)) ? Number(onesBal)
                   : undefined;

  const ofrSqm = row?.ofrTotalsSqm?.balanceOFR;
  const ofrSqmBal = Number.isFinite(Number(ofrSqm)) ? Number(ofrSqm) : undefined;

  let qty, sqm;

  if (mode === "name") {
    if (Number.isFinite(nonOfrBal)) {
      qty = nonOfrBal;
      sqm = qtyToSqm({
        itemType: row.type,
        lengthCm: row.length,
        widthCm: row.width,
        sheetsPerBox: row.sheetsPerBox,
        valueQty: qty,
      });
      if (typeLower === "sqm") {
        qty = qty ?? ofrSqmBal;
        sqm = ofrSqmBal ?? qty;
      }
    } else if (Number.isFinite(ofrSqmBal)) {
      sqm = ofrSqmBal;
      qty = typeLower === "sqm"
        ? ofrSqmBal
        : sqmToQty({
            itemType: row.type,
            lengthCm: row.length,
            widthCm: row.width,
            sheetsPerBox: row.sheetsPerBox,
            valueSqm: ofrSqmBal,
          });
    }
  } else {
    if (Number.isFinite(ofrSqmBal)) {
      sqm = ofrSqmBal;
      qty = typeLower === "sqm"
        ? ofrSqmBal
        : sqmToQty({
            itemType: row.type,
            lengthCm: row.length,
            widthCm: row.width,
            sheetsPerBox: row.sheetsPerBox,
            valueSqm: ofrSqmBal,
          });
    } else if (Number.isFinite(nonOfrBal)) {
      qty = nonOfrBal;
      sqm = qtyToSqm({
        itemType: row.type,
        lengthCm: row.length,
        widthCm: row.width,
        sheetsPerBox: row.sheetsPerBox,
        valueQty: qty,
      });
      if (typeLower === "sqm") sqm = qty;
    }
  }

  return {
    qty: Number.isFinite(qty) ? Number(qty) : undefined,
    sqm: Number.isFinite(sqm) ? Number(sqm) : undefined,
  };
};

// chips -> params
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

  // description source (maps to your endpoints)
  const [descMode, setDescMode] = useState("real"); // 'real' | 'name'
  const currentLedgerPath = useMemo(
    () =>
      descMode === "real"
        ? "/items/v1/real-variant-ledger"
        : "/items/v1/variant-ledger-by-name",
    [descMode]
  );

  // Report state (keep raw rows for SPB index)
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRows, setReportRows] = useState([]);
  const [reportSpbRows, setReportSpbRows] = useState([]); // unfiltered source (for SPB)
  const reportAbortRef = useRef();
  const newReportSignal = () => {
    try { reportAbortRef.current?.abort(); } catch {}
    reportAbortRef.current = new AbortController();
    return reportAbortRef.current.signal;
  };

  const buildQ = () => {
    const chipsQ = normalizeDigits(chips.join(" ").trim());
    if (chipsQ) return chipsQ;
    const inputQ = normalizeDigits(qInput).trim().replace(/\s+/g, " ");
    return inputQ;
  };

  // Optional live re-fetch while typing when NO chips are pinned
  useEffect(() => {
    if (chips.length > 0) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchFromLedger();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput, type, includeZeros, descMode]);

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

  // ------- Fetch current page -------
  const fetchFromLedger = async () => {
    setLoading(true);
    setBalancesLoading(true);
    setRows([]);
    setQtyMap(new Map());
    setSqmMap(new Map());
    setHasMore(false);
    setTotalRows(0);

    try {
      const signal = cancel();

const url = new URL(`${baseUrl}${currentLedgerPath}`, window.location.origin);
      url.searchParams.set("_", String(Date.now()));
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

      const res = await fetch(url, { signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

      const filtered = includeZeros
        ? data
        : data.filter((r) => {
            const { qty, sqm } = deriveBalances(r, descMode);
            return (Number.isFinite(qty) && qty > 0) || (Number.isFinite(sqm) && sqm > 0);
          });

      setRows(filtered);

      const qMap = new Map();
      const sMap = new Map();
      for (const r of filtered) {
        const vid = Number(r.variantId ?? r.id);
        const { qty, sqm } = deriveBalances(r, descMode);
        if (Number.isFinite(qty)) qMap.set(vid, Number(qty.toFixed(2)));
        if (Number.isFinite(sqm)) sMap.set(vid, Number(sqm.toFixed(2)));
      }
      setQtyMap(qMap);
      setSqmMap(sMap);

      const reportedTotal = Number(json?.totalRows ?? json?.total);
      setTotalRows(
        Number.isFinite(reportedTotal) && reportedTotal >= 0
          ? reportedTotal
          : (page - 1) * limit + data.length
      );
      setHasMore(Boolean(json?.hasMore ?? (data.length === limit)));
    } catch (e) {
      if (e?.name !== "AbortError") console.error("Fetch ledger failed:", e);
    } finally {
      setBalancesLoading(false);
      setLoading(false);
    }
  };

  // ------- Fetch ALL for report (UNFILTERED source + filtered view) -------
  const fetchAllForReport = async () => {
    setReportLoading(true);
    try {
      const signal = newReportSignal();

const base = new URL(`${baseUrl}${currentLedgerPath}`, window.location.origin);
      base.searchParams.set("_", String(Date.now()));
      const parsed = parseChipsToParams(chips);
      if (parsed.itemName) base.searchParams.set("itemName", parsed.itemName);
      if (parsed.thickness != null) base.searchParams.set("thickness", String(parsed.thickness));
      if (parsed.length != null) base.searchParams.set("length", String(parsed.length));
      if (parsed.width != null) base.searchParams.set("width", String(parsed.width));
      if (parsed.sheetsPerBox != null) base.searchParams.set("sheetsPerBox", String(parsed.sheetsPerBox));
      const qFinal = buildQ();
      if (qFinal) base.searchParams.set("q", qFinal);
      if (type) base.searchParams.set("type", type);
      // NOTE: do NOT pass includeZeros here — we want the raw universe for SPB.

      const BIG_LIMIT = 500;
      let aggAll = [];
      let pg = 1;
      let hasMoreAll = true;

      while (hasMoreAll) {
        const url = new URL(base.toString());
        url.searchParams.set("page", String(pg));
        url.searchParams.set("limit", String(BIG_LIMIT));
        url.searchParams.set("_", String(Date.now()));

        const res = await fetch(url, { signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        aggAll = aggAll.concat(data);

        const inferredHasMore = json?.hasMore ?? (data.length === BIG_LIMIT);
        hasMoreAll = Boolean(inferredHasMore);
        pg += 1;
      }

      // Visible set (respect current includeZeros toggle)
      const aggShown = includeZeros
        ? aggAll
        : aggAll.filter((r) => {
            const { qty, sqm } = deriveBalances(r, descMode);
            return (Number.isFinite(qty) && qty > 0) || (Number.isFinite(sqm) && sqm > 0);
          });

      setReportSpbRows(aggAll);   // source for SPB index (includes 0-qty box)
      setReportRows(aggShown);    // what we actually display
      setReportOpen(true);
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error("Report fetch failed:", e);
        setReportRows([]);
        setReportSpbRows([]);
        setReportOpen(true);
      }
    } finally {
      setReportLoading(false);
    }
  };

  // Re-fetch on these changes
  useEffect(() => {
    fetchFromLedger(); // eslint-disable-line react-hooks/exhaustive-deps
  }, [chips, type, page, limit, includeZeros, currentLedgerPath]);

  // Drawer helpers
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
    if (descMode !== "real") return; // batches only in real mode

    setDrawerVariant(variantRow);
    setDrawerOpen(true);
    setBatchesLoading(true);
    setBatches([]);
    setDrawerVariantTotalQty(0);
    setDrawerVariantTotalSqm(0);

    const { qty: totQty, sqm: totSqm } = deriveBalances(variantRow, descMode);

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

    setDrawerVariantTotalQty(Number.isFinite(totQty) ? Number(totQty.toFixed(2)) : 0);
    setDrawerVariantTotalSqm(Number.isFinite(totSqm) ? Number(totSqm.toFixed(2)) : 0);
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
      const itemWithThk = `${fmt2(r.thickness)}ملم ${r.itemName ?? ""}`.trim();
      const typeLower = String(r.type).toLowerCase();
      const spbForDims = (typeLower === "sheet" || typeLower === "sqm") ? 0 : r.sheetsPerBox;
      const dims = prettyDims(r.length, r.width, spbForDims);
      const { qty, sqm } = deriveBalances(r, descMode);

      const row = [
        itemWithThk.replace(/"/g, '""'),
        dims,
        String(r.type || "").toUpperCase(),
        (typeLower === "sheet" || typeLower === "sqm") ? "" : (Number(r.sheetsPerBox) || ""),
        r.origin || "",
        Number.isFinite(Number(qty)) ? Number(qty.toFixed(2)) : "",
        Number.isFinite(Number(sqm)) ? Number(sqm.toFixed(2)) : "",
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

  // ---------- Header UI ----------
  const header = (
    <div className="invb-toolbar">
      <div className="invb-row invb-row--wrap invb-row--gap">
        <div className="invb-search-bar" dir="rtl">
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
          <input
            className="invb-input invb-input--narrow"
            placeholder="ابحث… (Enter → pin) مثال: 5.5ملم ابيض 225*321-023 — أو اكتب مباشرة بدون تثبيت"
            dir="rtl"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={onSearchInputKeyDown}
          />
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

        {/* (toggle moved to title bar) */}

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

  const colCount = 7 + (showBoth ? 1 : 0);

  const isNameMode = descMode === "name";

  return (
    <div className="invb-container">
      {/* Title row + mode toggle on the right */}
      <div className="invb-titlebar">
        <h2 className="invb-title">Inventory → Variants</h2>

        <div className="invb-mode-toggle">
          <span
            className={
              "invb-mode-label" + (descMode === "real" ? " active" : "")
            }
            onClick={() => {
              setDescMode("real");
              setPage(1);
            }}
          >
            Real description
          </span>
          <label className="invb-mode-toggle-switch">
            <input
              type="checkbox"
              checked={isNameMode}
              onChange={(e) => {
                setDescMode(e.target.checked ? "name" : "real");
                setPage(1);
              }}
            />
            <span className="invb-mode-toggle-slider" />
          </label>
          <span
            className={
              "invb-mode-label" + (descMode === "name" ? " active" : "")
            }
            onClick={() => {
              setDescMode("name");
              setPage(1);
            }}
          >
            Name description
          </span>
        </div>
      </div>

      {header}

      <div className="invb-tablewrap">
        <table className="invb-table invb-table--compact invb-table--striped">
          <thead>
            <tr>
              <th>Item</th>
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
                const { qty, sqm } = deriveBalances(r, descMode);
                const hasQty = qty !== undefined && qty !== null;
                const lowStock = hasQty && Number(qty) < LOW_STOCK_THRESHOLD;

                const typeLower = String(r.type || "").toLowerCase();
                const spbForDims = (typeLower === "sheet" || typeLower === "sqm") ? 0 : r.sheetsPerBox;
                const spbCell =
                  (typeLower === "sheet" || typeLower === "sqm")
                    ? ""
                    : (Number(r.sheetsPerBox) || "");

                const canViewBatches = descMode === "real" && Array.isArray(r?.batches);

                return (
                  <tr key={vid} className={lowStock ? "invb-row--low" : ""}>
                    <td style={{ direction: "rtl", textAlign: "right", maxWidth: 360 }} className="truncate">
                      {`${fmt2(r.thickness)}ملم ${r.itemName}`}
                    </td>
                    <td className="ta-center">{prettyDims(r.length, r.width, spbForDims)}</td>
                    <td className="ta-center">{String(r.type || "").toUpperCase()}</td>
                    <td className="ta-center">{spbCell}</td>
                    <td className="truncate">{r.origin || ""}</td>
                    <td className="ta-right">
                      {balancesLoading && qty === undefined ? "…" :
                        qty === undefined ? "—" : (
                          <span className={`qty-pill ${Number(qty) < LOW_STOCK_THRESHOLD ? "low" : ""}`}>
                            {fmt2(qty)} <span className="u-muted">{unitLabelFor(r.type)}</span>
                          </span>
                        )}
                    </td>
                    {showBoth && (
                      <td className="ta-right u-muted">
                        {balancesLoading && sqm === undefined ? "…" : (sqm === undefined ? "—" : fmt2(sqm))}
                      </td>
                    )}
                    <td>
                      <button
                        className={`invb-btn small ${canViewBatches ? "" : "invb-btn--ghost"}`}
                        onClick={() => canViewBatches && openBatchesFor(r)}
                        disabled={!canViewBatches}
                        title={canViewBatches ? "View batches" : "Batches are available only in Real Description mode"}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
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

      {/* Report */}
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        rows={reportRows}
        spbSourceRows={reportSpbRows}   // ✅ unfiltered rows feed the SPB index
        loading={reportLoading}
        mode={descMode}
      />
    </div>
  );
}
