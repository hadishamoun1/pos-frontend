import React, { useEffect, useState } from "react";
import Select from "react-select";
import "./newRecord.css";

const NewRecordModal = ({ formData, setFormData, onClose, onSave }) => {
  const [invoiceNumbers, setInvoiceNumbers] = useState([]);
  const [customerNames, setCustomerNames] = useState([]);

  // Fetch dynamic data
  useEffect(() => {
    const fetchDynamicData = async () => {
      // Simulate fetching invoice numbers and customer names
      const invoices = ["INV-001", "INV-002", "INV-003"];
      const customers = ["John Doe", "Jane Smith", "Alice Johnson"];
      setInvoiceNumbers(invoices);
      setCustomerNames(customers);
    };

    fetchDynamicData();
  }, []);

  // Pre-fill exchange rate based on currency
  useEffect(() => {
    if (formData.currency === "USD") {
      setFormData((prevData) => ({
        ...prevData,
        exchangeRate: "1.00",
      }));
    } else if (formData.currency === "LL") {
      setFormData((prevData) => ({
        ...prevData,
        exchangeRate: "",
      }));
    }
  }, [formData.currency, setFormData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle Enter key as Tab functionality
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const formElements = Array.from(
          document.querySelectorAll(
            ".payments-modal-content input, .payments-modal-content select"
          )
        );
        const currentIndex = formElements.indexOf(document.activeElement);
        const nextElement = formElements[currentIndex + 1];
        nextElement?.focus();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="payments-modal-overlay">
      <div className="payments-modal-content">
        <h2>New Record</h2>
        <form>
          {/* Customer Name - Searchable Dropdown */}
          <label htmlFor="customerName">Customer Name</label>
          <Select
            options={customerNames.map((name) => ({
              value: name,
              label: name,
            }))}
            onChange={(selected) =>
              setFormData((prevData) => ({
                ...prevData,
                customerName: selected.value,
              }))
            }
            placeholder="Search or select customer"
          />

          {/* Currency */}
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

          {/* Exchange Rate */}
          <label htmlFor="exchangeRate">Exchange Rate</label>
          <select
            id="exchangeRate"
            name="exchangeRate"
            value={formData.exchangeRate}
            onChange={handleInputChange}
            disabled={formData.currency === "USD"}
            className={
              formData.currency === "USD" ? "payments-disabled-field" : ""
            }
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
            disabled={formData.currency === "USD"}
            className={
              formData.currency === "USD" ? "payments-disabled-field" : ""
            }
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
            disabled={formData.currency === "USD"}
            className={
              formData.currency === "USD" ? "payments-disabled-field" : ""
            }
          />

          {/* Other Fields */}
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

          {/* Date */}
          <label htmlFor="date">Date</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date || new Date().toISOString().split("T")[0]}
            onChange={handleInputChange}
          />

          {/* Invoice Number - Searchable Dropdown */}
          <label htmlFor="invoiceNumber">Invoice Number</label>
          <Select
            options={invoiceNumbers.map((invoice) => ({
              value: invoice,
              label: invoice,
            }))}
            onChange={(selected) =>
              setFormData((prevData) => ({
                ...prevData,
                invoiceNumber: selected.value,
              }))
            }
            placeholder="Search or select invoice"
          />

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
        </form>
        <div className="payments-modal-buttons">
          <button className="payments-action-button" onClick={onSave}>
            Save
          </button>
          <button className="payments-action-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewRecordModal;
