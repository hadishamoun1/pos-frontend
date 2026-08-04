import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { axiosClient } from '../api/axiosClient';
import '../pos-system/searchModal.css';
import '../pos-system/AllTab.css';
import './RVRBulkRandomizer.css';

/* ─── helpers ─────────────────────────────────────────────── */
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── distribution algorithm ─────────────────────────────── */
function distributeTargets(N, totalTarget, minAmt, maxAmt) {
  if (N === 0) return [];
  const minP = N * minAmt;
  const maxP = N * maxAmt;
  const eff  = Math.min(Math.max(totalTarget, minP), maxP);
  const targets = [];
  let rem = eff;
  for (let i = 0; i < N - 1; i++) {
    const left = N - i;
    const minForRest = minAmt * (left - 1);
    const maxForRest = maxAmt * (left - 1);
    const myMin = Math.max(minAmt, rem - maxForRest);
    const myMax = Math.min(maxAmt, rem - minForRest);
    const t = myMin + Math.random() * (myMax - myMin);
    targets.push(r2(t));
    rem -= targets[targets.length - 1];
  }
  targets.push(r2(Math.max(minAmt, Math.min(maxAmt, rem))));
  return targets;
}

function itemSortKey(item) {
  return `${item.itemName || ''}|||${String(item.thickness ?? '')}`;
}

// Returns sqm per single unit (1 box or 1 sheet), or null for unit/no-dims items.
function computeSqmPerUnit(item) {
  const typeLow = String(item.type || '').toLowerCase();
  const len = Number(item.length || 0);
  const wid = Number(item.width  || 0);
  const spb = Number(item.sheetsPerBox || 1);
  if (typeLow === 'box'   && len > 0 && wid > 0) return (len / 100) * (wid / 100) * spb;
  if (typeLow === 'sheet' && len > 0 && wid > 0) return (len / 100) * (wid / 100);
  return null; // unit type or missing dims → qty × price
}

function generateLines(itemPool, preVatTarget, maxQty) {
  if (!itemPool.length) return [];
  const shuffled = [...itemPool].sort(() => Math.random() - 0.5);

  // Value contributed by one unit of an item (1 box/sheet = sqm × price; unit = price)
  const baseValue = (item) => {
    const sqmPU = computeSqmPerUnit(item);
    return sqmPU !== null ? sqmPU * item.price : item.price;
  };

  // Estimate item count assuming items will carry ~55% of maxQty on average,
  // so invoices have fewer rows with varied (not uniform) quantities.
  const avgVal = shuffled.reduce((s, it) => s + baseValue(it), 0) / shuffled.length || 1;
  const avgQty  = Math.max(1, Math.ceil(maxQty * 0.55));
  const estimated = Math.max(1, Math.min(shuffled.length, Math.round(preVatTarget / (avgVal * avgQty))));
  // ±30% randomness so invoices look different from each other
  const lo = Math.max(1, Math.round(estimated * 0.7));
  const hi = Math.min(shuffled.length, Math.round(estimated * 1.3));
  const targetCount = lo + Math.floor(Math.random() * (Math.max(lo, hi) - lo + 1));

  const seen = new Set();
  const picked = [];
  for (const item of shuffled) {
    if (picked.length >= targetCount) break;
    if (seen.has(item.variantId)) continue;
    seen.add(item.variantId);
    picked.push(item);
  }

  // Assign each item a random qty in [1, maxQty] — not uniform, so rows have varied quantities
  const lines = picked.map(item => ({
    ...item,
    qty: maxQty > 1 ? (1 + Math.floor(Math.random() * maxQty)) : 1,
  }));

  const lineValue = (l) => {
    const sqmPU = computeSqmPerUnit(l);
    return l.qty * (sqmPU !== null ? sqmPU * l.price : l.price);
  };
  const total = () => lines.reduce((s, l) => s + lineValue(l), 0);

  // Scale all quantities proportionally to bring the random total close to target.
  // Scaling preserves the relative spread (some items still higher, some lower).
  const rawTotal = total();
  if (rawTotal > 0) {
    const scale = preVatTarget / rawTotal;
    lines.forEach(l => {
      l.qty = Math.max(1, Math.min(maxQty, Math.round(l.qty * scale)));
    });
  }

  // Fine-tune: pick the item whose unit value is closest to the remaining gap.
  // Stop when the best possible step would overshoot the gap by >2× (oscillation guard).
  for (let i = 0; i < 20; i++) {
    const diff = preVatTarget - total();
    if (Math.abs(diff) < 1) break;
    if (diff > 0) {
      const c = lines.filter(l => l.qty < maxQty)
        .sort((a, b) => Math.abs(baseValue(a) - diff) - Math.abs(baseValue(b) - diff));
      if (!c.length || baseValue(c[0]) > diff * 2) break;
      c[0].qty++;
    } else {
      const absDiff = Math.abs(diff);
      const c = lines.filter(l => l.qty > 1)
        .sort((a, b) => Math.abs(baseValue(a) - absDiff) - Math.abs(baseValue(b) - absDiff));
      if (!c.length || baseValue(c[0]) > absDiff * 2) break;
      c[0].qty--;
    }
  }

  const result = lines.map(l => {
    const sqmPU = computeSqmPerUnit(l);
    const sqm = sqmPU !== null ? r2(l.qty * sqmPU) : 0;
    const totalAmount = sqmPU !== null ? r2(sqm * l.price) : r2(l.qty * l.price);
    return { ...l, sqm, totalAmount };
  });

  result.sort((a, b) => itemSortKey(a).localeCompare(itemSortKey(b), 'ar'));
  return result;
}

