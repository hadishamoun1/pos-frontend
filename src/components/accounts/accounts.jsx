// src/components/accounts/AccountsPage.jsx
import React, { useState, useEffect } from "react";
import "./accounts.css";

const AccountsPage = () => {
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({
    accountNumber: "",
    accountName: "",
    arabicAccountName: "",
    parentNumber: "",
    accessible: true,
  });
  const [modalContent, setModalContent] = useState(false);
  const [modalType, setModalType] = useState("");

  const rawBase = process.env.REACT_APP_API_BASE_URL || "";
  const baseUrl = rawBase.replace(/\/+$/, ""); // remove trailing /

  // ---------- Helpers ----------

  const getParentName = (account, allAccounts) => {
    if (!account.parentNumber) return "Main Account";
    const parent = allAccounts.find(
      (a) => a.accountNumber === account.parentNumber
    );
    return parent?.accountName || parent?.arabicAccountName || "N/A";
  };

  // ---------- Fetch data on mount ----------
  useEffect(() => {
    const fetchCombinedData = async () => {
      try {
        const response = await fetch(`${baseUrl}/accounts/v1/combined`);
        // If your working endpoint is /accounts, use:
        // const response = await fetch(`${baseUrl}/accounts`);

        if (!response.ok) {
          console.error("Failed to fetch combined accounts", response.status);
          return;
        }

        const combinedData = await response.json();
        console.log("Combined accounts from API:", combinedData);
        setData(Array.isArray(combinedData) ? combinedData : []);
      } catch (error) {
        console.error("Error fetching combined data:", error);
      }
    };

    fetchCombinedData();
  }, [baseUrl]);

  // ---------- Form handlers ----------
  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${baseUrl}/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newAccount = await response.json();
        const safeAccount = {
          ...newAccount,
          children: newAccount.children || [],
        };
        setData((prevState) => [...prevState, safeAccount]);
        setModalType("success");
      } else {
        setModalType("error");
      }
    } catch (error) {
      console.error("Error creating account:", error);
      setModalType("error");
    } finally {
      setModalContent(true);
    }
  };

  const closeModal = () => setModalContent(false);

  // ---------- Flat renderer (no hiding by parentNumber) ----------
  const renderAccounts = (accounts) => {
    if (!accounts || !accounts.length) {
      return (
        <tr>
          <td colSpan={5} style={{ textAlign: "center", padding: "8px" }}>
            No accounts returned from API.
          </td>
        </tr>
      );
    }

    return accounts
      .slice()
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
      .map((account) => (
        <React.Fragment key={`acc-${account.id}`}>
          {/* Main account row */}
          <tr>
            <td>{account.accountNumber}</td>
            <td>{account.accountName || "—"}</td>
            <td
              style={{
                fontFamily: "'Tajawal', sans-serif",
                fontSize: "1.3rem",
                color: "#555",
                textAlign: "right",
                direction: "rtl",
              }}
            >
              {account.arabicAccountName || "N/A"}
            </td>
            <td>{account.parentNumber || "Main Account"}</td>
            <td>{getParentName(account, accounts)}</td>
          </tr>

          {/* Customer accounts (if backend added them as children with isCustomer flag) */}
          {account.accountNumber === "4111" &&
            Array.isArray(account.children) &&
            account.children
              .filter((child) => child.isCustomer)
              .map((customer) => (
                <tr
                  key={`cust-${customer.id}-${customer.accountNumber}`}
                  className="customer-account-row"
                >
                  <td>{customer.accountNumber}</td>
                  <td>{customer.accountName}</td>
                  <td
                    style={{
                      fontFamily: "'Tajawal', sans-serif",
                      fontSize: "1.3rem",
                      color: "#555",
                      textAlign: "right",
                      direction: "rtl",
                    }}
                  >
                    {account.arabicAccountName || "N/A"}
                  </td>
                  <td>{account.accountNumber}</td>
                  <td>{account.accountName || "—"}</td>
                </tr>
              ))}

          {/* Supplier accounts (if backend added them as children with isSupplier flag) */}
          {account.accountNumber === "4011" &&
            Array.isArray(account.children) &&
            account.children
              .filter((child) => child.isSupplier)
              .map((supplier) => (
                <tr
                  key={`supp-${supplier.id}-${supplier.accountNumber}`}
                  className="supplier-account-row"
                >
                  <td>{supplier.accountNumber}</td>
                  <td>{supplier.accountName}</td>
                  <td
                    style={{
                      fontFamily: "'Tajawal', sans-serif",
                      fontSize: "1.3rem",
                      color: "#555",
                      textAlign: "right",
                      direction: "rtl",
                    }}
                  >
                    {account.arabicAccountName || "N/A"}
                  </td>
                  <td>{account.accountNumber}</td>
                  <td>{account.accountName || "—"}</td>
                </tr>
              ))}
        </React.Fragment>
      ));
  };

  return (
    <div className="accounts-page">
      <h2 className="accounts-heading">Accounts Management</h2>

      {/* Tiny debug: see if data is actually loaded */}
      <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.5rem" }}>
        Loaded accounts: {data.length}
      </p>

      {/* ---------- Create Account Form ---------- */}
      <div className="accounts-form">
        <form onSubmit={handleFormSubmit}>
          <label>
            Account Number:
            <input
              placeholder="Enter account number"
              type="text"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleInputChange}
              required
            />
          </label>

          <label>
            Account Name:
            <input
              placeholder="Enter account name"
              type="text"
              name="accountName"
              value={formData.accountName}
              onChange={handleInputChange}
              required
            />
          </label>

          <label>
            Arabic Account Name:
            <input
              placeholder="Enter Arabic account name"
              type="text"
              name="arabicAccountName"
              value={formData.arabicAccountName}
              onChange={handleInputChange}
            />
          </label>

          <label>
            Parent Account:
            <select
              name="parentNumber"
              value={formData.parentNumber || ""}
              onChange={handleInputChange}
            >
              <option value="">Select Parent Account</option>
              {data
                .slice()
                .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
                .map((account) => (
                  <option key={account.id} value={account.accountNumber}>
                    {account.accountNumber} -{" "}
                    {account.accountName ||
                      account.arabicAccountName ||
                      "Unnamed"}
                  </option>
                ))}
            </select>
          </label>

          <div className="accessible-container">
            <label htmlFor="accessible">Accessible:</label>
            <input
              type="checkbox"
              id="accessible"
              name="accessible"
              checked={formData.accessible}
              onChange={handleInputChange}
            />
          </div>

          <button type="submit">Create Account</button>
        </form>
      </div>

      {/* ---------- Accounts Preview Table ---------- */}
      <div className="accounts-preview">
        <h3 className="accounts-preview-heading">Accounts Preview</h3>
        <table className="accounts-table">
          <thead>
            <tr>
              <th>Account Number</th>
              <th>Account Name</th>
              <th>Arabic Account Name</th>
              <th>Parent Number</th>
              <th>Parent Account Name</th>
            </tr>
          </thead>
          <tbody>{renderAccounts(data)}</tbody>
        </table>
      </div>

      {/* ---------- Modal ---------- */}
      {modalContent && (
        <div className="modal">
          <div
            className={`modal-content ${
              modalType === "success" ? "success-modal" : "error-modal"
            }`}
          >
            {modalType === "success" ? (
              <>
                <h2 className="modal-success-text">
                  Account Created Successfully
                </h2>
                <div className="modal-icon">✔</div>
              </>
            ) : (
              <>
                <h2 className="modal-error-text">Failed to Create Account</h2>
                <div className="modal-icon">✖</div>
              </>
            )}
            <button className="modal-button" onClick={closeModal}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
