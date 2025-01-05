import React, { useState } from "react";
import SupplierModal from "./suppliersModal";
import "./newPaymentModal.css";

const PaymentsModal = ({ onClose }) => {
  const [rows, setRows] = useState([
    {
      supplier: "",
      amount: "",
      currency: "",
      date: "",
      type: "",
      exchangeRate: "1", // Default value for USD
      amountExchanged: "",
      checkNumber: "",
      bankName: "",
      dueDate: "",
      paymentNumber: "",
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

  const formatNumber = (value) => {
    if (!value) return "";
    return new Intl.NumberFormat().format(value);
  };

  const handleInputChange = (index, e) => {
    const { name, value } = e.target;
    const newRows = [...rows];
    newRows[index][name] =
      name === "amount" || name === "exchangeRate" || name === "amountExchanged"
        ? value.replace(/,/g, "")
        : value;

    const amount = parseFloat(newRows[index].amount || "0");
    const amountExchanged = parseFloat(newRows[index].amountExchanged || "0");
    const exchangeRate = parseFloat(newRows[index].exchangeRate || "1");

    // Automatically calculate amountExchanged if amount and exchangeRate are provided
    if (name === "amount" || name === "exchangeRate") {
      if (newRows[index].currency === "LL" && exchangeRate > 0) {
        newRows[index].amountExchanged = (amount / exchangeRate).toFixed(2);
      }
    }

    // Automatically calculate exchangeRate if amount and amountExchanged are provided
    if (name === "amount" || name === "amountExchanged") {
      if (newRows[index].currency === "LL" && amountExchanged > 0) {
        newRows[index].exchangeRate = (amount / amountExchanged).toFixed(2);
      }
    }

    // Set exchangeRate to 1 and match amountExchanged to amount if currency is USD
    if (name === "currency" && value === "USD") {
      newRows[index].exchangeRate = "1";
      newRows[index].amountExchanged = amount.toFixed(2);
    }

    // Match amountExchanged to amount if currency is USD
    if (newRows[index].currency === "USD" && name === "amount") {
      newRows[index].amountExchanged = amount.toFixed(2);
    }

    setRows(newRows);
  };

  const openSupplierModal = (index) => {
    setActiveRowIndex(index);
    setIsSupplierModalOpen(true);
  };

  const handleSelectSupplier = (supplierName) => {
    const newRows = [...rows];
    newRows[activeRowIndex].supplier = supplierName;
    setRows(newRows);
    setIsSupplierModalOpen(false);
  };

  const addRow = () => {
    setRows([
      ...rows,
      {
        supplier: "",
        amount: "",
        currency: "",
        date: "",
        type: "",
        exchangeRate: "1", // Default value for USD
        amountExchanged: "",
        checkNumber: "",
        bankName: "",
        dueDate: "",
        paymentNumber: "",
        comments: "",
        paymentType: "",
      },
    ]);
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
    setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  const handleDeleteRow = () => {
    const newRows = rows.filter((_, index) => index !== contextMenu.rowIndex);
    setRows(newRows);
    handleCloseContextMenu();
  };

  const handleSubmit = () => {
    console.log("Submitted Data:", rows);
    onClose();
  };

  return (
    <div
      className="payment-voucher-modal-overlay"
      onClick={handleCloseContextMenu}
    >
      <div className="payment-voucher-modal-container">
        <div className="payment-voucher-modal-header">
          <h1>New Payment Voucher</h1>
          <div className="payment-voucher-modal-actions">
            <button
              onClick={handleSubmit}
              className="payment-voucher-modal-save"
            >
              Save
            </button>
            <button onClick={onClose} className="payment-voucher-modal-cancel">
              Cancel
            </button>
          </div>
        </div>

        <table className="payment-voucher-modal-table">
          <thead>
            <tr>
              <th className="payment-voucher-modal-supplier">Supplier</th>
              <th className="payment-voucher-modal-amount">Amount</th>
              <th className="payment-voucher-modal-currency">Currency</th>
              <th className="payment-voucher-modal-date">Date</th>
              <th className="payment-voucher-modal-type">Type</th>
              <th className="payment-voucher-modal-exchange-rate">Ex Rate</th>
              <th className="payment-voucher-modal-amount-exchanged">
                Amount Ex
              </th>
              <th className="payment-voucher-modal-check-number">Check #</th>
              <th className="payment-voucher-modal-bank-name">Bank Name</th>
              <th className="payment-voucher-modal-due-date">Due Date</th>
              <th className="payment-voucher-modal-payment-number">
                Payment #
              </th>
              <th className="payment-voucher-modal-comments">Comment</th>
              <th className="payment-voucher-modal-payment-type">Pmt Type</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                onContextMenu={(e) => handleContextMenu(e, index)}
              >
                {Object.keys(row).map((key) => (
                  <td key={key}>
                    {key === "supplier" ? (
                      <input
                        type="text"
                        value={row.supplier}
                        readOnly
                        onClick={() => openSupplierModal(index)}
                        placeholder="Select Supplier"
                      />
                    ) : key === "currency" ||
                      key === "type" ||
                      key === "paymentType" ? (
                      <select
                        name={key}
                        value={row[key]}
                        onChange={(e) => handleInputChange(index, e)}
                      >
                        <option value="">Select</option>
                        {key === "currency" && (
                          <>
                            <option value="USD">USD</option>
                            <option value="LL">LL</option>
                          </>
                        )}
                        {key === "type" && (
                          <>
                            <option value="Cash USD">Cash USD</option>
                            <option value="Cash LL">Cash LL</option>
                            <option value="Check USD">Check USD</option>
                            <option value="Check LL">Check LL</option>
                          </>
                        )}
                        {key === "paymentType" && (
                          <>
                            <option value="S">S</option>
                            <option value="G">G</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <input
                        type={
                          key === "date" || key === "dueDate" ? "date" : "text"
                        }
                        name={key}
                        value={
                          key === "amount" ||
                          key === "exchangeRate" ||
                          key === "amountExchanged"
                            ? formatNumber(row[key])
                            : row[key]
                        }
                        onChange={(e) => handleInputChange(index, e)}
                        placeholder={`Enter ${
                          key.charAt(0).toUpperCase() + key.slice(1)
                        }`}
                        disabled={
                          (key === "amountExchanged" &&
                            row.currency === "USD") ||
                          (key === "exchangeRate" && row.currency === "USD")
                        }
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addRow} className="payment-voucher-modal-add-row">
          Add Row
        </button>

        {contextMenu.visible && (
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
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
      </div>
    </div>
  );
};

export default PaymentsModal;
