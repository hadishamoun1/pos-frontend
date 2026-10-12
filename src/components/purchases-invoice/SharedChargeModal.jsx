import React, { useMemo, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./styles/sharedChargeModal.css";

const fmt2 = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
};

// Splits one cost (typically customs clearance) across two or more invoices
// that share it — e.g. separate orders that arrived on the same vessel and
// were cleared through customs together. Split "by value", proportional to
// each invoice's grand amount, matching how the existing cost formulas
// already spread shipping/charges across items within one invoice.
export default function SharedChargeModal({ isOpen, onClose, invoices, onCreated }) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [addToItemCost, setAddToItemCost] = useState(true);
  const [shipping, setShipping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = invoices || [];
    if (!q) return list;
    return list.filter((inv) => {
      const num = String(inv.invoiceNumber || inv.orderNumber || inv.proformaNumber || "").toLowerCase();
      const supplier = String(inv.supplier?.supplierName || "").toLowerCase();
      return num.includes(q) || supplier.includes(q);
    });
  }, [invoices, search]);

  const selectedInvoices = useMemo(
    () => (invoices || []).filter((inv) => selectedIds.has(inv.id)),
    [invoices, selectedIds]
  );

  const totalWeight = useMemo(
    () => selectedInvoices.reduce((sum, inv) => sum + Number(inv.grandAmount || 0), 0),
    [selectedInvoices]
  );

  const previewRows = useMemo(() => {
    const total = Number(totalAmount) || 0;
    if (!selectedInvoices.length || totalWeight <= 0) return [];
    return selectedInvoices.map((inv) => {
      const weight = Number(inv.grandAmount || 0);
      const pct = weight / totalWeight;
      return {
        id: inv.id,
        label: inv.invoiceNumber || inv.orderNumber || inv.proformaNumber || `#${inv.id}`,
        supplier: inv.supplier?.supplierName || "",
        grandAmount: weight,
        pct,
        allocated: total * pct,
      };
    });
  }, [selectedInvoices, totalWeight, totalAmount]);

  const toggleInvoice = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setSearch("");
    setSelectedIds(new Set());
    setDescription("");
    setTotalAmount("");
    setCurrency("usd");
    setAddToItemCost(true);
    setShipping(false);
    setErr("");
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const handleSubmit = async () => {
    setErr("");
    if (selectedIds.size < 2) {
      setErr("Select at least two invoices to split this charge across.");
      return;
    }
    if (!description.trim()) {
      setErr("Enter a description for this charge.");
      return;
    }
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      setErr("Enter a valid total amount.");
      return;
    }
    if (totalWeight <= 0) {
      setErr("Selected invoices have no value to split proportionally by.");
      return;
    }

    setSaving(true);
    try {
      const res = await axiosClient.post("/purchase-invoices/shared-charges", {
        description: description.trim(),
        totalAmount: total,
        currency: currency.toUpperCase(),
        invoiceIds: Array.from(selectedIds),
        addToItemCost,
        shipping,
      });
      onCreated?.(res.data, Array.from(selectedIds));
      resetForm();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to create the shared charge.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="scm-overlay" onClick={handleClose}>
      <div className="scm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scm-header">
          <h2>Split Shared Charge</h2>
          <button className="scm-close" onClick={handleClose} disabled={saving}>✕</button>
        </div>

        <p className="scm-hint">
          For one cost (e.g. customs clearance) that covers two or more invoices — split proportionally by each
          invoice's grand amount, and written as a normal charge row on each.
        </p>

        <div className="scm-body">
          <div className="scm-left">
            <input
              type="text"
              className="scm-search"
              placeholder="Search by invoice/order/proforma number or supplier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="scm-invoice-list">
              {filteredInvoices.length === 0 ? (
                <div className="scm-empty">No invoices match.</div>
              ) : (
                filteredInvoices.map((inv) => (
                  <label key={inv.id} className="scm-invoice-row">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inv.id)}
                      onChange={() => toggleInvoice(inv.id)}
                    />
                    <span className="scm-invoice-number">
                      {inv.invoiceNumber || inv.orderNumber || inv.proformaNumber || `#${inv.id}`}
                    </span>
                    <span className="scm-invoice-supplier">{inv.supplier?.supplierName || ""}</span>
                    <span className="scm-invoice-amount">${fmt2(inv.grandAmount)}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="scm-right">
            <label className="scm-field">
              Description
              <input
                type="text"
                placeholder="e.g. Customs clearance — Beirut port, Sep 2026"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="scm-field-row">
              <label className="scm-field">
                Total Amount
                <input
                  type="number"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                />
              </label>
              <label className="scm-field">
                Currency
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="usd">USD</option>
                  <option value="euro">Euro</option>
                  <option value="ll">LL</option>
                </select>
              </label>
            </div>

            <div className="scm-field-row">
              <label className="scm-chk">
                <input type="checkbox" checked={addToItemCost} onChange={(e) => setAddToItemCost(e.target.checked)} />
                Add to Item Cost
              </label>
              <label className="scm-chk">
                <input type="checkbox" checked={shipping} onChange={(e) => setShipping(e.target.checked)} />
                Shipping
              </label>
            </div>

            <div className="scm-preview">
              <div className="scm-preview-title">Preview split</div>
              {previewRows.length === 0 ? (
                <div className="scm-empty">Select invoices and enter a total to preview the split.</div>
              ) : (
                <table className="scm-preview-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th className="num">Grand Amount</th>
                      <th className="num">Share</th>
                      <th className="num">Allocated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.label}</td>
                        <td className="num">${fmt2(r.grandAmount)}</td>
                        <td className="num">{(r.pct * 100).toFixed(1)}%</td>
                        <td className="num">${fmt2(r.allocated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {err && <div className="scm-error">{err}</div>}
          </div>
        </div>

        <div className="scm-footer">
          <button className="scm-btn scm-btn--ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button className="scm-btn scm-btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Splitting…" : "Split Charge"}
          </button>
        </div>
      </div>
    </div>
  );
}
