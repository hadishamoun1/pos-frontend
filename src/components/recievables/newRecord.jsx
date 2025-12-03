// src/receipt-voucher/NewRecordModal.jsx
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

  // ✅ prevents double save
  const [saving, setSaving] = useState(false);

  const formatNumberWithCommas = (number) => {
    if (number === "" || number === null || number === undefined) return "";
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleAddRow = () => {
    if (saving) return;
    setRows((prev) => [
      ...prev,
      {
        customerId: "",
        customerName: "",
        type: "S", // default JV Type
        pmtType: "", // Payment Type
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
    if (saving) return;

    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };

        // whenever cashNumber / exchangeRate / currency changes, recalc amountExchanged:
        if (["cashNumber", "exchangeRate", "currency"].includes(field)) {
          const cash = parseFloat((updated.cashNumber || "").replace(/,/g, "")) || 0;
          const rate = parseFloat((updated.exchangeRate || "").replace(/,/g, "")) || 0;

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
          } else {
            updated.amountExchanged = "";
          }
        }

        return updated;
      })
    );
  };

  const handleCustomerSelect = (customer) => {
    if (saving) return;

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
    if (saving) return; // ✅ guard
    setSaving(true);

    try {
      if (!rows.length) throw new Error("Add at least one row.");

      const baseUrl = process.env.REACT_APP_API_BASE_URL;
      const created = [];

      for (const r of rows) {
        // basic validations
        if (!r.customerId) throw new Error("Customer is required.");
        if (!r.type) throw new Error("JV Type is required.");
        if (!r.pmtType) throw new Error("Payment Type is required.");
        if (!r.currency) throw new Error("Currency is required.");
        if (!r.cashNumber) throw new Error("Cash number is required.");

        if (r.currency === "LL" && !r.exchangeRate)
          throw new Error("Exchange rate is required for LL.");

        if (!r.amountExchanged)
          throw new Error("Amount exchanged is required.");

        if (!r.date) throw new Error("Date is required.");

        const cashNumber = parseFloat((r.cashNumber || "").replace(/,/g, ""));
        if (!Number.isFinite(cashNumber)) throw new Error("Invalid cash number.");

        const exchangeRateRaw = (r.exchangeRate || "").replace(/,/g, "");
        const exchangeRate =
          exchangeRateRaw === "" ? null : parseFloat(exchangeRateRaw);

        // if your backend expects exchangeRate always, keep it; otherwise allow null
        if (r.currency === "LL" && !Number.isFinite(exchangeRate)) {
          throw new Error("Invalid exchange rate.");
        }

        const amountExchanged = parseFloat(
          (r.amountExchanged || "").replace(/,/g, "")
        );
        if (!Number.isFinite(amountExchanged))
          throw new Error("Invalid amount exchanged.");

        const payload = {
          customerId: r.customerId,
          date: r.date,
          invoiceId: (r.invoiceNumber || "").trim() || null,
          cashNumber,
          currency: r.currency,
          exchangeRate: exchangeRate ?? null,
          amountExchanged,
          comments: r.comments,
          type: r.type,
          pmtType: r.pmtType,
        };

        const resp = await axios.post(`${baseUrl}/recievables`, payload);
        created.push(resp.data);
      }

      setNotification({ type: "success", message: "Saved successfully!" });
      setCloseAfterNotification(true);

      // pass newly created entries back to parent
      onSave(created);
    } catch (e) {
      setNotification({
        type: "error",
        message: e.response?.data?.message || e.message,
      });
    } finally {
      setSaving(false); // ✅ release lock
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
              disabled={saving}
            >
              Cancel
            </button>

            <button
              className="payments-modal-action-button payments-modal-save-button"
              onClick={handleSave}
              disabled={saving || rows.length === 0}
              title={rows.length === 0 ? "Add at least one row" : undefined}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <table className="payments-modal-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Type</th>
              <th>Pmt Type</th>
              <th>Currency</th>
              <th>Cash Number</th>
              <th>Exchange Rate</th>
              <th>Amount Ex</th>
              <th>Date</th>
              <th>Invoice #</th>
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
                    disabled={saving}
                    onClick={() => {
                      if (saving) return;
                      setCurrentRowIndex(idx);
                      setCustomerModalOpen(true);
                    }}
                  />
                </td>

                <td>
                  <select
                    value={row.type}
                    disabled={saving}
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
                    value={row.pmtType}
                    disabled={saving}
                    onChange={(e) =>
                      handleInputChange(idx, "pmtType", e.target.value)
                    }
                  >
                    <option value="">Select</option>
                    <option value="Cash">Cash</option>
                    <option value="Check">Check</option>
                  </select>
                </td>

                <td>
                  <select
                    value={row.currency}
                    disabled={saving}
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
                    disabled={saving}
                    onChange={(e) =>
                      handleInputChange(idx, "cashNumber", e.target.value)
                    }
                  />
                </td>

                <td>
                  <input
                    type="text"
                    value={row.exchangeRate}
                    disabled={saving}
                    onChange={(e) =>
                      handleInputChange(idx, "exchangeRate", e.target.value)
                    }
                  />
                </td>

                <td>
                  <input
                    type="text"
                    value={row.amountExchanged}
                    readOnly
                    disabled={saving}
                  />
                </td>

                <td>
                  <input
                    type="date"
                    value={row.date}
                    disabled={saving}
                    onChange={(e) =>
                      handleInputChange(idx, "date", e.target.value)
                    }
                  />
                </td>

                <td>
                  <input
                    type="text"
                    value={row.invoiceNumber}
                    disabled={saving}
                    onChange={(e) =>
                      handleInputChange(idx, "invoiceNumber", e.target.value)
                    }
                  />
                </td>

                <td>
                  <input
                    type="text"
                    value={row.comments}
                    disabled={saving}
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
            disabled={saving}
          >
            Add Row
          </button>
        </div>
      </div>

      {isCustomerModalOpen && !saving && (
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
