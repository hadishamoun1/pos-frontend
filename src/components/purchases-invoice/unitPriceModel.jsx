// UnitPriceModal.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/unitPriceModel.css";

export default function UnitPriceModal({
  isVisible,
  onClose,
  onSave,
  isEditable,
  invoiceId, // ← new prop
}) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!isVisible) return;

    if (invoiceId) {
      // Editing an existing invoice: fetch its saved unitPriceRows
      axios
        .get(`http://localhost:3000/purchase-invoices/${invoiceId}`)
        .then((res) => {
          // assume res.data.unitPriceRows matches shape you need
          setRows(
            res.data.unitPriceRows.map((r) => ({
              chargeName: r.chargeName,
              chargeType: r.chargeType,
              value: Number(r.value),
              valueOFR: Number(r.valueOFR),
              currency: r.currency,
              valueExch: Number(r.valueExch),
              valueExchOFR: Number(r.valueExchOFR),
              addToItemCost: r.addToItemCost,
              invoiceNbTax: r.invoiceNbTax,
              supplierOfTax: "", // you can map r.supplierId → name if you like
              accNbOfSupplier: "",
              shipping: r.shipping,
            }))
          );
        })
        .catch(console.error);
    } else {
      // New invoice: load default settings
      axios
        .get("http://localhost:3000/purchase-invoice-setting")
        .then((res) => {
          setRows(
            res.data.map((row) => ({
              chargeName: row.chargeName || "",
              chargeType: row.type || "amount",
              value: row.value || 0,
              valueOFR: 0,
              currency: (row.currency || "USD").toLowerCase(),
              valueExch: row.valueEx || 0,
              valueExchOFR: 0,
              addToItemCost: row.atc || false,
              invoiceNbTax: "",
              supplierOfTax: "",
              accNbOfSupplier: "",
              shipping: row.shipping || false,
            }))
          );
        })
        .catch(console.error);
    }
  }, [isVisible, invoiceId]);

  const handleInput = (i, field, val) => {
    const copy = [...rows];
    copy[i][field] = field === "chargeType" ? val : isNaN(+val) ? val : +val;
    setRows(copy);
  };
  const handleToggle = (i, field) => {
    const copy = [...rows];
    copy[i][field] = !copy[i][field];
    setRows(copy);
  };

  const save = () => onSave(rows);

  if (!isVisible) return null;
  return (
    <div className="unit-price-modal-overlay">
      <div className="unit-price-modal-content">
        <div className="modal-header">
          <h3>Unit Price Details</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="unit-price-table-container">
          <table className="unit-price-table">
            <thead>
              <tr>
                <th>Charge Name</th>
                <th>Type</th>
                <th>Value</th>
                <th>Value OFR</th>
                <th>Currency</th>
                <th>Exch.</th>
                <th>Exch. OFR</th>
                <th>ATC</th>
                <th>Nb Tax</th>
                <th>Supplier Tax</th>
                <th>Acc. Nb</th>
                <th>Shipping</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={r.chargeName}
                      onChange={(e) =>
                        handleInput(i, "chargeName", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      disabled={!isEditable}
                      value={r.chargeType}
                      onChange={(e) =>
                        handleInput(i, "chargeType", e.target.value)
                      }
                    >
                      <option value="amount">Amount</option>
                      <option value="percent">Percent</option>
                    </select>
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.value}
                      onChange={(e) => handleInput(i, "value", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueOFR}
                      onChange={(e) =>
                        handleInput(i, "valueOFR", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      disabled={!isEditable}
                      value={r.currency}
                      onChange={(e) =>
                        handleInput(i, "currency", e.target.value)
                      }
                    >
                      <option value="usd">USD</option>
                      <option value="euro">Euro</option>
                      <option value="ll">LL</option>
                    </select>
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueExch}
                      onChange={(e) =>
                        handleInput(i, "valueExch", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueExchOFR}
                      onChange={(e) =>
                        handleInput(i, "valueExchOFR", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="checkbox"
                      checked={r.addToItemCost}
                      onChange={() => handleToggle(i, "addToItemCost")}
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={r.invoiceNbTax}
                      onChange={(e) =>
                        handleInput(i, "invoiceNbTax", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={r.supplierOfTax}
                      onChange={(e) =>
                        handleInput(i, "supplierOfTax", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={r.accNbOfSupplier}
                      onChange={(e) =>
                        handleInput(i, "accNbOfSupplier", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="checkbox"
                      checked={r.shipping}
                      onChange={() => handleToggle(i, "shipping")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-actions">
          <button className="save-button" disabled={!isEditable} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
