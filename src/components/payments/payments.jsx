
import React, { useState, useEffect } from "react"; // Fix React hooks import
import "./payments.css";
import PaymentsModal from "./newPaymentModal"


import EditPaymentModal from "./editPaymentModal"; // Import the edit modal component

const PaymentsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State for edit modal
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [rowToEdit, setRowToEdit] = useState(null); // State for the row being edited

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

  // Handle checkbox selection
  const handleRowSelect = (id) => {
    setSelectedRows((prevSelectedRows) =>
      prevSelectedRows.includes(id)
        ? prevSelectedRows.filter((rowId) => rowId !== id)
        : [...prevSelectedRows, id]
    );
  };

  // Handle Edit Button Click
  const handleEditClick = () => {
    if (selectedRows.length !== 1) {
      alert("Please select exactly one row to edit.");
      return;
    }
    const selectedRowData = tableData.find((row) => row.id === selectedRows[0]);
    setRowToEdit(selectedRowData);
    setIsEditModalOpen(true);
  };

  // Handle Save from Edit Modal
  const handleSaveEdit = (updatedRow) => {
    setTableData((prevData) =>
      prevData.map((row) => (row.id === updatedRow.id ? updatedRow : row))
    );
    setIsEditModalOpen(false);
  };

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
        <button className="payment-voucher-edit-btn" onClick={handleEditClick}>
          Edit
        </button>
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
              <th className="payment-voucher-select">Select</th>
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
                <td className="payment-voucher-select">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row.id)}
                    onChange={() => handleRowSelect(row.id)}
                  />
                </td>
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

      {/* Modals */}
      {isModalOpen && <PaymentsModal onClose={() => setIsModalOpen(false)} />}
      {isEditModalOpen && rowToEdit && (
        <EditPaymentModal
          row={rowToEdit}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};

export default PaymentsPage;
