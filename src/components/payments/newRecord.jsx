import React, { useState } from "react";
import CustomerSelectionModal from "./CustomerSelectionModal";
import "./newRecord.css";

const NewRecordModal = ({ onClose, onSave }) => {
  const [rows, setRows] = useState([]);
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);

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
      prevRows.map((row, i) => {
        if (i !== index) return row;

        // Parse numeric fields for calculations
        const numericValue = isNaN(parseFloat(value)) ? 0 : parseFloat(value);
        const updatedRow = { ...row, [field]: value };

        // Handle specific logic for currency selection
        if (field === "currency") {
          if (value === "USD") {
            updatedRow.exchangeRate = ""; // Clear exchange rate for USD
            updatedRow.amountExchanged = updatedRow.cashNumber || ""; // Set amountExchanged = cashNumber
          } else if (value === "LL") {
            // Recalculate amountExchanged if both cashNumber and exchangeRate exist
            if (row.cashNumber && row.exchangeRate) {
              updatedRow.amountExchanged = (
                parseFloat(row.cashNumber) / parseFloat(row.exchangeRate)
              ).toFixed(2);
            }
          }
        }

        // Update amountExchanged or exchangeRate based on changes to cashNumber
        if (field === "cashNumber") {
          if (row.currency === "LL" && row.exchangeRate) {
            updatedRow.amountExchanged = (
              numericValue / parseFloat(row.exchangeRate)
            ).toFixed(2);
          } else if (row.currency === "USD") {
            updatedRow.amountExchanged = numericValue.toFixed(2); // Directly set amountExchanged for USD
          }
        }

        // Update amountExchanged when exchangeRate changes for LL
        if (field === "exchangeRate" && row.currency === "LL") {
          if (row.cashNumber) {
            updatedRow.amountExchanged = (
              parseFloat(row.cashNumber) / numericValue
            ).toFixed(2);
          }
        }

        // Update exchangeRate when amountExchanged changes for LL
        if (field === "amountExchanged" && row.currency === "LL") {
          if (row.cashNumber) {
            updatedRow.exchangeRate = (
              parseFloat(row.cashNumber) / numericValue
            ).toFixed(2);
          }
        }

        return updatedRow;
      })
    );
  };

  const handleSave = () => {
    console.log("Rows Data:", rows);
    onSave(rows);
    onClose();
  };

  const handleCustomerSelect = (customerName) => {
    setRows((prevRows) =>
      prevRows.map((row, i) =>
        i === currentRowIndex ? { ...row, customerName } : row
      )
    );
    setCustomerModalOpen(false);
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
              <th>Cash Number</th>
              <th>Exchange Rate</th>
              <th>Amount Exchanged</th>
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
                    onClick={() => {
                      setCustomerModalOpen(true);
                      setCurrentRowIndex(index);
                    }}
                    placeholder="Select Customer"
                    readOnly
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
                    value={row.cashNumber}
                    onChange={(e) =>
                      handleInputChange(index, "cashNumber", e.target.value)
                    }
                    placeholder="Cash Number"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.exchangeRate}
                    onChange={(e) =>
                      handleInputChange(index, "exchangeRate", e.target.value)
                    }
                    placeholder="Ex Rate"
                    disabled={row.currency === "USD"} // Disable if currency is USD
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
      {isCustomerModalOpen && (
        <CustomerSelectionModal
          onClose={() => setCustomerModalOpen(false)}
          onSelectCustomer={handleCustomerSelect}
        />
      )}
    </div>
  );
};

export default NewRecordModal;
