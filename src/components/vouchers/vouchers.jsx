import React, { useState } from "react";
import "./vouchers.css";

const JournalVoucherPage = () => {
  const [date, setDate] = useState("");
  const [entries, setEntries] = useState([
    { accountName: "", debit: 0, credit: 0, description: "" },
  ]);

  const handleAddRow = () => {
    setEntries([
      ...entries,
      { accountName: "", debit: 0, credit: 0, description: "" },
    ]);
  };

  const handleRemoveRow = (index) => {
    const updatedEntries = entries.filter((_, i) => i !== index);
    setEntries(updatedEntries);
  };

  const handleInputChange = (index, field, value) => {
    const updatedEntries = [...entries];
    updatedEntries[index][field] =
      field === "debit" || field === "credit" ? parseFloat(value) || 0 : value;
    setEntries(updatedEntries);
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
            <th>Account Name</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  value={entry.accountName}
                  onChange={(e) =>
                    handleInputChange(index, "accountName", e.target.value)
                  }
                  required
                  className="general-vouchers-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={entry.debit}
                  onChange={(e) =>
                    handleInputChange(index, "debit", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={entry.credit}
                  onChange={(e) =>
                    handleInputChange(index, "credit", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={entry.description}
                  onChange={(e) =>
                    handleInputChange(index, "description", e.target.value)
                  }
                  className="general-vouchers-input"
                />
              </td>
              <td>
                <button
                  className="general-vouchers-delete-btn"
                  onClick={() => handleRemoveRow(index)}
                >
                  Remove
                </button>
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
