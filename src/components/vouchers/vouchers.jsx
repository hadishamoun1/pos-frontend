import React, { useState } from "react";
import "./vouchers.css";
import AccountSelectionModal from "./acc-modal-selection";

const JournalVoucherPage = () => {
  const [date, setDate] = useState("");
  const [entries, setEntries] = useState([
    {
      accountNumber: "",
      accountName: "",
      currency: "USD",
      debit: 0,
      credit: 0,
      exchangeRate: 1,
      debitUSD: 0,
      creditUSD: 0,
      debitEx: 0,
      creditEx: 0,
      description: "",
      documentNbr: "",
    },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const handleAddRow = () => {
    setEntries([
      ...entries,
      {
        accountNumber: "",
        accountName: "",
        currency: "USD",
        debit: 0,
        credit: 0,
        exchangeRate: 1,
        debitUSD: 0,
        creditUSD: 0,
        debitEx: 0,
        creditEx: 0,
        description: "",
        documentNbr: "",
      },
    ]);
  };

  const handleInputChange = (index, field, value) => {
    const updatedEntries = [...entries];
    updatedEntries[index][field] = [
      "debit",
      "credit",
      "exchangeRate",
      "debitEx",
      "creditEx",
      "debitUSD",
      "creditUSD",
    ].includes(field)
      ? parseFloat(value) || 0
      : value;

    if (field === "debit" || field === "exchangeRate") {
      updatedEntries[index].debitEx =
        updatedEntries[index].debit * updatedEntries[index].exchangeRate;
    }
    if (field === "credit" || field === "exchangeRate") {
      updatedEntries[index].creditEx =
        updatedEntries[index].credit * updatedEntries[index].exchangeRate;
    }

    setEntries(updatedEntries);
  };

  const handleAccountSelection = (account) => {
    const updatedEntries = [...entries];
    updatedEntries[currentRowIndex].accountNumber = account.accountNumber;
    updatedEntries[currentRowIndex].accountName = account.accountName;
    setEntries(updatedEntries);
    setIsModalOpen(false);
  };

  const handleAccountNumberClick = (index) => {
    setCurrentRowIndex(index);
    setIsModalOpen(true);
  };

  const handleRightClick = (event, rowIndex) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      rowIndex,
    });
  };

  const handleDeleteRow = () => {
    if (contextMenu.rowIndex !== null) {
      setEntries(entries.filter((_, index) => index !== contextMenu.rowIndex));
      setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null });
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  const totalDebit = entries.reduce(
    (sum, entry) => sum + (entry.debit || 0),
    0
  );
  const totalCredit = entries.reduce(
    (sum, entry) => sum + (entry.credit || 0),
    0
  );
  const totalDebitUSD = entries.reduce(
    (sum, entry) => sum + (entry.currency === "EUR" ? entry.debitUSD || 0 : 0),
    0
  );
  const totalCreditUSD = entries.reduce(
    (sum, entry) => sum + (entry.currency === "EUR" ? entry.creditUSD || 0 : 0),
    0
  );
  const totalDebitLL = entries.reduce(
    (sum, entry) => sum + (entry.debitEx || 0),
    0
  );
  const totalCreditLL = entries.reduce(
    (sum, entry) => sum + (entry.creditEx || 0),
    0
  );

  const handleSubmit = () => {
    const journalVoucher = { date, entries };
    console.log(journalVoucher);
    alert("Journal Voucher Submitted");
  };

  const isEqual = totalDebit === totalCredit;
  const isUSDEqual = totalDebitUSD === totalCreditUSD;
  const isLLEqual = totalDebitLL === totalCreditLL;

  return (
    <div
      className="general-vouchers-container"
      onClick={handleCloseContextMenu}
    >
      <AccountSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleAccountSelection}
      />
      <div className="general-vouchers-header">
        <h2 className="general-vouchers-title">Journal Voucher</h2>
      </div>
      <div className="general-vouchers-date-wrapper">
        <label className="general-vouchers-label">
          Date:
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="general-vouchers-input"
          />
        </label>
        <button
          className="general-vouchers-submit-btn"
          onClick={handleSubmit}
          disabled={totalDebit !== totalCredit || totalDebit === 0}
        >
          Submit
        </button>
      </div>
      <div className="general-vouchers-table-container">
        <table className="general-vouchers-table">
          <thead>
            <tr>
              <th className="column-account-number">Acc Nb</th>
              <th className="column-account-name">Account Name</th>
              <th className="column-currency">Currency</th>
              <th className="column-debit">Debit</th>
              <th className="column-credit">Credit</th>
              <th className="column-exchange-rate-eur-usd">Exc (EUR to USD)</th>
              <th className="column-exchange-rate">Exc Rate</th>
              <th className="column-debit-usd">Debit USD</th>
              <th className="column-credit-usd">Credit USD</th>
              <th className="column-debit-ex">Debit LL</th>
              <th className="column-credit-ex">Credit LL</th>
              <th className="column-description">Description</th>
              <th className="column-document-nbr">Doc Nbr</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index} onContextMenu={(e) => handleRightClick(e, index)}>
                <td onClick={() => handleAccountNumberClick(index)}>
                  <input
                    type="text"
                    value={entry.accountNumber}
                    placeholder="Acc Nbr"
                    readOnly
                    className="general-vouchers-input column-account-number"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.accountName}
                    readOnly
                    placeholder="Account Name"
                    className="general-vouchers-input column-account-name"
                  />
                </td>
                <td>
                  <select
                    value={entry.currency}
                    onChange={(e) =>
                      handleInputChange(index, "currency", e.target.value)
                    }
                    className="general-vouchers-input column-currency"
                  >
                    <option value="USD">USD</option>
                    <option value="LL">LL</option>
                    <option value="EUR">EUR</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={entry.debit}
                    placeholder="Debit Number"
                    onChange={(e) =>
                      handleInputChange(index, "debit", e.target.value)
                    }
                    className="general-vouchers-input column-debit"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={entry.credit}
                    placeholder="Credit Number"
                    onChange={(e) =>
                      handleInputChange(index, "credit", e.target.value)
                    }
                    className="general-vouchers-input column-credit"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={entry.exchangeRateEURtoUSD || ""}
                    placeholder="Exc EUR to USD"
                    disabled={entry.currency !== "EUR"}
                    onChange={(e) =>
                      handleInputChange(
                        index,
                        "exchangeRateEURtoUSD",
                        e.target.value
                      )
                    }
                    className={`general-vouchers-input column-exchange-rate-eur-usd ${
                      entry.currency !== "EUR" ? "disabled-input" : ""
                    }`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={entry.exchangeRate}
                    placeholder="Exchange Rate"
                    onChange={(e) =>
                      handleInputChange(index, "exchangeRate", e.target.value)
                    }
                    className="general-vouchers-input column-exchange-rate"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={entry.debitUSD}
                    placeholder="Debit USD"
                    disabled={entry.currency !== "EUR"}
                    onChange={(e) =>
                      handleInputChange(index, "debitUSD", e.target.value)
                    }
                    className={`general-vouchers-input column-debit-usd ${
                      entry.currency !== "EUR" ? "disabled-input" : ""
                    }`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={entry.creditUSD}
                    placeholder="Credit USD"
                    disabled={entry.currency !== "EUR"}
                    onChange={(e) =>
                      handleInputChange(index, "creditUSD", e.target.value)
                    }
                    className={`general-vouchers-input column-credit-usd ${
                      entry.currency !== "EUR" ? "disabled-input" : ""
                    }`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={entry.debitEx}
                    placeholder="Debit Ex Num"
                    readOnly
                    className="general-vouchers-input column-debit-ex"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={entry.creditEx}
                    placeholder="Credit Ex Num"
                    readOnly
                    className="general-vouchers-input column-credit-ex"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.description}
                    placeholder="Description"
                    onChange={(e) =>
                      handleInputChange(index, "description", e.target.value)
                    }
                    className="general-vouchers-input column-description"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.documentNbr}
                    placeholder="Doc Nbr"
                    onChange={(e) =>
                      handleInputChange(index, "documentNbr", e.target.value)
                    }
                    className="general-vouchers-input column-document-nbr"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="general-vouchers-add-row-container">
        <button className="general-vouchers-new-btn" onClick={handleAddRow}>
          Add Row
        </button>
      </div>
      <div className="general-vouchers-summary">
        <div className="summary-row">
          <span className="summary-total-txt">
            Total Debit:{" "}
            <span className={`number ${isEqual ? "equal" : "not-equal"}`}>
              {totalDebit.toFixed(2)}
            </span>
          </span>
          <span className="summary-total-txt">
            Total Credit:{" "}
            <span className={`number ${isEqual ? "equal" : "not-equal"}`}>
              {totalCredit.toFixed(2)}
            </span>
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-total-txt">
            Total Debit USD:{" "}
            <span className={`number ${isUSDEqual ? "equal" : "not-equal"}`}>
              {totalDebitUSD.toFixed(2)}
            </span>
          </span>
          <span className="summary-total-txt">
            Total Credit USD:{" "}
            <span className={`number ${isUSDEqual ? "equal" : "not-equal"}`}>
              {totalCreditUSD.toFixed(2)}
            </span>
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-total-txt">
            Total Debit LL:{" "}
            <span className={`number ${isLLEqual ? "equal" : "not-equal"}`}>
              {totalDebitLL.toFixed(2)}
            </span>
          </span>
          <span className="summary-total-txt">
            Total Credit LL:{" "}
            <span className={`number ${isLLEqual ? "equal" : "not-equal"}`}>
              {totalCreditLL.toFixed(2)}
            </span>
          </span>
        </div>
      </div>

      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="context-menu-item" onClick={handleDeleteRow}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default JournalVoucherPage;
