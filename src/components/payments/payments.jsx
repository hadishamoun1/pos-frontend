import React, { useState } from "react";
import "./payments.css";
import PaymentsModal from "./newPaymentModal";

const PaymentsPage = () => {
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
      dateCreated: "2025-01-01",
      dateModified: "2025-01-02",
      doneBy: "Admin",
    },
    // Add more data as needed
  ];

  return (
    <div className="payment-voucher-container">
      {/* Action Buttons */}
      <div className="payment-voucher-action-buttons">
        <button
          className="payment-voucher-new-btn"
          onClick={() => setIsModalOpen(true)}
        >
          New
        </button>
        <button className="payment-voucher-edit-btn">Edit</button>
        <button className="payment-voucher-delete-btn">Delete</button>
      </div>

      {/* Table */}
      <table className="payment-voucher-table">
        <thead>
          <tr>
            <th className="payment-voucher-supplier">Supplier</th>
            <th className="payment-voucher-amount">Amount</th>
            <th className="payment-voucher-currency">Currency</th>
            <th className="payment-voucher-date">Date</th>
            <th className="payment-voucher-type">Type</th>
            <th className="payment-voucher-exchange-rate">Ex Rate</th>
            <th className="payment-voucher-amount-exchanged">Amount Ex</th>
            <th className="payment-voucher-check-number">Check #</th>
            <th className="payment-voucher-bank-name">Bank Name</th>
            <th className="payment-voucher-due-date">Due Date</th>
            <th className="payment-voucher-payment-number">Payment #</th>
            <th className="payment-voucher-comments">Comment</th>
            <th className="payment-voucher-payment-type">Pmt Type</th>
            <th className="payment-voucher-date-created">Date Created</th>
            <th className="payment-voucher-date-modified">Date Modified</th>
            <th className="payment-voucher-done-by">Done By</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, index) => (
            <tr key={index}>
              <td className="payment-voucher-supplier">{row.supplier}</td>
              <td className="payment-voucher-amount">{row.amount}</td>
              <td className="payment-voucher-currency">{row.currency}</td>
              <td className="payment-voucher-date">{row.date}</td>
              <td className="payment-voucher-type">{row.type}</td>
              <td className="payment-voucher-exchange-rate">
                {row.exchangeRate}
              </td>
              <td className="payment-voucher-amount-exchanged">
                {row.amountExchanged}
              </td>
              <td className="payment-voucher-check-number">
                {row.checkNumber}
              </td>
              <td className="payment-voucher-bank-name">{row.bankName}</td>
              <td className="payment-voucher-due-date">{row.dueDate}</td>
              <td className="payment-voucher-payment-number">
                {row.paymentNumber}
              </td>
              <td className="payment-voucher-comments">{row.comments}</td>
              <td className="payment-voucher-payment-type">
                {row.paymentType}
              </td>
              <td className="payment-voucher-date-created">
                {row.dateCreated}
              </td>
              <td className="payment-voucher-date-modified">
                {row.dateModified}
              </td>
              <td className="payment-voucher-done-by">{row.doneBy}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal */}
      {isModalOpen && <PaymentsModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default PaymentsPage;
