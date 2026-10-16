import React, { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./styles/table.css";
import "./styles/proformaOrderPickerModal.css";

// Same look as the main items table (reuses .items-table's styling from
// table.css — blue header row, alternating rows, same input style) so this
// reads as "the items table, with a couple of extra columns" rather than a
// brand-new unfamiliar layout. Lets the user pick which Proforma lines (and
// how much of each) go into a new order — a Proforma is often split into
// several separate orders shipped at different times, so each line shows
// how much has already been claimed by earlier orders and how much is
// actually still available.
const displayItemName = (row) => (row.thickness != null ? `${row.thickness} ملم ${row.itemName}` : row.itemName);

// SQM per one unit of quantity — taken from the proforma line itself so it
// respects whatever SQM the proforma was saved with; falls back to the same
// dims formula as ItemsTable when the line has no quantity to divide by.
const sqmPerUnit = (row) => {
  const qty = Number(row.quantity) || 0;
  if (qty > 0) return (Number(row.sqm) || 0) / qty;
  const sheets = Number(row.sheetsPerBox) || 1;
  return ((Number(row.length) || 0) * (Number(row.width) || 0) * sheets) / 10000;
};

const ProformaOrderPickerModal = ({ proformaId, onClose, onCreated }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  // rowId -> { checked, quantity, sqm }
  const [selection, setSelection] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axiosClient
      .get(`/purchase-invoices/${proformaId}/proforma-items`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data || [];
        setRows(data);
        const initial = {};
        for (const r of data) {
          initial[r.proformaItemId] = {
            checked: false,
            quantity: r.remainingQuantity,
            sqm: r.remainingSqm,
          };
        }
        setSelection(initial);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || "Failed to load proforma items.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [proformaId]);

  const updateSelection = (id, patch) => {
    setSelection((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const checkedRows = rows.filter((r) => selection[r.proformaItemId]?.checked);

  const handleSubmit = async () => {
    if (!checkedRows.length) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = checkedRows.map((r) => ({
        proformaItemId: r.proformaItemId,
        quantity: Number(selection[r.proformaItemId]?.quantity) || 0,
        sqm: Number(selection[r.proformaItemId]?.sqm) || 0,
      }));
      const res = await axiosClient.post(`/purchase-invoices/${proformaId}/create-order`, { items });
      onCreated?.(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to create the order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="proforma-picker-overlay" onClick={onClose}>
      <div className="proforma-picker" onClick={(e) => e.stopPropagation()}>
        <div className="proforma-picker-header">
          <h3>Create Order From Proforma</h3>
          <button type="button" className="proforma-picker-close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="proforma-picker-hint">
          Same items table as the invoice, with three extra columns on the right — how much of each line is already
          on an earlier order, how much is still left, and how much to put on this one. The proforma itself stays
          unchanged.
        </p>

        {loading && <div className="proforma-picker-status">Loading items…</div>}
        {!loading && error && <div className="proforma-picker-status proforma-picker-error">{error}</div>}

        {!loading && !error && (
          <>
            {rows.length === 0 ? (
              <div className="proforma-picker-status">This proforma has no items.</div>
            ) : (
              <div className="items-table proforma-picker-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Item Name</th>
                      <th>Type</th>
                      <th>Origin</th>
                      <th>Length</th>
                      <th>Width</th>
                      <th>SQM</th>
                      <th>SQM OFR</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                      <th className="proforma-picker-col-divider">Ordered</th>
                      <th>Remaining</th>
                      <th>Order Qty</th>
                      <th>Order SQM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const sel = selection[r.proformaItemId] || {};
                      const fullyClaimed = r.remainingQuantity <= 0 && r.remainingSqm <= 0;
                      return (
                        <tr key={r.proformaItemId} className={fullyClaimed ? "proforma-picker-row-done" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!sel.checked}
                              disabled={fullyClaimed}
                              onChange={(e) => updateSelection(r.proformaItemId, { checked: e.target.checked })}
                            />
                          </td>
                          <td style={{ direction: "rtl", textAlign: "right" }}>{displayItemName(r)}</td>
                          <td>{r.type}</td>
                          <td>{r.origin}</td>
                          <td>{r.length}</td>
                          <td>{r.width}</td>
                          <td>{r.sqm}</td>
                          <td>{r.sqmOfr}</td>
                          <td>{r.unitPrice}</td>
                          <td>{r.totalAmount}</td>
                          <td className="proforma-picker-col-divider">{r.orderedQuantity}</td>
                          <td className={fullyClaimed ? "proforma-picker-remaining-zero" : "proforma-picker-remaining"}>
                            {r.remainingQuantity}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={!sel.checked}
                              value={sel.quantity ?? 0}
                              onChange={(e) => {
                                const quantity = e.target.value;
                                const sqm = Number(((Number(quantity) || 0) * sqmPerUnit(r)).toFixed(2));
                                updateSelection(r.proformaItemId, { quantity, sqm });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={!sel.checked}
                              value={sel.sqm ?? 0}
                              onChange={(e) => updateSelection(r.proformaItemId, { sqm: e.target.value })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="proforma-picker-actions">
          <button type="button" className="proforma-picker-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="proforma-picker-confirm"
            disabled={submitting || checkedRows.length === 0}
            onClick={handleSubmit}
          >
            {submitting ? "Creating…" : `Create Order (${checkedRows.length} item${checkedRows.length === 1 ? "" : "s"})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProformaOrderPickerModal;
