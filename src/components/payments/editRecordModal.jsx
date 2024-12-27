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

  // Utility to format numbers with commas
  const formatNumberWithCommas = (number) => {
    if (!number) return "";
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
        cashNumber: formatNumberWithCommas(details[0]?.cashNumber || ""),
        currency: details[0]?.currency || "",
        exchangeRate: formatNumberWithCommas(details[0]?.exchangeRate || ""),
        amountExchanged: formatNumberWithCommas(
          details[0]?.amountExchanged || ""
        ),
        comments: details[0]?.comments || "",
      });
    }
  }, [selectedRow]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updatedData = { ...prev, [name]: value };

      // Apply conditions based on currency and input fields
      if (name === "currency") {
        if (value === "USD") {
          updatedData.exchangeRate = "";
          updatedData.amountExchanged = formatNumberWithCommas(
            stripCommas(updatedData.cashNumber) || ""
          );
        } else if (value === "LL") {
          if (prev.cashNumber && prev.exchangeRate) {
            updatedData.amountExchanged = formatNumberWithCommas(
              (
                parseFloat(stripCommas(prev.cashNumber)) /
                parseFloat(stripCommas(prev.exchangeRate))
              ).toFixed(2)
            );
          }
        }
      }

      if (name === "cashNumber") {
        updatedData.cashNumber = formatNumberWithCommas(
          value.replace(/,/g, "")
        ); // Add commas for display
        if (prev.currency === "LL" && prev.exchangeRate) {
          updatedData.amountExchanged = formatNumberWithCommas(
            (
              parseFloat(value.replace(/,/g, "")) /
              parseFloat(stripCommas(prev.exchangeRate))
            ).toFixed(2)
          );
        } else if (prev.currency === "USD") {
          updatedData.amountExchanged = formatNumberWithCommas(
            value.replace(/,/g, "")
          );
        }
      }

      if (name === "exchangeRate" && prev.currency === "LL") {
        updatedData.exchangeRate = formatNumberWithCommas(
          value.replace(/,/g, "")
        ); // Add commas for display
        if (prev.cashNumber) {
          updatedData.amountExchanged = formatNumberWithCommas(
            (
              parseFloat(stripCommas(prev.cashNumber)) /
              parseFloat(value.replace(/,/g, ""))
            ).toFixed(2)
          );
        }
      }

      if (name === "amountExchanged" && prev.currency === "LL") {
        updatedData.amountExchanged = formatNumberWithCommas(
          value.replace(/,/g, "")
        ); // Add commas for display
        if (prev.cashNumber) {
          updatedData.exchangeRate = formatNumberWithCommas(
            (
              parseFloat(stripCommas(prev.cashNumber)) /
              parseFloat(value.replace(/,/g, ""))
            ).toFixed(2)
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
          cashNumber: stripCommas(formData.cashNumber), // Strip commas before sending
          currency: formData.currency,
          exchangeRate: stripCommas(formData.exchangeRate), // Strip commas before sending
          amountExchanged: stripCommas(formData.amountExchanged), // Strip commas before sending
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
