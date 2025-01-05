import React, { useState } from "react";
import "./payments.css";

const PaymentsModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const tableData = [
    {
      supplier: "Supplier A",
      amount: "5000",
      currency: "USD",
      date: "2025-01-01",
      type: "Cash USD",
      exchangeRate: "1",
      amountExchanged: "5000",
      checkNumber: "123456",
      bankName: "Bank A",
      dueDate: "2025-01-15",
      paymentNumber: "PM001",
      comments: "Payment for order 123",
      paymentType: "S",
    },
    // Add more data as needed
  ];

  return (
    <div>
      {/* Trigger Button */}
      <button
        className="payment-voucher-modal-open-btn"
        onClick={() => setIsModalOpen(true)}
      >
        Open Payment Voucher Modal
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="payment-voucher-modal-overlay">
          <div className="payment-voucher-modal-container">
            {/* Close Button */}
            <button
              className="payment-voucher-modal-close-btn"
              onClick={() => setIsModalOpen(false)}
            >
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
                  <th className="payment-voucher-modal-exchange-rate">
                    Ex Rate
                  </th>
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
                  <th className="payment-voucher-modal-payment-type">
                    Pmt Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, index) => (
                  <tr key={index}>
                    <td className="payment-voucher-modal-supplier">
                      {row.supplier}
                    </td>
                    <td className="payment-voucher-modal-amount">
                      {row.amount}
                    </td>
                    <td className="payment-voucher-modal-currency">
                      {row.currency}
                    </td>
                    <td className="payment-voucher-modal-date">{row.date}</td>
                    <td className="payment-voucher-modal-type">{row.type}</td>
                    <td className="payment-voucher-modal-exchange-rate">
                      {row.exchangeRate}
                    </td>
                    <td className="payment-voucher-modal-amount-exchanged">
                      {row.amountExchanged}
                    </td>
                    <td className="payment-voucher-modal-check-number">
                      {row.checkNumber}
                    </td>
                    <td className="payment-voucher-modal-bank-name">
                      {row.bankName}
                    </td>
                    <td className="payment-voucher-modal-due-date">
                      {row.dueDate}
                    </td>
                    <td className="payment-voucher-modal-payment-number">
                      {row.paymentNumber}
                    </td>
                    <td className="payment-voucher-modal-comments">
                      {row.comments}
                    </td>
                    <td className="payment-voucher-modal-payment-type">
                      {row.paymentType}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsModal;
