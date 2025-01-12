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
      debit: "",
      credit: "",
      exchangeRate: 1,
      debitEx: "",
      creditEx: "",
      description: "",
      documentNbr: "",
    },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const handleAddRow = () => {
    setEntries([
      ...entries,
      {
        accountNumber: "",
        accountName: "",
        currency: "USD",
        debit: "",
        credit: "",
        exchangeRate: 1,
        debitEx: "",
        creditEx: "",
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
    ].includes(field)
      ? parseFloat(value) || 0
      : value;

    // Automatically calculate debitEx and creditEx based on exchangeRate
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

  const totalDebit = entries.reduce(
    (sum, entry) => sum + (entry.debit || 0),
    0
  );
  const totalCredit = entries.reduce(
    (sum, entry) => sum + (entry.credit || 0),
    0
  );

  const handleSubmit = () => {
    const journalVoucher = { date, entries };
    console.log(journalVoucher);
    alert("Journal Voucher Submitted");
  };

  return (
    <div className="general-vouchers-container">
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
      </div>

      <table className="general-vouchers-table">
        <thead>
          <tr>
            <th className="column-account-number">Account Nb</th>
            <th className="column-account-name">Account NM</th>
            <th className="column-currency">Currency</th>
            <th className="column-debit">Debit</th>
            <th className="column-credit">Credit</th>
            <th className="column-exchange-rate">Exc Rate</th>
            <th className="column-debit-ex">Debit Ex</th>
            <th className="column-credit-ex">Credit Ex</th>
            <th className="column-description">Description</th>
            <th className="column-document-nbr">Doc Nbr</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={index}>
              <td
                className="column-account-number"
                onClick={() => handleAccountNumberClick(index)}
              >
                <input
                  type="text"
                  value={entry.accountNumber}
                  placeholder="Acc Number"
                  readOnly
                  className="general-vouchers-input"
                />
              </td>
              <td className="column-account-name">
                <input
                  type="text"
                  value={entry.accountName}
                  placeholder="Account Name"
                  readOnly
                  onChange={(e) =>
                    handleInputChange(index, "accountName", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
              <td className="column-currency">
                <select
                  value={entry.currency}
                  onChange={(e) =>
                    handleInputChange(index, "currency", e.target.value)
                  }
                  className="general-vouchers-input"
                >
                  <option value="USD">USD</option>
                  <option value="LL">LL</option>
                  <option value="EUR">EUR</option>
                </select>
              </td>
              <td className="column-debit">
                <input
                  type="number"
                  placeholder="Debit Amount"
                  value={entry.debit}
                  onChange={(e) =>
                    handleInputChange(index, "debit", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
              <td className="column-credit">
                <input
                  type="number"
                  placeholder="Credit Amount"
                  value={entry.credit}
                  onChange={(e) =>
                    handleInputChange(index, "credit", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
              <td className="column-exchange-rate">
                <input
                  type="number"
                  value={entry.exchangeRate}
                  onChange={(e) =>
                    handleInputChange(index, "exchangeRate", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
              <td className="column-debit-ex">
                <input
                  type="number"
                  placeholder="Debit Ex"
                  value={entry.debitEx}
                  readOnly
                  className="general-vouchers-input"
                />
              </td>
              <td className="column-credit-ex">
                <input
                  type="number"
                  placeholder="Credit Ex"
                  value={entry.creditEx}
                  readOnly
                  className="general-vouchers-input"
                />
              </td>
              <td className="column-description">
                <input
                  type="text"
                  placeholder="Description"
                  value={entry.description}
                  onChange={(e) =>
                    handleInputChange(index, "description", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
              <td className="column-document-nbr">
                <input
                  type="text"
                  placeholder="Doc Nbr"
                  value={entry.documentNbr}
                  onChange={(e) =>
                    handleInputChange(index, "documentNbr", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="general-vouchers-action-buttons">
        <button className="general-vouchers-new-btn" onClick={handleAddRow}>
          Add Row
        </button>
      </div>
      <div className="general-vouchers-summary">
        <span>Total Debit: {totalDebit}</span>
        <span>Total Credit: {totalCredit}</span>
      </div>
      <div className="general-vouchers-action-buttons">
        <button
          className="general-vouchers-submit-btn"
          onClick={handleSubmit}
          disabled={totalDebit !== totalCredit || totalDebit === 0}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default JournalVoucherPage;
