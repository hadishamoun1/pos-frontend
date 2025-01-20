import React, { useState } from "react";
import "./vouchers.css";
import AccountSelectionModal from "./acc-modal-selection";
import axios from "axios";
import NotificationModal from "../recievables/NotificationModal";

const JournalVoucherPage = () => {
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [notification, setNotification] = useState({
    visible: false,
    type: "",
    message: "",
    onConfirm: null,
  });
  const [entries, setEntries] = useState([
    {
      accountId: null,
      accountNumber: "",
      accountName: "",
      currency: "",
      debit: "",
      credit: "",
      exchangeRate: "1",
      exchangeRateEURtoUSD: "1",
      debitUSD: "",
      creditUSD: "",
      debitEx: "",
      creditEx: "",
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

  const parseNumber = (value) => {
    if (value === "" || value === null || value === undefined) return 0;
    const stringValue = value.toString().replace(/,/g, "");
    return isNaN(stringValue) ? 0 : parseFloat(stringValue);
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === "") return "";
    return parseFloat(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAddRow = () => {
    setEntries([
      ...entries,
      {
        accountId: "",
        accountNumber: "",
        accountName: "",
        currency: "",
        debit: "",
        credit: "",
        exchangeRate: "1",
        exchangeRateEURtoUSD: "1",
        debitUSD: "",
        creditUSD: "",
        debitEx: "",
        creditEx: "",
        description: "",
        documentNbr: "",
      },
    ]);
  };

  const handleInputChange = (index, field, value) => {
    const updatedEntries = [...entries];
    updatedEntries[index][field] = value;

    const entry = updatedEntries[index];
    const debit = parseNumber(entry.debit);
    const credit = parseNumber(entry.credit);
    const exchangeRate = parseNumber(entry.exchangeRate);
    const exchangeRateEURtoUSD = parseNumber(entry.exchangeRateEURtoUSD);

    if (field === "currency") {
      if (value === "USD") {
        entry.debitEx = (debit * exchangeRate).toString();
        entry.creditEx = (credit * exchangeRate).toString();
        entry.debitUSD = debit.toString();
        entry.creditUSD = credit.toString();
      } else if (value === "LL") {
        entry.debitUSD = (debit / exchangeRate).toString();
        entry.creditUSD = (credit / exchangeRate).toString();
        entry.debitEx = debit.toString();
        entry.creditEx = credit.toString();
      } else if (value === "EUR") {
        entry.debitUSD = (debit * exchangeRateEURtoUSD).toString();
        entry.creditUSD = (credit * exchangeRateEURtoUSD).toString();
        entry.debitEx = (parseNumber(entry.debitUSD) * exchangeRate).toString();
        entry.creditEx = (
          parseNumber(entry.creditUSD) * exchangeRate
        ).toString();
      }
    }

    if (entry.currency === "USD") {
      entry.debitUSD = debit.toString();
      entry.creditUSD = credit.toString();
      entry.debitEx = (debit * exchangeRate).toString();
      entry.creditEx = (credit * exchangeRate).toString();
    } else if (entry.currency === "LL") {
      entry.debitUSD = (debit / exchangeRate).toString();
      entry.creditUSD = (credit / exchangeRate).toString();
      entry.debitEx = debit.toString();
      entry.creditEx = credit.toString();
    } else if (entry.currency === "EUR") {
      entry.debitUSD = (debit * exchangeRateEURtoUSD).toString();
      entry.creditUSD = (credit * exchangeRateEURtoUSD).toString();
      entry.debitEx = (parseNumber(entry.debitUSD) * exchangeRate).toString();
      entry.creditEx = (parseNumber(entry.creditUSD) * exchangeRate).toString();
    }

    setEntries(updatedEntries);
  };

  const handleInputBlur = (index, field) => {
    const updatedEntries = [...entries];
    const value = parseNumber(updatedEntries[index][field]);
    updatedEntries[index][field] = formatNumber(value);
    setEntries(updatedEntries);
  };

  const handleAccountSelection = (account) => {
    if (currentRowIndex === null) {
      // If no specific row is selected, show an error or handle as needed

      alert("Please select a row to assign an account.");
      return;
    }

    // Set account for the selected entry
    const updatedEntries = [...entries];
    updatedEntries[currentRowIndex].accountId = account.id; // Set the accountId
    updatedEntries[currentRowIndex].accountNumber = account.accountNumber; // Set the accountNumber
    updatedEntries[currentRowIndex].accountName = account.accountName; // Set the accountName

    console.log("Updated entries after account selection:", updatedEntries); // Log updated entries
    setEntries(updatedEntries); // Update the state with modified entries
    setIsModalOpen(false); // Close the modal
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

  const totalDebit = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debit), 0)
  );
  const totalCredit = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.credit), 0)
  );
  const totalDebitUSD = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debitUSD), 0)
  );
  const totalCreditUSD = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.creditUSD), 0)
  );
  const totalDebitLL = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debitEx), 0)
  );
  const totalCreditLL = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.creditEx), 0)
  );

  const handleSubmit = async () => {
    console.log("Current entries state:", entries);
    try {
      // Validate that every entry has an accountId
      const invalidEntries = entries.filter((entry) => !entry.accountId);
      if (invalidEntries.length > 0) {
        setNotification({
          visible: true,
          type: "error",
          message: "All entries must have a valid account selected.",
        });

        console.log("Invalid entries:", invalidEntries);
        return;
      }
      if (!type) {
        setNotification({
          type: "error",
          message: "Please select a type for the Journal Voucher.",
          visible: true,
        });
        return;
      }
      if (!date) {
        setNotification({
          type: "error",
          message: "Please select a date for the Journal Voucher.",
          visible: true,
        });
        return;
      }

      // Prepare the payload
      const payload = {
        date,
        jvType: type,
        details: entries.map((entry) => ({
          accountId: entry.accountId,
          description: entry.description,
          debit: entry.debit,
          debitUSD: entry.debitUSD,
          debitLL: entry.debitEx,
          credit: entry.credit,
          creditUSD: entry.creditUSD,
          creditLL: entry.creditEx,
          currency: entry.currency,
          exchangeRateEURtoUSD: entry.exchangeRateEURtoUSD,
          exchangeRate: entry.exchangeRate,
          docNbr: entry.documentNbr,
        })),
      };
      console.log("Payload to be sent:", JSON.stringify(payload, null, 2));

      // Make the API call
      const response = await axios.post(
        "http://localhost:3000/journal-vouchers",
        payload
      );

      if (response.status === 201) {
        setNotification({
          visible: true,
          type: "success",
          message: "Journal Voucher submitted successfully!",
        });

        console.log("Response:", response.data);

        // Reset the form
        setDate("");
        setEntries([
          {
            accountId: null,
            accountNumber: "",
            accountName: "",
            currency: "",
            debit: "",
            credit: "",
            exchangeRate: "1",
            exchangeRateEURtoUSD: "1",
            debitUSD: "",
            creditUSD: "",
            debitEx: "",
            creditEx: "",
            description: "",
            documentNbr: "",
          },
        ]);
      }
    } catch (error) {
      console.error(
        "Error submitting journal voucher:",
        error.response || error.message
      );
      setNotification({
        visible: true,
        type: "error",
        message: "Failed to submit the journal voucher. Please try again.",
      });
    }
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
        <div className="date-type">
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
          <label className="general-vouchers-label">
            Type:
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
              className="general-vouchers-input"
            >
              <option value="" disabled hidden>
                Select Type
              </option>
              <option value="S">S</option>
              <option value="G">G</option>
              {/* Add other types if necessary */}
            </select>
          </label>
        </div>
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
                    <option value="" disabled hidden>
                      Select
                    </option>
                    <option value="USD">USD</option>
                    <option value="LL">LL</option>
                    <option value="EUR">EUR</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.debit}
                    placeholder="Debit"
                    onChange={(e) =>
                      handleInputChange(index, "debit", e.target.value)
                    }
                    onBlur={() => handleInputBlur(index, "debit")}
                    className="general-vouchers-input column-debit"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.credit}
                    placeholder="Credit"
                    onChange={(e) =>
                      handleInputChange(index, "credit", e.target.value)
                    }
                    onBlur={() => handleInputBlur(index, "credit")}
                    className="general-vouchers-input column-credit"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.exchangeRateEURtoUSD}
                    placeholder="Exc EUR to USD"
                    disabled={entry.currency !== "EUR"}
                    onChange={(e) =>
                      handleInputChange(
                        index,
                        "exchangeRateEURtoUSD",
                        e.target.value
                      )
                    }
                    onBlur={() =>
                      handleInputBlur(index, "exchangeRateEURtoUSD")
                    }
                    className={`general-vouchers-input column-exchange-rate-eur-usd ${
                      entry.currency !== "EUR" ? "disabled-input" : ""
                    }`}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.exchangeRate}
                    placeholder="Exchange Rate"
                    onChange={(e) =>
                      handleInputChange(index, "exchangeRate", e.target.value)
                    }
                    onBlur={() => handleInputBlur(index, "exchangeRate")}
                    className="general-vouchers-input column-exchange-rate"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.debitUSD}
                    placeholder="Debit USD"
                    readOnly={entry.currency === "USD"}
                    onChange={(e) =>
                      handleInputChange(index, "debitUSD", e.target.value)
                    }
                    onBlur={() => handleInputBlur(index, "debitUSD")}
                    className={`general-vouchers-input column-debit-usd ${
                      entry.currency === "USD" ? "readonly-input" : ""
                    }`}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={entry.creditUSD}
                    placeholder="Credit USD"
                    readOnly={entry.currency === "USD"}
                    onChange={(e) =>
                      handleInputChange(index, "creditUSD", e.target.value)
                    }
                    onBlur={() => handleInputBlur(index, "creditUSD")}
                    className={`general-vouchers-input column-credit-usd ${
                      entry.currency === "USD" ? "readonly-input" : ""
                    }`}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={formatNumber(entry.debitEx)}
                    placeholder="Debit LL"
                    readOnly
                    className="general-vouchers-input column-debit-ex"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={formatNumber(entry.creditEx)}
                    placeholder="Credit LL"
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
              {formatNumber(totalDebit)}
            </span>
          </span>
          <span className="summary-total-txt">
            Total Credit:{" "}
            <span className={`number ${isEqual ? "equal" : "not-equal"}`}>
              {formatNumber(totalCredit)}
            </span>
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-total-txt">
            Total Debit USD:{" "}
            <span className={`number ${isUSDEqual ? "equal" : "not-equal"}`}>
              {formatNumber(totalDebitUSD)}
            </span>
          </span>
          <span className="summary-total-txt">
            Total Credit USD:{" "}
            <span className={`number ${isUSDEqual ? "equal" : "not-equal"}`}>
              {formatNumber(totalCreditUSD)}
            </span>
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-total-txt">
            Total Debit LL:{" "}
            <span className={`number ${isLLEqual ? "equal" : "not-equal"}`}>
              {formatNumber(totalDebitLL)}
            </span>
          </span>
          <span className="summary-total-txt">
            Total Credit LL:{" "}
            <span className={`number ${isLLEqual ? "equal" : "not-equal"}`}>
              {formatNumber(totalCreditLL)}
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
      {notification.visible && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification({ ...notification, visible: false })}
          onConfirm={notification.onConfirm}
          confirmLabel="OK"
          cancelLabel={notification.type === "warning" ? "Cancel" : null}
        />
      )}
    </div>
  );
};

export default JournalVoucherPage;
