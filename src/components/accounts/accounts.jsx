import React, { useState, useEffect } from "react";
import "./accounts.css";

const AccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [formData, setFormData] = useState({
    accountNumber: "",
    accountName: "",
    parentNumber: null,
    accessible: true,
  });
  const [modalContent, setModalContent] = useState(false);
  const [modalType, setModalType] = useState("");

  // Fetch accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch("http://localhost:3000/accounts");
        const data = await response.json();
        setAccounts(data);
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };

    fetchAccounts();
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
        setAccounts((prevState) => [...prevState, newAccount]);
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

  return (
    <div className="accounts-page">
      <h2 className="accounts-heading">Accounts Management</h2>

      <div className="accounts-form">
        <form onSubmit={handleFormSubmit}>
          <label>
            Account Number:
            <input
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
              {accounts.map((account) => (
                <option key={account.id} value={account.accountNumber}>
                  {account.accountName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Accessible:
            <input
              type="checkbox"
              name="accessible"
              checked={formData.accessible}
              onChange={handleInputChange}
            />
          </label>
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
              <th>Parent Number</th>
              <th>Parent Account Name</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.accountNumber}</td>
                <td>{account.accountName}</td>
                <td>{account.parentNumber || "Main Account"}</td>
                <td>{account.parent?.accountName || "N/A"}</td>
              </tr>
            ))}
          </tbody>
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
