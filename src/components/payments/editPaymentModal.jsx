import React, { useState, useEffect } from "react";
import PayeeModal from "./PayeeModal";
import "./editPaymentModal.css";

const EditPaymentModal = ({ onClose, row, onSave, isSaving }) => {
  const [rowData, setRowData] = useState({
    payee: "",
    payeeType: "",
    supplierId: "",
    accountId: "",
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
  const [isPayeeModalOpen, setIsPayeeModalOpen] = useState(false);

  useEffect(() => {
    if (row) {
      const detail = row.details?.[0] || {};
      const derivedCurrency = row.paymentType?.includes("USD") ? "USD" : "LL";
      const isAccount = !row.supplierId && !!row.accountId;
      setRowData({
        payee: isAccount
          ? (row.accountName || "")
          : (row.supplierName || ""),
        payeeType: isAccount ? "account" : "supplier",
        supplierId: row.supplierId || "",
        accountId: row.accountId || "",
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

  const handleSelectPayee = (payee) => {
    setRowData((prev) => ({
      ...prev,
      payee: payee.displayName,
      payeeType: payee.type,
      supplierId: payee.type === "supplier" ? payee.id : "",
      accountId: payee.type === "account" ? payee.id : "",
    }));
    setIsPayeeModalOpen(false);
  };

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

  // ── NEW: normalize Arabic-Indic & Persian digits to ASCII ──────────────
  const normalizeDigits = (value) =>
    value
      .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660) // Arabic-Indic: ٠=0x0660
      .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06F0); // Persian: ۰=0x06F0
  // ───────────────────────────────────────────────────────────────────────

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setRowData((prev) => {
      let updated = {
        ...prev,
        [name]:
          name === "amount" || name === "exchangeRate" || name === "amountExchanged"
            ? normalizeDigits(value).replace(/,/g, "") // ← normalize first, then strip commas
            : value,
      };

      if (name === "paymentType") {
        updated.currency = value.includes("USD") ? "USD" : "LL";
      }

      return recalculate(updated, name);
    });
  };

  const formatNumber = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    const num = parseFloat(String(value).replace(/,/g, ""));
    if (isNaN(num)) return "";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const handleSave = () => {
    const updatedRow = {
      ...row,
      ...(rowData.payeeType === "account"
        ? { accountId: rowData.accountId, supplierId: null }
        : { supplierId: rowData.supplierId, accountId: null }),
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
            <button onClick={handleSave} className="edit-payment-modal-save" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>
            <button onClick={onClose} className="edit-payment-modal-cancel" disabled={isSaving}>Cancel</button>
          </div>
        </div>

        <table className="edit-payment-modal-table">
          <thead>
            <tr>
              <th className="edit-payment-modal-supplier">Payee</th>
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
                  value={rowData.payee}
                  readOnly
                  onClick={() => setIsPayeeModalOpen(true)}
                  placeholder="Select Payee"
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

      {isPayeeModalOpen && (
        <PayeeModal
          onClose={() => setIsPayeeModalOpen(false)}
          onSelectPayee={handleSelectPayee}
        />
      )}
    </div>
  );
};

export default EditPaymentModal;