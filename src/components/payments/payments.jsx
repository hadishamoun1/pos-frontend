import React, { useState } from "react";
import "./payments.css";
import NewRecordModal from "./newRecord";

const AccountingPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    currency: "",
    exchangeRate: "",
    amountExchanged: "", // New field for Amount Exchanged
    cashNumber: "",
    date: "",
    invoiceNumber: "",
    comments: "",
    rct: "",
  });

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      customerName: "",
      currency: "",
      exchangeRate: "",
      amountExchanged: "", 
      cashNumber: "",
      date: "",
      invoiceNumber: "",
      comments: "",
      rct: "",
    });
  };

  const handleSave = () => {
    console.log("Form Data:", formData);
    closeModal(); // Close the modal after saving
  };

  return (
    <div className="accounting-container">
      {/* Top Section */}
      <div className="accounting-section top-section">
        <div className="top-toolbar">
          <input type="text" placeholder="Search" className="search-input" />
          <div className="button-group">
            <button className="action-button" onClick={openModal}>
              New
            </button>
            <button className="action-button">Edit</button>
          </div>
        </div>

        <table className="accounting-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Currency</th>
              <th>Currency Ex Rate</th>
              <th>Amount Exchanged</th> {/* New column for Amount Exchanged */}
              <th>Cash Number</th>
              <th>Date</th>
              <th>Invoice Number</th>
              <th>Comments</th>
              <th>RCT</th>
            </tr>
          </thead>
          <tbody>{/* Table rows would go here */}</tbody>
        </table>
      </div>

      {/* Bottom Section */}
      <div className="accounting-section bottom-section">
        <div className="bottom-toolbar">
          <input type="text" placeholder="Search" className="search-input" />
          <button className="action-button">Edit</button>
        </div>
        {/* Additional content for bottom section can go here */}
      </div>

      {isModalOpen && (
        <NewRecordModal
          formData={formData}
          setFormData={setFormData}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default AccountingPage;
