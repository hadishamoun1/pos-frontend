import React from "react";
import "./newPaymentModal.css";

const PaymentsModal = ({ onClose }) => {
  return (
    <div className="payment-voucher-modal-overlay">
      <div className="payment-voucher-modal-container">
        {/* Close Button */}
        <button className="payment-voucher-modal-close-btn" onClick={onClose}>
          &times;
        </button>

        {/* Table */}
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
            {/* Placeholder row */}
            <tr>
              <td className="payment-voucher-modal-supplier">
                Sample Supplier
              </td>
              <td className="payment-voucher-modal-amount">5000</td>
              <td className="payment-voucher-modal-currency">USD</td>
              <td className="payment-voucher-modal-date">2025-01-01</td>
              <td className="payment-voucher-modal-type">Cash USD</td>
              <td className="payment-voucher-modal-exchange-rate">1</td>
              <td className="payment-voucher-modal-amount-exchanged">5000</td>
              <td className="payment-voucher-modal-check-number">123456</td>
              <td className="payment-voucher-modal-bank-name">Bank A</td>
              <td className="payment-voucher-modal-due-date">2025-01-15</td>
              <td className="payment-voucher-modal-payment-number">PM001</td>
              <td className="payment-voucher-modal-comments">
                Payment for order 123
              </td>
              <td className="payment-voucher-modal-payment-type">S</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentsModal;
