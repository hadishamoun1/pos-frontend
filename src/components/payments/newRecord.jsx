import React, { useState } from "react";
import "./newRecord.css";

const NewRecordModal = ({ onClose, onSave }) => {
  const [rows, setRows] = useState([]);

  const handleAddRow = () => {
    const newRow = {
      customerName: "",
      currency: "",
      exchangeRate: "",
      amountExchanged: "",
      cashNumber: "",
      date: "",
      invoiceNumber: "",
      comments: "",
    };
    setRows((prevRows) => [...prevRows, newRow]);
  };

  const handleInputChange = (index, field, value) => {
    setRows((prevRows) =>
      prevRows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSave = () => {
    console.log("Rows Data:", rows);
    onSave(rows);
    onClose();
  };

  return (
    <div className="payments-modal-overlay">
      <div className="payments-modal-content">
        <div className="payments-modal-header">
          <h2>New Record</h2>
          <div className="payments-modal-header-buttons">
            <button
              type="button"
              className="payments-modal-action-button payments-modal-cancel-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="payments-modal-action-button payments-modal-save-button"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
        <table className="payments-modal-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Currency</th>
              <th>Exchange Rate</th>
              <th>Amount Exchanged</th>
              <th>Cash Number</th>
              <th>Date</th>
              <th>Invoice Number</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={row.customerName}
                    onChange={(e) =>
                      handleInputChange(index, "customerName", e.target.value)
                    }
                    placeholder="Customer Name"
                  />
                </td>
                <td>
                  <select
                    value={row.currency}
                    onChange={(e) =>
                      handleInputChange(index, "currency", e.target.value)
                    }
                  >
                    <option value="">Select</option>
                    <option value="USD">USD</option>
                    <option value="LL">LL</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={row.exchangeRate}
                    onChange={(e) =>
                      handleInputChange(index, "exchangeRate", e.target.value)
                    }
                    placeholder="Exchange Rate"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.amountExchanged}
                    onChange={(e) =>
                      handleInputChange(
                        index,
                        "amountExchanged",
                        e.target.value
                      )
                    }
                    placeholder="Amount Exchanged"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.cashNumber}
                    onChange={(e) =>
                      handleInputChange(index, "cashNumber", e.target.value)
                    }
                    placeholder="Cash Number"
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) =>
                      handleInputChange(index, "date", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.invoiceNumber}
                    onChange={(e) =>
                      handleInputChange(index, "invoiceNumber", e.target.value)
                    }
                    placeholder="Invoice Number"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.comments}
                    onChange={(e) =>
                      handleInputChange(index, "comments", e.target.value)
                    }
                    placeholder="Comments"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="payments-modal-footer">
          <button
            type="button"
            className="payments-modal-action-button"
            onClick={handleAddRow}
          >
            Add Row
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewRecordModal;
