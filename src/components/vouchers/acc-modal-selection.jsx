import React, { useEffect, useState } from "react";
import "./acc-modal-selection.css";

const AccountSelectionModal = ({ isOpen, onClose, onSelect }) => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
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
      const response = await fetch(`${baseUrl}/accounts/v1/acc-arranged`);
      if (!response.ok) {
        throw new Error("Failed to fetch accounts data");
      }
      const combinedData = await response.json();
      setData(combinedData);
      setFilteredData(combinedData); // Initialize filteredData to the full data
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Recursive function to render accounts and their children
  const renderAccounts = (accounts, parentNumber = null, level = 0) => {
    // Filter accounts by parentNumber
    const children = accounts.filter(
      (account) => account.parentNumber === parentNumber
    );

    // Sort accounts by accountNumber
    children.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    // Render each account and recursively render its children
    return children.flatMap((account) => {
      const parentRow = (
        <tr
          key={account.id}
          className="acc-modal-selection-row"
         onClick={() => onSelect({ ...account, entityType: "account" })}
        >
          <td
            className="acc-modal-selection-cell"
            style={{ paddingLeft: `${level * 20}px` }}
          >
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
      );

      // Render recursively for children
      const childrenRows = renderAccounts(
        accounts,
        account.accountNumber,
        level + 1
      );

      // Handle special cases for customers (4111) and suppliers (4011)
      let additionalRows = [];
      if (account.accountNumber === "4111" && account.children?.length) {
        additionalRows = account.children.map((customer) => (
          <tr
            key={`customer-${customer.id}`}
            className="acc-modal-selection-row"
            onClick={() => onSelect({ ...customer, entityType: "customer" })}
          >
            <td
              className="acc-modal-selection-cell"
              style={{ paddingLeft: `${(level + 1) * 20}px` }}
            >
              {customer.accountNumber}
            </td>
            <td className="acc-modal-selection-cell">{customer.accountName}</td>
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
        ));
      }

      if (account.accountNumber === "4011" && account.children?.length) {
        additionalRows = account.children.map((supplier) => (
          <tr
            key={`supplier-${supplier.id}`}
            className="acc-modal-selection-row"
            onClick={() => onSelect({ ...supplier, entityType: "supplier" })}
          >
            <td
              className="acc-modal-selection-cell"
              style={{ paddingLeft: `${(level + 1) * 20}px` }}
            >
              {supplier.accountNumber}
            </td>
            <td className="acc-modal-selection-cell">{supplier.accountName}</td>
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
        ));
      }

      // Return parent row combined with its children rows and additionalRows
      return [parentRow, ...childrenRows, ...additionalRows];
    });
  };

  // Handle search input changes
  const handleSearchChange = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    const filtered = data.filter((account) => {
      const accountNumber = account.accountNumber?.toLowerCase() || "";
      const accountName = account.accountName?.toLowerCase() || "";
      const arabicAccountName = account.arabicAccountName?.toLowerCase() || "";

      return (
        accountNumber.includes(query) ||
        accountName.includes(query) ||
        arabicAccountName.includes(query)
      );
    });

    setFilteredData(filtered);
  };

  return (
    isOpen && (
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
                <input
                  type="text"
                  className="acc-modal-selection-search-input"
                  placeholder="Search by Account Number, Name, or Arabic Name..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                <table className="acc-modal-selection-table">
                  <thead>
                    <tr>
                      <th>Account Number</th>
                      <th>Account Name</th>
                      <th>Arabic Account Name</th>
                    </tr>
                  </thead>
                  <tbody>{renderAccounts(filteredData)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  );
};

export default AccountSelectionModal;
