import React, { useState, useEffect } from "react";
import "./payments.css";
import PaymentsModal from "./newPaymentModal";
import EditPaymentModal from "./editPaymentModal";
import NotificationModal from "../recievables/NotificationModal";

const PaymentsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [rowToEdit, setRowToEdit] = useState(null);
  const [notification, setNotification] = useState(null);

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

  const handleRowSelect = (id) => {
    setSelectedRows((prevSelectedRows) =>
      prevSelectedRows.includes(id)
        ? prevSelectedRows.filter((rowId) => rowId !== id)
        : [...prevSelectedRows, id]
    );
  };

  const handleEditClick = () => {
    if (selectedRows.length !== 1) {
      setNotification({
        type: "error",
        message: "Please select exactly one row to edit.",
      });
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
          row.id === updatedRow.id
            ? {
                ...row,
                supplierName: updatedRow.supplierName,
                date: updatedRow.date,
                paymentType: updatedRow.paymentType,
                type: updatedRow.type,
                details: updatedRow.details,
                // Extract and assign the values directly from the `updatedRow`
                amount: `${updatedRow.details?.[0]?.amount}.00` || "0.00",
                currency: updatedRow.details?.[0]?.currency || "USD",
                amountExchanged:
                  `${updatedRow.details?.[0]?.amountExchanged}.00` || "0.00",
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

  const handleDeleteConfirmation = () => {
    if (selectedRows.length === 0) {
      setNotification({
        type: "error",
        message: "Please select at least one row to delete.",
      });
      return;
    }
    setNotification({
      type: "warning",
      message: "Are you sure you want to delete the selected voucher(s)?",
      onConfirm: handleDelete,
      confirmLabel: "Yes",
      cancelLabel: "No",
      onClose: () => setNotification(null),
    });
  };

  const handleDelete = async () => {
    try {
      await Promise.all(
        selectedRows.map((id) =>
          fetch(`http://localhost:3000/payment-vouchers/${id}`, {
            method: "DELETE",
          })
        )
      );

      setTableData((prevData) =>
        prevData.filter((row) => !selectedRows.includes(row.id))
      );

      setSelectedRows([]);

      setNotification({
        type: "success",
        message: "Selected payment voucher(s) deleted successfully!",
      });
    } catch (error) {
      setNotification({
        type: "error",
        message: error.message || "Failed to delete payment voucher(s).",
      });
    }
  };

  const handleNotificationClose = () => {
    setNotification(null);
  };

  const formatNumber = (value) => {
    if (isNaN(value) || value === null) return "0.00";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  return (
    <div className="payment-voucher-container">
      <div className="payment-voucher-header">
        <h1 className="payment-voucher-title">PAYMENTS</h1>
        <div className="payment-voucher-action-buttons">
          <button
            className="payment-voucher-new-btn"
            onClick={() => setIsModalOpen(true)}
          >
            New
          </button>
          <button
            className="payment-voucher-edit-btn"
            onClick={handleEditClick}
          >
            Edit
          </button>
          <button
            className="payment-voucher-delete-btn"
            onClick={handleDeleteConfirmation}
          >
            Delete
          </button>
        </div>
      </div>

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
              <th className="payment-voucher-payment-type">Pmt Type</th>
              <th className="payment-voucher-date">Date</th>
              <th className="payment-voucher-type">Type</th>
              <th className="payment-voucher-exchange-rate">Ex Rate</th>
              <th className="payment-voucher-amount-exchanged">Amount Ex</th>
              <th className="payment-voucher-check-number">Check #</th>
              <th className="payment-voucher-bank-name">Bank Name</th>
              <th className="payment-voucher-due-date">Due Date</th>
              <th className="payment-voucher-payment-number">Payment #</th>
              <th className="payment-voucher-comments">Comment</th>
              <th className="payment-voucher-currency">Currency</th>
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
                  {formatNumber(row.details[0]?.amount)}
                </td>
                <td className="payment-voucher-payment-type">
                  {row.paymentType}
                </td>
                <td className="payment-voucher-date">{row.date}</td>
                <td className="payment-voucher-type">{row.type}</td>
                <td className="payment-voucher-exchange-rate">
                  {formatNumber(row.details[0]?.exchangeRate)}
                </td>
                <td className="payment-voucher-amount-exchanged">
                  {formatNumber(row.details[0]?.amountExchanged)}
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
                </td>
                <td className="payment-voucher-date-created">{row.date}</td>
                <td className="payment-voucher-date-modified">{row.date}</td>
                <td className="payment-voucher-done-by">{row.doneBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
          onClose={notification.onClose || handleNotificationClose}
          onConfirm={notification.onConfirm}
          confirmLabel={notification.confirmLabel || "OK"}
          cancelLabel={notification.cancelLabel}
        />
      )}
    </div>
  );
};

export default PaymentsPage;
