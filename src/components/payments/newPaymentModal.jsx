import React, { useState } from "react";
import SupplierModal from "./suppliersModal";
import NotificationModal from "../recievables/NotificationModal";
import "./newPaymentModal.css";
import { axiosClient } from "../api/axiosClient";

const emptyRow = () => ({
  supplier: "",
  supplierId: "",
  amount: "",
  currency: "",
  date: "",
  type: "S",
  exchangeRate: "89500",
  amountExchanged: "",
  checkNumber: "",
  bankName: "",
  dueDate: "",
  comments: "",
  paymentType: "",
});

const PaymentsModal = ({ onClose }) => {
  const [rows, setRows] = useState([emptyRow()]);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [notificationData, setNotificationData] = useState({
    type: "",
    message: "",
  });

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(num)) return value;
    return num.toLocaleString("en-US");
  };

  const recalculate = (row, changedField) => {
    const amount = parseFloat(row.amount || "0");
    const exchangeRate = parseFloat(row.exchangeRate || "0");
    const amountExchanged = parseFloat(row.amountExchanged || "0");

    if (row.currency === "USD") {
      if (changedField === "amount" || changedField === "exchangeRate") {
        row.amountExchanged =
          amount && exchangeRate ? (amount * exchangeRate).toFixed(2) : "";
      } else if (changedField === "amountExchanged") {
        row.exchangeRate =
          amount && amountExchanged ? (amountExchanged / amount).toFixed(2) : row.exchangeRate;
      }
    } else if (row.currency === "LL") {
      if (changedField === "amount" || changedField === "exchangeRate") {
        row.amountExchanged =
          amount && exchangeRate ? (amount / exchangeRate).toFixed(2) : "";
      } else if (changedField === "amountExchanged") {
        row.exchangeRate =
          amountExchanged && amount ? (amount / amountExchanged).toFixed(2) : row.exchangeRate;
      }
    }

    return row;
  };

  const handleInputChange = (index, e) => {
    const { name, value } = e.target;

    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index] };

      if (name === "paymentType") {
        row.currency = value.includes("USD") ? "USD" : value ? "LL" : "";
        if (value.includes("Cash")) {
          row.checkNumber = "";
          row.bankName = "";
          row.dueDate = "";
        }
      }

      row[name] =
        name === "amount" ||
        name === "exchangeRate" ||
        name === "amountExchanged"
          ? value.replace(/,/g, "")
          : value;

      next[index] = recalculate(row, name);
      return next;
    });
  };

  const openSupplierModal = (index) => {
    setActiveRowIndex(index);
    setIsSupplierModalOpen(true);
  };

  const handleSelectSupplier = (supplier) => {
    setRows((prev) => {
      const next = [...prev];
      next[activeRowIndex] = {
        ...next[activeRowIndex],
        supplier: supplier.supplierName,
        supplierId: supplier.id,
      };
      return next;
    });
    setIsSupplierModalOpen(false);
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const handleContextMenu = (e, index) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      rowIndex: index,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      rowIndex: null,
    });
  };

  const handleDeleteRow = () => {
    setRows((prev) => {
      if (prev.length === 1) return [emptyRow()];
      return prev.filter((_, index) => index !== contextMenu.rowIndex);
    });
    handleCloseContextMenu();
  };

  const handleSubmit = async () => {
    try {
      const payload = rows.map((row) => ({
        supplierId: row.supplierId,
        date: row.date,
        invoiceId: "",
        paymentType: row.paymentType,
        type: row.type,
        doneBy: "",
        details: [
          {
            amount: parseFloat(row.amount || 0),
            currency: row.currency,
            exchangeRate: parseFloat(row.exchangeRate || 0),
            amountExchanged: parseFloat(row.amountExchanged || 0),
            checkDueDate: row.dueDate,
            checkNumber: row.checkNumber,
            checkDate: row.date,
            bankName: row.bankName,
            description: row.comments,
          },
        ],
      }));

      await axiosClient.post("/payment-vouchers/v1/bulk", payload);

      setRows([emptyRow()]);
      setNotificationData({
        type: "success",
        message: "Payment voucher created successfully!",
      });
      setIsNotificationVisible(true);
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data ||
        error?.message ||
        "Failed to create payment voucher";

      setNotificationData({
        type: "error",
        message: String(msg),
      });
      setIsNotificationVisible(true);
    }
  };

  return (
    <div
      className="payment-voucher-modal-overlay"
      onClick={handleCloseContextMenu}
    >
      <div
        className="payment-voucher-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="payment-voucher-modal-header">
          <h1>New Payment Voucher</h1>

          <div className="payment-voucher-modal-actions">
            <button
              onClick={handleSubmit}
              className="payment-voucher-modal-save"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="payment-voucher-modal-cancel"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="payment-voucher-modal-table-wrapper">
          <table className="payment-voucher-modal-table">
            <thead>
              <tr>
                <th className="payment-voucher-modal-supplier">Supplier</th>
                <th className="payment-voucher-modal-payment-type">Pmt Type</th>
                <th className="payment-voucher-modal-currency">Currency</th>
                <th className="payment-voucher-modal-amount">Amount</th>
                <th className="payment-voucher-modal-date">Date</th>
                <th className="payment-voucher-modal-type">Type</th>
                <th className="payment-voucher-modal-exchange-rate">Ex Rate</th>
                <th className="payment-voucher-modal-amount-exchanged">Amount Ex</th>
                <th className="payment-voucher-modal-check-number">Check #</th>
                <th className="payment-voucher-modal-bank-name">Bank Name</th>
                <th className="payment-voucher-modal-due-date">Due Date</th>
                <th className="payment-voucher-modal-comments">Comment</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={index} onContextMenu={(e) => handleContextMenu(e, index)}>
                  <td className="payment-voucher-modal-supplier">
                    <input
                      type="text"
                      value={row.supplier}
                      readOnly
                      onClick={() => openSupplierModal(index)}
                      placeholder="Select Supplier"
                    />
                  </td>

                  <td className="payment-voucher-modal-payment-type">
                    <select
                      name="paymentType"
                      value={row.paymentType}
                      onChange={(e) => handleInputChange(index, e)}
                    >
                      <option value="">Select</option>
                      <option value="Cash USD">Cash USD</option>
                      <option value="Cash LL">Cash LL</option>
                      <option value="Check USD">Check USD</option>
                      <option value="Check LL">Check LL</option>
                    </select>
                  </td>

                  <td className="payment-voucher-modal-currency">
                    <input
                      type="text"
                      name="currency"
                      value={row.currency}
                      readOnly
                    />
                  </td>

                  <td className="payment-voucher-modal-amount">
                    <input
                      type="text"
                      name="amount"
                      value={formatNumber(row.amount)}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Enter amount"
                    />
                  </td>

                  <td className="payment-voucher-modal-date">
                    <input
                      type="date"
                      name="date"
                      value={row.date}
                      onChange={(e) => handleInputChange(index, e)}
                    />
                  </td>

                  <td className="payment-voucher-modal-type">
                    <select
                      name="type"
                      value={row.type}
                      onChange={(e) => handleInputChange(index, e)}
                    >
                      <option value="">Select</option>
                      <option value="S">S</option>
                      <option value="G">G</option>
                    </select>
                  </td>

                  <td className="payment-voucher-modal-exchange-rate">
                    <input
                      type="text"
                      name="exchangeRate"
                      value={formatNumber(row.exchangeRate)}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Enter exchange rate"
                    />
                  </td>

                  <td className="payment-voucher-modal-amount-exchanged">
                    <input
                      type="text"
                      name="amountExchanged"
                      value={formatNumber(row.amountExchanged)}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Enter amount ex"
                    />
                  </td>

                  <td className="payment-voucher-modal-check-number">
                    <input
                      type="text"
                      name="checkNumber"
                      value={row.checkNumber}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Enter check number"
                      disabled={row.paymentType?.includes("Cash")}
                    />
                  </td>

                  <td className="payment-voucher-modal-bank-name">
                    <input
                      type="text"
                      name="bankName"
                      value={row.bankName}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Enter bank name"
                      disabled={row.paymentType?.includes("Cash")}
                    />
                  </td>

                  <td className="payment-voucher-modal-due-date">
                    <input
                      type="date"
                      name="dueDate"
                      value={row.dueDate}
                      onChange={(e) => handleInputChange(index, e)}
                      disabled={row.paymentType?.includes("Cash")}
                    />
                  </td>

                  <td className="payment-voucher-modal-comments">
                    <input
                      type="text"
                      name="comments"
                      value={row.comments}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Enter comments"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="payment-voucher-modal-footer">
          <button onClick={addRow} className="payment-voucher-modal-add-row">
            Add Row
          </button>
        </div>

        {contextMenu.visible && (
          <div
            className="payment-voucher-modal-context-menu"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={handleDeleteRow}>Delete Row</button>
            <button onClick={handleCloseContextMenu}>Close</button>
          </div>
        )}

        {isSupplierModalOpen && (
          <SupplierModal
            onClose={() => setIsSupplierModalOpen(false)}
            onSelectSupplier={handleSelectSupplier}
          />
        )}

        {isNotificationVisible && (
          <NotificationModal
            type={notificationData.type}
            message={notificationData.message}
            onClose={() => setIsNotificationVisible(false)}
          />
        )}
      </div>
    </div>
  );
};

export default PaymentsModal;