function runDistribution(selectedInvoices, itemPool, params) {
  const { minAmount, maxAmount, targetGrandTotal, maxQty, vatPct } = params;
  const vatRate = vatPct / 100;
  const N = selectedInvoices.length;
  const grandTargets = distributeTargets(N, targetGrandTotal, minAmount, maxAmount);

  // Pass 1: generate each invoice independently
  const results = selectedInvoices.map((inv, i) => {
    const grandTarget = grandTargets[i];
    const preVatTarget = grandTarget / (1 + vatRate);
    const lines = generateLines(itemPool, preVatTarget, maxQty).map(l => ({ ...l }));
    const totalWithoutVAT = r2(lines.reduce((s, l) => s + l.totalAmount, 0));
    const totalVAT        = r2(totalWithoutVAT * vatRate);
    const grandTotal      = r2(totalWithoutVAT + totalVAT);
    return { invoice: inv, lines, totalWithoutVAT, totalVAT, grandTotal, grandTarget };
  });

  // Helpers for the correction pass
  const lineBaseVal = (l) => {
    const sqmPU = computeSqmPerUnit(l);
    return sqmPU !== null ? sqmPU * l.price : l.price;
  };
  const recomputeEntry = (entry) => {
    entry.lines.forEach(l => {
      const sqmPU = computeSqmPerUnit(l);
      l.sqm         = sqmPU !== null ? r2(l.qty * sqmPU) : 0;
      l.totalAmount = sqmPU !== null ? r2(l.sqm * l.price) : r2(l.qty * l.price);
    });
    entry.totalWithoutVAT = r2(entry.lines.reduce((s, l) => s + l.totalAmount, 0));
    entry.totalVAT        = r2(entry.totalWithoutVAT * vatRate);
    entry.grandTotal      = r2(entry.totalWithoutVAT + entry.totalVAT);
  };

  // Pass 2: correct grand-total drift caused by discrete qty steps
  for (let iter = 0; iter < 150; iter++) {
    const actualGrand = r2(results.reduce((s, r) => s + r.grandTotal, 0));
    const drift = targetGrandTotal - actualGrand;
    if (Math.abs(drift) < 1) break;

    let bestEntry = null, bestLine = null, bestDist = Infinity, bestDir = 0;

    for (const entry of results) {
      for (const l of entry.lines) {
        const step = r2(lineBaseVal(l) * (1 + vatRate)); // grand-total impact of ±1 qty
        if (drift > 0 && l.qty < maxQty) {
          if (step > Math.abs(drift) * 3) continue; // would overshoot by 3× — skip
          if (r2(entry.grandTotal + step) > maxAmount * 1.15) continue;
          const dist = Math.abs(step - drift);
          if (dist < bestDist) { bestDist = dist; bestEntry = entry; bestLine = l; bestDir = 1; }
        } else if (drift < 0 && l.qty > 1) {
          if (step > Math.abs(drift) * 3) continue;
          if (r2(entry.grandTotal - step) < minAmount * 0.85) continue;
          const dist = Math.abs(step - Math.abs(drift));
          if (dist < bestDist) { bestDist = dist; bestEntry = entry; bestLine = l; bestDir = -1; }
        }
      }
    }

    if (!bestLine) break; // no valid adjustment exists — accept current total
    bestLine.qty += bestDir;
    recomputeEntry(bestEntry);
  }

  return results;
}

