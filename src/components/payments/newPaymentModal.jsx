import React, { useState } from "react";
import "./newPaymentModal.css";

const PaymentsModal = ({ onClose }) => {
  const [rows, setRows] = useState([
    {
      supplier: "",
      amount: "",
      currency: "",
      date: "",
      type: "",
      exchangeRate: "",
      amountExchanged: "",
      checkNumber: "",
      bankName: "",
      dueDate: "",
      paymentNumber: "",
      comments: "",
      paymentType: "",
    },
  ]);

  const handleInputChange = (index, e) => {
    const { name, value } = e.target;
    const newRows = [...rows];
    newRows[index][name] = value;

    // Automatically calculate amountExchanged if amount and exchangeRate are provided
    if (name === "amount" || name === "exchangeRate") {
      const amount = parseFloat(newRows[index].amount || "0");
      const exchangeRate = parseFloat(newRows[index].exchangeRate || "1");
      newRows[index].amountExchanged = (amount / exchangeRate).toFixed(2);
    }

    setRows(newRows);
  };

  const addRow = () => {
    setRows([
      ...rows,
      {
        supplier: "",
        amount: "",
        currency: "",
        date: "",
        type: "",
        exchangeRate: "",
        amountExchanged: "",
        checkNumber: "",
        bankName: "",
        dueDate: "",
        paymentNumber: "",
        comments: "",
        paymentType: "",
      },
    ]);
  };

  const handleSubmit = () => {
    console.log("Submitted Data:", rows);
    onClose();
  };

  return (
    <div className="payment-voucher-modal-overlay">
      <div className="payment-voucher-modal-container">
        <div className="payment-voucher-modal-header">
          <h3>New Payment Voucher</h3>
          <div className="payment-voucher-modal-actions">
            <button
              onClick={handleSubmit}
              className="payment-voucher-modal-save"
            >
              Save
            </button>
            <button onClick={onClose} className="payment-voucher-modal-cancel">
              Cancel
            </button>
          </div>
        </div>

        <table className="payment-voucher-modal-table">
          <thead>
            <tr>
              <th className="payment-voucher-modal-supplier">Supplier</th>
              <th className="payment-voucher-modal-amount">Amount</th>
              <th className="payment-voucher-modal-currency">Currency</th>
              <th className="payment-voucher-modal-date">Date</th>
              <th className="payment-voucher-modal-type">Type</th>
              <th className="payment-voucher-modal-exchange-rate">Ex Rate</th>
              <th className="payment-voucher-modal-amount-exchanged">
                Amount Ex
              </th>
              <th className="payment-voucher-modal-check-number">Check #</th>
              <th className="payment-voucher-modal-bank-name">Bank Name</th>
              <th className="payment-voucher-modal-due-date">Due Date</th>
              <th className="payment-voucher-modal-payment-number">
                Payment #
              </th>
              <th className="payment-voucher-modal-comments">Comment</th>
              <th className="payment-voucher-modal-payment-type">Pmt Type</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {Object.keys(row).map((key) => (
                  <td key={key}>
                    {key === "currency" ||
                    key === "type" ||
                    key === "paymentType" ? (
                      <select
                        name={key}
                        value={row[key]}
                        onChange={(e) => handleInputChange(index, e)}
                      >
                        <option value="">Select</option>
                        {key === "currency" && (
                          <>
                            <option value="USD">USD</option>
                            <option value="LL">LL</option>
                          </>
                        )}
                        {key === "type" && (
                          <>
                            <option value="Cash USD">Cash USD</option>
                            <option value="Cash LL">Cash LL</option>
                            <option value="Check USD">Check USD</option>
                            <option value="Check LL">Check LL</option>
                          </>
                        )}
                        {key === "paymentType" && (
                          <>
                            <option value="S">S</option>
                            <option value="G">G</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <input
                        type={
                          key === "date" || key === "dueDate" ? "date" : "text"
                        }
                        name={key}
                        value={row[key]}
                        onChange={(e) => handleInputChange(index, e)}
                        placeholder={
                          key === "supplier"
                            ? "Enter Supplier"
                            : key === "amount"
                            ? "Enter Amount"
                            : key === "exchangeRate"
                            ? "Enter Exchange Rate"
                            : key === "checkNumber"
                            ? "Enter Check"
                            : key === "bankName"
                            ? "Enter Bank "
                            : key === "dueDate"
                            ? "Select Due Date"
                            : key === "paymentNumber"
                            ? "Enter Pmt"
                            : key === "comments"
                            ? "Enter Comments"
                            : ""
                        }
                        disabled={key === "amountExchanged"}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addRow} className="payment-voucher-modal-add-row">
          Add Row
        </button>
      </div>
    </div>
  );
};

export default PaymentsModal;
