import React, { useState, useEffect } from "react";
import "./payments.css";
import NewRecordModal from "./newRecord";
import axios from "axios";

const AccountingPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
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
  const [data, setData] = useState([]); // State to store fetched data
  const [loading, setLoading] = useState(true); // State for loading status
  const [error, setError] = useState(null); // State for error handling

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
    closeModal();
  };

  useEffect(() => {
    // Fetch data from the API
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:3000/receipt-vouchers/v1/specific-fields");
        const formattedData = response.data.map((voucher) => ({
          date: voucher.date,
          customerName: voucher.customer.name,
          currency: voucher.totalCrLL === "0.00" ? "USD" : "LL",
          exchangeRate: voucher.exchangeRate.join(", "), // Join multiple rates if applicable
          amountExchanged: voucher.totalCr,
          cashNumber: voucher.totalCr,
          invoiceNumber: voucher.rvNumber,
          comments: voucher.comments.join(", "), // Join multiple comments if applicable
          rct: "", // Remains empty
        }));
        setData(formattedData);
      } catch (err) {
        setError("Failed to fetch data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

        {loading ? (
          <p>Loading data...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : (
          <table className="accounting-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Currency</th>
                <th>Currency Ex Rate</th>
                <th>Amount Exchanged</th>
                <th>Cash Number</th>
                <th>Date</th>
                <th>Invoice Number</th>
                <th>Comments</th>
                <th>RCT</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  <td>{row.customerName}</td>
                  <td>{row.currency}</td>
                  <td>{row.exchangeRate}</td>
                  <td>{row.amountExchanged}</td>
                  <td>{row.cashNumber}</td>
                  <td>{row.date}</td>
                  <td>{row.invoiceNumber}</td>
                  <td>{row.comments}</td>
                  <td>{row.rct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Section */}
      <div className="accounting-section bottom-section">
        <div className="bottom-toolbar">
          <input type="text" placeholder="Search" className="search-input" />
          <button className="action-button">Edit</button>
        </div>
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
