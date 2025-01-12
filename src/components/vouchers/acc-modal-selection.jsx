import React from "react";
import "./modal.css";

const AccountSelectionModal = ({ isOpen, onClose, onSelect }) => {
  const accounts = [
    { accountNumber: "001", accountName: "Cash" },
    { accountNumber: "002", accountName: "Accounts Receivable" },
    { accountNumber: "003", accountName: "Inventory" },
  ];

  if (!isOpen) return null;

  return (
    <div className="acc-modal-selection-overlay">
      <div className="acc-modal-selection-container">
        <div className="acc-modal-selection-header">
          <h2>Select Account</h2>
          <button className="acc-modal-selection-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <table className="acc-modal-selection-table">
          <thead>
            <tr>
              <th>Account Number</th>
              <th>Account Name</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.accountNumber}
                onClick={() => onSelect(account)}
                className="acc-modal-selection-row"
              >
                <td>{account.accountNumber}</td>
                <td>{account.accountName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountSelectionModal;
