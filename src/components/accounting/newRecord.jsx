import React from "react";
import "./newRecord.css";

const NewRecordModal = ({ formData, setFormData, onClose, onSave }) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>New Record</h2>
        <form>
          <input
            type="text"
            name="customerName"
            value={formData.customerName}
            onChange={handleInputChange}
            placeholder="Customer Name"
          />
          <input
            type="text"
            name="currency"
            value={formData.currency}
            onChange={handleInputChange}
            placeholder="Currency"
          />
          <input
            type="text"
            name="exchangeRate"
            value={formData.exchangeRate}
            onChange={handleInputChange}
            placeholder="Exchange Rate"
          />
          <input
            type="text"
            name="amountExchanged" // New input for Amount Exchanged
            value={formData.amountExchanged}
            onChange={handleInputChange}
            placeholder="Amount Exchanged"
          />
          <input
            type="text"
            name="cashNumber"
            value={formData.cashNumber}
            onChange={handleInputChange}
            placeholder="Cash Number"
          />
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
          />
          <input
            type="text"
            name="invoiceNumber"
            value={formData.invoiceNumber}
            onChange={handleInputChange}
            placeholder="Invoice Number"
          />
          <input
            type="text"
            name="comments"
            value={formData.comments}
            onChange={handleInputChange}
            placeholder="Comments"
          />
          <input
            type="text"
            name="rct"
            value={formData.rct}
            onChange={handleInputChange}
            placeholder="RCT"
          />
        </form>
        <div className="modal-buttons">
          <button className="action-button" onClick={onSave}>
            Save
          </button>
          <button className="action-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewRecordModal;