/* ─── Alternative Customer Picker (searchable) ───────────── */
function AltCustomerPicker({ altCustomers, value, onChange }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const selected = useMemo(() => altCustomers.find(c => c.id === value) || null, [altCustomers, value]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return altCustomers.slice(0, 50);
    return altCustomers.filter(c =>
      (c.company || '').toLowerCase().includes(q) ||
      (c.businessPhone || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.areaDescription || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [altCustomers, query]);

  const pick = (id) => { onChange(id); setOpen(false); setQuery(''); };

  return (
    <div className="rvr-item-search-wrap" ref={wrapRef}>
      <input
        type="text"
        className="rvr-input"
        placeholder="— keep original —"
        value={open ? query : (selected?.company || '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
        dir="rtl"
      />
      {selected && !open && <span className="rvr-check">✓</span>}
      {open && (
        <div className="rvr-dropdown">
          <div className="rvr-dropdown-row" onClick={() => pick(null)}>
            <span className="rvr-dropdown-type">— keep original —</span>
          </div>
          {filtered.map(c => (
            <div key={c.id} className="rvr-dropdown-row" onClick={() => pick(c.id)}>
              <span className="rvr-dropdown-name" dir="rtl">{c.company}</span>
              <span className="rvr-dropdown-type">{c.businessPhone || ''}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rvr-dropdown-row"><span className="rvr-dropdown-type">No matches</span></div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Price Prompt Modal ─────────────────────────────────── */
function PricePrompt({ row, onConfirm, onCancel }) {
  const [price, setPrice] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0); }, []);

  const typeLower = String(row.type || '').toLowerCase();
  const label = typeLower === 'unit'
    ? String(row.itemName ?? '')
    : `${parseFloat(String(row.thickness))} ملم ${row.itemName ?? ''}`.trim();

  const submit = () => {
    const p = parseFloat(price);
    if (!Number.isFinite(p) || p <= 0) return;
    onConfirm(p);
  };

  return (
    <div className="repeat-modal-overlay" role="dialog" aria-modal="true"
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="repeat-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="repeat-modal-header">
          <div className="repeat-modal-title">Set Unit Price</div>
          <button className="repeat-modal-x" onClick={onCancel}>×</button>
        </div>
        <div className="repeat-modal-body">
          <div className="repeat-modal-label" dir="rtl">{label}</div>
          <div className="repeat-modal-field">
            <div className="repeat-modal-field-label">Unit Price ($)</div>
            <input
              ref={inputRef}
              className="repeat-modal-input"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
            />
          </div>
        </div>
        <div className="repeat-modal-footer">
          <button className="repeat-modal-btn ghost" onClick={onCancel}>Cancel</button>
          <button className="repeat-modal-btn primary" onClick={submit} disabled={!price || parseFloat(price) <= 0}>
            Add to Pool
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Stock Search Panel ─────────────────────────────────── */
function StockSearchPanel({ itemPool, onAdd, onRemove }) {
  const [flatRows, setFlatRows]           = useState([]);
  const [inputValue, setInputValue]       = useState('');
  const [nameChip, setNameChip]           = useState('');
  const [dimsChip, setDimsChip]           = useState('');
  const [originFilter, setOriginFilter]   = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(false);
  const [loading, setLoading]             = useState(false);
  const [promptRow, setPromptRow]         = useState(null);
  const limit = 100;
  const abortRef = useRef(null);
  const searchInputRef = useRef(null);

  const QUICK_BUBBLES = useMemo(() => [
    'ابيض','اسود','برونز','برش','مرايا','مغش','تريبلكس','كريستال',
    'عاكس','مشرط','ازرق','اخضر','غامق','فاتح','صليب','دلتا',
  ], []);
  const THICKNESS_BUBBLES = useMemo(() => ['3','4','5','5.5','6','8','10','12','15','19'], []);
  const DIM_BUBBLES = useMemo(() => [
    '160','161','165','170','180','183','190','200','202','205','210',
    '214','215','225','235','240','244','245','250','255','260','321','330','366',
  ], []);
  const [quickOrder, setQuickOrder] = useState([]);

  const cancelInFlight = () => {
    try { abortRef.current?.abort(); } catch {}
    const next = new AbortController();
    abortRef.current = next;
    return next.signal;
  };

  const normalizeDigits = useCallback((s = '') =>
    String(s).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/،/g, ','), []);

  const normalizeArabic = useCallback((s = '') =>
    String(s || '')
      .replace(/[ً-ٟ]/g, '').replace(/ـ/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/ئ/g, 'ي').replace(/ؤ/g, 'و').replace(/\s+/g, ' ').trim(), []);

  const looksLikeDims = useCallback((s) => {
    if (!s) return false;
    const t = normalizeDigits(s).trim();
    if (!t.includes('*')) return false;
    const [L, rest] = t.split('*');
    if (!L || !rest) return false;
    if (!/^\s*\d+(\.\d+)?\s*$/.test(L)) return false;
    const parts = rest.split('-');
    if (!/^\s*\d+(\.\d+)?\s*$/.test(parts[0] || '')) return false;
    if (parts[1] && !/^\s*\d+\s*$/.test(parts[1])) return false;
    return true;
  }, [normalizeDigits]);

  const isPlainNumber = useCallback((s) => {
    if (!s) return false;
    const t = normalizeDigits(String(s)).trim();
    return /^\d{1,5}(\.\d+)?$/.test(t);
  }, [normalizeDigits]);

  const normalizeEnvelope = useCallback((raw) => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const data = Array.isArray(raw.data) ? raw.data
        : Array.isArray(raw.items) ? raw.items
        : Array.isArray(raw.results) ? raw.results : [];
      let hm;
      if (typeof raw.hasMore === 'boolean') hm = raw.hasMore;
      else if (raw.page != null && raw.totalPages != null) hm = Number(raw.page) < Number(raw.totalPages);
      else hm = data.length >= limit;
      return { data, hasMore: hm };
    }
    if (Array.isArray(raw)) return { data: raw, hasMore: raw.length >= limit };
    return { data: [], hasMore: false };
  }, [limit]);

  const flattenVariants = useCallback((variants) => {
    const out = [];
    for (const v of (variants || [])) {
      const isService = String(v.stockMode || '').toLowerCase() === 'none';
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
          stockQty: isService ? '' : Number(b.balanceOFR ?? 0),
        });
      }
    }
    return out;
  }, []);

  const fetchPage = useCallback(async (targetPage) => {
    setLoading(true);
    try {
      const signal = cancelInFlight();
      const res = await axiosClient.get('/items/v1/real-variant-ledger', {
        params: { page: targetPage, limit, includeSqm: true },
        signal,
      });
      const { data: variants, hasMore: hm } = normalizeEnvelope(res.data);
      const flat = flattenVariants(variants);
      if (targetPage === 1) setFlatRows(flat);
      else setFlatRows(prev => [...prev, ...flat]);
      setPage(targetPage);
      setHasMore(Boolean(hm));
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      setHasMore(false);
    } finally { setLoading(false); }
  }, [normalizeEnvelope, flattenVariants]); // eslint-disable-line

  const fetchSearch = useCallback(async () => {
    setLoading(true);
    try {
      const signal = cancelInFlight();
      const params = { page: 1, limit: 200 };
      if (nameChip) params.q = normalizeArabic(nameChip);
      const raw = dimsChip ? normalizeDigits(dimsChip.trim()) : '';
      if (raw) {
        if (looksLikeDims(raw)) params.q = [params.q, raw].filter(Boolean).join(' ');
        else if (isPlainNumber(raw)) params.length = Number(raw);
      }
      const res = await axiosClient.get('/items/v1/real-variant-ledger', { params: { ...params, includeSqm: true }, signal });
      const { data: variants } = normalizeEnvelope(res.data);
      setFlatRows(flattenVariants(variants));
      setHasMore(false);
      setPage(1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      setFlatRows([]);
      setHasMore(false);
    } finally { setLoading(false); }
  }, [nameChip, dimsChip, normalizeArabic, normalizeDigits, looksLikeDims, isPlainNumber, normalizeEnvelope, flattenVariants]);

  useEffect(() => {
    if (nameChip || dimsChip) fetchSearch();
    else fetchPage(1);
    return () => { try { abortRef.current?.abort(); } catch {} };
  }, [nameChip, dimsChip]); // eslint-disable-line

  const orderToText = useCallback((ord) =>
    (ord || []).map(k => {
      if (k.startsWith('N:')) return k.slice(2);
      if (k.startsWith('T:')) return `${k.slice(2)}ملم`;
      if (k.startsWith('D:')) return k.slice(2);
      return '';
    }).filter(Boolean).join(' ').trim(), []);

  const handleEnter = (e) => {
    if (e.key !== 'Enter') return;
    const raw0 = inputValue.trim();
    if (!raw0) return;
    const raw = normalizeDigits(raw0).trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    setQuickOrder([]);
    const dimsToken = parts.find(p => p.includes('*') && looksLikeDims(p));
    if (dimsToken) {
      setDimsChip(dimsToken);
      const rest = parts.filter(p => p !== dimsToken).join(' ').trim();
      if (rest) setNameChip(normalizeArabic(rest));
      setInputValue('');
      return;
    }
    const numIdx = [];
    for (let i = 0; i < parts.length; i++) { if (isPlainNumber(parts[i])) numIdx.push(i); }
    if (numIdx.length >= 2) {
      const a = parts[numIdx[0]], b = parts[numIdx[1]];
      setDimsChip(`${a}*${b}`);
      const restParts = parts.slice();
      restParts.splice(numIdx[1], 1); restParts.splice(numIdx[0], 1);
      if (restParts.join(' ').trim()) setNameChip(normalizeArabic(restParts.join(' ').trim()));
      setInputValue('');
      return;
    }
    if (numIdx.length === 1) {
      const n = parts[numIdx[0]];
      setDimsChip(n);
      const restParts = parts.slice();
      restParts.splice(numIdx[0], 1);
      if (restParts.join(' ').trim()) setNameChip(normalizeArabic(restParts.join(' ').trim()));
      setInputValue('');
      return;
    }
    setNameChip(normalizeArabic(raw));
    setInputValue('');
  };

  const clearEverything = () => {
    setInputValue(''); setNameChip(''); setDimsChip('');
    setOriginFilter(''); setTypeFilter(''); setQuickOrder([]);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const activeThickness = useMemo(() => {
    const found = quickOrder.find(x => x.startsWith('T:'));
    return found ? found.slice(2) : null;
  }, [quickOrder]);

  const toggleNameBubble = (token) => {
    setQuickOrder(prev => {
      const key = `N:${token}`;
      const next = prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key];
      setInputValue(orderToText(next));
      setTimeout(() => searchInputRef.current?.focus(), 0);
      return next;
    });
  };

  const toggleThicknessBubble = (th) => {
    setQuickOrder(prev => {
      const key = `T:${th}`;
      const without = prev.filter(x => !x.startsWith('T:'));
      const next = prev.includes(key) ? without : [...without, key];
      setInputValue(orderToText(next));
      setTimeout(() => searchInputRef.current?.focus(), 0);
      return next;
    });
  };

  const toggleDimBubble = (num) => {
    setQuickOrder(prev => {
      const key = `D:${num}`;
      if (prev.includes(key)) {
        const next = prev.filter(x => x !== key);
        setInputValue(orderToText(next));
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return next;
      }
      const dims = prev.filter(x => x.startsWith('D:'));
      let next = prev;
      if (dims.length >= 2) next = next.filter(x => x !== dims[0]);
      next = [...next, key];
      setInputValue(orderToText(next));
      setTimeout(() => searchInputRef.current?.focus(), 0);
      return next;
    });
  };

  const rows = useMemo(() => {
    let filtered = flatRows.map(r => {
      const variantId = Number(r.variantId);
      const batchId = Number(r.batchId);
      return {
        uniqueId: `${variantId}-${batchId}`,
        variantId,
        batchId,
        selectable: Number.isFinite(variantId) && Number.isFinite(batchId),
        itemName: r.itemName,
        type: r.type,
        thickness: r.thickness,
        length: Math.floor(Number(r.length || 0)),
        width: Math.floor(Number(r.width || 0)),
        sheetsPerBox: Number(r.sheetsPerBox || 0),
        stockMode: r.stockMode ?? 'sqm',
        origin: r.origin || '',
        condition: r.condition ?? '',
        dateReceived: r.dateReceived ?? '',
        stockQty: r.stockQty ?? '',
      };
    });
    if (originFilter) filtered = filtered.filter(r => String(r.origin || '').toLowerCase() === originFilter.toLowerCase());
    if (typeFilter)   filtered = filtered.filter(r => String(r.type   || '').toLowerCase() === typeFilter.toLowerCase());
    return filtered;
  }, [flatRows, originFilter, typeFilter]);

  const poolKeySet = useMemo(() =>
    new Set(itemPool.map(x => `${x.variantId}-${x.batchId}`)), [itemPool]);

  const handleRowClick = (r) => {
    if (!r.selectable) return;
    const key = `${r.variantId}-${r.batchId}`;
    if (poolKeySet.has(key)) {
      const idx = itemPool.findIndex(x => x.variantId === r.variantId && x.batchId === r.batchId);
      if (idx >= 0) onRemove(idx);
    } else {
      setPromptRow(r);
    }
  };

  const confirmPrice = (price) => {
    if (!promptRow) return;
    onAdd({
      variantId:    promptRow.variantId,
      batchId:      promptRow.batchId,
      itemName:     promptRow.itemName,
      type:         promptRow.type,
      thickness:    promptRow.thickness,
      length:       promptRow.length,
      width:        promptRow.width,
      sheetsPerBox: promptRow.sheetsPerBox,
      stockMode:    promptRow.stockMode,
      price,
    });
    setPromptRow(null);
  };

  const inSearchMode = Boolean(nameChip || dimsChip);

  return (
    <div className="rvr-stock-panel">
      {promptRow && (
        <PricePrompt row={promptRow} onConfirm={confirmPrice} onCancel={() => setPromptRow(null)} />
      )}

      {/* Search input + chips */}
      <div className="search-modal-item-input-row rvr-search-row">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="بحث عن صنف… (اضغط Enter)"
            className="search-modal-items-input"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleEnter}
          />
          <button type="button" className="search-clear-btn" onClick={clearEverything}>مسح</button>
        </div>
        <div className="search-modal-chips">
          {nameChip && (
            <span className="search-chip">
              <span className="search-chip-label search-chip-label--name" dir="rtl">{nameChip}</span>
              <button className="search-chip-x" onClick={() => setNameChip('')}>×</button>
            </span>
          )}
          {dimsChip && (
            <span className="search-chip">
              <span className="search-chip-label search-chip-label--dims" dir="ltr"><bdi>{dimsChip}</bdi></span>
              <button className="search-chip-x" onClick={() => setDimsChip('')}>×</button>
            </span>
          )}
          <select value={originFilter} onChange={e => setOriginFilter(e.target.value)}
            className="rvr-filter-select" style={{ background: originFilter ? '#e8f4f8' : 'white' }}>
            <option value="">All Origins</option>
            <option>China</option><option>Italy</option><option>Trakya</option>
            <option>Sphinx</option><option>SISECAM</option><option>Corpotrad</option>
            <option>Sahand</option><option>GrandStar</option><option>S.G</option>
            <option>Bisheng Techno</option><option>Qingdao</option><option>King Tai</option>
            <option>Guardian</option><option>AGC</option><option>Cario</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="rvr-filter-select" style={{ background: typeFilter ? '#e8f4f8' : 'white' }}>
            <option value="">All Types</option>
            <option value="box">Box</option><option value="sheet">Sheet</option>
            <option value="sqm">SQM</option><option value="unit">Unit</option>
          </select>
          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
            In pool: <strong>{itemPool.length}</strong>
          </span>
        </div>
      </div>

      {/* Quick bubbles */}
      <div className="search-quick-bubbles-wrap rvr-bubbles-wrap">
        <div className="search-quick-bubbles-row">
          {QUICK_BUBBLES.map(token => (
            <button key={token} type="button"
              className={'quick-bubble' + (quickOrder.includes(`N:${token}`) ? ' active' : '')}
              onClick={() => toggleNameBubble(token)}>
              {token}
            </button>
          ))}
        </div>
        <div className="search-quick-bubbles-row thickness-row">
          {THICKNESS_BUBBLES.map(t => (
            <button key={t} type="button"
              className={'quick-bubble quick-bubble-thick' + (activeThickness === t ? ' active' : '')}
              onClick={() => toggleThicknessBubble(t)}>
              {t} ملم
            </button>
          ))}
        </div>
        <div className="search-quick-bubbles-row dims-row">
          {DIM_BUBBLES.map(n => (
            <button key={n} type="button"
              className={'quick-bubble quick-bubble-dim' + (quickOrder.includes(`D:${n}`) ? ' active' : '')}
              onClick={() => toggleDimBubble(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Results table */}
      <div className="rvr-table-scroll">
      <table className="search-modal-table">
        <thead>
          <tr>
            <th className="col-select">Pool</th>
            <th className="col-item">Item</th>
            <th className="col-type">Type</th>
            <th className="col-length">Dimensions</th>
            <th className="col-stock-box">Stock Box</th>
            <th className="col-stock-sheet">Stock Sheet</th>
            <th className="col-origin">Origin</th>
            <th className="col-condition">Condition</th>
            <th className="col-date">Date Rcvd</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const typeLower = String(r.type || '').toLowerCase();
            const isBox   = typeLower === 'box';
            const isSheet = typeLower === 'sheet';
            const inPool  = poolKeySet.has(`${r.variantId}-${r.batchId}`);
            const poolItem = inPool ? itemPool.find(x => x.variantId === r.variantId && x.batchId === r.batchId) : null;

            let dimensionsDisplay = '';
            if (r.length > 0 && r.width > 0) {
              if (isBox)        dimensionsDisplay = `${r.length}×${r.width}-${String(r.sheetsPerBox || 0).padStart(3, '0')}`;
              else if (isSheet) dimensionsDisplay = `${r.length}×${r.width}`;
              else              dimensionsDisplay = `${r.length}×${r.width}`;
            } else if (r.length > 0) {
              dimensionsDisplay = String(r.length);
            }

            return (
              <tr key={r.uniqueId}
                className={[!r.selectable ? 'row-disabled' : '', inPool ? 'rvr-row-in-pool' : ''].filter(Boolean).join(' ')}
                onClick={() => handleRowClick(r)}
                style={{ cursor: r.selectable ? 'pointer' : 'default' }}>
                <td className="cell-select">
                  <input type="checkbox" readOnly checked={inPool} disabled={!r.selectable}
                    onClick={e => e.stopPropagation()} onChange={() => handleRowClick(r)} />
                  {inPool && poolItem && (
                    <span className="rvr-pool-price-badge">${fmt(poolItem.price)}</span>
                  )}
                </td>
                <td style={{ direction: 'rtl', textAlign: 'right' }}>
                  {typeLower === 'unit'
                    ? String(r.itemName ?? '')
                    : `${parseFloat(String(r.thickness))} ملم ${r.itemName ?? ''}`.trim()}
                </td>
                <td>{r.type}</td>
                <td>{dimensionsDisplay}</td>
                <td>{isBox ? (r.stockQty ?? '') : ''}</td>
                <td>{isSheet ? (r.stockQty ?? '') : ''}</td>
                <td>{r.origin ?? ''}</td>
                <td>{r.condition ?? ''}</td>
                <td>{r.dateReceived ?? ''}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr className="empty-row">
              <td className="empty-cell" colSpan={9}>
                {loading ? 'Loading…' : 'No items found.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {!inSearchMode && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button className="rvr-btn rvr-btn-outline" disabled={loading || !hasMore} onClick={() => fetchPage(page + 1)}>
            {loading ? 'Loading…' : hasMore ? 'Load More' : 'No more items'}
          </button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Page {page} · {rows.length} rows</span>
        </div>
      )}
    </div>
  );
}

/* ─── main component ─────────────────────────────────────── */
export default function RVRBulkRandomizer() {
  const [fromDate,      setFromDate]      = useState(() => `${new Date().getFullYear()}-01-01`);
  const [toDate,        setToDate]        = useState(() => new Date().toISOString().slice(0, 10));
  const [minAmount,     setMinAmount]     = useState('');
  const [maxAmount,     setMaxAmount]     = useState('');
  const [targetTotal,   setTargetTotal]   = useState('');
  const [maxQty,        setMaxQty]        = useState('5');
  const [vatPct,        setVatPct]        = useState('11');

  const [invoices,      setInvoices]      = useState([]);
  const [selected,      setSelected]      = useState(new Set());
  const [searching,     setSearching]     = useState(false);
  const [searchErr,     setSearchErr]     = useState('');

  const [itemPool,      setItemPool]      = useState([]);
  const [poolSaving,    setPoolSaving]    = useState(false);
  const [poolSaveMsg,   setPoolSaveMsg]   = useState('');

  const [altCustomers,          setAltCustomers]          = useState([]);
  const [altCustomerOverrides,  setAltCustomerOverrides]  = useState(new Map());

  // Load saved pool from DB on mount
  useEffect(() => {
    axiosClient.get('/bulk-rvr-schedule/item-pool')
      .then(res => { if (Array.isArray(res.data)) setItemPool(res.data); })
      .catch(() => {});
  }, []);

  // Load alternative customers from DB on mount
  useEffect(() => {
    axiosClient.get('/alternative-customers')
      .then(res => { if (Array.isArray(res.data)) setAltCustomers(res.data); })
      .catch(() => {});
  }, []);

  const setAltCustomerFor = (invId, altCustomerId) => {
    setAltCustomerOverrides(prev => {
      const next = new Map(prev);
      if (altCustomerId) next.set(invId, Number(altCustomerId));
      else next.delete(invId);
      return next;
    });
  };

  const printRef = useRef(null);

  const handlePrint = () => {
    const target = parseFloat(targetTotal || 0);
    const actual = previewGrandTotal;
    const diff   = Math.abs(actual - target);
    const header = `
      <div style="margin-bottom:20px;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-family:Arial,sans-serif">
        <h2 style="margin:0 0 8px;font-size:1.1rem">RVR Randomizer — Preview</h2>
        <div style="display:flex;gap:32px;font-size:0.9rem">
          <span><b>Invoices:</b> ${preview?.length ?? 0}</span>
          <span><b>Grand Total:</b> $${fmt(actual)}</span>
          <span><b>Target:</b> $${fmt(target)}</span>
          <span><b>Difference:</b> $${fmt(diff)}</span>
        </div>
      </div>`;
    const body = printRef.current ? printRef.current.innerHTML : '';
    const win = window.open('', '_blank', 'width=1000,height=800');
    win.document.write(`<!DOCTYPE html><html><head><title>RVR Preview</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;padding:20px}
      table{width:100%;border-collapse:collapse;margin-bottom:0;font-size:12px}
      th{text-align:left;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;padding:6px 10px;border-bottom:2px solid #e2e8f0;background:#f8fafc}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f9}
      .num{text-align:right}
      .rvr-preview-card{border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px;page-break-inside:avoid}
      .rvr-preview-card-header{background:#f8fafc;padding:8px 14px;display:flex;gap:14px;align-items:center;font-size:12px;flex-wrap:wrap}
      .rvr-inv-num{font-weight:700;color:#4f46e5}
      .rvr-preview-customer{flex:1;font-weight:500}
      .rvr-preview-target{color:#6366f1;font-weight:600}
      .rvr-preview-actual{color:#16a34a;font-weight:700}
      .rvr-subtotal-row td,.rvr-vat-row td{color:#64748b;font-size:11px}
      .rvr-total-row td{font-weight:700;background:#f8fafc;border-top:2px solid #e2e8f0}
      .rvr-dims-cell{font-weight:600;color:#0369a1;white-space:nowrap}
      .rvr-grand-summary{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin-top:8px}
      .rvr-grand-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0}
      .rvr-grand-value{font-weight:600}
      .rvr-grand-diff{border-top:1px solid #e2e8f0;margin-top:4px;padding-top:8px;font-weight:700}
      @media print{@page{margin:15mm}body{padding:0}}
    </style></head><body>${header}${body}<script>window.onload=function(){window.print();window.close();}<\/script></body></html>`);
    win.document.close();
  };

  // Auto-save pool to DB whenever it changes (debounced 800 ms)
  const poolSaveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(poolSaveTimer.current);
    poolSaveTimer.current = setTimeout(() => {
      setPoolSaving(true);
      axiosClient.patch('/bulk-rvr-schedule/item-pool', { pool: itemPool })
        .then(() => { setPoolSaveMsg('Pool saved'); setTimeout(() => setPoolSaveMsg(''), 2000); })
        .catch(() => setPoolSaveMsg('Save failed'))
        .finally(() => setPoolSaving(false));
    }, 800);
    return () => clearTimeout(poolSaveTimer.current);
  }, [itemPool]);

  const [preview,       setPreview]       = useState(null);
  const [previewErr,    setPreviewErr]    = useState('');

  const [applying,      setApplying]      = useState(false);
  const [applyProgress, setApplyProgress] = useState(null);
  const [applyResult,   setApplyResult]   = useState(null);

  const handleSearch = useCallback(async () => {
    setSearchErr(''); setInvoices([]); setSelected(new Set());
    setPreview(null); setApplyResult(null); setSearching(true);
    try {
      const res = await axiosClient.get('/invoices/details', {
        params: { type: 'RVR', from: fromDate, to: toDate, limit: 500 },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setInvoices(data);
      setAltCustomerOverrides(new Map(
        data.filter(inv => inv.alternativeCustomer?.id).map(inv => [inv.id, inv.alternativeCustomer.id])
      ));
      if (!data.length) setSearchErr('No RVR invoices found in this date range.');
    } catch (e) {
      setSearchErr(e?.response?.data?.message || e.message || 'Search failed.');
    } finally { setSearching(false); }
  }, [fromDate, toDate]);

  const toggleInv = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => {
    if (selected.size === invoices.length) setSelected(new Set());
    else setSelected(new Set(invoices.map(i => i.id)));
  };

  const shuffleArray = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Assigns a shuffled alternative customer to every selected invoice, cycling through
  // the full list with no repeats until it's exhausted, then starting over from the top.
  const handleAutoAssignCustomerNames = () => {
    if (!altCustomers.length) return;
    const targets = invoices.filter(inv => selected.has(inv.id));
    if (!targets.length) return;

    const shuffled = shuffleArray(altCustomers);
    setAltCustomerOverrides(prev => {
      const next = new Map(prev);
      targets.forEach((inv, i) => {
        next.set(inv.id, shuffled[i % shuffled.length].id);
      });
      return next;
    });
  };

  const [applyingAltNames, setApplyingAltNames] = useState(false);
  const [altApplyProgress, setAltApplyProgress] = useState(null);
  const [altApplyResult,   setAltApplyResult]   = useState(null);

  // Assigns alternative customers to already-processed RVR invoices without touching items.
  const handleApplyCustomerNamesOnly = async () => {
    const targets = invoices.filter(inv => selected.has(inv.id) && altCustomerOverrides.has(inv.id));
    if (!targets.length) return;

    setAltApplyResult(null); setApplyingAltNames(true);
    const errors = [];
    let done = 0;
    for (const inv of targets) {
      setAltApplyProgress({ current: done + 1, total: targets.length, invoiceNumber: inv.invoiceNumber });
      try {
        await axiosClient.patch(`/invoices/${inv.id}/alternative-customer`, {
          alternativeCustomerId: altCustomerOverrides.get(inv.id),
        });
        done++;
      } catch (e) {
        errors.push(`${inv.invoiceNumber}: ${e?.response?.data?.message || e.message}`);
        done++;
      }
    }
    setApplyingAltNames(false);
    setAltApplyProgress(null);
    setAltApplyResult({ done, total: targets.length, errors });
  };

  const addItem    = (item) => {
    if (itemPool.some(x => x.variantId === item.variantId && x.batchId === item.batchId)) return;
    setItemPool(prev => [...prev, item]);
  };
  const removeItem = (idx) => setItemPool(prev => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const min = parseFloat(minAmount), max = parseFloat(maxAmount),
          tgt = parseFloat(targetTotal), mq = parseInt(maxQty, 10), vat = parseFloat(vatPct);
    if (!Number.isFinite(min) || min <= 0)  return 'Enter a valid min amount per invoice.';
    if (!Number.isFinite(max) || max <= 0)  return 'Enter a valid max amount per invoice.';
    if (min > max)                           return 'Min amount cannot exceed max amount.';
    if (!Number.isFinite(tgt) || tgt <= 0)  return 'Enter a valid grand total target.';
    if (!Number.isFinite(mq)  || mq < 1)    return 'Max qty must be at least 1.';
    if (!Number.isFinite(vat) || vat < 0)   return 'VAT % must be 0 or more.';
    if (selected.size === 0)                 return 'Select at least one invoice.';
    if (itemPool.length === 0)               return 'Add at least one item to the pool.';
    return null;
  };

  const handleGenerate = () => {
    setPreviewErr('');
    const err = validate();
    if (err) { setPreviewErr(err); return; }
    const selInvoices = invoices.filter(i => selected.has(i.id));
    const params = {
      minAmount: parseFloat(minAmount), maxAmount: parseFloat(maxAmount),
      targetGrandTotal: parseFloat(targetTotal), maxQty: parseInt(maxQty, 10),
      vatPct: parseFloat(vatPct),
    };
    try {
      const results = runDistribution(selInvoices, itemPool, params).map(entry => {
        const altId = altCustomerOverrides.get(entry.invoice.id) || null;
        const alt = altId ? altCustomers.find(c => c.id === altId) : null;
        return { ...entry, alternativeCustomerId: altId, alternativeCustomerName: alt?.company || null };
      });
      setPreview(results);
      setApplyResult(null);
    } catch (e) {
      setPreviewErr('Distribution failed: ' + e.message);
    }
  };

  const handleApply = async () => {
    if (!preview?.length) return;
    setApplyResult(null); setApplying(true);
    const vat = parseFloat(vatPct);
    const errors = [];
    let done = 0;
    for (const entry of preview) {
      const inv = entry.invoice;
      setApplyProgress({ current: done + 1, total: preview.length, invoiceNumber: inv.invoiceNumber });
      const items = entry.lines.map(l => ({
        itemVariantId: l.variantId,
        itemBatchId:   l.batchId,
        itemType:      l.type,
        stockMode:     l.stockMode || null,
        quantity:      l.qty,
        sqm:           l.sqm ?? 0,
        unitPrice:     l.price,
        totalAmount:   l.totalAmount,
        vat:           r2(l.totalAmount * vat / 100),
        length: l.length || null, width: l.width || null, sheetsPerBox: l.sheetsPerBox || null,
      }));
      const payload = {
        customerId:            inv.customer?.id,
        alternativeCustomerId: entry.alternativeCustomerId ?? null,
        date:            inv.date,
        invoiceType:     'RVR',
        currencyCode:    inv.currency?.code || 'USD',
        currencyRate:    inv.totals?.currencyRate || 1,
        vatPercentage:   vat,
        totalWithoutVAT: entry.totalWithoutVAT,
        totalVAT:        entry.totalVAT,
        grandTotal:      entry.grandTotal,
        items,
      };
      try {
        await axiosClient.put(`/invoices/${inv.id}`, payload);
        done++;
      } catch (e) {
        errors.push(`${inv.invoiceNumber}: ${e?.response?.data?.message || e.message}`);
        done++;
      }
    }
    setApplying(false);
    setApplyProgress(null);
    setApplyResult({ done, total: preview.length, errors });
  };

  const previewGrandTotal = preview?.reduce((s, e) => s + e.grandTotal, 0) ?? 0;

  return (
    <div className="rvr-page">
      <div className="rvr-header">
        <h1 className="rvr-title">RVR Bulk Randomizer</h1>
        <p className="rvr-subtitle">Randomly redistribute items across existing RVR invoices to hit a target total.</p>
      </div>

      {/* STEP 1: Parameters */}
      <section className="rvr-section">
        <div className="rvr-section-title">1 · Parameters</div>
        <div className="rvr-params-grid">
          <div className="rvr-field">
            <label>From Date</label>
            <input className="rvr-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="rvr-field">
            <label>To Date</label>
            <input className="rvr-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="rvr-field">
            <label>Min per Invoice ($)</label>
            <input className="rvr-input" type="number" min="0" step="0.01" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="rvr-field">
            <label>Max per Invoice ($)</label>
            <input className="rvr-input" type="number" min="0" step="0.01" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="rvr-field">
            <label>Grand Total Target ($)</label>
            <input className="rvr-input" type="number" min="0" step="0.01" value={targetTotal} onChange={e => setTargetTotal(e.target.value)} placeholder="0.00" />
          </div>
          <div className="rvr-field">
            <label>Max Qty per Item</label>
            <input className="rvr-input" type="number" min="1" step="1" value={maxQty} onChange={e => setMaxQty(e.target.value)} />
          </div>
          <div className="rvr-field">
            <label>VAT %</label>
            <input className="rvr-input" type="number" min="0" step="0.1" value={vatPct} onChange={e => setVatPct(e.target.value)} />
          </div>
          <div className="rvr-field rvr-field-btn">
            <button className="rvr-btn rvr-btn-primary" onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching…' : 'Search RVR Invoices'}
            </button>
          </div>
        </div>
        {searchErr && <div className="rvr-error">{searchErr}</div>}
      </section>

      {/* STEP 2: Invoice list */}
      {invoices.length > 0 && (
        <section className="rvr-section">
          <div className="rvr-section-title">
            2 · Select Invoices
            <span className="rvr-count-badge">{invoices.length} found</span>
            <span className="rvr-count-badge rvr-badge-blue">{selected.size} selected</span>
          </div>
          <div className="rvr-table-wrap">
            <table className="rvr-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selected.size === invoices.length && invoices.length > 0} onChange={toggleAll} /></th>
                  <th>Invoice #</th><th>Date</th><th>Customer</th><th>Alternative Customer</th>
                  <th className="num">Grand Total</th><th className="num">Items</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className={selected.has(inv.id) ? 'rvr-row-selected' : ''}
                    onClick={() => toggleInv(inv.id)} style={{ cursor: 'pointer' }}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleInv(inv.id)} />
                    </td>
                    <td className="rvr-inv-num">{inv.invoiceNumber}</td>
                    <td>{inv.date}</td>
                    <td>
                      {inv.alternativeCustomer?.name ? (
                        <>
                          <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{inv.customer?.name || '—'}</span>
                          <br />
                          <span dir="rtl" style={{ fontWeight: 600 }}>{inv.alternativeCustomer.name}</span>
                        </>
                      ) : (inv.customer?.name || '—')}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <AltCustomerPicker
                        altCustomers={altCustomers}
                        value={altCustomerOverrides.get(inv.id) || null}
                        onChange={(id) => setAltCustomerFor(inv.id, id)}
                      />
                    </td>
                    <td className="num">${fmt(inv.totals?.grandTotal)}</td>
                    <td className="num">{inv.items?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rvr-generate-row">
            <button
              className="rvr-btn rvr-btn-outline"
              onClick={handleAutoAssignCustomerNames}
              disabled={selected.size === 0 || altCustomers.length === 0}
              title="Shuffles the alternative customer list and assigns one per selected invoice with no repeats until the list is exhausted, then starts over."
            >
              🎲 Auto-Assign Names to Selected
            </button>
            <button
              className="rvr-btn rvr-btn-confirm"
              onClick={handleApplyCustomerNamesOnly}
              disabled={applyingAltNames || ![...selected].some(id => altCustomerOverrides.has(id))}
            >
              {applyingAltNames
                ? (altApplyProgress ? `Applying ${altApplyProgress.current}/${altApplyProgress.total} — ${altApplyProgress.invoiceNumber}…` : 'Applying…')
                : '💾 Apply Customer Names to Selected'}
            </button>
            <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 8 }}>
              Only sets the alternative customer on selected invoices — items are left untouched.
            </span>
          </div>
          {altApplyResult && (
            <div className={`rvr-result ${altApplyResult.errors.length ? 'rvr-result-warn' : 'rvr-result-ok'}`}>
              <strong>{altApplyResult.errors.length === 0 ? '✅ All done!' : '⚠ Completed with errors'}</strong>
              <span> — {altApplyResult.done} of {altApplyResult.total} invoices updated.</span>
              {altApplyResult.errors.length > 0 && (
                <ul className="rvr-error-list">
                  {altApplyResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* STEP 3: Item pool */}
      {invoices.length > 0 && (
        <section className="rvr-section">
          <div className="rvr-section-title">
            3 · Item Pool
            <span className="rvr-count-badge rvr-badge-blue">{itemPool.length} items</span>
            {poolSaving && <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>saving…</span>}
            {poolSaveMsg && !poolSaving && <span style={{ fontSize: '0.75rem', color: poolSaveMsg === 'Pool saved' ? '#16a34a' : '#dc2626', fontWeight: 400 }}>{poolSaveMsg}</span>}
          </div>

          {itemPool.length > 0 ? (
            <div className="rvr-pool-summary">
              {itemPool.map((item, i) => {
                const typeLow = String(item.type || '').toLowerCase();
                const thickStr = typeLow !== 'unit' && item.thickness
                  ? `${parseFloat(String(item.thickness))} ملم ` : '';
                const hasDims = Number(item.length) > 0 && Number(item.width) > 0;
                let dimsStr = '';
                if (hasDims) {
                  dimsStr = typeLow === 'box'
                    ? ` ${item.length}×${item.width}-${String(item.sheetsPerBox || 0).padStart(3, '0')}`
                    : ` ${item.length}×${item.width}`;
                }
                const needsDims = (typeLow === 'box' || typeLow === 'sheet') && !hasDims;
                return (
                  <div key={i} className={`rvr-pool-chip${needsDims ? ' rvr-pool-chip-nodims' : ''}`}>
                    <span dir="rtl">{thickStr}{item.itemName}{dimsStr}</span>
                    {needsDims && <span className="rvr-pool-chip-warn" title="No dimensions in DB — SQM cannot be calculated">⚠</span>}
                    <span className="rvr-pool-chip-price">${fmt(item.price)}</span>
                    <button className="rvr-btn-remove" onClick={() => removeItem(i)}>×</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rvr-pool-hint">Click any row in the table below to set its price and add it to the pool. Click again to remove.</div>
          )}

          <StockSearchPanel itemPool={itemPool} onAdd={addItem} onRemove={removeItem} />

          <div className="rvr-generate-row">
            <button className="rvr-btn rvr-btn-primary" onClick={handleGenerate} disabled={selected.size === 0 || itemPool.length === 0}>
              ⚡ Generate Preview
            </button>
            {preview && (
              <button className="rvr-btn rvr-btn-outline" onClick={handleGenerate} disabled={selected.size === 0 || itemPool.length === 0}>
                🔀 Regenerate
              </button>
            )}
          </div>
          {previewErr && <div className="rvr-error">{previewErr}</div>}
        </section>
      )}

      {/* STEP 4: Preview */}
      {preview && (
        <section className="rvr-section">
          <div className="rvr-section-title">
            4 · Preview
            <span className="rvr-count-badge rvr-badge-blue">{preview.length} invoices</span>
            <span className="rvr-count-badge rvr-badge-green">Total: ${fmt(previewGrandTotal)}</span>
            <span className={`rvr-count-badge ${Math.abs(previewGrandTotal - parseFloat(targetTotal || 0)) < 1 ? 'rvr-badge-green' : 'rvr-badge-amber'}`}>
              Target: ${fmt(parseFloat(targetTotal || 0))} (Δ ${fmt(Math.abs(previewGrandTotal - parseFloat(targetTotal || 0)))})
            </span>
            <button className="rvr-btn rvr-btn-outline rvr-btn-sm" onClick={handlePrint} style={{ marginLeft: 'auto' }}>
              🖨 Print
            </button>
          </div>

          <div ref={printRef}>
          {preview.map((entry, ei) => (
            <div key={ei} className="rvr-preview-card">
              <div className="rvr-preview-card-header">
                <span className="rvr-inv-num">{entry.invoice.invoiceNumber}</span>
                <span className="rvr-preview-customer">
                  {entry.alternativeCustomerName
                    ? `${entry.invoice.customer?.name} → ${entry.alternativeCustomerName}`
                    : entry.invoice.customer?.name}
                </span>
                <span className="rvr-preview-date">{entry.invoice.date}</span>
                <span className="rvr-preview-target">Target: ${fmt(entry.grandTarget)}</span>
                <span className="rvr-preview-actual">Actual: ${fmt(entry.grandTotal)}</span>
              </div>
              <table className="rvr-table rvr-preview-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Dimensions</th>
                    <th className="num">Qty</th>
                    <th className="num">SQM</th>
                    <th className="num">Unit Price</th>
                    <th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((l, li) => {
                    const typeLow = String(l.type || '').toLowerCase();
                    const itemLabel = typeLow !== 'unit' && l.thickness
                      ? `${parseFloat(String(l.thickness))} ملم ${l.itemName ?? ''}`
                      : String(l.itemName ?? '');
                    const len = Number(l.length || 0);
                    const wid = Number(l.width  || 0);
                    const spb = Number(l.sheetsPerBox || 0);
                    let dimsLabel = '';
                    if (len > 0 && wid > 0) {
                      dimsLabel = typeLow === 'box'
                        ? `${len}×${wid}-${String(spb).padStart(3, '0')}`
                        : `${len}×${wid}`;
                    } else if (len > 0) {
                      dimsLabel = String(len);
                    }
                    return (
                      <tr key={li}>
                        <td dir="rtl">{itemLabel}</td>
                        <td className="num rvr-dims-cell">{dimsLabel}</td>
                        <td className="num">{l.qty}</td>
                        <td className="num">{l.sqm > 0 ? fmt(l.sqm) : '—'}</td>
                        <td className="num">${fmt(l.price)}</td>
                        <td className="num">${fmt(l.totalAmount)}</td>
                      </tr>
                    );
                  })}
                  <tr className="rvr-subtotal-row">
                    <td colSpan={5} className="num">Subtotal (excl. VAT)</td>
                    <td className="num">${fmt(entry.totalWithoutVAT)}</td>
                  </tr>
                  <tr className="rvr-vat-row">
                    <td colSpan={5} className="num">VAT ({vatPct}%)</td>
                    <td className="num">${fmt(entry.totalVAT)}</td>
                  </tr>
                  <tr className="rvr-total-row">
                    <td colSpan={5} className="num">Grand Total</td>
                    <td className="num">${fmt(entry.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          <div className="rvr-grand-summary">
            <div className="rvr-grand-row">
              <span>Sum of all invoice totals</span>
              <span className="rvr-grand-value">${fmt(previewGrandTotal)}</span>
            </div>
            <div className="rvr-grand-row">
              <span>Target grand total</span>
              <span className="rvr-grand-value">${fmt(parseFloat(targetTotal || 0))}</span>
            </div>
            <div className="rvr-grand-row rvr-grand-diff">
              <span>Difference</span>
              <span className="rvr-grand-value">${fmt(Math.abs(previewGrandTotal - parseFloat(targetTotal || 0)))}</span>
            </div>
          </div>
          </div>{/* end printRef */}

          {!applyResult && (
            <div className="rvr-apply-row">
              <button className="rvr-btn rvr-btn-confirm" onClick={handleApply} disabled={applying}>
                {applying
                  ? (applyProgress ? `Applying ${applyProgress.current}/${applyProgress.total} — ${applyProgress.invoiceNumber}…` : 'Applying…')
                  : `✅ Confirm & Apply (${preview.length} invoices)`}
              </button>
            </div>
          )}

          {applyResult && (
            <div className={`rvr-result ${applyResult.errors.length ? 'rvr-result-warn' : 'rvr-result-ok'}`}>
              <strong>{applyResult.errors.length === 0 ? '✅ All done!' : '⚠ Completed with errors'}</strong>
              <span> — {applyResult.done} of {applyResult.total} invoices updated.</span>
              {applyResult.errors.length > 0 && (
                <ul className="rvr-error-list">
                  {applyResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
