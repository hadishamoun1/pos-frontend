import React, { useState, useEffect } from "react";
import "./payments.css";
import PaymentsModal from "./newPaymentModal";
import EditPaymentModal from "./editPaymentModal";
import NotificationModal from "../recievables/NotificationModal";
import { axiosClient } from "../api/axiosClient";
import { hasPerm } from "../auth/authz";

const PaymentsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [rowToEdit, setRowToEdit] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    column: null,
    value: null,
  });

  const [filters, setFilters] = useState({});

  const canCreate = hasPerm("payments.create");
  const canUpdate = hasPerm("payments.update");
  const canDelete = hasPerm("payments.delete");

  const fetchPaymentVouchers = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/payment-vouchers/v1/formatted");
      const data = res.data || [];

      setTableData(data);
      setFilteredData(data);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to fetch payment vouchers";
      setError(String(msg));
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

      const queryString = new URLSearchParams({
        ...filters,
        page: currentPage,
        limit: pageSize,
      }).toString();

      const res = await axiosClient.get(
        `/payment-vouchers/v1/filter?${queryString}`
      );

      const payload = res.data || {};
      const data = payload.data || [];
      const total = payload.total || 0;

      setTotalPages(Math.ceil(total / pageSize));

      if (append) {
        setFilteredData((prevData) => [...prevData, ...data]);
      } else {
        setFilteredData(data);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to fetch filtered payment vouchers";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    setCurrentPage((prevPage) => prevPage + 1);
  };

  useEffect(() => {
    if (Object.keys(filters).length > 0 && currentPage > 1) {
      fetchFilteredData(true);
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
    if (!canUpdate) return;

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
      const res = await axiosClient.patch(
        `/payment-vouchers/${updatedRow.id}`,
        updatedRow
      );

      const updatedData = res.data;

      setTableData((prevData) =>
        prevData.map((row) =>
          row.id === updatedRow.id ? { ...row, ...updatedData } : row
        )
      );

      setFilteredData((prevData) =>
        prevData.map((row) =>
          row.id === updatedRow.id ? { ...row, ...updatedData } : row
        )
      );

      setIsEditModalOpen(false);
      setNotification({
        type: "success",
        message: "Payment voucher updated successfully!",
      });
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data ||
        error?.message ||
        "Failed to update payment voucher.";
      setNotification({
        type: "error",
        message: String(msg),
      });
    }
  };

  const handleDeleteConfirmation = () => {
    if (!canDelete) return;

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
        selectedRows.map((id) => axiosClient.delete(`/payment-vouchers/${id}`))
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
      const msg =
        error?.response?.data?.message ||
        error?.response?.data ||
        error?.message ||
        "Failed to delete payment voucher(s).";
      setNotification({
        type: "error",
        message: String(msg),
      });
    }
  };

  const handleNotificationClose = () => {
    setNotification(null);
  };

  const handleFilterApply = () => {
    setCurrentPage(1);
    fetchFilteredData(false);
  };

  const handleClearFilters = () => {
    setFilters({});
    setCurrentPage(1);
    fetchPaymentVouchers();
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

    setFilters((prevFilters) => ({
      ...prevFilters,
      [column]: value,
    }));

    closeContextMenu();
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, column: null, value: null });
  };

  const formatNumber = (value) => {
    if (isNaN(value) || value === null || value === undefined || value === "") {
      return "0.00";
    }

    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  };

  return (
    <div className="payment-voucher-container" onClick={closeContextMenu}>
      <div className="payment-voucher-header">
        <div className="payment-voucher-title-section">
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
          {canCreate && (
            <button
              className="payment-voucher-new-btn"
              onClick={() => setIsModalOpen(true)}
            >
              New
            </button>
          )}

          {canUpdate && (
            <button
              className="payment-voucher-edit-btn"
              onClick={handleEditClick}
            >
              Edit
            </button>
          )}

          {canDelete && (
            <button
              className="payment-voucher-delete-btn"
              onClick={handleDeleteConfirmation}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p className="loading-message">Loading payment vouchers.</p>
      ) : (
        <table className="payment-voucher-table">
          <thead>
            <tr>
              <th className="payment-voucher-select">Select</th>
              <th className="payment-voucher-supplier">Payee</th>
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
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row) => {
              const detail = row.details?.[0] || {};

              return (
                <tr key={row.id}>
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
                      handleContextMenu(e, "supplierName", row.supplierName || row.accountName)
                    }
                  >
                    {row.supplierName || row.accountName}
                  </td>

                  <td
                    className="payment-voucher-amount"
                    onContextMenu={(e) =>
                      handleContextMenu(e, "amount", detail.amount)
                    }
                  >
                    {formatNumber(detail.amount)}
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
                      handleContextMenu(e, "exchangeRate", detail.exchangeRate)
                    }
                  >
                    {formatNumber(detail.exchangeRate)}
                  </td>

                  <td
                    className="payment-voucher-amount-exchanged"
                    onContextMenu={(e) =>
                      handleContextMenu(
                        e,
                        "amountExchanged",
                        detail.amountExchanged
                      )
                    }
                  >
                    {formatNumber(detail.amountExchanged)}
                  </td>

                  <td
                    className="payment-voucher-check-number"
                    onContextMenu={(e) =>
                      handleContextMenu(e, "checkNumber", detail.checkNumber)
                    }
                  >
                    {detail.checkNumber}
                  </td>

                  <td
                    className="payment-voucher-bank-name"
                    onContextMenu={(e) =>
                      handleContextMenu(e, "bankName", detail.bankName)
                    }
                  >
                    {detail.bankName}
                  </td>

                  <td
                    className="payment-voucher-due-date"
                    onContextMenu={(e) =>
                      handleContextMenu(e, "checkDueDate", detail.checkDueDate)
                    }
                  >
                    {detail.checkDueDate}
                  </td>

                  <td
                    className="payment-voucher-payment-number"
                    onContextMenu={(e) =>
                      handleContextMenu(e, "paymentNumber", row.paymentNumber)
                    }
                  >
                    {row.paymentNumber}
                  </td>

                  <td
                    className="payment-voucher-comments"
                    onContextMenu={(e) =>
                      handleContextMenu(e, "description", detail.description)
                    }
                  >
                    {detail.description}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {Object.keys(filters).length > 0 &&
        currentPage < totalPages &&
        !loading && (
          <div className="payment-voucher-load-more">
            <button onClick={handleLoadMore}>Load More</button>
          </div>
        )}

      {contextMenu.visible && (
        <div
          className="payment-voucher-context-menu"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
          }}
        >
          <button onClick={handleFilterColumn}>Filter by this value</button>
          <button onClick={closeContextMenu}>Close</button>
        </div>
      )}

      {isModalOpen && canCreate && (
        <PaymentsModal
          onClose={() => {
            setIsModalOpen(false);
            fetchPaymentVouchers();
          }}
        />
      )}

      {isEditModalOpen && rowToEdit && canUpdate && (
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
          confirmLabel={notification.confirmLabel}
          cancelLabel={notification.cancelLabel}
        />
      )}
    </div>
  );
};

export default PaymentsPage;