import React, { useState, useEffect } from "react";
import "./payments.css";
import PaymentsModal from "./newPaymentModal";

const PaymentsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch payment vouchers from the API
  useEffect(() => {
    const fetchPaymentVouchers = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(
          "http://localhost:3000/payment-vouchers/v1/formatted"
        );
        if (!response.ok) {
          throw new Error("Failed to fetch payment vouchers");
        }
        const data = await response.json();
        setTableData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentVouchers();
  }, []);

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

      {/* Error and Loading */}
      {error && <p className="error-message">{error}</p>}
      {loading ? (
        <p className="loading-message">Loading payment vouchers...</p>
      ) : (
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
                <td className="payment-voucher-supplier">{row.supplierName}</td>
                <td className="payment-voucher-amount">
                  {row.details[0]?.amount}
                </td>
                <td className="payment-voucher-currency">
                  {row.details[0]?.currency}
                </td>
                <td className="payment-voucher-date">{row.date}</td>
                <td className="payment-voucher-type">{row.type}</td>
                <td className="payment-voucher-exchange-rate">
                  {row.details[0]?.exchangeRate}
                </td>
                <td className="payment-voucher-amount-exchanged">
                  {row.details[0]?.amountExchanged}
                </td>
                <td className="payment-voucher-check-number">
                  {row.details[0]?.checkNumber}
                </td>
                <td className="payment-voucher-bank-name">
                  {row.details[0]?.bankName}
                </td>
                <td className="payment-voucher-due-date">
                  {row.details[0]?.checkDueDate}
                </td>
                <td className="payment-voucher-payment-number">
                  {row.paymentNumber}
                </td>
                <td className="payment-voucher-comments">
                  {row.details[0]?.description}
                </td>
                <td className="payment-voucher-payment-type">
                  {row.paymentType}
                </td>
                <td className="payment-voucher-date-created">{row.date}</td>
                <td className="payment-voucher-date-modified">{row.date}</td>
                <td className="payment-voucher-done-by">{row.doneBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {isModalOpen && <PaymentsModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default PaymentsPage;
