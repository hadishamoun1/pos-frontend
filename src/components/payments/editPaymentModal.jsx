import React, { useState, useEffect } from "react";
import "./editPaymentModal.css";

const EditPaymentModal = ({ onClose, row, onSave }) => {
  const [rowData, setRowData] = useState({
    supplier: "",
    amount: "",
    currency: "",
    date: "",
    type: "",
    exchangeRate: "1",
    amountExchanged: "",
    checkNumber: "",
    bankName: "",
    dueDate: "",
    paymentNumber: "",
    comments: "",
    paymentType: "",
  });

  useEffect(() => {
    if (row) {
      const detail = row.details?.[0] || {};
      const derivedCurrency = row.paymentType?.includes("USD") ? "USD" : "LL";
      setRowData({
        supplier: row.supplierName || "",
        amount: detail.amount || "",
        currency: derivedCurrency,
        date: row.date || "",
        type: row.type || "",
        exchangeRate: detail.exchangeRate || "1",
        amountExchanged: detail.amountExchanged || "",
        checkNumber: detail.checkNumber || "",
        bankName: detail.bankName || "",
        dueDate: detail.checkDueDate || "",
        paymentNumber: row.paymentNumber || "",
        comments: detail.description || "",
        paymentType: row.paymentType || "",
      });
    }
  }, [row]);

  const recalculate = (data, changedField) => {
    const amount = parseFloat(data.amount || "0");
    const exchangeRate = parseFloat(data.exchangeRate || "1");
    const amountExchanged = parseFloat(data.amountExchanged || "0");

    if (data.currency === "USD") {
      // USD: amountExchanged = amount * exchangeRate
      if (changedField === "amount" || changedField === "exchangeRate") {
        data.amountExchanged = (amount * exchangeRate).toFixed(2);
      } else if (changedField === "amountExchanged" && amount > 0) {
        data.exchangeRate = (amountExchanged / amount).toFixed(2);
      }
    } else {
      // LL: amountExchanged = amount / exchangeRate
      if (changedField === "amount" || changedField === "exchangeRate") {
        if (exchangeRate > 0) {
          data.amountExchanged = (amount / exchangeRate).toFixed(2);
        }
      } else if (changedField === "amountExchanged" && amountExchanged > 0) {
        data.exchangeRate = (amount / amountExchanged).toFixed(2);
      }
    }

    return data;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setRowData((prev) => {
      let updated = {
        ...prev,
        [name]:
          name === "amount" || name === "exchangeRate" || name === "amountExchanged"
            ? value.replace(/,/g, "")
            : value,
      };

      if (name === "paymentType") {
        updated.currency = value.includes("USD") ? "USD" : "LL";
      }

      return recalculate(updated, name);
    });
  };

  const formatNumber = (value) => {
    if (!value) return "";
    return new Intl.NumberFormat().format(value);
  };

  const handleSave = () => {
    const updatedRow = {
      ...row,
      supplierId: row.supplierId,
      supplierName: rowData.supplier,
      date: rowData.date,
      invoiceId: row.invoiceId || "",
      paymentNumber: rowData.paymentNumber,
      paymentType: rowData.paymentType,
      type: rowData.type,
      details: [
        {
          amount: parseFloat(rowData.amount),
          currency: rowData.currency,
          exchangeRate: parseFloat(rowData.exchangeRate),
          amountExchanged: parseFloat(rowData.amountExchanged),
          checkNumber: rowData.checkNumber,
          checkDate: rowData.date,
          checkDueDate: rowData.dueDate,
          bankName: rowData.bankName,
          description: rowData.comments,
        },
      ],
    };

    onSave(updatedRow);
  };

  return (
    <div className="edit-payment-modal-overlay">
      <div className="edit-payment-modal-container">
        <div className="edit-payment-modal-header">
          <h1>Edit Payment Voucher</h1>
          <div className="edit-payment-modal-actions">
            <button onClick={handleSave} className="edit-payment-modal-save">Save</button>
            <button onClick={onClose} className="edit-payment-modal-cancel">Cancel</button>
          </div>
        </div>

        <table className="edit-payment-modal-table">
          <thead>
            <tr>
              <th className="edit-payment-modal-supplier">Supplier</th>
              <th className="edit-payment-modal-payment-type">Pmt Type</th>
              <th className="edit-payment-modal-currency">Currency</th>
              <th className="edit-payment-modal-amount">Amount</th>
              <th className="edit-payment-modal-date">Date</th>
              <th className="edit-payment-modal-type">Type</th>
              <th className="edit-payment-modal-exchange-rate">Ex Rate</th>
              <th className="edit-payment-modal-amount-exchanged">Amount Ex</th>
              <th className="edit-payment-modal-check-number">Check #</th>
              <th className="edit-payment-modal-bank-name">Bank Name</th>
              <th className="edit-payment-modal-due-date">Due Date</th>
              <th className="edit-payment-modal-payment-number">Payment #</th>
              <th className="edit-payment-modal-comments">Comment</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <input
                  type="text"
                  name="supplier"
                  value={rowData.supplier}
                  onChange={handleInputChange}
                  placeholder="Enter Supplier"
                />
              </td>
              <td>
                <select
                  name="paymentType"
                  value={rowData.paymentType}
                  onChange={handleInputChange}
                >
                  <option value="">Select</option>
                  <option value="Cash USD">Cash USD</option>
                  <option value="Cash LL">Cash LL</option>
                  <option value="Check USD">Check USD</option>
                  <option value="Check LL">Check LL</option>
                </select>
              </td>
              <td>
                <input type="text" name="currency" value={rowData.currency} disabled />
              </td>
              <td>
                <input
                  type="text"
                  name="amount"
                  value={formatNumber(rowData.amount)}
                  onChange={handleInputChange}
                  placeholder="Enter Amount"
                />
              </td>
              <td>
                <input
                  type="date"
                  name="date"
                  value={rowData.date}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <select
                  name="type"
                  value={rowData.type}
                  onChange={handleInputChange}
                  disabled
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
                  value={formatNumber(rowData.exchangeRate)}
                  onChange={handleInputChange}
                  placeholder="Enter Exchange Rate"
                />
              </td>
              <td>
                <input
                  type="text"
                  name="amountExchanged"
                  value={formatNumber(rowData.amountExchanged)}
                  onChange={handleInputChange}
                  placeholder="Enter Amount Exchanged"
                />
              </td>
              <td>
                <input
                  type="text"
                  name="checkNumber"
                  value={rowData.checkNumber}
                  onChange={handleInputChange}
                  placeholder="Enter Check Number"
                  disabled={rowData.paymentType?.includes("Cash")}
                />
              </td>
              <td>
                <input
                  type="text"
                  name="bankName"
                  value={rowData.bankName}
                  onChange={handleInputChange}
                  placeholder="Enter Bank Name"
                  disabled={rowData.paymentType?.includes("Cash")}
                />
              </td>
              <td>
                <input
                  type="date"
                  name="dueDate"
                  value={rowData.dueDate}
                  onChange={handleInputChange}
                  disabled={rowData.paymentType?.includes("Cash")}
                />
              </td>
              <td>
                <input
                  type="text"
                  name="paymentNumber"
                  value={rowData.paymentNumber}
                  onChange={handleInputChange}
                  placeholder="Enter Payment Number"
                  disabled
                />
              </td>
              <td>
                <input
                  type="text"
                  name="comments"
                  value={rowData.comments}
                  onChange={handleInputChange}
                  placeholder="Enter Comments"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EditPaymentModal;