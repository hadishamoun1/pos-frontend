// ✅ Updated UnitPriceModal to fetch and display data from the GET API
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/unitPriceModel.css";

const UnitPriceModal = ({ isVisible, onClose, onSave }) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (isVisible) {
      axios
        .get("http://localhost:3000/purchase-invoice-setting")
        .then((res) => {
          const mapped = res.data.map((row) => ({
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
          }));
          setRows(mapped);
        })
        .catch((err) => {
          console.error("Error loading charges", err);
        });
    }
  }, [isVisible]);

  const handleInputChange = (index, field, value) => {
    const updatedRows = [...rows];
    updatedRows[index][field] = value;
    setRows(updatedRows);
  };

  const handleCheckboxChange = (index, field) => {
    const updatedRows = [...rows];
    updatedRows[index][field] = !updatedRows[index][field];
    setRows(updatedRows);
  };

  const handleSave = () => {
    onSave(rows);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="unit-price-modal-overlay">
      <div className="unit-price-modal-content">
        <div className="modal-header">
          <h3>Unit Price Details</h3>
          <button className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="unit-price-table-container">
          <table className="unit-price-table">
            <thead>
              <tr>
                <th>Charge Name</th>
                <th>Charge Type</th>
                <th>Value</th>
                <th>Value OFR</th>
                <th>Currency</th>
                <th>Value Exch.</th>
                <th>Value Exch. OFR</th>
                <th>Add to Item Cost</th>
                <th>Invoice Nb Tax</th>
                <th>Supplier of Tax</th>
                <th>Acc. Nb of Supplier</th>
                <th>Shipping</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      value={row.chargeName}
                      onChange={(e) =>
                        handleInputChange(index, "chargeName", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={row.chargeType}
                      onChange={(e) =>
                        handleInputChange(index, "chargeType", e.target.value)
                      }
                    >
                      <option value="amount">Amount</option>
                      <option value="percent">Percent</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) =>
                        handleInputChange(index, "value", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.valueOFR}
                      onChange={(e) =>
                        handleInputChange(index, "valueOFR", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={row.currency}
                      onChange={(e) =>
                        handleInputChange(index, "currency", e.target.value)
                      }
                    >
                      <option value="usd">USD</option>
                      <option value="euro">Euro</option>
                      <option value="ll">LL</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.valueExch}
                      onChange={(e) =>
                        handleInputChange(index, "valueExch", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.valueExchOFR}
                      onChange={(e) =>
                        handleInputChange(index, "valueExchOFR", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.addToItemCost}
                      onChange={() =>
                        handleCheckboxChange(index, "addToItemCost")
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.invoiceNbTax}
                      onChange={(e) =>
                        handleInputChange(index, "invoiceNbTax", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.supplierOfTax}
                      onChange={(e) =>
                        handleInputChange(
                          index,
                          "supplierOfTax",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.accNbOfSupplier}
                      onChange={(e) =>
                        handleInputChange(
                          index,
                          "accNbOfSupplier",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.shipping}
                      onChange={() => handleCheckboxChange(index, "shipping")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-actions">
          <button className="save-button" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitPriceModal;
