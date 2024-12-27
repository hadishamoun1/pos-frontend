import React, { useState, useEffect } from "react";
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

  // Utility to format numbers with commas
  const formatNumberWithCommas = (number) => {
    if (!number || isNaN(number)) return "";
    return Number(number).toLocaleString("en-US");
  };

  // Utility to strip commas from numbers
  const stripCommas = (number) => {
    if (!number) return "";
    return number.replace(/,/g, "");
  };

  useEffect(() => {
    if (selectedRow) {
      const {
        id: receiptVoucherId,
        customer = {},
        date = "",
        invoiceId = "",
        details = [{}],
      } = selectedRow;

      setFormData({
        receiptVoucherId,
        customerName: customer.name || "",
        customerAccountId: customer.id || "",
        date,
        invoiceNumber: invoiceId,
        cashNumber: details[0]?.cashNumber || "0",
        currency: details[0]?.currency || "",
        exchangeRate: details[0]?.exchangeRate || "0",
        amountExchanged: details[0]?.amountExchanged || "0",
        comments: details[0]?.comments || "",
      });
    }
  }, [selectedRow]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let updatedData = { ...prev, [name]: value };

      if (name === "currency") {
        if (value === "USD") {
          updatedData.exchangeRate = "";
          updatedData.amountExchanged = formatNumberWithCommas(
            stripCommas(updatedData.cashNumber) || "0"
          );
        } else if (value === "LL") {
          if (prev.cashNumber && prev.exchangeRate) {
            updatedData.amountExchanged = formatNumberWithCommas(
              (
                parseFloat(stripCommas(prev.cashNumber)) /
                parseFloat(stripCommas(prev.exchangeRate) || 1)
              ).toFixed(2)
            );
          }
        }
      }

      if (name === "cashNumber") {
        const cashNumber = parseFloat(stripCommas(value)) || 0;
        updatedData.cashNumber = formatNumberWithCommas(cashNumber);

        if (prev.currency === "LL" && prev.exchangeRate) {
          const exchangeRate = parseFloat(stripCommas(prev.exchangeRate)) || 1;
          updatedData.amountExchanged = formatNumberWithCommas(
            (cashNumber / exchangeRate).toFixed(2)
          );
        } else if (prev.currency === "USD") {
          updatedData.amountExchanged = formatNumberWithCommas(cashNumber);
        }
      }

      if (name === "exchangeRate" && prev.currency === "LL") {
        const exchangeRate = parseFloat(stripCommas(value)) || 0;
        updatedData.exchangeRate = formatNumberWithCommas(exchangeRate);

        if (prev.cashNumber) {
          const cashNumber = parseFloat(stripCommas(prev.cashNumber)) || 0;
          updatedData.amountExchanged = formatNumberWithCommas(
            (cashNumber / (exchangeRate || 1)).toFixed(2)
          );
        }
      }

      if (name === "amountExchanged" && prev.currency === "LL") {
        const amountExchanged = parseFloat(stripCommas(value)) || 0;
        updatedData.amountExchanged = formatNumberWithCommas(amountExchanged);

        if (prev.cashNumber) {
          const cashNumber = parseFloat(stripCommas(prev.cashNumber)) || 0;
          updatedData.exchangeRate = formatNumberWithCommas(
            (cashNumber / (amountExchanged || 1)).toFixed(2)
          );
        }
      }

      return updatedData;
    });
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
          cashNumber: stripCommas(formData.cashNumber),
          currency: formData.currency,
          exchangeRate: stripCommas(formData.exchangeRate),
          amountExchanged: stripCommas(formData.amountExchanged),
          comments: formData.comments,
        },
      ],
    };
    onSave(formattedData);
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
        <table className="edit-modal-table">
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
            <tr>
              <td>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  readOnly
                  onClick={() => setIsCustomerModalOpen(true)}
                  placeholder="Select Customer"
                />
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
                  placeholder="Cash Number"
                />
              </td>
              <td>
                <input
                  type="text"
                  name="exchangeRate"
                  value={formData.exchangeRate}
                  onChange={handleInputChange}
                  disabled={formData.currency === "USD"}
                  placeholder="Ex Rate"
                />
              </td>
              <td>
                <input
                  type="text"
                  name="amountExchanged"
                  value={formData.amountExchanged}
                  onChange={handleInputChange}
                  placeholder="Amount Exchanged"
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
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleInputChange}
                  placeholder="Invoice Number"
                />
              </td>
              <td>
                <input
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                  placeholder="Comments"
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
