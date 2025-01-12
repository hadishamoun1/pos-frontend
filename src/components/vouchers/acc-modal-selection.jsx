import React, { useEffect, useState } from "react";
import "./acc-modal-selection.css";

const AccountSelectionModal = ({ isOpen, onClose, onSelect }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/accounts/v1/combined`);
      if (!response.ok) {
        throw new Error("Failed to fetch accounts data");
      }
      const combinedData = await response.json();
      setData(
        combinedData.map((account) => ({
          ...account,
          children: account.children || [],
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderAccounts = (accounts, parentNumber = null) => {
    return accounts
      .filter((account) => account.parentNumber === parentNumber)
      .map((account) => (
        <React.Fragment key={account.id}>
          <tr
            className="acc-modal-selection-row"
            onClick={() => onSelect(account)} // Trigger parent callback
          >
            <td className="acc-modal-selection-cell">
              {account.accountNumber}
            </td>
            <td className="acc-modal-selection-cell">{account.accountName}</td>
            <td
              className="acc-modal-selection-cell arabic-text"
              style={{
                textAlign: "right",
                direction: "rtl",
              }}
            >
              {account.arabicAccountName || "N/A"}
            </td>
          </tr>

          {/* Render customer accounts under 4111 */}
          {account.accountNumber === "4111" &&
            account.children &&
            account.children
              .filter((child) => child.accountNumber.startsWith("4111"))
              .map((customer) => (
                <tr
                  key={customer.id}
                  className="acc-modal-selection-row customer-account-row"
                  onClick={() => onSelect(customer)} // Trigger parent callback
                >
                  <td className="acc-modal-selection-cell">
                    {customer.accountNumber}
                  </td>
                  <td className="acc-modal-selection-cell">
                    {customer.accountName}
                  </td>
                  <td
                    className="acc-modal-selection-cell arabic-text"
                    style={{
                      textAlign: "right",
                      direction: "rtl",
                    }}
                  >
                    {customer.arabicAccountName || "N/A"}
                  </td>
                </tr>
              ))}

          {/* Render supplier accounts under 4011 */}
          {account.accountNumber === "4011" &&
            account.children &&
            account.children
              .filter((child) => child.accountNumber.startsWith("4011"))
              .map((supplier) => (
                <tr
                  key={supplier.id}
                  className="acc-modal-selection-row supplier-account-row"
                  onClick={() => onSelect(supplier)} // Trigger parent callback
                >
                  <td className="acc-modal-selection-cell">
                    {supplier.accountNumber}
                  </td>
                  <td className="acc-modal-selection-cell">
                    {supplier.accountName}
                  </td>
                  <td
                    className="acc-modal-selection-cell arabic-text"
                    style={{
                      textAlign: "right",
                      direction: "rtl",
                    }}
                  >
                    {supplier.arabicAccountName || "N/A"}
                  </td>
                </tr>
              ))}

          {/* Recursively render other children */}
          {renderAccounts(accounts, account.accountNumber)}
        </React.Fragment>
      ));
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
                <tbody>{renderAccounts(data)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSelectionModal;
