import React, { useState, useEffect } from "react";
import axios from "axios"; // Import axios
import "./editRecordModal.css";
import CustomerSelectionModal from "./CustomerSelectionModal";

const EditRecordModal = ({ selectedRow, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    customerName: "",
    customerAccountId: "",
    currency: "",
    exchangeRate: "",
    amountExchanged: "",
    cashNumber: "",
    date: "",
    invoiceNumber: "",
    comments: "",
  });

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  useEffect(() => {
    if (selectedRow) {
      const {
        id: receiptVoucherId,
        customer = {}, // Default to an empty object to prevent undefined errors
        date = "",
        invoiceId = "",
        details = [{}], // Default to an array with an empty object
      } = selectedRow;

      setFormData({
        receiptVoucherId,
        customerName: customer.name || "", // Ensure fallback to an empty string
        customerAccountId: customer.id || "",
        date,
        invoiceNumber: invoiceId,
        cashNumber: details[0]?.cashNumber || "",
        currency: details[0]?.currency || "",
        exchangeRate: details[0]?.exchangeRate || "",
        amountExchanged: details[0]?.amountExchanged || "",
        comments: details[0]?.comments || "",
      });
    }
  }, [selectedRow]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = () => {
    const formattedData = {
      receiptVoucherId: selectedRow.id,
      customerAccountId: formData.customerAccountId,
      customerName: formData.customerName, 
      date: formData.date,
      invoiceId: formData.invoiceNumber,
      details: [
        {
          cashNumber: formData.cashNumber,
          currency: formData.currency,
          exchangeRate: formData.exchangeRate,
          amountExchanged: formData.amountExchanged,
          comments: formData.comments,
        },
      ],
    };
    onSave(formattedData); // Pass updated data back to AccountingPage
  };

  const handleCustomerSelect = (customer) => {
    setFormData((prev) => ({
      ...prev,
      customerName: customer.customerName,
      customerAccountId: customer.id,
    }));
    setIsCustomerModalOpen(false);
  };

  return (
    <div className="edit-modal-overlay">
      <div className="edit-modal-content">
        <h2>Edit Record</h2>
        <div className="edit-form-group">
          <label>Customer Name</label>
          <input
            type="text"
            name="customerName"
            value={formData.customerName}
            readOnly
            onClick={() => setIsCustomerModalOpen(true)}
          />
        </div>
        <div className="edit-form-group">
          <label>Currency</label>
          <select
            name="currency"
            value={formData.currency}
            onChange={handleInputChange}
          >
            <option value="USD">USD</option>
            <option value="LL">LL</option>
          </select>
        </div>
        <div className="edit-form-group">
          <label>Cash Number</label>
          <input
            type="text"
            name="cashNumber"
            value={formData.cashNumber}
            onChange={handleInputChange}
          />
        </div>
        <div className="edit-form-group">
          <label>Exchange Rate</label>
          <input
            type="text"
            name="exchangeRate"
            value={formData.exchangeRate}
            onChange={handleInputChange}
            disabled={formData.currency === "USD"}
          />
        </div>
        <div className="edit-form-group">
          <label>Amount Exchanged</label>
          <input
            type="text"
            name="amountExchanged"
            value={formData.amountExchanged}
            onChange={handleInputChange}
          />
        </div>
        <div className="edit-form-group">
          <label>Date</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
          />
        </div>
        <div className="edit-form-group">
          <label>Invoice Number</label>
          <input
            type="text"
            name="invoiceNumber"
            value={formData.invoiceNumber}
            onChange={handleInputChange}
          />
        </div>
        <div className="edit-form-group">
          <label>Comments</label>
          <textarea
            name="comments"
            value={formData.comments}
            onChange={handleInputChange}
          />
        </div>
        <div className="edit-modal-actions">
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
      </div>
      {isCustomerModalOpen && (
        <CustomerSelectionModal
          onClose={() => setIsCustomerModalOpen(false)}
          onSelectCustomer={handleCustomerSelect}
        />
      )}
    </div>
  );
};

export default EditRecordModal;
