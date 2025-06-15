// src/recievables/EditRecordModal.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./editRecordModal.css";
import CustomerSelectionModal from "./CustomerSelectionModal";

const EditRecordModal = ({ selectedRow, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    receiptVoucherId: "",
    customerName: "",
    customerAccountId: "",
    date: "",
    invoiceId: "", // ref invoice
    type: "", // G | S | RVR
    pmtType: "", // Cash | Check
    currency: "",
    exchangeRate: "",
    cashNumber: "",
    amountExchanged: "",
    comments: "",
  });
  console.log(formData);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  const stripCommas = (s) => (s ? s.replace(/,/g, "") : "");
  const formatCommas = (n) =>
    n != null && !isNaN(n) ? Number(n).toLocaleString("en-US") : "";

  useEffect(() => {
    if (!selectedRow) return;

    // ① Log out the raw selectedRow so you can see exactly what arrived
    console.log("🔍 selectedRow payload:", selectedRow);

    const {
      id,
      customer = {},
      date = "",
      invoiceId = "",
      type = "",
      details = [{}],
    } = selectedRow;
    const d0 = details[0] || {};

    // build the new formData object
    const newForm = {
      receiptVoucherId: id,
      customerName: customer.name || "",
      customerAccountId: customer.id || "",
      date,
      invoiceId,
      type,
      pmtType: d0.pmtType || "",
      currency: d0.currency || "",
      cashNumber: formatCommas(d0.cashNumber),
      exchangeRate: formatCommas(d0.exchangeRate),
      amountExchanged: formatCommas(d0.amountExchanged),
      comments: d0.comments || "",
    };

    // ② Log out the object you're about to set into state
    console.log("📝 initializing formData:", newForm);

    setFormData(newForm);
  }, [selectedRow]);
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let upd = { ...prev, [name]: value };

      // whenever cash/exchange/currency change, recompute amountExchanged
      if (["cashNumber", "exchangeRate", "currency"].includes(name)) {
        const cash = parseFloat(stripCommas(upd.cashNumber)) || 0;
        const rate = parseFloat(stripCommas(upd.exchangeRate)) || 0;
        if (upd.currency === "LL" && rate) {
          upd.amountExchanged = formatCommas((cash / rate).toFixed(2));
        } else if (upd.currency === "USD") {
          // USD→LL: just echo cash
          upd.amountExchanged = formatCommas(cash * rate);
        }
      }

      return upd;
    });
  };

  const handleSave = async () => {
    try {
      const {
        receiptVoucherId,
        customerAccountId,
        date,
        invoiceId,
        type,
        pmtType,
        cashNumber,
        currency,
        exchangeRate,
        amountExchanged,
        comments,
      } = formData;

      const payload = {
        customerId: Number(customerAccountId),
        date,
        invoiceId,
        cashNumber: Number(stripCommas(cashNumber)),
        currency,
        exchangeRate: exchangeRate
          ? Number(stripCommas(exchangeRate))
          : undefined,
        amountExchanged: Number(stripCommas(amountExchanged)),
        comments,
        type,
        pmtType,
      };

      const res = await axios.put(
        `${baseUrl}/recievables/${receiptVoucherId}`,
        payload
      );

      onSave(res.data);
      onClose();
    } catch (err) {
      console.error("Update failed:", err);
      alert(
        err.response?.data?.message ||
          "Failed to update. Please check your inputs."
      );
    }
  };

  const handleCustomerSelect = (c) => {
    setFormData((prev) => ({
      ...prev,
      customerName: c.customerName,
      customerAccountId: c.id,
    }));
    setIsCustomerModalOpen(false);
  };

  return (
    <div className="edit-modal-overlay">
      <div className="edit-modal-content">
        <h2>Edit Record</h2>
        <table className="edit-modal-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Ref Invoice</th>
              <th>Type</th>
              <th>PMT Type</th>
              <th>Currency</th>
              <th>Cash Number</th>
              <th>Exchange Rate</th>
              <th>Amount EX</th>
              <th>Date</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  readOnly
                  onClick={() => setIsCustomerModalOpen(true)}
                />
              </td>
              <td>
                <input
                  type="text"
                  name="invoiceId"
                  value={formData.invoiceId}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  disabled
                >
                  <option value="">Select Type</option>
                  <option value="G">G</option>
                  <option value="S">S</option>
                  <option value="RVR">RVR</option>
                </select>
              </td>
              <td>
                <select
                  name="pmtType"
                  value={formData.pmtType}
                  onChange={handleInputChange}
                  disabled
                >
                  <option value="">Select PMT</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                </select>
              </td>
              <td>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                >
                  <option value="">Select</option>
                  <option value="USD">USD</option>
                  <option value="LL">LL</option>
                </select>
              </td>
              <td>
                <input
                  type="text"
                  name="cashNumber"
                  value={formData.cashNumber}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <input
                  type="text"
                  name="exchangeRate"
                  value={formData.exchangeRate}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <input
                  type="text"
                  name="amountExchanged"
                  value={formData.amountExchanged}
                  readOnly
                />
              </td>
              <td>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <input
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="edit-modal-footer">
          <button
            className="edit-modal-action-button edit-modal-cancel-button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="edit-modal-action-button edit-modal-save-button"
            onClick={handleSave}
          >
            Update
          </button>
        </div>

        {isCustomerModalOpen && (
          <CustomerSelectionModal
            onClose={() => setIsCustomerModalOpen(false)}
            onSelectCustomer={handleCustomerSelect}
          />
        )}
      </div>
    </div>
  );
};

export default EditRecordModal;
