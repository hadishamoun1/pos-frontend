import React, { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";

const customerLabel = (c, fallback) =>
  c ? c.name || c.customerName || c.fullName || fallback : fallback;

// Edits one cash collection that hasn't been created as a receivable yet.
// The backend refuses created (green) ones as well.
export default function EditCollectionModal({ row, currencies, onClose, onSaved }) {
  const [date, setDate] = useState(row.date || "");
  const [customerId, setCustomerId] = useState(row.customerId);
  const [customerText, setCustomerText] = useState(customerLabel(row.customer, `#${row.customerId}`));
  const [suggestions, setSuggestions] = useState([]);
  const [amount, setAmount] = useState(String(Number(row.amount) || ""));
  const [currencyId, setCurrencyId] = useState(row.currencyId ?? "");
  const [method, setMethod] = useState(row.method || "CASH");
  const [driverName, setDriverName] = useState(row.driverName || "");
  const [reference, setReference] = useState(row.reference || "");
  const [notes, setNotes] = useState(row.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Customer search, same endpoint as the Add Collection form.
  useEffect(() => {
    const q = customerText.trim();
    if (customerId || q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await axiosClient.get(`/customers/v1/search`, { params: { query: q } });
        setSuggestions(Array.isArray(data) ? data : data?.rows || []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customerText, customerId]);

  const save = async () => {
    setError("");
    if (!customerId) return setError("Please pick a customer from the list.");
    if (!(Number(amount) > 0)) return setError("Amount must be more than 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Date must be YYYY-MM-DD.");

    setSaving(true);
    try {
      await axiosClient.patch(`/cash-collections/${row.id}`, {
        date,
        customerId,
        amount: Number(amount),
        currencyId: currencyId === "" ? null : Number(currencyId),
        method,
        driverName,
        reference,
        notes,
      });
      onSaved();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cc-edit-overlay" onClick={onClose}>
      <div className="cc-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cc-edit-head">
          <div className="cc-card-title">Edit Collection #{row.id}</div>
          <button type="button" className="cc-edit-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="cc-edit-grid">
          <label className="cc-field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="cc-field cc-edit-customer">
            <span>Customer</span>
            <input
              dir="auto"
              value={customerText}
              onChange={(e) => {
                setCustomerText(e.target.value);
                setCustomerId(null);
              }}
              placeholder="Type at least 2 letters…"
            />
            {suggestions.length > 0 && (
              <div className="cc-edit-suggest">
                {suggestions.slice(0, 12).map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    dir="auto"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerText(customerLabel(c, `#${c.id}`));
                      setSuggestions([]);
                    }}
                  >
                    {customerLabel(c, `#${c.id}`)}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="cc-field">
            <span>Amount</span>
            <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>

          <label className="cc-field">
            <span>Currency</span>
            <select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
              <option value="">—</option>
              {(currencies || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.currencyCode}
                </option>
              ))}
            </select>
          </label>

          <label className="cc-field">
            <span>Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">CASH</option>
              <option value="WHISH">WHISH</option>
              <option value="CHEQUE">CHEQUE</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>

          <label className="cc-field">
            <span>الشوفير</span>
            <input dir="auto" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </label>

          <label className="cc-field">
            <span>Reference</span>
            <input dir="auto" value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>

          <label className="cc-field cc-edit-wide">
            <span>Notes</span>
            <input dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        {error && <div className="cc-edit-error">{error}</div>}

        <div className="cc-edit-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
