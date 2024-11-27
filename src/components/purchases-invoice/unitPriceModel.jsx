import React, { useState } from "react";
import "./styles/unitPriceModel.css";

const UnitPriceModal = ({ isVisible, onClose, onSave }) => {
  const [rows, setRows] = useState([
    {
      chargeName: "",
      chargeType: "amount", // default value
      value: 0,
      valueOFR: 0,
      currency: "USD", // default value
      valueExch: 0,
      valueExchOFR: 0,
      addToItemCost: false,
      invoiceNbTax: "",
      supplierOfTax: "",
      accNbOfSupplier: "",
      shipping: false,
    },
  ]);

  const addRow = () => {
    setRows([
      ...rows,
      {
        chargeName: "",
        chargeType: "amount",
        value: 0,
        valueOFR: 0,
        currency: "USD",
        valueExch: 0,
        valueExchOFR: 0,
        addToItemCost: false,
        invoiceNbTax: "",
        supplierOfTax: "",
        accNbOfSupplier: "",
        shipping: false,
      },
    ]);
  };

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
    onSave(rows); // Pass rows data back to parent
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
                    placeholder="Enter charge name"
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
                    <option value="euro">Euro</option>
                    <option value="usd">USD</option>
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
                      handleInputChange(index, "supplierOfTax", e.target.value)
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
        <div className="table-actions">
          <button className="add-row-button" onClick={addRow}>
            Add Row
          </button>
          <button className="save-button" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitPriceModal;
