import React, { useEffect, useState } from "react";
import "./acc-modal-selection.css";

const AccountSelectionModal = ({ isOpen, onClose, onSelect }) => {
  const [accounts, setAccounts] = useState([]);
  const [sortedAccounts, setSortedAccounts] = useState([]);
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

      // Ensure all accounts have `children` initialized as an array
      const accountsWithChildren = data.map((account) => ({
        ...account,
        children: account.children || [],
      }));

      setAccounts(accountsWithChildren);
      const sorted = sortAccounts(accountsWithChildren);
      setSortedAccounts(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sortAccounts = (accounts) => {
    const accountMap = new Map();

    // Step 1: Map accounts by their accountNumber
    accounts.forEach((account) => {
      account.children = account.children || []; // Ensure children is always an array
      accountMap.set(account.accountNumber, account);
    });

    // Step 2: Populate children relationships
    accounts.forEach((account) => {
      if (account.parentNumber) {
        const parent = accountMap.get(account.parentNumber);
        if (parent) {
          parent.children.push(account);
        }
      }
    });

    // Step 3: Recursively flatten the hierarchy
    const flattenAccounts = (accountList, result = [], level = 0) => {
      accountList.forEach((account) => {
        account.level = level; // Add level for indentation
        result.push(account);
        if (account.children && account.children.length > 0) {
          flattenAccounts(account.children, result, level + 1);
        }
      });
      return result;
    };

    // Get root accounts (accounts without a parent)
    const rootAccounts = accounts.filter((account) => !account.parentNumber);

    return flattenAccounts(rootAccounts);
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
            <div className="acc-modal-selection-table-wrapper">
              <table className="acc-modal-selection-table">
                <thead>
                  <tr>
                    <th>Account Number</th>
                    <th>Account Name</th>
                    <th>Arabic Account Name</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map((account) => (
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
                      <td style={{ paddingLeft: `${account.level * 20}px` }}>
                        {account.accountNumber}
                      </td>
                      <td>{account.accountName}</td>
                      <td className="arabic-text">
                        {account.arabicAccountName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSelectionModal;
