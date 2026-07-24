// src/inventory/InventoryBrowser.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import ReportModal from "./inventory-report-modal";
import "./inventory.css";
import { axiosClient } from "../api/axiosClient";

const LOW_STOCK_THRESHOLD = 5;

const normalizeDigits = (s) => {
  if (!s) return "";
  const map = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
};

const normalizeArabicAlef = (s) => String(s || "").replace(/أ|إ|آ/g, "ا");
const TYPE_OPTIONS = ["", "box", "sheet", "sqm", "unit"];

const ORIGIN_OPTIONS = ["", "China", "Italy", "Trakya","Sphinx", "SISECAM","Corpotrad", "Sahand", "GrandStar","S.G","Bisheng Techno","Qingdao","King Tai","Guardian","AGC","Cario"];

function useCancelableFetch() {
  const abortRef = useRef();
  const cancel = () => {
    try {
      abortRef.current?.abort();
    } catch {}
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };
  return { cancel };
}

const prettyDims = (L, W, SPB) => {
  const l = Math.floor(Number(L) || 0);
  const w = Math.floor(Number(W) || 0);
  const spb = Number(SPB) || 0;
  if (l && w)
    return spb ? `${l}×${w}-${String(spb).padStart(3, "0")}` : `${l}×${w}`;
  return "-";
};

const fmt2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

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

// ✅ FIXED deriveBalances:
// ones.balance = SUM(quantityofr) from backend → PRIMARY for Balance (Qty)
// ofrTotalsSqm.balanceOFR = SUM(sqmofr) from backend → PRIMARY for Balance (SQM)
const deriveBalances = (row, _mode) => {
  const typeLower = String(row?.type || "").toLowerCase();

  // ✅ quantityofr balance — backend sends this as ones.balance
  const qtyBal =
    Number.isFinite(Number(row?.ones?.balance))
      ? Number(row.ones.balance)
      : Number.isFinite(Number(row?.ofrTotalsUnits?.balance))
      ? Number(row.ofrTotalsUnits.balance)
      : undefined;

  // ✅ sqmofr balance — backend sends this as ofrTotalsSqm.balanceOFR
  const sqmBal =
    Number.isFinite(Number(row?.ofrTotalsSqm?.balanceOFR))
      ? Number(row.ofrTotalsSqm.balanceOFR)
      : undefined;

  let qty, sqm;

  if (Number.isFinite(qtyBal)) {
    // ✅ quantityofr is PRIMARY → show directly as Balance (Qty)
    qty = qtyBal;
    if (typeLower === "sqm") {
      // sqm-type: qty and sqm are the same unit
      sqm = Number.isFinite(sqmBal) ? sqmBal : qty;
    } else {
      // use sqmofr directly for Balance (SQM), fallback to computing from qty
      sqm = Number.isFinite(sqmBal)
        ? sqmBal
        : qtyToSqm({
            itemType: row.type,
            lengthCm: row.length,
            widthCm: row.width,
            sheetsPerBox: row.sheetsPerBox,
            valueQty: qty,
          });
    }
  } else if (Number.isFinite(sqmBal)) {
    // ✅ fallback only: no quantityofr, derive qty from sqmofr
    sqm = sqmBal;
    qty =
      typeLower === "sqm"
        ? sqmBal
        : sqmToQty({
            itemType: row.type,
            lengthCm: row.length,
            widthCm: row.width,
            sheetsPerBox: row.sheetsPerBox,
            valueSqm: sqmBal,
          });
  }

  return {
    qty: Number.isFinite(qty) ? Number(qty) : undefined,
    sqm: Number.isFinite(sqm) ? Number(sqm) : undefined,
  };
};

