import React, { useState, useEffect } from "react"; // Fix React hooks import
import "./payments.css";
import PaymentsModal from "./newPaymentModal";
import EditPaymentModal from "./editPaymentModal";
import NotificationModal from "../recievables/NotificationModal"; // Import the notification modal

const PaymentsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State for edit modal
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [rowToEdit, setRowToEdit] = useState(null); // State for the row being edited
  const [notification, setNotification] = useState(null); // State for notification modal

  // Fetch payment vouchers from the API
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

  useEffect(() => {
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

  const handleSaveEdit = async (updatedRow) => {
    try {
      // Send the updated row to the API
      const response = await fetch(
        `http://localhost:3000/payment-vouchers/${updatedRow.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedRow),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update payment voucher");
      }

      // Get the updated data from the API response
      const updatedData = await response.json();

      console.log("Updated Data:", updatedData); // Debugging

      // Update the tableData state with the updated row
      setTableData((prevData) =>
        prevData.map((row) =>
          row.id === updatedData.id
            ? {
                ...row,
                supplierName:
                  updatedData.supplier?.supplierName || row.supplierName,
                date: updatedData.date,
                paymentType: updatedData.paymentType,
                type: updatedData.type,
                details: updatedData.details || row.details, // Merge details
              }
            : row
        )
      );

      console.log("Updated Table Data:", tableData); // Debugging

      // Close the edit modal
      setIsEditModalOpen(false);

      // Show success notification
      setNotification({
        type: "success",
        message: "Payment voucher updated successfully!",
      });
    } catch (error) {
      console.error(error.message);
      setNotification({
        type: "error",
        message: error.message || "Failed to update payment voucher.",
      });
    }
  };

  // Handle notification close
  const handleNotificationClose = () => {
    setNotification(null); // Close the notification modal
    if (notification?.type === "success") {
      setIsEditModalOpen(false); // Close the edit modal only on success
    }
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
              <th className="payment-voucher-payment-type">Pmt Type</th>{" "}
              {/* Moved here */}
              <th className="payment-voucher-date">Date</th>
              <th className="payment-voucher-type">Type</th>
              <th className="payment-voucher-exchange-rate">Ex Rate</th>
              <th className="payment-voucher-amount-exchanged">Amount Ex</th>
              <th className="payment-voucher-check-number">Check #</th>
              <th className="payment-voucher-bank-name">Bank Name</th>
              <th className="payment-voucher-due-date">Due Date</th>
              <th className="payment-voucher-payment-number">Payment #</th>
              <th className="payment-voucher-comments">Comment</th>
              <th className="payment-voucher-currency">Currency</th>{" "}
              {/* Moved here */}
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
                <td className="payment-voucher-payment-type">
                  {row.paymentType}
                </td>{" "}
                {/* Moved here */}
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
                <td className="payment-voucher-currency">
                  {row.details[0]?.currency}
                </td>{" "}
                {/* Moved here */}
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

export default PaymentsPage;
