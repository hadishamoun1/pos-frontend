import React, { useEffect, useRef, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import CustomerSelectionModal from "../recievables/CustomerSelectionModal";
import "./BulkRvrSettings.css";

const todayISO = () => new Date().toISOString().slice(0, 10);

function ItemSearchField({ selected, onSelect, disabled }) {
  const [query, setQuery] = useState(selected?.itemName || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (selected) setQuery(selected.itemName || "");
  }, [selected]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axiosClient.get("/items/v1/real-variant-ledger", {
          params: { q, page: 1, limit: 20, includeSqm: false },
        });
        const raw = res.data?.data || res.data || [];
        const flat = [];
        for (const v of (Array.isArray(raw) ? raw : [])) {
          const batches = v.batches?.length ? v.batches : [{ id: null }];
          for (const b of batches) {
            flat.push({ variantId: v.variantId, batchId: b.id, itemName: v.itemName, type: String(v.type || "unit").toLowerCase(), stockMode: v.stockMode || null });
          }
        }
        setResults(flat.slice(0, 20));
        setOpen(flat.length > 0);
      } catch { setResults([]); setOpen(false); }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const onDown = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="brs-item-wrap" ref={containerRef}>
      <input type="text" className={`brs-input ${selected ? "brs-input-selected" : ""}`} value={query}
        placeholder="Type to search items…" disabled={disabled} autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); if (selected) onSelect(null); }} />
      {selected && <span className="brs-check">✓ {selected.itemName}</span>}
      {open && results.length > 0 && (
        <div className="brs-dropdown">
          {results.map((r, i) => (
            <div key={`${r.variantId}-${r.batchId ?? "x"}-${i}`} className="brs-dropdown-row"
              onMouseDown={() => { onSelect(r); setQuery(r.itemName); setOpen(false); }}>
              <span className="brs-dropdown-name">{r.itemName}</span>
              {r.type && <span className="brs-dropdown-badge">{r.type}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return { value: i, label: `${String(h).padStart(2, "0")}:00 ${ampm}` };
});

function fmtDateTime(iso) {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function BulkRvrSettings() {
  const [tab, setTab] = useState("manual"); // "manual" | "schedule"

  // ── Manual tab state ──
  const [quantity, setQuantity] = useState(5);
  const [invCustomer, setInvCustomer] = useState(null);
  const [invItem, setInvItem] = useState(null);
  const [invUnitPrice, setInvUnitPrice] = useState("");
  const [showInvPicker, setShowInvPicker] = useState(false);
  const [recvCustomer, setRecvCustomer] = useState(null);
  const [recvCash, setRecvCash] = useState("");
  const [recvCurrency, setRecvCurrency] = useState("USD");
  const [recvExchangeRate, setRecvExchangeRate] = useState("89500");
  const [showRecvPicker, setShowRecvPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  // ── Schedule tab state ──
  const [schedule, setSchedule] = useState(null);
  const [schedLoading, setSchedLoading] = useState(true);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedRunning, setSchedRunning] = useState(false);
  const [schedErr, setSchedErr] = useState("");
  const [schedResult, setSchedResult] = useState(null);

  // Schedule form fields
  const [sEnabled, setSEnabled] = useState(false);
  const [sQty, setSQty] = useState(1);
  const [sRunHour, setSRunHour] = useState(0);
  const [sAllowedDays, setSAllowedDays] = useState([0, 1, 2, 3, 4, 5, 6]); // all days by default
  const [sInvCustomer, setSInvCustomer] = useState(null);
  const [sInvItem, setSInvItem] = useState(null);
  const [sInvPrice, setSInvPrice] = useState("");
  const [sRecvCustomer, setSRecvCustomer] = useState(null);
  const [sRecvCash, setSRecvCash] = useState("");
  const [sRecvCurrency, setSRecvCurrency] = useState("USD");
  const [sRecvExRate, setSRecvExRate] = useState("89500");
  const [showSInvPicker, setShowSInvPicker] = useState(false);
  const [showSRecvPicker, setShowSRecvPicker] = useState(false);

  // Load schedule config on mount
  useEffect(() => {
    axiosClient.get("/bulk-rvr-schedule")
      .then((res) => {
        const d = res.data;
        setSchedule(d);
        setSEnabled(!!d.enabled);
        setSQty(d.quantity || 1);
        // Convert UTC hour stored on server → browser local hour for display
        const utcToLocal = (h) => ((h - Math.round(new Date().getTimezoneOffset() / 60)) % 24 + 24) % 24;
        setSRunHour(utcToLocal(d.runHour ?? 0));
        setSInvPrice(d.invoiceUnitPrice ? String(d.invoiceUnitPrice) : "");
        setSRecvCash(d.receivableCashAmount ? String(d.receivableCashAmount) : "");
        setSRecvCurrency(d.receivableCurrency || "USD");
        setSRecvExRate(d.receivableExchangeRate ? String(d.receivableExchangeRate) : "89500");
        if (d.invoiceCustomerId) setSInvCustomer({ id: d.invoiceCustomerId, customerName: d.invoiceCustomerName });
        if (d.invoiceItemVariantId) setSInvItem({ variantId: d.invoiceItemVariantId, batchId: d.invoiceItemBatchId, itemName: d.invoiceItemName, type: d.invoiceItemType, stockMode: d.invoiceItemStockMode });
        if (d.receivableCustomerId) setSRecvCustomer({ id: d.receivableCustomerId, customerName: d.receivableCustomerName });
        if (d.allowedDays) {
          const parsed = d.allowedDays.split(",").map(Number).filter((n) => !isNaN(n) && n >= 0 && n <= 6);
          setSAllowedDays(parsed.length ? parsed : [0, 1, 2, 3, 4, 5, 6]);
        } else {
          setSAllowedDays([0, 1, 2, 3, 4, 5, 6]);
        }
      })
      .catch(() => setSchedErr("Failed to load schedule config."))
      .finally(() => setSchedLoading(false));
  }, []);

  const saveSchedule = async () => {
    setSchedSaving(true); setSchedErr("");
    try {
      const payload = {
        enabled: sEnabled,
        quantity: sQty,
        // Convert browser local hour → UTC before storing on server
        runHour: ((sRunHour + Math.round(new Date().getTimezoneOffset() / 60)) % 24 + 24) % 24,
        invoiceCustomerId: sInvCustomer?.id || null,
        invoiceCustomerName: sInvCustomer?.customerName || null,
        invoiceItemVariantId: sInvItem?.variantId || null,
        invoiceItemBatchId: sInvItem?.batchId || null,
        invoiceItemType: sInvItem?.type || null,
        invoiceItemStockMode: sInvItem?.stockMode || null,
        invoiceItemName: sInvItem?.itemName || null,
        invoiceUnitPrice: parseFloat(sInvPrice) || 0,
        receivableCustomerId: sRecvCustomer?.id || null,
        receivableCustomerName: sRecvCustomer?.customerName || null,
        receivableCashAmount: parseFloat(sRecvCash) || 0,
        receivableCurrency: sRecvCurrency,
        receivableExchangeRate: parseFloat(String(sRecvExRate).replace(/,/g, "")) || 89500,
        allowedDays: sAllowedDays.length === 7 ? null : sAllowedDays.join(","),
      };
      const res = await axiosClient.patch("/bulk-rvr-schedule", payload);
      setSchedule(res.data);
    } catch (e) {
      setSchedErr(e?.response?.data?.message || e.message || "Failed to save.");
    } finally {
      setSchedSaving(false);
    }
  };

  const runScheduleNow = async () => {
    setSchedRunning(true); setSchedErr(""); setSchedResult(null);
    try {
      const res = await axiosClient.post("/bulk-rvr-schedule/run");
      setSchedResult(res.data);
      const updated = await axiosClient.get("/bulk-rvr-schedule");
      setSchedule(updated.data);
    } catch (e) {
      setSchedErr(e?.response?.data?.message || e.message || "Run failed.");
    } finally {
      setSchedRunning(false);
    }
  };

  // ── Manual create ──
  const handleCreate = async () => {
    setErr(""); setResult(null);
    if (!invCustomer) { setErr("Select a customer for the invoices."); return; }
    if (!invItem) { setErr("Select an item for the invoices."); return; }
    const unitPrice = parseFloat(invUnitPrice);
    if (!invUnitPrice || !Number.isFinite(unitPrice) || unitPrice <= 0) { setErr("Enter a valid unit price."); return; }
    if (!recvCustomer) { setErr("Select a customer for the receivables."); return; }
    const cashNumber = parseFloat(recvCash);
    if (!recvCash || !Number.isFinite(cashNumber) || cashNumber <= 0) { setErr("Enter a valid cash amount."); return; }

    const qty = Math.max(1, Math.floor(Number(quantity)));
    const vatAmount = parseFloat((unitPrice * 0.11).toFixed(2));
    const grandTotal = parseFloat((unitPrice + vatAmount).toFixed(2));
    const rate = parseFloat(String(recvExchangeRate).replace(/,/g, "")) || 89500;
    const amountExchanged = recvCurrency === "LL" ? parseFloat((cashNumber / rate).toFixed(2)) : parseFloat((cashNumber * rate).toFixed(2));

    setCreating(true);
    const errors = []; let invoicesCreated = 0; let receivablesCreated = 0;

    for (let i = 0; i < qty; i++) {
      setProgress({ type: "invoice", current: i + 1, total: qty });
      try {
        await axiosClient.post("/invoices", { customerId: invCustomer.id, date: todayISO(), invoiceType: "RVR", documentNumber: "DOC-0001", currencyCode: "USD", totalWithoutVAT: unitPrice, totalVAT: vatAmount, grandTotal, currencyRate: 1, vatPercentage: 11, items: [{ itemVariantId: invItem.variantId, itemBatchId: invItem.batchId, itemType: invItem.type || "unit", stockMode: invItem.stockMode || null, quantity: 1, sqm: 0, unitPrice, totalAmount: unitPrice, vat: vatAmount, length: null, width: null, sheetsPerBox: null }] });
        invoicesCreated++;
      } catch (e) { errors.push(`Invoice ${i + 1}: ${e?.response?.data?.message || e.message}`); }
    }
    for (let i = 0; i < qty; i++) {
      setProgress({ type: "receivable", current: i + 1, total: qty });
      try {
        await axiosClient.post("/recievables", { customerId: recvCustomer.id, date: todayISO(), invoiceId: null, cashNumber, currency: recvCurrency, exchangeRate: rate, amountExchanged, comments: "", type: "RVR", pmtType: "Cash" });
        receivablesCreated++;
      } catch (e) { errors.push(`Receivable ${i + 1}: ${e?.response?.data?.message || e.message}`); }
    }
    setCreating(false); setProgress(null);
    setResult({ invoicesCreated, receivablesCreated, qty, errors });
  };

  const busy = creating;

  return (
    <div className="brs-page">
      <div className="brs-header">
        <h2 className="brs-title">Bulk RVR Creator</h2>
        <p className="brs-subtitle">
          Create multiple RVR invoices and receivables at once, or set up a daily schedule
          to run automatically every day at a fixed time.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="brs-tabs">
        <button className={`brs-tab ${tab === "manual" ? "brs-tab-active" : ""}`} onClick={() => setTab("manual")}>
          Run Manually
        </button>
        <button className={`brs-tab ${tab === "schedule" ? "brs-tab-active" : ""}`} onClick={() => setTab("schedule")}>
          Daily Schedule
          {schedule?.enabled && <span className="brs-tab-dot" />}
        </button>
      </div>

      {/* ══════════════ MANUAL TAB ══════════════ */}
      {tab === "manual" && (
        <>
          <div className="brs-card">
            <div className="brs-card-title">How many to create?</div>
            <div className="brs-card-desc">Applies to both invoices and receivables.</div>
            <div className="brs-qty-row">
              <button className="brs-qty-btn" disabled={busy || !!result} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
              <input type="number" className="brs-qty-input" min={1} max={100} value={quantity}
                disabled={busy || !!result} onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
              <button className="brs-qty-btn" disabled={busy || !!result} onClick={() => setQuantity(q => Math.min(100, q + 1))}>+</button>
              <span className="brs-qty-label">will create <strong>{quantity}</strong> invoice{quantity !== 1 ? "s" : ""} + <strong>{quantity}</strong> receivable{quantity !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="brs-sections">
            <div className="brs-section-card">
              <div className="brs-section-head">
                <span className="brs-section-icon">🧾</span>
                <div><div className="brs-section-title">Invoices</div><div className="brs-section-desc">RVR — VAT 11% applied automatically</div></div>
              </div>
              <div className="brs-field">
                <label className="brs-label">Customer</label>
                {invCustomer ? <div className="brs-selected-customer"><span className="brs-customer-name">{invCustomer.customerName}</span><button className="brs-clear" disabled={busy || !!result} onClick={() => setInvCustomer(null)}>Change</button></div>
                  : <button className="brs-pick" disabled={busy || !!result} onClick={() => setShowInvPicker(true)}>Select customer…</button>}
              </div>
              <div className="brs-field">
                <label className="brs-label">Item</label>
                <ItemSearchField selected={invItem} onSelect={setInvItem} disabled={busy || !!result} />
              </div>
              <div className="brs-field">
                <label className="brs-label">Unit Price <span className="brs-currency-tag">USD excl. VAT</span></label>
                <input type="number" className="brs-input" placeholder="0.00" min={0} step="0.01" value={invUnitPrice}
                  disabled={busy || !!result} onChange={(e) => setInvUnitPrice(e.target.value)} />
                {invUnitPrice && !isNaN(parseFloat(invUnitPrice)) && parseFloat(invUnitPrice) > 0 && (
                  <div className="brs-vat-preview">VAT (11%): <strong>${(parseFloat(invUnitPrice) * 0.11).toFixed(2)}</strong> · Grand total: <strong>${(parseFloat(invUnitPrice) * 1.11).toFixed(2)}</strong></div>
                )}
              </div>
            </div>

            <div className="brs-section-card">
              <div className="brs-section-head">
                <span className="brs-section-icon">💰</span>
                <div><div className="brs-section-title">Receivables</div><div className="brs-section-desc">RVR — cash payment type</div></div>
              </div>
              <div className="brs-field">
                <label className="brs-label">Customer</label>
                {recvCustomer ? <div className="brs-selected-customer"><span className="brs-customer-name">{recvCustomer.customerName}</span><button className="brs-clear" disabled={busy || !!result} onClick={() => setRecvCustomer(null)}>Change</button></div>
                  : <button className="brs-pick" disabled={busy || !!result} onClick={() => setShowRecvPicker(true)}>Select customer…</button>}
              </div>
              <div className="brs-field">
                <label className="brs-label">Cash Amount</label>
                <div className="brs-amount-row">
                  <input type="number" className="brs-input brs-amount-input" placeholder="0.00" min={0} step="0.01" value={recvCash}
                    disabled={busy || !!result} onChange={(e) => setRecvCash(e.target.value)} />
                  <select className="brs-select" value={recvCurrency} disabled={busy || !!result} onChange={(e) => setRecvCurrency(e.target.value)}>
                    <option value="USD">USD</option><option value="LL">LL</option>
                  </select>
                </div>
              </div>
              {recvCurrency === "LL" && (
                <div className="brs-field">
                  <label className="brs-label">Exchange Rate</label>
                  <input type="text" className="brs-input" value={recvExchangeRate} disabled={busy || !!result} onChange={(e) => setRecvExchangeRate(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {err && <div className="brs-err"><span className="brs-err-icon">⚠</span>{err}</div>}

          {creating && progress && (
            <div className="brs-progress-card">
              <div className="brs-progress-bar-wrap"><div className="brs-progress-bar" style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div>
              <div className="brs-progress-label">Creating {progress.type} {progress.current} of {progress.total}…</div>
            </div>
          )}

          {result && (
            <div className={`brs-result ${result.errors.length > 0 ? "brs-result-warn" : "brs-result-ok"}`}>
              <div className="brs-result-row"><span className="brs-result-icon">✅</span><span>{result.invoicesCreated} RVR invoice{result.invoicesCreated !== 1 ? "s" : ""} created</span></div>
              <div className="brs-result-row"><span className="brs-result-icon">✅</span><span>{result.receivablesCreated} RVR receivable{result.receivablesCreated !== 1 ? "s" : ""} created</span></div>
              {result.errors.length > 0 && <div className="brs-result-errors">{result.errors.map((e, i) => <div key={i} className="brs-result-error">⚠ {e}</div>)}</div>}
            </div>
          )}

          <div className="brs-actions">
            {result
              ? <button className="brs-btn brs-btn-secondary" onClick={() => { setResult(null); setErr(""); }}>Create Another Batch</button>
              : <button className="brs-btn brs-btn-primary" onClick={handleCreate} disabled={busy}>
                  {busy ? `Creating… (${progress?.type} ${progress?.current}/${progress?.total})` : `Create ${quantity} RVR Invoice${quantity !== 1 ? "s" : ""} + ${quantity} Receivable${quantity !== 1 ? "s" : ""}`}
                </button>}
          </div>
        </>
      )}

      {/* ══════════════ SCHEDULE TAB ══════════════ */}
      {tab === "schedule" && (
        <>
          {schedLoading ? <div className="brs-sched-loading">Loading schedule…</div> : (
            <>
              {/* Status banner */}
              <div className={`brs-sched-status ${sEnabled ? "brs-sched-status-on" : "brs-sched-status-off"}`}>
                <div className="brs-sched-status-left">
                  <span className="brs-sched-dot" />
                  <div>
                    <div className="brs-sched-status-label">{sEnabled ? "Schedule Active" : "Schedule Disabled"}</div>
                    <div className="brs-sched-status-desc">
                      {sEnabled
                        ? `Runs at ${HOURS[sRunHour]?.label} · ${(() => {
                            const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                            return sAllowedDays.length === 7 ? "Every day" : sAllowedDays.length === 0 ? "No days selected!" : sAllowedDays.map((d) => DAY_NAMES[d]).join(", ");
                          })()} · Last run: ${fmtDateTime(schedule?.lastRunAt)}`
                        : "Enable the schedule and save to activate automatic daily creation."}
                    </div>
                  </div>
                </div>
                <button
                  className={`brs-toggle ${sEnabled ? "brs-toggle-on" : "brs-toggle-off"}`}
                  onClick={async () => {
                    const next = !sEnabled;
                    setSEnabled(next);
                    try {
                      await axiosClient.patch("/bulk-rvr-schedule", { enabled: next });
                    } catch {
                      setSEnabled(!next);
                    }
                  }}
                  disabled={schedSaving || schedRunning}
                >
                  <span className="brs-toggle-knob" />
                </button>
              </div>

              {/* Run time */}
              <div className="brs-sched-card">
                <div className="brs-sched-card-title">Run Time</div>
                <div className="brs-sched-card-desc">The server will automatically create the batch once per day at this hour.</div>
                <select className="brs-select brs-hour-select" value={sRunHour} onChange={(e) => setSRunHour(Number(e.target.value))}>
                  {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </div>

              {/* Allowed days */}
              <div className="brs-sched-card">
                <div className="brs-sched-card-title">Allowed Days</div>
                <div className="brs-sched-card-desc">
                  The schedule will only run on selected days.
                  {sAllowedDays.length === 0 && <span className="brs-days-warn"> At least one day must be selected.</span>}
                </div>
                <div className="brs-days-row">
                  {[
                    { n: 0, label: "Sun" },
                    { n: 1, label: "Mon" },
                    { n: 2, label: "Tue" },
                    { n: 3, label: "Wed" },
                    { n: 4, label: "Thu" },
                    { n: 5, label: "Fri" },
                    { n: 6, label: "Sat" },
                  ].map(({ n, label }) => {
                    const active = sAllowedDays.includes(n);
                    return (
                      <button
                        key={n}
                        className={`brs-day-btn ${active ? "brs-day-btn-on" : "brs-day-btn-off"}`}
                        onClick={() =>
                          setSAllowedDays((prev) =>
                            active
                              ? prev.filter((d) => d !== n)
                              : [...prev, n].sort((a, b) => a - b)
                          )
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity */}
              <div className="brs-sched-card">
                <div className="brs-sched-card-title">Quantity per Run</div>
                <div className="brs-qty-row" style={{ marginTop: 8 }}>
                  <button className="brs-qty-btn" onClick={() => setSQty(q => Math.max(1, q - 1))}>−</button>
                  <input type="number" className="brs-qty-input" min={1} max={100} value={sQty} onChange={(e) => setSQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
                  <button className="brs-qty-btn" onClick={() => setSQty(q => Math.min(100, q + 1))}>+</button>
                  <span className="brs-qty-label"><strong>{sQty}</strong> invoice{sQty !== 1 ? "s" : ""} + <strong>{sQty}</strong> receivable{sQty !== 1 ? "s" : ""} per day</span>
                </div>
              </div>

              {/* Default values */}
              <div className="brs-sections">
                <div className="brs-section-card">
                  <div className="brs-section-head">
                    <span className="brs-section-icon">🧾</span>
                    <div><div className="brs-section-title">Invoice Defaults</div><div className="brs-section-desc">RVR — VAT 11%</div></div>
                  </div>
                  <div className="brs-field">
                    <label className="brs-label">Customer</label>
                    {sInvCustomer ? <div className="brs-selected-customer"><span className="brs-customer-name">{sInvCustomer.customerName}</span><button className="brs-clear" onClick={() => setSInvCustomer(null)}>Change</button></div>
                      : <button className="brs-pick" onClick={() => setShowSInvPicker(true)}>Select customer…</button>}
                  </div>
                  <div className="brs-field">
                    <label className="brs-label">Item</label>
                    <ItemSearchField selected={sInvItem} onSelect={setSInvItem} disabled={false} />
                  </div>
                  <div className="brs-field">
                    <label className="brs-label">Unit Price <span className="brs-currency-tag">USD excl. VAT</span></label>
                    <input type="number" className="brs-input" placeholder="0.00" min={0} step="0.01" value={sInvPrice} onChange={(e) => setSInvPrice(e.target.value)} />
                    {sInvPrice && !isNaN(parseFloat(sInvPrice)) && parseFloat(sInvPrice) > 0 && (
                      <div className="brs-vat-preview">VAT (11%): <strong>${(parseFloat(sInvPrice) * 0.11).toFixed(2)}</strong> · Grand total: <strong>${(parseFloat(sInvPrice) * 1.11).toFixed(2)}</strong></div>
                    )}
                  </div>
                </div>

                <div className="brs-section-card">
                  <div className="brs-section-head">
                    <span className="brs-section-icon">💰</span>
                    <div><div className="brs-section-title">Receivable Defaults</div><div className="brs-section-desc">RVR — cash payment</div></div>
                  </div>
                  <div className="brs-field">
                    <label className="brs-label">Customer</label>
                    {sRecvCustomer ? <div className="brs-selected-customer"><span className="brs-customer-name">{sRecvCustomer.customerName}</span><button className="brs-clear" onClick={() => setSRecvCustomer(null)}>Change</button></div>
                      : <button className="brs-pick" onClick={() => setShowSRecvPicker(true)}>Select customer…</button>}
                  </div>
                  <div className="brs-field">
                    <label className="brs-label">Cash Amount</label>
                    <div className="brs-amount-row">
                      <input type="number" className="brs-input brs-amount-input" placeholder="0.00" min={0} step="0.01" value={sRecvCash} onChange={(e) => setSRecvCash(e.target.value)} />
                      <select className="brs-select" value={sRecvCurrency} onChange={(e) => setSRecvCurrency(e.target.value)}>
                        <option value="USD">USD</option><option value="LL">LL</option>
                      </select>
                    </div>
                  </div>
                  {sRecvCurrency === "LL" && (
                    <div className="brs-field">
                      <label className="brs-label">Exchange Rate</label>
                      <input type="text" className="brs-input" value={sRecvExRate} onChange={(e) => setSRecvExRate(e.target.value)} />
                    </div>
                  )}
                </div>
              </div>

              {schedErr && <div className="brs-err"><span className="brs-err-icon">⚠</span>{schedErr}</div>}

              {schedResult && (
                <div className={`brs-result ${schedResult.errors?.length > 0 ? "brs-result-warn" : "brs-result-ok"}`}>
                  <div className="brs-result-row"><span className="brs-result-icon">✅</span><span>{schedResult.invoicesCreated} invoice{schedResult.invoicesCreated !== 1 ? "s" : ""} created</span></div>
                  <div className="brs-result-row"><span className="brs-result-icon">✅</span><span>{schedResult.receivablesCreated} receivable{schedResult.receivablesCreated !== 1 ? "s" : ""} created</span></div>
                  {schedResult.errors?.length > 0 && <div className="brs-result-errors">{schedResult.errors.map((e, i) => <div key={i} className="brs-result-error">⚠ {e}</div>)}</div>}
                </div>
              )}

              {schedule?.lastRunAt && !schedResult && (
                <div className="brs-last-run">
                  Last automatic run: <strong>{fmtDateTime(schedule.lastRunAt)}</strong>
                  {schedule.lastRunResult && (() => { try { const r = JSON.parse(schedule.lastRunResult); return <span> — {r.invoicesCreated} invoices, {r.receivablesCreated} receivables{r.errors?.length ? `, ${r.errors.length} error(s)` : ""}</span>; } catch { return null; } })()}
                </div>
              )}

              <div className="brs-actions">
                <button className="brs-btn brs-btn-primary" onClick={saveSchedule} disabled={schedSaving || schedRunning}>
                  {schedSaving ? "Saving…" : "Save Schedule"}
                </button>
                <button className="brs-btn brs-btn-secondary" onClick={runScheduleNow} disabled={schedSaving || schedRunning}>
                  {schedRunning ? "Running…" : "Run Now with These Defaults"}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Customer pickers */}
      {showInvPicker && <CustomerSelectionModal onClose={() => setShowInvPicker(false)} onSelectCustomer={(c) => { setInvCustomer(c); setShowInvPicker(false); }} />}
      {showRecvPicker && <CustomerSelectionModal onClose={() => setShowRecvPicker(false)} onSelectCustomer={(c) => { setRecvCustomer(c); setShowRecvPicker(false); }} />}
      {showSInvPicker && <CustomerSelectionModal onClose={() => setShowSInvPicker(false)} onSelectCustomer={(c) => { setSInvCustomer(c); setShowSInvPicker(false); }} />}
      {showSRecvPicker && <CustomerSelectionModal onClose={() => setShowSRecvPicker(false)} onSelectCustomer={(c) => { setSRecvCustomer(c); setShowSRecvPicker(false); }} />}
    </div>
  );
}