const parseChipsToParams = (chips) => {
  let q = normalizeDigits(chips.join(" ").trim());
  q = q.replace(/[xX×]/g, "*").replace(/\s+/g, " ");
  let thickness, length, width, sheetsPerBox, itemName;

  const thkRe = /(\d+(?:\.\d+)?)\s*م?\s*ل?\s*م/;
  const thkM = q.match(thkRe);
  if (thkM) {
    thickness = Number(thkM[1]);
    q = q.replace(thkM[0], " ");
  }

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
  const [origin, setOrigin] = useState("");
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

  // Home + remote warehouse (set in Warehouse Settings)
  const [companyWarehouse, setCompanyWarehouse] = useState(null);
  const [remoteWarehouse, setRemoteWarehouse] = useState("Tripoli");
  useEffect(() => {
    axiosClient.get("/warehouses").then((res) => {
      const list = res?.data || [];
      const home = list.find((w) => w.isHome);
      const remote = list.find((w) => !w.isHome);
      if (home?.name) setCompanyWarehouse(home.name.trim());
      if (remote?.name) setRemoteWarehouse(remote.name.trim());
    }).catch(() => {});
  }, []);

  // Toggles
  const [includeZeros, setIncludeZeros] = useState(false);
  const [showBoth, setShowBoth] = useState(true);
  const [showTripoli, setShowTripoli] = useState(false);
  const [asOf, setAsOf] = useState("");

  // description source
  const [descMode, setDescMode] = useState("real");
  const currentLedgerPath = useMemo(
    () =>
      descMode === "real"
        ? "/items/v1/real-variant-ledger"
        : "/items/v1/variant-ledger-by-name",
    [descMode]
  );

  // Report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRows, setReportRows] = useState([]);
  const [reportSpbRows, setReportSpbRows] = useState([]);
  const reportAbortRef = useRef();
  const newReportSignal = () => {
    try {
      reportAbortRef.current?.abort();
    } catch {}
    reportAbortRef.current = new AbortController();
    return reportAbortRef.current.signal;
  };

  const buildQ = () => {
    const chipsQ = normalizeDigits(chips.join(" ").trim());
    if (chipsQ) return chipsQ;
    const inputQ = normalizeDigits(qInput).trim().replace(/\s+/g, " ");
    return inputQ;
  };

  useEffect(() => {
    if (chips.length > 0) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchFromLedger();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput, type, origin, includeZeros, descMode, asOf]);

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

  const clearChips = () => {
    setChips([]);
    setPage(1);
  };

  const isCanceled = (e) =>
    e?.name === "CanceledError" || e?.code === "ERR_CANCELED";

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
      const parsed = parseChipsToParams(chips);
      const qFinal = buildQ();

      const params = {
        _: Date.now(),
        page,
        limit,
        includeZeros: String(includeZeros),
      };

      if (asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) params.asOf = asOf;

      if (parsed.itemName) params.itemName = parsed.itemName;
      if (parsed.thickness != null) params.thickness = String(parsed.thickness);
      if (parsed.length != null) params.length = String(parsed.length);
      if (parsed.width != null) params.width = String(parsed.width);
      if (parsed.sheetsPerBox != null)
        params.sheetsPerBox = String(parsed.sheetsPerBox);

      if (qFinal) params.q = qFinal;
      if (type) params.type = type;
      if (origin) params.origin = origin;

      const res = await axiosClient.get(currentLedgerPath, { params, signal });
      const json = res?.data;

      const data = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];

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
      setHasMore(Boolean(json?.hasMore));
    } catch (e) {
      if (!isCanceled(e)) console.error("Fetch ledger failed:", e);
    } finally {
      setBalancesLoading(false);
      setLoading(false);
    }
  };

  const fetchAllForReport = async () => {
    setReportLoading(true);
    try {
      const signal = newReportSignal();
      const parsed = parseChipsToParams(chips);
      const qFinal = buildQ();

      const baseParams = {};

      if (asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) baseParams.asOf = asOf;
      if (parsed.itemName) baseParams.itemName = parsed.itemName;
      if (parsed.thickness != null) baseParams.thickness = String(parsed.thickness);
      if (parsed.length != null) baseParams.length = String(parsed.length);
      if (parsed.width != null) baseParams.width = String(parsed.width);
      if (parsed.sheetsPerBox != null) baseParams.sheetsPerBox = String(parsed.sheetsPerBox);
      if (qFinal) baseParams.q = qFinal;
      if (type) baseParams.type = type;
      if (origin) baseParams.origin = origin;

      const BIG_LIMIT = 500;
      let aggAll = [];
      let pg = 1;

      while (true) {
        const params = {
          ...baseParams,
          page: pg,
          limit: BIG_LIMIT,
          _: Date.now(),
        };

        const res = await axiosClient.get(currentLedgerPath, { params, signal });
        const json = res?.data;

        const data = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

        aggAll = aggAll.concat(data);

        const hasMorePages = json?.hasMore === true;
        if (!hasMorePages) break;

        pg += 1;
      }

      const aggShown = includeZeros
        ? aggAll
        : aggAll.filter((r) => {
            const { qty, sqm } = deriveBalances(r, descMode);
            return (Number.isFinite(qty) && qty > 0) || (Number.isFinite(sqm) && sqm > 0);
          });

      setReportSpbRows(aggAll);
      setReportRows(aggShown);
      setReportOpen(true);
    } catch (e) {
      if (!isCanceled(e)) {
        console.error("Report fetch failed:", e);
        setReportRows([]);
        setReportSpbRows([]);
        setReportOpen(true);
      }
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchFromLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chips, type, origin, page, limit, includeZeros, currentLedgerPath, asOf]);

  // ✅ batch qty comes directly from balanceOFR which backend now sets = quantityofr
  const batchQtyUnits = (batch, header) => {
    if (batch?.balanceOFR !== undefined && batch?.balanceOFR !== null) {
      const n = Number(batch.balanceOFR);
      if (Number.isFinite(n)) return n;
    }
    // fallback: compute from sqmofr
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
    const sqm = Number(batch?.startOFR ?? 0) + Number(batch?.inOFR ?? 0) - Number(batch?.outOFR ?? 0);
    return sqmToQty({
      itemType: header?.type,
      lengthCm: header?.length,
      widthCm: header?.width,
      sheetsPerBox: header?.sheetsPerBox,
      valueSqm: sqm,
    });
  };

  const openBatchesFor = (variantRow) => {
    if (descMode !== "real") return;

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
        const ad = a.dateReceived || "";
        const bd = b.dateReceived || "";
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
    const headers = ["Item (Thk)", "Dimensions", "Type", "Sheets/Box", "Origin", "Balance (Qty)", "Balance (sqm)"];
    const lines = [headers.join(",")];

    rows.forEach((r) => {
      const itemWithThk = `${fmt2(r.thickness)}ملم ${r.itemName ?? ""}`.trim();
      const typeLower = String(r.type).toLowerCase();
      const spbForDims = typeLower === "sheet" || typeLower === "sqm" ? 0 : r.sheetsPerBox;
      const dims = prettyDims(r.length, r.width, spbForDims);
      const { qty, sqm } = deriveBalances(r, descMode);

      const row = [
        itemWithThk.replace(/"/g, '""'),
        dims,
        String(r.type || "").toUpperCase(),
        typeLower === "sheet" || typeLower === "sqm" ? "" : Number(r.sheetsPerBox) || "",
        r.origin || "",
        Number.isFinite(Number(qty)) ? Number(qty.toFixed(2)) : "",
        Number.isFinite(Number(sqm)) ? Number(sqm.toFixed(2)) : "",
      ];

      lines.push(
        row
          .map((cell) =>
            typeof cell === "string" && (cell.includes(",") || cell.includes('"') || cell.includes("\n"))
              ? `"${cell}"`
              : String(cell)
          )
          .join(",")
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
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
    if (e.key === "Enter") {
      e.preventDefault();
      addChipFromInput();
    }
  };

  const header = (
    <div className="invb-toolbar">
      <div className="invb-row invb-row--wrap invb-row--gap">
        <div className="invb-search-bar" dir="rtl">
          <div className="invb-chipsline">
            {chips.map((c, idx) => (
              <span key={`${c}-${idx}`} className="chip">
                {c}
                <button type="button" className="chip-x" aria-label="Remove" onClick={() => removeChip(idx)}>
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
            <button className="invb-btn" onClick={addChipFromInput}>
              Add
            </button>
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
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t || "any"} value={t}>
              {t ? t.toUpperCase() : "Any Type"}
            </option>
          ))}
        </select>

        <select
          className="invb-select"
          value={origin}
          onChange={(e) => {
            setOrigin(e.target.value);
            setPage(1);
          }}
        >
          {ORIGIN_OPTIONS.map((o) => (
            <option key={o || "any-origin"} value={o}>
              {o || "Any Origin"}
            </option>
          ))}
        </select>

        <div className="invb-date">
          <span className="u-muted">As of</span>
          <input
            type="date"
            value={asOf}
            onChange={(e) => {
              setAsOf(e.target.value);
              setPage(1);
            }}
          />
          <button
            className="invb-btn invb-btn--ghost"
            onClick={() => {
              setAsOf("");
              setPage(1);
            }}
            disabled={!asOf}
            title="Back to today"
          >
            Today
          </button>
        </div>

        <label className="invb-chk">
          <input
            type="checkbox"
            checked={includeZeros}
            onChange={(e) => {
              setIncludeZeros(e.target.checked);
              setPage(1);
            }}
          />
          Show zero/negative
        </label>

        <label className="invb-chk">
          <input type="checkbox" checked={showBoth} onChange={(e) => setShowBoth(e.target.checked)} />
          Show SQM column
        </label>

        <label className="invb-chk">
          <input type="checkbox" checked={showTripoli} onChange={(e) => setShowTripoli(e.target.checked)} />
          Inventory {remoteWarehouse}
        </label>

        <button className="invb-btn" onClick={exportCsv} style={{ marginInlineStart: "auto" }}>
          ⬇ Export CSV (page)
        </button>
        <button
          className="invb-btn"
          onClick={fetchAllForReport}
          disabled={reportLoading}
        >
          {reportLoading ? "⏳ Loading report…" : "📝 Report"}
        </button>
      </div>

      <div className="invb-row">
        <span className="invb-hint">
          {loading
            ? "Loading…"
            : `Page ${page} • ${hasMore ? `${page * limit}+ variants` : `${totalRows} variants`}${
                balancesLoading ? " • computing totals…" : ""
              }`}
        </span>

        <div className="invb-pager">
          <button className="invb-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>
            ◀ Prev
          </button>
          <button className="invb-btn" onClick={() => setPage((p) => p + 1)} disabled={loading || !hasMore}>
            Next ▶
          </button>
          <select
            className="invb-select"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const colCount = 7 + (showBoth ? 1 : 0) + (showTripoli ? 1 : 0);
  const isNameMode = descMode === "name";

  return (
    <div className="invb-container">
      <div className="invb-titlebar">
        <h2 className="invb-title">Inventory → Variants</h2>

        <div className="invb-mode-toggle">
          <span
            className={"invb-mode-label" + (descMode === "real" ? " active" : "")}
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
            className={"invb-mode-label" + (descMode === "name" ? " active" : "")}
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
              {showTripoli && <th className="ta-right" style={{ color: "#1a237e" }}>Qty {remoteWarehouse.slice(0,3)}</th>}
              {showBoth && <th className="ta-right">Balance (SQM)</th>}
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} style={{ textAlign: "center", opacity: 0.7 }}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} style={{ textAlign: "center", opacity: 0.7 }}>
                  No variants found.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const vid = Number(r.variantId ?? r.id);
                const { qty, sqm } = deriveBalances(r, descMode);
                const hasQty = qty !== undefined && qty !== null;
                const lowStock = hasQty && Number(qty) < LOW_STOCK_THRESHOLD;

                const typeLower = String(r.type || "").toLowerCase();
                const spbForDims = typeLower === "sheet" || typeLower === "sqm" ? 0 : r.sheetsPerBox;
                const spbCell = typeLower === "sheet" || typeLower === "sqm" ? "" : Number(r.sheetsPerBox) || "";

                const canViewBatches = descMode === "real" && Array.isArray(r?.batches);

                const tripoliQty = showTripoli
                  ? (r.batches || [])
                      .filter((b) => (b.warehouse ?? null) === remoteWarehouse)
                      .reduce((sum, b) => sum + batchQtyUnits(b, r), 0)
                  : null;

                const homeQty = showTripoli && companyWarehouse
                  ? (r.batches || [])
                      .filter((b) => (b.warehouse ?? null) === companyWarehouse)
                      .reduce((sum, b) => sum + batchQtyUnits(b, r), 0)
                  : null;

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
                      {balancesLoading && qty === undefined ? (
                        "…"
                      ) : qty === undefined ? (
                        "—"
                      ) : (
                        <span className={`qty-pill ${Number(qty) < LOW_STOCK_THRESHOLD ? "low" : ""}`}>
                          {fmt2(qty)} <span className="u-muted">{unitLabelFor(r.type)}</span>
                        </span>
                      )}
                    </td>
                    {showTripoli && (
                      <td className="ta-right" style={{ color: "#1a237e" }}>
                        {tripoliQty > 0 ? (
                          <span className="qty-pill">
                            {fmt2(tripoliQty)} <span className="u-muted">{unitLabelFor(r.type)}</span>
                          </span>
                        ) : (
                          <span className="u-muted">—</span>
                        )}
                      </td>
                    )}
                    {showBoth && (
                      <td className="ta-right u-muted">
                        {balancesLoading && sqm === undefined ? "…" : sqm === undefined ? "—" : fmt2(sqm)}
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
                  {drawerVariant?.itemName} — {fmt2(drawerVariant?.thickness)} ملم —{" "}
                  {prettyDims(
                    drawerVariant?.length,
                    drawerVariant?.width,
                    String(drawerVariant?.type).toLowerCase() === "sheet" ||
                      String(drawerVariant?.type).toLowerCase() === "sqm"
                      ? 0
                      : drawerVariant?.sheetsPerBox
                  )}{" "}
                  — {String(drawerVariant?.type || "").toUpperCase()}
                </div>
              </div>
              <button className="invb-btn" onClick={closeDrawer}>
                ✕
              </button>
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
        spbSourceRows={reportSpbRows}
        loading={reportLoading}
        mode={descMode}
        showTripoliColInitial={showTripoli}
        companyWarehouse={companyWarehouse}
        remoteWarehouse={remoteWarehouse}
      />
    </div>
  );
}