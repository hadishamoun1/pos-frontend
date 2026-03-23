import React, { useState } from "react";
import SupplierModal from "./suppliersModal";
import NotificationModal from "../recievables/NotificationModal";
import "./newPaymentModal.css";
import { axiosClient } from "../api/axiosClient";

const baseUrl = process.env.REACT_APP_API_BASE_URL;

const PaymentsModal = ({ onClose }) => {
  const [rows, setRows] = useState([
    {
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
    },
  ]);

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [notificationData, setNotificationData] = useState({ type: "", message: "" });

  const formatNumber = (value) => {
    if (!value) return "";
    return new Intl.NumberFormat().format(value);
  };

  const recalculate = (row, changedField) => {
    const amount = parseFloat(row.amount || "0");
    const exchangeRate = parseFloat(row.exchangeRate || "1");
    const amountExchanged = parseFloat(row.amountExchanged || "0");

    if (row.currency === "USD") {
      // USD: amountExchanged = amount * exchangeRate
      if (changedField === "amount" || changedField === "exchangeRate") {
        row.amountExchanged = (amount * exchangeRate).toFixed(2);
      } else if (changedField === "amountExchanged" && amount > 0) {
        row.exchangeRate = (amountExchanged / amount).toFixed(2);
      }
    } else {
      // LL: amountExchanged = amount / exchangeRate
      if (changedField === "amount" || changedField === "exchangeRate") {
        if (exchangeRate > 0) {
          row.amountExchanged = (amount / exchangeRate).toFixed(2);
        }
      } else if (changedField === "amountExchanged" && amountExchanged > 0) {
        row.exchangeRate = (amount / amountExchanged).toFixed(2);
      }
    }

    return row;
  };

  const handleInputChange = (index, e) => {
    const { name, value } = e.target;
    const newRows = [...rows];
    const row = { ...newRows[index] };

    if (name === "paymentType") {
      row.currency = value.includes("USD") ? "USD" : "LL";
    }

    row[name] =
      name === "amount" || name === "exchangeRate" || name === "amountExchanged"
        ? value.replace(/,/g, "")
        : value;

    newRows[index] = recalculate(row, name);
    setRows(newRows);
  };

  const openSupplierModal = (index) => {
    setActiveRowIndex(index);
    setIsSupplierModalOpen(true);
  };

  const handleSelectSupplier = (supplier) => {
    const newRows = [...rows];
    newRows[activeRowIndex].supplier = supplier.supplierName;
    newRows[activeRowIndex].supplierId = supplier.id;
    setRows(newRows);
    setIsSupplierModalOpen(false);
  };

  const addRow = () => {
    setRows([
      ...rows,
      {
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
      },
    ]);
  };

  const handleContextMenu = (e, index) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex: index });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  const handleDeleteRow = () => {
    const newRows = rows.filter((_, index) => index !== contextMenu.rowIndex);
    setRows(newRows);
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
            amount: parseFloat(row.amount),
            currency: row.currency,
            exchangeRate: parseFloat(row.exchangeRate),
            amountExchanged: parseFloat(row.amountExchanged),
            checkDueDate: row.dueDate,
            checkNumber: row.checkNumber,
            checkDate: row.date,
            bankName: row.bankName,
            description: row.comments,
          },
        ],
      }));

      await axiosClient.post(`${baseUrl}/payment-vouchers/v1/bulk`, payload);
      setRows([{
        supplier: "", supplierId: "", amount: "", currency: "",
        date: "", type: "S", exchangeRate: "89500", amountExchanged: "",
        checkNumber: "", bankName: "", dueDate: "", comments: "", paymentType: "",
      }]);
      setNotificationData({ type: "success", message: "Payment voucher created successfully!" });
      setIsNotificationVisible(true);
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data ||
        error?.message ||
        "Failed to create payment voucher";
      setNotificationData({ type: "error", message: String(msg) });
      setIsNotificationVisible(true);
    }
  };

  return (
    <div className="payment-voucher-modal-overlay" onClick={handleCloseContextMenu}>
      <div className="payment-voucher-modal-container">
        <div className="payment-voucher-modal-header">
          <h1>New Payment Voucher</h1>
          <div className="payment-voucher-modal-actions">
            <button onClick={handleSubmit} className="payment-voucher-modal-save">Save</button>
            <button onClick={onClose} className="payment-voucher-modal-cancel">Cancel</button>
          </div>
        </div>

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
                <td>
                  <input
                    type="text"
                    value={row.supplier}
                    readOnly
                    onClick={() => openSupplierModal(index)}
                    placeholder="Select Supplier"
                  />
                </td>
                <td>
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
                <td>
                  <input type="text" name="currency" value={row.currency} readOnly />
                </td>
                <td>
                  <input
                    type="text"
                    name="amount"
                    value={formatNumber(row.amount)}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Enter Amount"
                  />
                </td>
                <td>
                  <input
                    type="date"
                    name="date"
                    value={row.date}
                    onChange={(e) => handleInputChange(index, e)}
                  />
                </td>
                <td>
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
                <td>
                  <input
                    type="text"
                    name="exchangeRate"
                    value={formatNumber(row.exchangeRate)}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Enter Exchange Rate"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    name="amountExchanged"
                    value={formatNumber(row.amountExchanged)}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Enter Amount Exchanged"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    name="checkNumber"
                    value={row.checkNumber}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Enter Check Number"
                    disabled={row.paymentType?.includes("Cash")}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    name="bankName"
                    value={row.bankName}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Enter Bank Name"
                    disabled={row.paymentType?.includes("Cash")}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    name="dueDate"
                    value={row.dueDate}
                    onChange={(e) => handleInputChange(index, e)}
                    disabled={row.paymentType?.includes("Cash")}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    name="comments"
                    value={row.comments}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Enter Comments"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button onClick={addRow} className="payment-voucher-modal-add-row">Add Row</button>

        {contextMenu.visible && (
          <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <button onClick={handleDeleteRow}>Delete Row</button>
            <button onClick={handleCloseContextMenu}>Cancel</button>
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