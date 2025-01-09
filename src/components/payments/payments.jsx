import React, { useState, useEffect } from "react";
import "./payments.css";
import PaymentsModal from "./newPaymentModal";
import EditPaymentModal from "./editPaymentModal";
import NotificationModal from "../recievables/NotificationModal";

const PaymentsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]); // For filtered data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [rowToEdit, setRowToEdit] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1); // Tracks the current page.
  const [pageSize] = useState(10); // Defines the number of items per page.
  const [totalPages, setTotalPages] = useState(0); // Tracks the total number of pages.

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    column: null,
    value: null,
  });

  const [filters, setFilters] = useState({}); // State to track active filters

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
      setFilteredData(data); // Set both tableData and filteredData
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentVouchers();
  }, []);

  const fetchFilteredData = async (append = false) => {
    try {
      setLoading(true);
      setError("");

      // Build the query string with filters, page, and limit.
      const queryString = new URLSearchParams({
        ...filters,
        page: currentPage,
        limit: pageSize,
      }).toString();

      const response = await fetch(
        `http://localhost:3000/payment-vouchers/v1/filter?${queryString}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch filtered payment vouchers");
      }

      const { data, total } = await response.json(); // Assuming API provides `total`.

      setTotalPages(Math.ceil(total / pageSize)); // Calculate the total number of pages.

      if (append) {
        // Append new data if this is a "Load More" operation.
        setFilteredData((prevData) => [...prevData, ...data]);
      } else {
        // Replace data for fresh filters.
        setFilteredData(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    setCurrentPage((prevPage) => prevPage + 1); // Increment the current page.
  };
  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      fetchFilteredData(true); // Append data when the page changes.
    }
  }, [currentPage]);

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

      const updatedData = await response.json();

      setTableData((prevData) =>
        prevData.map((row) =>
          row.id === updatedRow.id ? { ...row, ...updatedRow } : row
        )
      );

      setFilteredData((prevData) =>
        prevData.map((row) =>
          row.id === updatedRow.id ? { ...row, ...updatedRow } : row
        )
      );

      setIsEditModalOpen(false);
      setNotification({
        type: "success",
        message: "Payment voucher updated successfully!",
      });
    } catch (error) {
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

      setFilteredData((prevData) =>
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

  const handleFilterApply = () => {
    setCurrentPage(1);
    fetchFilteredData();
  };

  const handleClearFilters = () => {
    setFilters({});
    setCurrentPage(1);
    fetchPaymentVouchers(); // Reset to original data
  };

  const handleContextMenu = (e, column, value) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      column,
      value,
    });
  };

  const handleFilterColumn = () => {
    const { column, value } = contextMenu;
    if (!column || value === null) return;

    setFilters((prevFilters) => ({ ...prevFilters, [column]: value }));

    closeContextMenu();
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, column: null, value: null });
  };

  const formatNumber = (value) => {
    if (isNaN(value) || value === null) return "0.00";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="payment-voucher-container" onClick={closeContextMenu}>
      <div className="payment-voucher-header">
        <div className="payment-voucher-header-content">
          <h1 className="payment-voucher-title">PAYMENTS</h1>
          <button
            className="payment-voucher-filter-btn"
            onClick={handleFilterApply}
          >
            Apply Filters
          </button>
          <button
            className="payment-voucher-clear-btn"
            onClick={handleClearFilters}
          >
            Clear Filters
          </button>
        </div>
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
            {filteredData.map((row, index) => (
              <tr key={index}>
                <td className="payment-voucher-select">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row.id)}
                    onChange={() => handleRowSelect(row.id)}
                  />
                </td>
                <td
                  className="payment-voucher-supplier"
                  onContextMenu={(e) =>
                    handleContextMenu(e, "supplierId", row.supplierId)
                  }
                >
                  {row.supplierName}
                </td>
                <td
                  className="payment-voucher-amount"
                  onContextMenu={(e) =>
                    handleContextMenu(e, "amount", row.details[0]?.amount)
                  }
                >
                  {formatNumber(row.details[0]?.amount)}
                </td>
                <td
                  className="payment-voucher-payment-type"
                  onContextMenu={(e) =>
                    handleContextMenu(e, "paymentType", row.paymentType)
                  }
                >
                  {row.paymentType}
                </td>
                <td
                  className="payment-voucher-date"
                  onContextMenu={(e) => handleContextMenu(e, "date", row.date)}
                >
                  {row.date}
                </td>
                <td
                  className="payment-voucher-type"
                  onContextMenu={(e) => handleContextMenu(e, "type", row.type)}
                >
                  {row.type}
                </td>
                <td
                  className="payment-voucher-exchange-rate"
                  onContextMenu={(e) =>
                    handleContextMenu(
                      e,
                      "exchangeRate",
                      row.details[0]?.exchangeRate
                    )
                  }
                >
                  {formatNumber(row.details[0]?.exchangeRate)}
                </td>
                <td
                  className="payment-voucher-amount-exchanged"
                  onContextMenu={(e) =>
                    handleContextMenu(
                      e,
                      "amountExchanged",
                      row.details[0]?.amountExchanged
                    )
                  }
                >
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
      )}
      {currentPage < totalPages && (
        <div className="load-more-container">
        <button className="load-more-btn" onClick={handleLoadMore}>
          Load More
        </button>
        </div>
      )}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <button onClick={handleFilterColumn}>Add to Filters</button>
        </div>
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
