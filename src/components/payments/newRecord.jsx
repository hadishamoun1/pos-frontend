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
    const newRow = {
      customerId: "",
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

        const numericValue = isNaN(parseFloat(value.replace(/,/g, "")))
          ? 0
          : parseFloat(value.replace(/,/g, ""));
        const updatedRow = { ...row, [field]: value };

        if (field === "currency") {
          if (value === "USD") {
            updatedRow.exchangeRate = "";
            updatedRow.amountExchanged = formatNumberWithCommas(
              updatedRow.cashNumber || ""
            );
          } else if (value === "LL") {
            if (row.cashNumber && row.exchangeRate) {
              updatedRow.amountExchanged = formatNumberWithCommas(
                (
                  parseFloat(row.cashNumber.replace(/,/g, "")) /
                  parseFloat(row.exchangeRate.replace(/,/g, ""))
                ).toFixed(2)
              );
            }
          }
        }

        if (field === "cashNumber") {
          updatedRow.cashNumber = formatNumberWithCommas(
            value.replace(/,/g, "")
          );
          if (row.currency === "LL" && row.exchangeRate) {
            updatedRow.amountExchanged = formatNumberWithCommas(
              (
                numericValue / parseFloat(row.exchangeRate.replace(/,/g, ""))
              ).toFixed(2)
            );
          } else if (row.currency === "USD") {
            updatedRow.amountExchanged = formatNumberWithCommas(
              numericValue.toFixed(2)
            );
          }
        }
        if (field === "exchangeRate" && row.currency === "LL") {
          updatedRow.exchangeRate = value.replace(/,/g, ""); // Remove commas
          if (row.cashNumber) {
            updatedRow.amountExchanged = formatNumberWithCommas(
              (
                parseFloat(row.cashNumber.replace(/,/g, "")) /
                parseFloat(updatedRow.exchangeRate)
              ).toFixed(2)
            );
          }
        }

        if (field === "amountExchanged" && row.currency === "LL") {
          updatedRow.amountExchanged = formatNumberWithCommas(
            value.replace(/,/g, "")
          );
          if (row.cashNumber) {
            updatedRow.exchangeRate = formatNumberWithCommas(
              (
                parseFloat(row.cashNumber.replace(/,/g, "")) / numericValue
              ).toFixed(2)
            );
          }
        }

        return updatedRow;
      })
    );
  };

  const handleSave = async () => {
    try {
      if (rows.length === 0) {
        setNotification({
          type: "error",
          message: "Please add at least one row before saving.",
        });
        return;
      }

      // Validate all rows
      for (const [index, row] of rows.entries()) {
        if (!row.customerId) {
          setNotification({
            type: "error",
            message: `Row ${index + 1}: Customer is required.`,
          });
          return;
        }
        if (!row.currency) {
          setNotification({
            type: "error",
            message: `Row ${index + 1}: Currency is required.`,
          });
          return;
        }
        if (!row.cashNumber) {
          setNotification({
            type: "error",
            message: `Row ${index + 1}: Cash Number is required.`,
          });
          return;
        }
        if (row.currency === "LL" && !row.exchangeRate) {
          setNotification({
            type: "error",
            message: `Row ${
              index + 1
            }: Exchange Rate is required for LL currency.`,
          });
          return;
        }
        if (!row.amountExchanged) {
          setNotification({
            type: "error",
            message: `Row ${index + 1}: Amount Exchanged is required.`,
          });
          return;
        }
        if (!row.date) {
          setNotification({
            type: "error",
            message: `Row ${index + 1}: Date is required.`,
          });
          return;
        }
        if (!row.invoiceNumber) {
          setNotification({
            type: "error",
            message: `Row ${index + 1}: Invoice Number is required.`,
          });
          return;
        }
      }

      // Format rows for API
      const formattedTransactions = rows.map((row) => ({
        customerAccountId: row.customerId,
        date: row.date,
        invoiceId: row.invoiceNumber,
        details: [
          {
            cashNumber: row.cashNumber.replace(/,/g, ""), // Remove commas
            currency: row.currency,
            exchangeRate:
              row.currency === "LL"
                ? row.exchangeRate.replace(/,/g, "") || "1"
                : "1",
            amountExchanged: row.amountExchanged.replace(/,/g, ""), // Remove commas
            comments: row.comments,
          },
        ],
      }));

      // API Call to save the data
      await axios.post(
        "http://localhost:3000/receipt-vouchers/v1/bulk",
        formattedTransactions
      );

      setNotification({
        type: "success",
        message: "Receipt vouchers saved successfully!",
      });
      setCloseAfterNotification(true);
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error.response?.data?.message ||
          "Failed to save data. Please check your input and try again.",
      });
    }
  };

  const handleNotificationClose = () => {
    setNotification(null);
    if (closeAfterNotification) {
      onClose();
    }
  };

  const handleCustomerSelect = (customer) => {
    setRows((prevRows) =>
      prevRows.map((row, i) =>
        i === currentRowIndex
          ? {
              ...row,
              customerName: customer.customerName,
              customerId: customer.id,
            }
          : row
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
        {/* Main Content */}
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
                {/* Row Inputs */}
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
                    required
                  />
                </td>
                <td>
                  <select
                    value={row.currency}
                    onChange={(e) =>
                      handleInputChange(index, "currency", e.target.value)
                    }
                    required
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
                      handleInputChange(index, "cashNumber", e.target.value)
                    }
                    placeholder="Cash Number"
                    required
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.exchangeRate}
                    onChange={(e) =>
                      handleInputChange(index, "exchangeRate", e.target.value)
                    }
                    placeholder="Ex Rate"
                    disabled={row.currency === "USD"}
                    required={row.currency === "LL"}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.amountExchanged}
                    onChange={(e) =>
                      handleInputChange(
                        index,
                        "amountExchanged",
                        e.target.value
                      )
                    }
                    placeholder="Amount Exchanged"
                    required
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) =>
                      handleInputChange(index, "date", e.target.value)
                    }
                    required
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
                    required
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
