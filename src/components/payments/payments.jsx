import React from "react";
import "./payments.css";

const PaymentsPage = () => {
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
      receiptNumber: "R001",
      comments: "Payment for order 123",
      receiptType: "S",
      dateCreated: "2025-01-01",
      dateModified: "2025-01-02",
      doneBy: "Admin",
    },
    // Add more data as needed
  ];

  return (
    <div className="payment-voucher-container">
      <table className="payment-voucher-table">
        <thead>
          <tr>
            <th className="payment-voucher-supplier">Supplier</th>
            <th className="payment-voucher-amount">Amount</th>
            <th className="payment-voucher-currency">Currency</th>
            <th className="payment-voucher-date">Date</th>
            <th>Type</th>
            <th>Exchange Rate</th>
            <th>Amount Exchanged</th>
            <th>Check Number</th>
            <th>Bank Name</th>
            <th>Due Date</th>
            <th>Receipt Number</th>
            <th className="payment-voucher-comments">Comments</th>
            <th>Receipt Type</th>
            <th>Date Created</th>
            <th>Date Modified</th>
            <th>Done By</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, index) => (
            <tr key={index}>
              <td className="payment-voucher-supplier">{row.supplier}</td>
              <td className="payment-voucher-amount">{row.amount}</td>
              <td className="payment-voucher-currency">{row.currency}</td>
              <td className="payment-voucher-date">{row.date}</td>
              <td>{row.type}</td>
              <td>{row.exchangeRate}</td>
              <td>{row.amountExchanged}</td>
              <td>{row.checkNumber}</td>
              <td>{row.bankName}</td>
              <td>{row.dueDate}</td>
              <td>{row.receiptNumber}</td>
              <td className="payment-voucher-comments">{row.comments}</td>
              <td>{row.receiptType}</td>
              <td>{row.dateCreated}</td>
              <td>{row.dateModified}</td>
              <td>{row.doneBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentsPage;
