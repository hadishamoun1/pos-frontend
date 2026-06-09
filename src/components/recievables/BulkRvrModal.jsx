import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { axiosClient } from "../api/axiosClient";
import CustomerSelectionModal from "./CustomerSelectionModal";
import "./BulkRvrModal.css";

const todayISO = () => new Date().toISOString().slice(0, 10);

function ItemSearchField({ selected, onSelect }) {
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
        const variants = Array.isArray(raw) ? raw : [];
        const flat = [];
        for (const v of variants) {
          const batches = v.batches?.length ? v.batches : [{ id: null }];
          for (const b of batches) {
            flat.push({
              variantId: v.variantId,
              batchId: b.id,
              itemName: v.itemName,
              type: String(v.type || "unit").toLowerCase(),
              stockMode: v.stockMode || null,
            });
          }
        }
        setResults(flat.slice(0, 20));
        setOpen(flat.length > 0);
      } catch {
        setResults([]); setOpen(false);
      }
    }, 280);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="brm-item-search" ref={containerRef}>
      <input
        type="text"
        className="brm-input"
        value={query}
        placeholder="Search item by name…"
        onChange={(e) => { setQuery(e.target.value); if (selected) onSelect(null); }}
        autoComplete="off"
      />
      {selected && <span className="brm-selected-badge">✓</span>}
      {open && results.length > 0 && (
        <div className="brm-item-dropdown">
          {results.map((r, i) => (
            <div
              key={`${r.variantId}-${r.batchId ?? "x"}-${i}`}
              className="brm-item-row"
              onMouseDown={() => { onSelect(r); setQuery(r.itemName); setOpen(false); }}
            >
              <span className="brm-item-name">{r.itemName}</span>
              {r.type && <span className="brm-item-type">{r.type}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BulkRvrModal({ onClose, onDone }) {
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

  const handleCreate = async () => {
    setErr("");
    if (!invCustomer) { setErr("Select a customer for invoices."); return; }
    if (!invItem) { setErr("Select an item for invoices."); return; }
    const unitPrice = parseFloat(invUnitPrice);
    if (!invUnitPrice || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      setErr("Enter a valid unit price.");
      return;
    }
    if (!recvCustomer) { setErr("Select a customer for receivables."); return; }
    const cashNumber = parseFloat(recvCash);
    if (!recvCash || !Number.isFinite(cashNumber) || cashNumber <= 0) {
      setErr("Enter a valid cash amount.");
      return;
    }

    const qty = Math.max(1, Math.floor(Number(quantity)));
    const vatRate = 0.11;
    const vatAmount = parseFloat((unitPrice * vatRate).toFixed(2));
    const grandTotal = parseFloat((unitPrice + vatAmount).toFixed(2));
    const rate = parseFloat(String(recvExchangeRate).replace(/,/g, "")) || 89500;
    const amountExchanged =
      recvCurrency === "LL"
        ? parseFloat((cashNumber / rate).toFixed(2))
        : parseFloat((cashNumber * rate).toFixed(2));

    setCreating(true);
    const errors = [];
    let invoicesCreated = 0;
    let receivablesCreated = 0;

    for (let i = 0; i < qty; i++) {
      setProgress({ type: "invoice", current: i + 1, total: qty });
      try {
        await axiosClient.post("/invoices", {
          customerId: invCustomer.id,
          date: todayISO(),
          invoiceType: "RVR",
          documentNumber: "DOC-0001",
          currencyCode: "USD",
          totalWithoutVAT: unitPrice,
          totalVAT: vatAmount,
          grandTotal,
          currencyRate: 1,
          vatPercentage: 11,
          items: [{
            itemVariantId: invItem.variantId,
            itemBatchId: invItem.batchId,
            itemType: invItem.type || "unit",
            stockMode: invItem.stockMode || null,
            quantity: 1,
            sqm: 0,
            unitPrice,
            totalAmount: unitPrice,
            vat: vatAmount,
            length: null,
            width: null,
            sheetsPerBox: null,
          }],
        });
        invoicesCreated++;
      } catch (e) {
        errors.push(`Invoice ${i + 1}: ${e?.response?.data?.message || e.message}`);
      }
    }

    for (let i = 0; i < qty; i++) {
      setProgress({ type: "receivable", current: i + 1, total: qty });
      try {
        await axiosClient.post("/recievables", {
          customerId: recvCustomer.id,
          date: todayISO(),
          invoiceId: null,
          cashNumber,
          currency: recvCurrency,
          exchangeRate: rate,
          amountExchanged,
          comments: "",
          type: "RVR",
          pmtType: "Cash",
        });
        receivablesCreated++;
      } catch (e) {
        errors.push(`Receivable ${i + 1}: ${e?.response?.data?.message || e.message}`);
      }
    }

    setCreating(false);
    setProgress(null);
    setResult({ invoicesCreated, receivablesCreated, errors });
    if (onDone) onDone();
  };

  const canCreate = !creating && !result;

  return ReactDOM.createPortal(
    <div className="brm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !creating) onClose(); }}>
      <div className="brm-modal">
        <div className="brm-header">
          <span className="brm-title">Bulk RVR Creator</span>
          <button className="brm-close" onClick={onClose} disabled={creating}>×</button>
        </div>

        <div className="brm-body">
          {/* Quantity */}
          <div className="brm-row brm-qty-row">
            <label className="brm-label">Quantity</label>
            <input
              type="number"
              className="brm-input brm-qty-input"
              min={1}
              max={100}
              value={quantity}
              disabled={creating || !!result}
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
            <span className="brm-qty-hint">invoices + receivables will be created</span>
          </div>

          <div className="brm-sections">
            {/* ── Invoices Section ── */}
            <div className="brm-section">
              <div className="brm-section-title">Invoices</div>

              <div className="brm-row">
                <label className="brm-label">Customer</label>
                <div className="brm-customer-row">
                  <button
                    type="button"
                    className="brm-pick-btn"
                    disabled={creating || !!result}
                    onClick={() => setShowInvPicker(true)}
                  >
                    {invCustomer ? invCustomer.customerName : "Pick customer…"}
                  </button>
                  {invCustomer && (
                    <button className="brm-clear-btn" onClick={() => setInvCustomer(null)} disabled={creating || !!result}>×</button>
                  )}
                </div>
              </div>

              <div className="brm-row">
                <label className="brm-label">Item</label>
                <ItemSearchField
                  selected={invItem}
                  onSelect={setInvItem}
                />
              </div>

              <div className="brm-row">
                <label className="brm-label">Unit Price (USD)</label>
                <input
                  type="number"
                  className="brm-input brm-price-input"
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                  value={invUnitPrice}
                  disabled={creating || !!result}
                  onChange={(e) => setInvUnitPrice(e.target.value)}
                />
              </div>
            </div>

            {/* ── Receivables Section ── */}
            <div className="brm-section">
              <div className="brm-section-title">Receivables</div>

              <div className="brm-row">
                <label className="brm-label">Customer</label>
                <div className="brm-customer-row">
                  <button
                    type="button"
                    className="brm-pick-btn"
                    disabled={creating || !!result}
                    onClick={() => setShowRecvPicker(true)}
                  >
                    {recvCustomer ? recvCustomer.customerName : "Pick customer…"}
                  </button>
                  {recvCustomer && (
                    <button className="brm-clear-btn" onClick={() => setRecvCustomer(null)} disabled={creating || !!result}>×</button>
                  )}
                </div>
              </div>

              <div className="brm-row">
                <label className="brm-label">Cash Amount</label>
                <div className="brm-cash-row">
                  <input
                    type="number"
                    className="brm-input brm-cash-input"
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                    value={recvCash}
                    disabled={creating || !!result}
                    onChange={(e) => setRecvCash(e.target.value)}
                  />
                  <select
                    className="brm-select"
                    value={recvCurrency}
                    disabled={creating || !!result}
                    onChange={(e) => setRecvCurrency(e.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="LL">LL</option>
                  </select>
                </div>
              </div>

              {recvCurrency === "LL" && (
                <div className="brm-row">
                  <label className="brm-label">Exchange Rate</label>
                  <input
                    type="text"
                    className="brm-input brm-price-input"
                    value={recvExchangeRate}
                    disabled={creating || !!result}
                    onChange={(e) => setRecvExchangeRate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {err && <div className="brm-err">{err}</div>}

          {/* Progress */}
          {creating && progress && (
            <div className="brm-progress">
              Creating {progress.type} {progress.current} / {progress.total}…
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`brm-result ${result.errors.length > 0 ? "brm-result-warn" : "brm-result-ok"}`}>
              <div>✅ {result.invoicesCreated} invoice{result.invoicesCreated !== 1 ? "s" : ""} created</div>
              <div>✅ {result.receivablesCreated} receivable{result.receivablesCreated !== 1 ? "s" : ""} created</div>
              {result.errors.length > 0 && (
                <div className="brm-result-errors">
                  {result.errors.map((e, i) => <div key={i} className="brm-result-error">⚠ {e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="brm-footer">
          {!result ? (
            <>
              <button className="brm-btn brm-btn-cancel" onClick={onClose} disabled={creating}>Cancel</button>
              <button className="brm-btn brm-btn-create" onClick={handleCreate} disabled={!canCreate}>
                {creating ? "Creating…" : `Create ${quantity} × RVR`}
              </button>
            </>
          ) : (
            <button className="brm-btn brm-btn-cancel" onClick={onClose}>Close</button>
          )}
        </div>
      </div>

      {showInvPicker && (
        <CustomerSelectionModal
          onClose={() => setShowInvPicker(false)}
          onSelectCustomer={(c) => { setInvCustomer(c); setShowInvPicker(false); }}
        />
      )}

      {showRecvPicker && (
        <CustomerSelectionModal
          onClose={() => setShowRecvPicker(false)}
          onSelectCustomer={(c) => { setRecvCustomer(c); setShowRecvPicker(false); }}
        />
      )}
    </div>,
    document.body
  );
}
