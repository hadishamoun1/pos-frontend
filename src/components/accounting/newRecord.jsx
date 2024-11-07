import React, { useEffect, useState } from "react";
import "./newRecord.css";

const NewRecordModal = ({ formData, setFormData, onClose, onSave }) => {
  const [invoiceNumbers, setInvoiceNumbers] = useState([]);

  useEffect(() => {
    const fetchInvoiceNumbers = async () => {
      const invoices = ["INV-001", "INV-002", "INV-003"];
      setInvoiceNumbers(invoices);
    };

    fetchInvoiceNumbers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const isDisabled = formData.currency === "USD";

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>New Record</h2>
        <form>
          {/* Customer Name */}
          <label htmlFor="customerName">Customer Name</label>
          <input
            type="text"
            id="customerName"
            name="customerName"
            value={formData.customerName}
            onChange={handleInputChange}
            placeholder="Customer Name"
          />

          {/* Currency - Dropdown */}
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleInputChange}
          >
            <option value="">Select Currency</option>
            <option value="USD">USD</option>
            <option value="LL">LL</option>
          </select>

          {/* Currency Exchange Rate - Dropdown with Custom Option */}
          <label htmlFor="exchangeRate">Exchange Rate</label>
          <select
            id="exchangeRate"
            name="exchangeRate"
            value={formData.exchangeRate}
            onChange={handleInputChange}
            disabled={isDisabled}
            className={isDisabled ? "disabled-field" : ""}
          >
            <option value="">Select Exchange Rate</option>
            <option value="89000">89,000</option>
            <option value="1500">1,500</option>
          </select>
          <input
            type="number"
            name="exchangeRate"
            placeholder="Or enter a custom rate"
            value={formData.exchangeRate}
            onChange={handleInputChange}
            disabled={isDisabled}
            className={isDisabled ? "disabled-field" : ""}
          />

          {/* Amount Exchanged */}
          <label htmlFor="amountExchanged">Amount Exchanged</label>
          <input
            type="text"
            id="amountExchanged"
            name="amountExchanged"
            value={formData.amountExchanged}
            onChange={handleInputChange}
            placeholder="Amount Exchanged"
            disabled={isDisabled}
            className={isDisabled ? "disabled-field" : ""}
          />

          {/* Cash Number */}
          <label htmlFor="cashNumber">Cash Number</label>
          <input
            type="text"
            id="cashNumber"
            name="cashNumber"
            value={formData.cashNumber}
            onChange={handleInputChange}
            placeholder="Cash Number"
          />

          {/* Date - Calendar */}
          <label htmlFor="date">Date</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date || new Date().toISOString().split("T")[0]}
            onChange={handleInputChange}
          />

          {/* Invoice Number - Dropdown */}
          <label htmlFor="invoiceNumber">Invoice Number</label>
          <select
            id="invoiceNumber"
            name="invoiceNumber"
            value={formData.invoiceNumber}
            onChange={handleInputChange}
          >
            <option value="">Select Invoice Number</option>
            {invoiceNumbers.map((invoice) => (
              <option key={invoice} value={invoice}>
                {invoice}
              </option>
            ))}
          </select>

          {/* Comments */}
          <label htmlFor="comments">Comments</label>
          <input
            type="text"
            id="comments"
            name="comments"
            value={formData.comments}
            onChange={handleInputChange}
            placeholder="Comments"
          />

          {/* RCT */}
          <label htmlFor="rct">RCT</label>
          <input
            type="text"
            id="rct"
            name="rct"
            value={formData.rct}
            onChange={handleInputChange}
            placeholder="RCT"
          />
        </form>
        <div className="modal-buttons">
          <button className="action-button" onClick={onSave}>Save</button>
          <button className="action-button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default NewRecordModal;
