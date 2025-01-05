import React, { useState } from "react";
import "./newPaymentModal.css";

const PaymentsModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
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
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Automatically calculate amountExchanged if amount and exchangeRate are provided
    if (name === "amount" || name === "exchangeRate") {
      const amount = parseFloat(formData.amount || "0");
      const exchangeRate = parseFloat(formData.exchangeRate || "1");
      setFormData((prevData) => ({
        ...prevData,
        amountExchanged: (amount / exchangeRate).toFixed(2),
      }));
    }
  };

  const handleSubmit = () => {
    console.log("Submitted Data:", formData);
    onClose();
  };

  return (
    <div className="payment-voucher-modal-overlay">
      <div className="payment-voucher-modal-container">
        <div className="payment-voucher-modal-header">
          <h3>New Payment Voucher</h3>
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
            <tr>
              <td>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
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
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                >
                  <option value="">Select</option>
                  <option value="Cash USD">Cash USD</option>
                  <option value="Cash LL">Cash LL</option>
                  <option value="Check USD">Check USD</option>
                  <option value="Check LL">Check LL</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
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
                  disabled
                />
              </td>
              <td>
                <input
                  type="text"
                  name="checkNumber"
                  value={formData.checkNumber}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <input
                  type="text"
                  name="paymentNumber"
                  value={formData.paymentNumber}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <input
                  type="text"
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <select
                  name="paymentType"
                  value={formData.paymentType}
                  onChange={handleInputChange}
                >
                  <option value="">Select</option>
                  <option value="S">S</option>
                  <option value="G">G</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="payment-voucher-modal-actions">
          <button onClick={handleSubmit} className="payment-voucher-modal-save">
            Save
          </button>
          <button onClick={onClose} className="payment-voucher-modal-cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentsModal;
