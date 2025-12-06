// src/components/StockTotalsAudit.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "./styles/stockTotalsAudit.css";

const baseUrl = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

/* =========================
   Robust parsing/formatting
   ========================= */
const DIGIT_MAP = {
  "٠": "0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  "۰": "0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
};
const normalizeDigits = (s) => String(s ?? "").replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d] ?? d);

const parseLooseNumber = (v) => {
  if (v === null || v === undefined) return NaN;
  let s = normalizeDigits(String(v)).trim();
  if (!s) return NaN;

  s = s
    .replace(/,/g, ".")
    .replace(/ملم/gi, " ")
    .replace(/\bmm\b/gi, " ")
    .replace(/[^0-9.\-]+/g, " ");

  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n) => Number(toNum(n).toFixed(2));
const fmt2 = (n) => r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const trimNum = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  const s = String(x);
  if (!s.includes(".")) return s;
  return s.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
};

const fmtMm = (t) => {
  const n = parseLooseNumber(t);
  if (!Number.isFinite(n) || n === 0) return "—ملم";
  return `${trimNum(n)}ملم`;
};

const fmtDim = (L, W) => {
  const l = parseLooseNumber(L);
  const w = parseLooseNumber(W);
  if (!Number.isFinite(l) || !Number.isFinite(w) || l === 0 || w === 0) return "";
  return `${trimNum(l)}×${trimNum(w)}`;
};

const cx = (...a) => a.filter(Boolean).join(" ");

const getWrongBase = (b) => Boolean(b?.computed?.wrongBalance ?? b?.wrongBalance);
const getWrongOfr  = (b) => Boolean(b?.computed?.wrongBalanceOFR ?? b?.wrongBalanceOFR);

/* =========================
   Normalization / de-dupe
   ========================= */
const getItemId = (it) => Number(it?.itemId ?? it?.id);
const getVariantId = (v) => Number(v?.variantId ?? v?.id ?? v?.itemVariantId);
const getBatchId = (b) => Number(b?.batchId ?? b?.id ?? b?.itemBatchId);

const pickVariants = (item) => {
  if (Array.isArray(item?.variants)) return item.variants;
  if (Array.isArray(item?.itemVariants)) return item.itemVariants;
  if (Array.isArray(item?.data?.variants)) return item.data.variants;
  return [];
};
const pickBatches = (v) => {
  if (Array.isArray(v?.batches)) return v.batches;
  if (Array.isArray(v?.itemBatches)) return v.itemBatches;
  if (Array.isArray(v?.batchesList)) return v.batchesList;
  return [];
};

// real-description sort index (support multiple possible shapes)
const getRdSortIndex = (row) => {
  const v = row?.v || {};
  return (
    Number(
      v?.realDescription?.sortIndex ??
      v?.realDescription?.sort_index ??
      v?.realDescriptionSortIndex ??
      v?.realDescription_sortIndex ??
      row?.realDescription?.sortIndex ??
      row?.realDescriptionSortIndex ??
      row?.realDescription_sortIndex ??
      0
    ) || 0
  );
};

// counts how many variants are inside server payload (useful to detect broken server pagination)
const countVariantsInPayload = (payload) => {
  const arr = Array.isArray(payload?.data) ? payload.data : [];
  if (!arr.length) return 0;

  // "direct variants list" shape
  const v0 = arr[0];
  const looksLikeVariantDirect =
    v0?.variantId !== undefined ||
    v0?.itemVariantId !== undefined ||
    v0?.stored !== undefined ||
    v0?.computed !== undefined ||
    v0?.v?.stored !== undefined;

  if (looksLikeVariantDirect) return arr.length;

  // "items -> variants" shape
  let total = 0;
  for (const item of arr) total += pickVariants(item).length;
  return total;
};

