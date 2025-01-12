import React, { useEffect, useState } from "react";
import './acc-modal-selection.css'

const AccountSelectionModal = ({ isOpen, onClose, onSelect }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "http://localhost:3000/accounts/v1/combined"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch accounts data");
      }
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (account) => {
    onSelect(account);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="acc-modal-selection-overlay">
      <div className="acc-modal-selection-container">
        <div className="acc-modal-selection-header">
          <h2>Select an Account</h2>
          <button className="acc-modal-selection-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="acc-modal-selection-body">
          {loading && <p>Loading accounts...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && (
            <table className="acc-modal-selection-table">
              <thead>
                <tr>
                  <th>Account Number</th>
                  <th>Account Name</th>
                  <th>Arabic Account Name</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.id}
                    onClick={() =>
                      handleSelectAccount({
                        accountNumber: account.accountNumber,
                        accountName: account.accountName,
                      })
                    }
                    className="acc-modal-selection-row"
                  >
                    <td>{account.accountNumber}</td>
                    <td>{account.accountName}</td>
                    <td>{account.arabicAccountName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSelectionModal;
