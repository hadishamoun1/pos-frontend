import React, { useState } from "react";
import axios from "axios";
import CustomerSelectionModal from "./CustomerSelectionModal";
import "./newRecord.css";
import NotificationModal from "./NotificationModal";

const NewRecordModal = ({ onClose, onSave }) => {
  const [rows, setRows] = useState([]);
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const [notification, setNotification] = useState(null);
  const [closeAfterNotification, setCloseAfterNotification] = useState(false);

  const formatNumberWithCommas = (number) => {
    if (number === "" || number === null) return "";
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        customerId: "",
        customerName: "",
        type: "S", // ← default Type
        currency: "",
        exchangeRate: "",
        cashNumber: "",
        amountExchanged: "",
        date: "",
        invoiceNumber: "",
        comments: "",
      },
    ]);
  };

  const handleInputChange = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };

        // recalc amountExchanged whenever cashNumber / exchangeRate / currency changes
        if (["cashNumber", "exchangeRate", "currency"].includes(field)) {
          const cash = parseFloat(updated.cashNumber.replace(/,/g, "")) || 0;
          const rate = parseFloat(updated.exchangeRate.replace(/,/g, "")) || 0;
          if (updated.currency === "LL" && rate) {
            // LL → USD
            updated.amountExchanged = formatNumberWithCommas(
              (cash / rate).toFixed(2)
            );
          } else if (updated.currency === "USD" && rate) {
            // USD → LL
            updated.amountExchanged = formatNumberWithCommas(
              (cash * rate).toFixed(2)
            );
          }
        }

        return updated;
      })
    );
  };

  const handleCustomerSelect = (customer) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === currentRowIndex
          ? {
              ...row,
              customerId: customer.id,
              customerName: customer.customerName,
            }
          : row
      )
    );
    setCustomerModalOpen(false);
  };

  const handleSave = async () => {
    try {
      if (!rows.length) throw new Error("Add at least one row.");

      const baseUrl = process.env.REACT_APP_API_BASE_URL;
      const created = [];

      for (const r of rows) {
        // validations
        if (!r.customerId) throw new Error("Customer is required.");
        if (!r.type) throw new Error("Type is required.");
        if (!r.currency) throw new Error("Currency is required.");
        if (!r.cashNumber) throw new Error("Cash number is required.");
        if (r.currency === "LL" && !r.exchangeRate)
          throw new Error("Exchange rate is required for LL.");
        if (!r.amountExchanged) throw new Error("Amount exchanged required.");
        if (!r.date) throw new Error("Date is required.");
        if (!r.invoiceNumber) throw new Error("Invoice # is required.");

        const payload = {
          customerId: r.customerId,
          date: r.date,
          invoiceId: r.invoiceNumber,
          cashNumber: parseFloat(r.cashNumber.replace(/,/g, "")),
          currency: r.currency,
          exchangeRate: parseFloat(r.exchangeRate.replace(/,/g, "")),
          amountExchanged: parseFloat(r.amountExchanged.replace(/,/g, "")),
          comments: r.comments,
          type: r.type,
        };

        const resp = await axios.post(`${baseUrl}/recievables`, payload);
        created.push(resp.data);
      }

      setNotification({ type: "success", message: "Saved successfully!" });
      setCloseAfterNotification(true);

      // inform parent of new entries
      onSave(created);
    } catch (e) {
      setNotification({
        type: "error",
        message: e.response?.data?.message || e.message,
      });
    }
  };

  const handleNotificationClose = () => {
    setNotification(null);
    if (closeAfterNotification) onClose();
  };

  return (
    <div className="payments-modal-overlay">
      <div className="payments-modal-content">
        <div className="payments-modal-header">
          <h2>New Record</h2>
          <div className="payments-modal-header-buttons">
            <button
              className="payments-modal-action-button payments-modal-cancel-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
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
              <th>Type</th>
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
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    value={row.customerName}
                    readOnly
                    onClick={() => {
                      setCurrentRowIndex(idx);
                      setCustomerModalOpen(true);
                    }}
                  />
                </td>
                <td>
                  <select
                    value={row.type}
                    onChange={(e) =>
                      handleInputChange(idx, "type", e.target.value)
                    }
                  >
                    <option value="G">G</option>
                    <option value="S">S</option>
                    <option value="RVR">RVR</option>
                  </select>
                </td>
                <td>
                  <select
                    value={row.currency}
                    onChange={(e) =>
                      handleInputChange(idx, "currency", e.target.value)
                    }
                  >
                    <option value="">Select</option>
                    <option value="USD">USD</option>
                    <option value="LL">LL</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={row.cashNumber}
                    onChange={(e) =>
                      handleInputChange(idx, "cashNumber", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.exchangeRate}
                    onChange={(e) =>
                      handleInputChange(idx, "exchangeRate", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input type="text" value={row.amountExchanged} readOnly />
                </td>
                <td>
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) =>
                      handleInputChange(idx, "date", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.invoiceNumber}
                    onChange={(e) =>
                      handleInputChange(idx, "invoiceNumber", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.comments}
                    onChange={(e) =>
                      handleInputChange(idx, "comments", e.target.value)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="payments-modal-footer">
          <button
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
      {notification && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={handleNotificationClose}
        />
      )}
    </div>
  );
};

export default NewRecordModal;
