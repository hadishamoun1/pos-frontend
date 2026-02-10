// src/components/accounts/AccountsPage.jsx
import React, { useState, useEffect } from "react";
import "./accounts.css";
import { axiosClient } from "../api/axiosClient";

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

  // ✅ EDIT MODE STATE
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);

  // ✅ Helper to find parent name
  const getParentName = (account, allAccounts) => {
    if (!account.parentNumber) return "Main Account";
    const parent = allAccounts.find((a) => a.accountNumber === account.parentNumber);
    return parent?.accountName || parent?.arabicAccountName || "N/A";
  };

  // ✅ Load accounts once
  useEffect(() => {
    const fetchCombinedData = async () => {
      try {
        const res = await axiosClient.get("/accounts/v1/combined");
        const combinedData = res?.data;
        setData(Array.isArray(combinedData) ? combinedData : []);
      } catch (error) {
        console.error("Error fetching combined data:", error);
      }
    };

    fetchCombinedData();
  }, []);

  // ✅ Form change
  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // ✅ EDIT: Load account into form
  const handleEditClick = (account) => {
    setIsEditMode(true);
    setEditingAccountId(account.id);
    setFormData({
      accountNumber: account.accountNumber,
      accountName: account.accountName || "",
      arabicAccountName: account.arabicAccountName || "",
      parentNumber: account.parentNumber || "",
      accessible: account.accessible ?? true,
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ✅ CANCEL EDIT: Reset form
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditingAccountId(null);
    setFormData({
      accountNumber: "",
      accountName: "",
      arabicAccountName: "",
      parentNumber: "",
      accessible: true,
    });
  };

  // ✅ Create OR Update account
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    try {
      if (isEditMode && editingAccountId) {
        // UPDATE EXISTING ACCOUNT
        const res = await axiosClient.put(`/accounts/${editingAccountId}`, formData);
        const updatedAccount = res?.data;

        // Update in local state
        setData((prev) =>
          prev.map((acc) =>
            acc.id === editingAccountId
              ? { ...updatedAccount, children: acc.children || [] }
              : acc
          )
        );

        setModalType("success-edit");
        setIsEditMode(false);
        setEditingAccountId(null);
      } else {
        // CREATE NEW ACCOUNT
        const res = await axiosClient.post("/accounts", formData);
        const newAccount = res?.data;

        const safeAccount = { ...newAccount, children: newAccount?.children || [] };
        setData((prev) => [...prev, safeAccount]);

        setModalType("success");
      }

      // Reset form
      setFormData({
        accountNumber: "",
        accountName: "",
        arabicAccountName: "",
        parentNumber: "",
        accessible: true,
      });
    } catch (error) {
      console.error("Error saving account:", error);
      setModalType("error");
    } finally {
      setModalContent(true);
    }
  };

  const closeModal = () => setModalContent(false);

  // ✅ Render all accounts + customers/suppliers under special accounts
  const renderAccounts = (accounts) => {
    if (!accounts || !accounts.length) {
      return (
        <tr>
          <td colSpan={6} style={{ textAlign: "center", padding: "8px" }}>
            No accounts returned from API.
          </td>
        </tr>
      );
    }

    return accounts
      .slice()
      .sort((a, b) => String(a.accountNumber).localeCompare(String(b.accountNumber)))
      .map((account) => (
        <React.Fragment key={`acc-${account.id}`}>
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
            <td>
              {/* ✅ EDIT BUTTON */}
              <button
                className="edit-account-btn"
                onClick={() => handleEditClick(account)}
                title="Edit Account"
              >
                ✏️ Edit
              </button>
            </td>
          </tr>

          {/* Customers under Customer_Index */}
          {account.children &&
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
                    {customer.arabicAccountName || "N/A"}
                  </td>
                  <td>{account.accountNumber}</td>
                  <td>{account.accountName || "—"}</td>
                  <td>
                    <span style={{ fontSize: "0.9rem", color: "#999" }}>Customer</span>
                  </td>
                </tr>
              ))}

          {/* Suppliers under Supplier_Index */}
          {account.children &&
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
                    {supplier.arabicAccountName || "N/A"}
                  </td>
                  <td>{account.accountNumber}</td>
                  <td>{account.accountName || "—"}</td>
                  <td>
                    <span style={{ fontSize: "0.9rem", color: "#999" }}>Supplier</span>
                  </td>
                </tr>
              ))}
        </React.Fragment>
      ));
  };

  return (
    <div className="accounts-page">
      <h2 className="accounts-heading">Accounts Management</h2>

      <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.5rem" }}>
        Loaded accounts: {data.length}
      </p>

      {/* ✅ Create/Edit Account Form */}
      <div className="accounts-form">
        <h3>{isEditMode ? "Edit Account" : "Create New Account"}</h3>
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
              style={{
                fontFamily: "'Tajawal', sans-serif",
                fontSize: "1.2rem",
                direction: "rtl",
                textAlign: "right",
              }}
            />
          </label>

          <label>
            Parent Account: <span style={{ color: "red" }}>*</span>
            <select
              name="parentNumber"
              value={formData.parentNumber || ""}
              onChange={handleInputChange}
              required
            >
              <option value="" disabled>
                Select Parent Account (Required)
              </option>
              {data
                .slice()
                .sort((a, b) =>
                  String(a.accountNumber).localeCompare(String(b.accountNumber))
                )
                .map((account) => (
                  <option key={account.id} value={account.accountNumber}>
                    {account.accountNumber} -{" "}
                    {account.accountName || account.arabicAccountName || "Unnamed"}
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

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="submit">
              {isEditMode ? "Update Account" : "Create Account"}
            </button>

            {isEditMode && (
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  cursor: "pointer",
                  borderRadius: "4px",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ✅ Accounts Preview Table */}
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>{renderAccounts(data)}</tbody>
        </table>
      </div>

      {/* ✅ Modal */}
      {modalContent && (
        <div className="modal">
          <div
            className={`modal-content ${
              modalType.includes("success") ? "success-modal" : "error-modal"
            }`}
          >
            {modalType === "success" ? (
              <>
                <h2 className="modal-success-text">Account Created Successfully</h2>
                <div className="modal-icon">✔</div>
              </>
            ) : modalType === "success-edit" ? (
              <>
                <h2 className="modal-success-text">Account Updated Successfully</h2>
                <div className="modal-icon">✔</div>
              </>
            ) : (
              <>
                <h2 className="modal-error-text">Failed to Save Account</h2>
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