export default function StockTotalsAudit() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // pagination by default
  const [loadAll, setLoadAll] = useState(false);

  const [fix, setFix] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null); // "v:ID" or "b:ID"
  const [savingAll, setSavingAll] = useState(false);

  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [data, setData] = useState(null);

  const [expandedVariantId, setExpandedVariantId] = useState(null);

  const [variantEdits, setVariantEdits] = useState(() => new Map());
  const [batchEdits, setBatchEdits] = useState(() => new Map());

  // ✅ if backend returns "too many variants" for a page, we switch to client-side paging
  const [serverPaginationBroken, setServerPaginationBroken] = useState(false);

  const abortRef = useRef(null);

  const cancelInFlight = () => {
    const ctl = abortRef.current;
    if (ctl?.abort) {
      try { ctl.abort(); } catch {}
    }
    const next = new AbortController();
    abortRef.current = next;
    return next.signal;
  };

  const fetchOnce = async ({ page: p, limit: l, signal }) => {
    const params = {
      page: p,
      limit: l,
      includeVariants: 1,
      includeBatches: 1,
      ...(fix ? { fix: 1 } : {}),
    };
    const res = await axios.get(`${baseUrl}/items/v1/stock-totals/all-variants-batches`, {
      params,
      signal,
      headers: { "Cache-Control": "no-cache" },
    });
    return res.data;
  };

  const inferHasMore = (chunk, p, l) => {
    if (chunk?.hasMore !== undefined) return Boolean(chunk.hasMore);
    const tp = Number(chunk?.totalPages || 0);
    if (tp) return p < tp;
    const arr = Array.isArray(chunk?.data) ? chunk.data : [];
    return arr.length >= l;
  };

  const fetchData = async () => {
    setLoading(true);
    setErr("");
    setNote("");
    try {
      const signal = cancelInFlight();

      // Normal pagination mode: request ONE page
      if (!loadAll) {
        const one = await fetchOnce({ page, limit, signal });

        // ✅ detect broken server paging: if it returns more variants than limit
        const vCount = countVariantsInPayload(one);
        setServerPaginationBroken(vCount > limit);

        setData(one);
        return;
      }

      // Load-all mode
      let p = 1;
      let first = null;
      const all = [];
      let guard = 0;

      while (true) {
        guard += 1;
        if (guard > 5000) break;

        const chunk = await fetchOnce({ page: p, limit, signal });
        if (!first) first = chunk;

        const arr = Array.isArray(chunk?.data) ? chunk.data : [];
        all.push(...arr);

        const more = inferHasMore(chunk, p, limit);
        if (!more) break;
        p += 1;
      }

      // in loadAll, treat as not broken (buttons hidden anyway)
      setServerPaginationBroken(false);

      setData({
        ...(first || {}),
        page: 1,
        hasMore: false,
        totalPages: 1,
        data: all,
        loadedAll: true,
        loadedAllCount: all.length,
      });
    } catch (e) {
      if (e?.name === "CanceledError") return;
      if (axios.isCancel?.(e)) return;
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Failed to load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ fetch initial + when limit/fix/loadAll changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, fix, loadAll]);

  // ✅ fetch on page change ONLY if server pagination is OK
  useEffect(() => {
    if (loadAll) return;
    if (serverPaginationBroken) return; // client paging mode (no refetch)
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // reset UI when mode changes
  useEffect(() => {
    setExpandedVariantId(null);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAll, limit, fix]);

  /* =========================
     ✅ Normalize rows:
     supports BOTH old shape (items->variants)
     and new shape (variants list directly)
     ========================= */
  const normalizedVariants = useMemo(() => {
    const arr = Array.isArray(data?.data) ? data.data : [];

    const looksLikeVariantDirect =
      arr.length > 0 &&
      (arr[0]?.variantId !== undefined ||
        arr[0]?.itemVariantId !== undefined ||
        (arr[0]?.stored && arr[0]?.computed) ||
        (arr[0]?.v?.stored && arr[0]?.v?.computed));

    // ✅ New API: data IS already variants
    if (looksLikeVariantDirect) {
      const out = arr.map((raw) => {
        const variantId = getVariantId(raw);
        const itemId = getItemId(raw);
        const itemName = String(raw?.itemName ?? raw?.name ?? raw?.item?.itemName ?? "");
        const type = String(raw?.type ?? raw?.itemType ?? raw?.item?.type ?? "").toLowerCase();

        const batchesRaw =
          Array.isArray(raw?.batches) ? raw.batches :
          Array.isArray(raw?.v?.batches) ? raw.v.batches : [];
        const batches = batchesRaw.map((b) => ({ ...b, batchId: getBatchId(b) }));

        const stored = raw?.stored ?? raw?.v?.stored ?? {};
        const computed = raw?.computed ?? raw?.v?.computed ?? {};

        const v = {
          ...raw,
          ...raw?.v,
          variantId,
          thickness: raw?.thickness ?? raw?.v?.thickness,
          length: raw?.length ?? raw?.v?.length,
          width: raw?.width ?? raw?.v?.width,
          origin: raw?.origin ?? raw?.v?.origin,
          sheetsPerBox: raw?.sheetsPerBox ?? raw?.v?.sheetsPerBox,
          realDescription: raw?.realDescription ?? raw?.v?.realDescription,
          stored,
          computed,
        };

        const mismatchTotals =
          Math.abs(toNum(stored.totalBalance) - toNum(computed.totalBalance)) > 0.01 ||
          Math.abs(toNum(stored.totalBalanceOFR) - toNum(computed.totalBalanceOFR)) > 0.01;

        const batchMismatch = batches.some((b) => getWrongBase(b) || getWrongOfr(b));

        return {
          itemId,
          itemName,
          type,
          variantId,
          v,
          batches,
          hasIssues: Boolean(raw?.hasIssues ?? raw?.mismatch ?? (mismatchTotals || batchMismatch)),
        };
      });

      out.sort((a, b) => {
        const ard = getRdSortIndex(a);
        const brd = getRdSortIndex(b);
        if (ard !== brd) return ard - brd;

        const an = String(a.itemName || "").localeCompare(String(b.itemName || ""), "ar");
        if (an !== 0) return an;

        const at = parseLooseNumber(a?.v?.thickness);
        const bt = parseLooseNumber(b?.v?.thickness);
        if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;

        const ad = fmtDim(a?.v?.length, a?.v?.width);
        const bd = fmtDim(b?.v?.length, b?.v?.width);
        const dn = ad.localeCompare(bd);
        if (dn !== 0) return dn;

        return Number(a.variantId) - Number(b.variantId);
      });

      return out;
    }

    // ✅ Old API: data is items with nested variants/batches
    const byVariant = new Map();

    for (const item of arr) {
      const itemId = getItemId(item);
      const itemName = String(item?.itemName ?? item?.name ?? "");
      const itemType = String(item?.type ?? "").toLowerCase();

      const variants = pickVariants(item);

      for (const rawV of variants) {
        const variantId = getVariantId(rawV);
        if (!Number.isFinite(variantId) || variantId <= 0) continue;

        const batchMap = new Map();
        for (const b of pickBatches(rawV)) {
          const bid = getBatchId(b);
          if (!Number.isFinite(bid) || bid <= 0) continue;
          batchMap.set(bid, { ...b, batchId: bid });
        }

        const existing = byVariant.get(variantId);

        if (!existing) {
          byVariant.set(variantId, {
            itemId,
            itemName,
            type: itemType,
            variantId,
            v: { ...rawV, variantId },
            batches: Array.from(batchMap.values()),
          });
        } else {
          const exBatchMap = new Map((existing.batches || []).map((b) => [Number(b?.batchId), b]));
          for (const [bid, b] of batchMap.entries()) exBatchMap.set(bid, b);

          existing.itemId = existing.itemId || itemId;
          existing.itemName = existing.itemName || itemName;
          existing.type = existing.type || itemType;

          existing.v = { ...rawV, ...existing.v, variantId };
          existing.batches = Array.from(exBatchMap.values());
        }
      }
    }

    const out = [];
    for (const row of byVariant.values()) {
      const s = row?.v?.stored || {};
      const c = row?.v?.computed || {};
      const mismatchTotals =
        Math.abs(toNum(s.totalBalance) - toNum(c.totalBalance)) > 0.01 ||
        Math.abs(toNum(s.totalBalanceOFR) - toNum(c.totalBalanceOFR)) > 0.01;

      const batchMismatch = (row?.batches || []).some((b) => getWrongBase(b) || getWrongOfr(b));
      out.push({ ...row, hasIssues: mismatchTotals || batchMismatch });
    }

    out.sort((a, b) => {
      const ard = getRdSortIndex(a);
      const brd = getRdSortIndex(b);
      if (ard !== brd) return ard - brd;

      const an = String(a.itemName || "").localeCompare(String(b.itemName || ""), "ar");
      if (an !== 0) return an;

      const at = parseLooseNumber(a?.v?.thickness);
      const bt = parseLooseNumber(b?.v?.thickness);
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;

      const ad = fmtDim(a?.v?.length, a?.v?.width);
      const bd = fmtDim(b?.v?.length, b?.v?.width);
      const dn = ad.localeCompare(bd);
      if (dn !== 0) return dn;

      return Number(a.variantId) - Number(b.variantId);
    });

    return out;
  }, [data]);

  const filteredRows = useMemo(() => {
    const s = String(search || "").trim().toLowerCase();
    const tf = String(typeFilter || "all").toLowerCase();

    let out = normalizedVariants;

    if (tf !== "all") out = out.filter((r) => String(r?.type || "").toLowerCase() === tf);

    if (s) {
      out = out.filter((r) => {
        const name = String(r?.itemName || "").toLowerCase();
        const t = fmtMm(r?.v?.thickness).toLowerCase();
        const dim = fmtDim(r?.v?.length, r?.v?.width).toLowerCase();
        return name.includes(s) || t.includes(s) || dim.includes(s) || String(r?.variantId).includes(s);
      });
    }

    if (onlyIssues) out = out.filter((r) => Boolean(r?.hasIssues));

    return out;
  }, [normalizedVariants, search, typeFilter, onlyIssues]);

  /* =========================
     ✅ PAGINATION (final)
     - If server pagination is broken -> paginate client-side.
     - If server pagination OK -> render page as received.
     ========================= */
  const clientPaging = !loadAll && serverPaginationBroken;

  const clientTotalPages = useMemo(() => {
    if (!clientPaging) return 0;
    return Math.max(1, Math.ceil(filteredRows.length / limit));
  }, [clientPaging, filteredRows.length, limit]);

  useEffect(() => {
    if (!clientPaging) return;
    if (page > clientTotalPages) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientPaging, clientTotalPages]);

  const serverTotalPages = Number(data?.totalPages || 0);
  const serverHasMore = data?.hasMore !== undefined ? Boolean(data.hasMore) : (serverTotalPages ? page < serverTotalPages : false);

  const hasMore = clientPaging ? (page < clientTotalPages) : serverHasMore;

  const visibleRows = useMemo(() => {
    if (loadAll) return filteredRows;
    if (clientPaging) {
      const start = (page - 1) * limit;
      return filteredRows.slice(start, start + limit);
    }
    // server paging => show what server sent (already paged)
    return filteredRows;
  }, [filteredRows, loadAll, clientPaging, page, limit]);

  /* =========================
     ✅ Edits: always merge defaults + partial edits
     ========================= */
  const getVariantDefaults = (row) => {
    const s = row?.v?.stored || {};
    return {
      totalStart: String(r2(s.totalStart)),
      totalIn: String(r2(s.totalIn)),
      totalOut: String(r2(s.totalOut)),
      totalStartOFR: String(r2(s.totalStartOFR)),
      totalInOFR: String(r2(s.totalInOFR)),
      totalOutOFR: String(r2(s.totalOutOFR)),
    };
  };

  const getEditForVariant = (row) => {
    const id = Number(row?.variantId);
    const defaults = getVariantDefaults(row);
    const existing = variantEdits.get(id);
    return existing ? { ...defaults, ...existing } : defaults;
  };

  const setVariantField = (variantId, field, value) => {
    const id = Number(variantId);
    setVariantEdits((prev) => {
      const next = new Map(prev);
      const base = next.get(id) || {};
      next.set(id, { ...base, [field]: value });
      return next;
    });
  };

  const revertVariant = (variantId) => {
    const id = Number(variantId);
    setVariantEdits((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setNote(`Variant #${id}: reverted edits.`);
  };

  const applyExpectedVariant = (row) => {
    const id = Number(row?.variantId);
    const c = row?.v?.computed || {};
    setVariantEdits((prev) => {
      const next = new Map(prev);
      next.set(id, {
        totalStart: String(r2(c.totalStart)),
        totalIn: String(r2(c.totalIn)),
        totalOut: String(r2(c.totalOut)),
        totalStartOFR: String(r2(c.totalStartOFR)),
        totalInOFR: String(r2(c.totalInOFR)),
        totalOutOFR: String(r2(c.totalOutOFR)),
      });
      return next;
    });
    setNote(`Variant #${id}: filled from Expected (sum of batches).`);
  };

  const buildVariantPayload = (e) => ({
    totalStart: r2(e.totalStart),
    totalIn: r2(e.totalIn),
    totalOut: r2(e.totalOut),
    totalStartOFR: r2(e.totalStartOFR),
    totalInOFR: r2(e.totalInOFR),
    totalOutOFR: r2(e.totalOutOFR),
  });

  const saveVariant = async (variantId, editObj) => {
    const id = Number(variantId);
    await axios.put(`${baseUrl}/items/v1/stock-totals/variants/${id}/totals`, buildVariantPayload(editObj));
    setVariantEdits((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setNote(`Saved Variant #${id}.`);
  };

  const getBatchDefaults = (b) => ({
    start: String(r2(b?.start)),
    in: String(r2(b?.in)),
    out: String(r2(b?.out)),
    startOFR: String(r2(b?.startOFR)),
    inOFR: String(r2(b?.inOFR)),
    outOFR: String(r2(b?.outOFR)),
    condition: String(b?.condition ?? ""),
    dateReceived: String(b?.dateReceived ?? ""),
  });

  const getEditForBatch = (b) => {
    const id = Number(b?.batchId);
    const defaults = getBatchDefaults(b);
    const existing = batchEdits.get(id);
    return existing ? { ...defaults, ...existing } : defaults;
  };

  const setBatchField = (batchId, field, value) => {
    const id = Number(batchId);
    setBatchEdits((prev) => {
      const next = new Map(prev);
      const base = next.get(id) || {};
      next.set(id, { ...base, [field]: value });
      return next;
    });
  };

  const revertBatch = (batchId) => {
    const id = Number(batchId);
    setBatchEdits((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setNote(`Batch #${id}: reverted edits.`);
  };

  const buildBatchPayload = (e) => ({
    start: r2(e.start),
    in: r2(e.in),
    out: r2(e.out),
    startOFR: r2(e.startOFR),
    inOFR: r2(e.inOFR),
    outOFR: r2(e.outOFR),
    condition: String(e.condition ?? "").trim() || null,
    dateReceived: String(e.dateReceived ?? "").trim() || null,
  });

  const saveBatch = async (batchId, editObj) => {
    const id = Number(batchId);
    await axios.put(`${baseUrl}/items/v1/stock-totals/batches/${id}/totals`, buildBatchPayload(editObj));
    setBatchEdits((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setNote(`Saved Batch #${id}.`);
  };

  const dirtyCount = useMemo(() => variantEdits.size + batchEdits.size, [variantEdits, batchEdits]);

  const saveAll = async () => {
    if (dirtyCount === 0) return;
    setSavingAll(true);
    setErr("");
    setNote("");
    try {
      for (const [variantId, editObj] of variantEdits.entries()) {
        // eslint-disable-next-line no-await-in-loop
        await saveVariant(variantId, editObj);
      }
      for (const [batchId, editObj] of batchEdits.entries()) {
        // eslint-disable-next-line no-await-in-loop
        await saveBatch(batchId, editObj);
      }
      setNote("Saved all changes.");
      setSavingId(null);
      await fetchData();
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Save failed.");
    } finally {
      setSavingAll(false);
      setSavingId(null);
    }
  };

  const toggleExpand = (variantId) => {
    setExpandedVariantId((p) => (p === variantId ? null : variantId));
    setNote("");
  };

  const summary = useMemo(() => {
    let start = 0, inn = 0, outt = 0, bal = 0;
    let startO = 0, inO = 0, outO = 0, balO = 0;

    visibleRows.forEach((r) => {
      const s = r?.v?.stored || {};
      start += toNum(s.totalStart);
      inn += toNum(s.totalIn);
      outt += toNum(s.totalOut);
      bal += toNum(s.totalBalance);

      startO += toNum(s.totalStartOFR);
      inO += toNum(s.totalInOFR);
      outO += toNum(s.totalOutOFR);
      balO += toNum(s.totalBalanceOFR);
    });

    return { start, inn, outt, bal, startO, inO, outO, balO };
  }, [visibleRows]);

  const pageTotalLabel = loadAll
    ? "1"
    : clientPaging
      ? String(clientTotalPages)
      : (serverTotalPages ? String(serverTotalPages) : "?");

  return (
    <div className="sta-root">
      <div className="sta-header">
        <div className="sta-header-left">
          <div className="sta-title">Stock Totals Audit</div>
          <div className="sta-subtitle">
            <span className="sta-legend-dot stored" /> <b>Stored</b> = DB totals{" "}
            <span className="sta-legend-dot expected" /> <b>Expected</b> = sum of batches{" "}
            <span className="sta-legend-dot edit" /> <b>Edit</b> Variant + Batches (balance auto).
          </div>
        </div>

        <div className="sta-header-actions">
          <button className="sta-btn" onClick={fetchData} disabled={loading || savingAll}>
            {loading ? "Loading…" : "Refresh"}
          </button>

          <button
            className={cx("sta-btn primary", dirtyCount > 0 && "active")}
            onClick={saveAll}
            disabled={savingAll || dirtyCount === 0}
            title={dirtyCount ? "Save all edited variants & batches" : "No changes"}
          >
            {savingAll ? "Saving…" : `Save All (${dirtyCount})`}
          </button>

          <button
            className={cx("sta-btn danger", fix && "active")}
            onClick={() => setFix((p) => !p)}
            disabled={savingAll}
            title="Fix Mode: backend recompute + persist wrong totals"
          >
            {fix ? "Fix Mode: ON" : "Fix Mode: OFF"}
          </button>
        </div>
      </div>

      <div className="sta-card sta-controls">
        <div className="sta-control">
          <label>Search (name / thickness / dim / variantId)</label>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="مثال: 5.5ملم / 2140×3300 / أبيض..."
          />
        </div>

        <div className="sta-control">
          <label>Type</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setExpandedVariantId(null);
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="box">Box</option>
            <option value="sheet">Sheet</option>
            <option value="sqm">SQM</option>
            <option value="unit">Unit</option>
          </select>
        </div>

        <div className="sta-control">
          <label>Only issues</label>
          <button
            className={cx("sta-togglebtn", onlyIssues && "on")}
            onClick={() => { setOnlyIssues((p) => !p); setPage(1); }}
          >
            {onlyIssues ? "ON" : "OFF"}
          </button>
        </div>

        <div className="sta-control">
          <label>Load ALL</label>
          <button
            className={cx("sta-togglebtn", loadAll && "on")}
            onClick={() => setLoadAll((p) => !p)}
          >
            {loadAll ? "ON" : "OFF"}
          </button>
        </div>

        <div className="sta-control">
          <label>{loadAll ? "Chunk size" : "Rows per page"}</label>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* ✅ Pagination visible when NOT loadAll */}
      {!loadAll && (
        <div className="sta-card sta-pager">
          <div className="sta-pager-inline">
            <button className="sta-btn small" onClick={() => setPage(1)} disabled={loading || page <= 1}>⟪</button>
            <button className="sta-btn small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>←</button>

            <div className="sta-page-chip">
              Page <b>{page}</b> / <b>{pageTotalLabel}</b>
              {clientPaging && <span style={{ marginLeft: 8, opacity: 0.8 }}>(client paging)</span>}
            </div>

            <button className="sta-btn small" onClick={() => setPage((p) => p + 1)} disabled={loading || !hasMore}>→</button>
          </div>

          <div className="sta-pager-meta">
            {loading
              ? "Loading…"
              : clientPaging
                ? `Showing ${visibleRows.length} / ${filteredRows.length} filtered variants`
                : `Showing ${visibleRows.length} variants from server`}
          </div>
        </div>
      )}

      <div className="sta-grid">
        <div className="sta-card sta-kpi">
          <div className="sta-kpi-title">Variants (shown)</div>
          <div className="sta-kpi-value">{visibleRows.length.toLocaleString()}</div>
          <div className="sta-kpi-meta">
            {loadAll ? `Loaded all: ${filteredRows.length.toLocaleString()}` : `Filtered total: ${filteredRows.length.toLocaleString()}`}
          </div>
        </div>

        <div className="sta-card sta-kpi wide">
          <div className="sta-kpi-title">Totals (Stored • shown variants)</div>
          <div className="sta-kpi-split">
            <div className="sta-mini">
              <div className="sta-mini-h">BASE</div>
              <div className="sta-mini-row"><span>Start</span><b>{fmt2(summary.start)}</b></div>
              <div className="sta-mini-row"><span>In</span><b>{fmt2(summary.inn)}</b></div>
              <div className="sta-mini-row"><span>Out</span><b>{fmt2(summary.outt)}</b></div>
              <div className="sta-mini-row"><span>Balance</span><b>{fmt2(summary.bal)}</b></div>
            </div>
            <div className="sta-mini">
              <div className="sta-mini-h">OFR</div>
              <div className="sta-mini-row"><span>Start</span><b>{fmt2(summary.startO)}</b></div>
              <div className="sta-mini-row"><span>In</span><b>{fmt2(summary.inO)}</b></div>
              <div className="sta-mini-row"><span>Out</span><b>{fmt2(summary.outO)}</b></div>
              <div className="sta-mini-row"><span>Balance</span><b>{fmt2(summary.balO)}</b></div>
            </div>
          </div>
        </div>
      </div>

      {note && <div className="sta-alert info">{note}</div>}
      {err && <div className="sta-alert error"><b>Error:</b> {err}</div>}

      <div className="sta-card sta-list">
        {visibleRows.length === 0 ? (
          <div className="sta-empty">{loading ? "Loading…" : "No variants matched your filters."}</div>
        ) : (
          visibleRows.map((row) => {
            const variantId = Number(row.variantId);
            const v = row?.v || {};
            const s = v?.stored || {};
            const c = v?.computed || {};

            const dim = fmtDim(v?.length, v?.width);
            const title = `${fmtMm(v?.thickness)} ${row.itemName}${dim ? ` ${dim}` : ""}`.trim();

            const expanded = expandedVariantId === variantId;

            const batches = Array.isArray(row?.batches) ? row.batches : [];
            const batchHasIssues = batches.some((b) => getWrongBase(b) || getWrongOfr(b));
            const dirtyVariant = variantEdits.has(variantId);

            const vMismatch =
              Math.abs(toNum(s.totalBalance) - toNum(c.totalBalance)) > 0.01 ||
              Math.abs(toNum(s.totalBalanceOFR) - toNum(c.totalBalanceOFR)) > 0.01;

            return (
              <div key={variantId} className={cx("sta-itemrow", expanded && "expanded")}>
                <div className="sta-itemrow-top">
                  <button className="sta-expand" onClick={() => toggleExpand(variantId)}>
                    {expanded ? "−" : "+"}
                  </button>

                  <div className="sta-itemrow-main">
                    <div className="sta-itemrow-title">
                      <span className="sta-item-title-main">{title}</span>

                      <span className={cx("sta-pillstate", row?.hasIssues ? "warn" : "ok")}>
                        {row?.hasIssues ? "CHECK" : "OK"}
                      </span>

                      {dirtyVariant && <span className="sta-badge-small edit">Edited</span>}
                      {vMismatch && <span className="sta-badge-small warn">Totals mismatch</span>}
                      {batchHasIssues && <span className="sta-badge-small warn">Batch mismatch</span>}
                    </div>

                    <div className="sta-itemrow-sub">
                      Item #{row.itemId} • Variant #{variantId} • Type <b>{String(row.type || "").toUpperCase()}</b>
                      {" "}• Origin <b>{v?.origin ?? "-"}</b>
                      {" "}• SPB <b>{String(row.type || "").toLowerCase() === "box" ? (v?.sheetsPerBox ?? 0) : "-"}</b>
                      {dim ? <> • Dimension <b>{dim}</b></> : null}
                    </div>
                  </div>

                  <div className="sta-itemrow-totals">
                    <div className="sta-tot">
                      <span>Stored BASE Bal</span>
                      <b>{fmt2(s.totalBalance)}</b>
                    </div>
                    <div className="sta-tot">
                      <span>Stored OFR Bal</span>
                      <b>{fmt2(s.totalBalanceOFR)}</b>
                    </div>
                  </div>
                </div>

                {/* ✅ HEAVY BODY renders ONLY when expanded */}
                {expanded && (() => {
                  const ve = getEditForVariant(row);
                  const vbal  = toNum(ve.totalStart) + toNum(ve.totalIn) - toNum(ve.totalOut);
                  const vbalO = toNum(ve.totalStartOFR) + toNum(ve.totalInOFR) - toNum(ve.totalOutOFR);

                  return (
                    <div className="sta-expand-body">
                      <div className="sta-expand-head">
                        <div className="sta-expand-label">Totals (variant) + Edit</div>
                        <div className="sta-expand-hint">Balance auto: <b>Start + In − Out</b></div>
                      </div>

                      <div className="sta-vcard">
                        <div className="sta-vcard-cols">
                          {/* Stored */}
                          <div className="sta-vbox">
                            <div className="sta-vbox-title"><span className="sta-legend-dot stored" /> Stored (DB)</div>
                            <div className="sta-vrow"><span>BASE Bal</span><b>{fmt2(s.totalBalance)}</b></div>
                            <div className="sta-vrow"><span>OFR Bal</span><b>{fmt2(s.totalBalanceOFR)}</b></div>
                            <div className="sta-vrow small"><span>BASE S/I/O</span><b>{fmt2(s.totalStart)} / {fmt2(s.totalIn)} / {fmt2(s.totalOut)}</b></div>
                            <div className="sta-vrow small"><span>OFR S/I/O</span><b>{fmt2(s.totalStartOFR)} / {fmt2(s.totalInOFR)} / {fmt2(s.totalOutOFR)}</b></div>
                          </div>

                          {/* Expected */}
                          <div className="sta-vbox">
                            <div className="sta-vbox-title"><span className="sta-legend-dot expected" /> Expected (sum of batches)</div>
                            <div className="sta-vrow"><span>BASE Bal</span><b>{fmt2(c.totalBalance)}</b></div>
                            <div className="sta-vrow"><span>OFR Bal</span><b>{fmt2(c.totalBalanceOFR)}</b></div>
                            <div className="sta-vrow small"><span>BASE S/I/O</span><b>{fmt2(c.totalStart)} / {fmt2(c.totalIn)} / {fmt2(c.totalOut)}</b></div>
                            <div className="sta-vrow small"><span>OFR S/I/O</span><b>{fmt2(c.totalStartOFR)} / {fmt2(c.totalInOFR)} / {fmt2(c.totalOutOFR)}</b></div>
                          </div>

                          {/* Edit */}
                          <div className="sta-vbox edit">
                            <div className="sta-vbox-title"><span className="sta-legend-dot edit" /> Edit Variant Totals</div>

                            <div className="sta-editgrid">
                              <div className="sta-editcol">
                                <div className="sta-edithead">BASE</div>
                                <label>Start</label>
                                <input
                                  type="number" step="0.01" className="sta-inp"
                                  value={ve.totalStart}
                                  onChange={(ev) => setVariantField(variantId, "totalStart", ev.target.value)}
                                />
                                <label>In</label>
                                <input
                                  type="number" step="0.01" className="sta-inp"
                                  value={ve.totalIn}
                                  onChange={(ev) => setVariantField(variantId, "totalIn", ev.target.value)}
                                />
                                <label>Out</label>
                                <input
                                  type="number" step="0.01" className="sta-inp"
                                  value={ve.totalOut}
                                  onChange={(ev) => setVariantField(variantId, "totalOut", ev.target.value)}
                                />
                                <div className="sta-balance">
                                  <span>Auto Balance</span>
                                  <b>{fmt2(vbal)}</b>
                                </div>
                              </div>

                              <div className="sta-editcol">
                                <div className="sta-edithead">OFR</div>
                                <label>Start</label>
                                <input
                                  type="number" step="0.01" className="sta-inp"
                                  value={ve.totalStartOFR}
                                  onChange={(ev) => setVariantField(variantId, "totalStartOFR", ev.target.value)}
                                />
                                <label>In</label>
                                <input
                                  type="number" step="0.01" className="sta-inp"
                                  value={ve.totalInOFR}
                                  onChange={(ev) => setVariantField(variantId, "totalInOFR", ev.target.value)}
                                />
                                <label>Out</label>
                                <input
                                  type="number" step="0.01" className="sta-inp"
                                  value={ve.totalOutOFR}
                                  onChange={(ev) => setVariantField(variantId, "totalOutOFR", ev.target.value)}
                                />
                                <div className="sta-balance">
                                  <span>Auto Balance</span>
                                  <b>{fmt2(vbalO)}</b>
                                </div>
                              </div>
                            </div>

                            <div className="sta-vactions">
                              <button className="sta-btn small ghost" onClick={() => applyExpectedVariant(row)}>
                                Use Expected
                              </button>

                              <button className="sta-btn small" onClick={() => revertVariant(variantId)} disabled={!dirtyVariant}>
                                Revert
                              </button>

                              <button
                                className={cx("sta-btn small primary", dirtyVariant && "active")}
                                onClick={async () => {
                                  setSavingId(`v:${variantId}`);
                                  setErr("");
                                  try {
                                    await saveVariant(variantId, getEditForVariant(row));
                                    await fetchData();
                                  } catch (e) {
                                    console.error(e);
                                    setErr(e?.response?.data?.message || e?.message || "Save failed.");
                                  } finally {
                                    setSavingId(null);
                                  }
                                }}
                                disabled={savingId === `v:${variantId}` || savingAll}
                              >
                                {savingId === `v:${variantId}` ? "Saving…" : "Save Variant"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="sta-batches-block">
                        <div className="sta-batches-head">
                          <div className="sta-batches-title">Batches (editable)</div>
                          <div className="sta-batches-hint">Batch balance auto: Start + In − Out</div>
                        </div>

                        <div className="sta-batches-wrap">
                          <table className="sta-batches-table">
                            <thead>
                              <tr>
                                <th>Batch</th>
                                <th>Cond</th>
                                <th>Date</th>

                                <th className="num">Start</th>
                                <th className="num">In</th>
                                <th className="num">Out</th>
                                <th className="num">Auto Bal</th>
                                <th className="num">Stored Bal</th>

                                <th className="num">Start OFR</th>
                                <th className="num">In OFR</th>
                                <th className="num">Out OFR</th>
                                <th className="num">Auto Bal OFR</th>
                                <th className="num">Stored Bal OFR</th>

                                <th className="sta-actions-col">Actions</th>
                              </tr>
                            </thead>

                            <tbody>
                              {batches.length === 0 ? (
                                <tr>
                                  <td colSpan={14} className="sta-batches-empty">No batches.</td>
                                </tr>
                              ) : (
                                batches.map((b) => {
                                  const batchId = Number(b.batchId);
                                  const be = getEditForBatch(b);

                                  const bal  = toNum(be.start) + toNum(be.in) - toNum(be.out);
                                  const balO = toNum(be.startOFR) + toNum(be.inOFR) - toNum(be.outOFR);

                                  const storedBal  = r2(b?.balance);
                                  const storedBalO = r2(b?.balanceOFR);

                                  const wrongBase = Math.abs(storedBal - r2(bal)) > 0.01 || getWrongBase(b);
                                  const wrongOFR  = Math.abs(storedBalO - r2(balO)) > 0.01 || getWrongOfr(b);
                                  const dirty = batchEdits.has(batchId);

                                  return (
                                    <tr key={batchId} className={cx((wrongBase || wrongOFR) && "sta-batch-warn")}>
                                      <td><b>#{batchId}</b></td>

                                      <td>
                                        <input
                                          className="sta-inp sta-inp-sm"
                                          value={be.condition}
                                          onChange={(ev) => setBatchField(batchId, "condition", ev.target.value)}
                                          placeholder="cond"
                                        />
                                      </td>

                                      <td>
                                        <input
                                          className="sta-inp sta-inp-sm"
                                          value={be.dateReceived}
                                          onChange={(ev) => setBatchField(batchId, "dateReceived", ev.target.value)}
                                          placeholder="MM/YYYY"
                                        />
                                      </td>

                                      <td className="num">
                                        <input
                                          type="number" step="0.01"
                                          className="sta-inp sta-inp-sm num"
                                          value={be.start}
                                          onChange={(ev) => setBatchField(batchId, "start", ev.target.value)}
                                        />
                                      </td>
                                      <td className="num">
                                        <input
                                          type="number" step="0.01"
                                          className="sta-inp sta-inp-sm num"
                                          value={be.in}
                                          onChange={(ev) => setBatchField(batchId, "in", ev.target.value)}
                                        />
                                      </td>
                                      <td className="num">
                                        <input
                                          type="number" step="0.01"
                                          className="sta-inp sta-inp-sm num"
                                          value={be.out}
                                          onChange={(ev) => setBatchField(batchId, "out", ev.target.value)}
                                        />
                                      </td>

                                      <td className={cx("num", wrongBase && "sta-wrong")}><b>{fmt2(bal)}</b></td>
                                      <td className="num">{fmt2(storedBal)}</td>

                                      <td className="num">
                                        <input
                                          type="number" step="0.01"
                                          className="sta-inp sta-inp-sm num"
                                          value={be.startOFR}
                                          onChange={(ev) => setBatchField(batchId, "startOFR", ev.target.value)}
                                        />
                                      </td>
                                      <td className="num">
                                        <input
                                          type="number" step="0.01"
                                          className="sta-inp sta-inp-sm num"
                                          value={be.inOFR}
                                          onChange={(ev) => setBatchField(batchId, "inOFR", ev.target.value)}
                                        />
                                      </td>
                                      <td className="num">
                                        <input
                                          type="number" step="0.01"
                                          className="sta-inp sta-inp-sm num"
                                          value={be.outOFR}
                                          onChange={(ev) => setBatchField(batchId, "outOFR", ev.target.value)}
                                        />
                                      </td>

                                      <td className={cx("num", wrongOFR && "sta-wrong")}><b>{fmt2(balO)}</b></td>
                                      <td className="num">{fmt2(storedBalO)}</td>

                                      <td className="sta-actions-col">
                                        <div className="sta-row-actions">
                                          <button className="sta-btn small" disabled={!dirty} onClick={() => revertBatch(batchId)}>
                                            Revert
                                          </button>

                                          <button
                                            className={cx("sta-btn small primary", dirty && "active")}
                                            onClick={async () => {
                                              setSavingId(`b:${batchId}`);
                                              setErr("");
                                              try {
                                                await saveBatch(batchId, getEditForBatch(b));
                                                await fetchData();
                                              } catch (e) {
                                                console.error(e);
                                                setErr(e?.response?.data?.message || e?.message || "Save failed.");
                                              } finally {
                                                setSavingId(null);
                                              }
                                            }}
                                            disabled={savingId === `b:${batchId}` || savingAll}
                                          >
                                            {savingId === `b:${batchId}` ? "Saving…" : "Save Batch"}
                                          </button>
                                        </div>

                                        {(wrongBase || wrongOFR) && <div className="sta-chip-warn">Mismatch</div>}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="sta-batches-foot">
                          Tip: If only “Stored Bal” is wrong, click “Save Batch” (server recomputes balance).
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
