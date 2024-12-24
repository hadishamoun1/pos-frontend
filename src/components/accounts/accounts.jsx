import React, { useState, useEffect } from "react";
import "./accounts.css";

const AccountsPage = () => {
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({
    accountNumber: "",
    accountName: "",
    parentNumber: null,
    accessible: true,
  });
  const [modalContent, setModalContent] = useState(false);
  const [modalType, setModalType] = useState("");

  // Fetch combined data
  useEffect(() => {
    const fetchCombinedData = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/accounts/v1/combined"
        );
        const combinedData = await response.json();
        setData(combinedData);
      } catch (error) {
        console.error("Error fetching combined data:", error);
      }
    };

    fetchCombinedData();
  }, []);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:3000/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newAccount = await response.json();
        setData((prevState) => [...prevState, newAccount]);
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

  // Recursive function to render accounts, maintaining order and avoiding duplication
  const renderAccounts = (accounts, parentNumber = null) => {
    return accounts
      .filter((account) => account.parentNumber === parentNumber)
      .map((account) => (
        <React.Fragment key={account.id}>
          <tr>
            <td>{account.accountNumber}</td>
            <td>{account.accountName}</td>
            <td>{account.arabicAccountName || "N/A"}</td>
            <td>{account.parentNumber || "Main Account"}</td>
            <td>{account.parent?.accountName || "N/A"}</td>
          </tr>

          {/* Render customer accounts under 4111 */}
          {account.accountNumber === "4111" &&
            account.children &&
            account.children
              .filter((child) => child.accountNumber.startsWith("4111"))
              .map((customer) => (
                <tr key={customer.id} className="customer-account-row">
                  <td>{customer.accountNumber}</td>
                  <td>{customer.accountName}</td>
                  <td>{customer.arabicAccountName || "N/A"}</td>
                  <td>{account.accountNumber}</td>
                  <td>{account.accountName}</td>
                </tr>
              ))}

          {/* Render supplier accounts under 4011 */}
          {account.accountNumber === "4011" &&
            account.children &&
            account.children
              .filter((child) => child.accountNumber.startsWith("4011"))
              .map((supplier) => (
                <tr key={supplier.id} className="supplier-account-row">
                  <td>{supplier.accountNumber}</td>
                  <td>{supplier.accountName}</td>
                  <td>{supplier.arabicAccountName || "N/A"}</td>
                  <td>{account.accountNumber}</td>
                  <td>{account.accountName}</td>
                </tr>
              ))}

          {/* Recursively render other children */}
          {renderAccounts(accounts, account.accountNumber)}
        </React.Fragment>
      ));
  };

  return (
    <div className="accounts-page">
      <h2 className="accounts-heading">Accounts Management</h2>

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
            Parent Account:
            <select
              name="parentNumber"
              value={formData.parentNumber || ""}
              onChange={handleInputChange}
            >
              <option value="">Select Parent Account</option>
              {data.map((account) => (
                <option key={account.id} value={account.accountNumber}>
                  {account.accountName}
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
