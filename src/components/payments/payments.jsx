import React, { useState, useEffect } from "react";
import "./payments.css";
import NewRecordModal from "./newRecord";
import NotificationModal from "./NotificationModal"; // Assuming you have this modal component
import axios from "axios";
import io from "socket.io-client";

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
  const [filteredData, setFilteredData] = useState([]); // State for filtered data
  const [searchTerm, setSearchTerm] = useState(""); // State for search input
  const [loading, setLoading] = useState(true); // State for loading status
  const [error, setError] = useState(null); // State for error handling
  const [notification, setNotification] = useState(null); // Notification modal state

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
        const response = await axios.get(
          "http://localhost:3000/receipt-vouchers/v1/specific-fields"
        );
        const formattedData = response.data.map((voucher) => ({
          date: voucher.date,
          customerName: voucher.customer.name,
          currency: voucher.totalCrLL === "0.00" ? "USD" : "LL",
          exchangeRate: voucher.exchangeRate
            .map(formatNumberWithCommas)
            .join(", "),
          amountExchanged: formatNumberWithCommas(voucher.totalCr),
          cashNumber: formatNumberWithCommas(voucher.totalCr),
          invoiceNumber: voucher.rvNumber,
          comments: voucher.comments.join(", "),
          rct: "",
        }));
        setData(formattedData);
        setFilteredData(formattedData);
      } catch (err) {
        setError("Failed to fetch data. Please try again.");
        setNotification({
          type: "error",
          message: "Failed to fetch data from the server.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const socket = io("http://localhost:3000");

    // Verify WebSocket connection
    socket.on("connect", () => {
      console.log("WebSocket connected:", socket.id);
    });

    // Debug fallback listener
    socket.onAny((event, payload) => {
      console.log(`Received event: ${event}`, payload);
    });

    // Listen for 'receipt-vouchers' event
    socket.on("receipt-vouchers", (updatedData) => {
      console.log("Received updated data via WebSocket:", updatedData);
      const formattedData = updatedData.map((voucher) => ({
        date: voucher.date,
        customerName: voucher.customer.name,
        currency: voucher.totalCrLL === "0.00" ? "USD" : "LL",
        exchangeRate: voucher.exchangeRate
          .map(formatNumberWithCommas)
          .join(", "),
        amountExchanged: formatNumberWithCommas(voucher.totalCr),
        cashNumber: formatNumberWithCommas(voucher.totalCr),
        invoiceNumber: voucher.rvNumber,
        comments: voucher.comments.join(", "),
        rct: "",
      }));
      setData(formattedData);
      setFilteredData(formattedData);
    });

    return () => {
      socket.disconnect(); // Clean up WebSocket connection on unmount
    };
  }, []);

  // Format numbers with commas
  const formatNumberWithCommas = (number) => {
    if (number === null || number === undefined) return "";
    return Number(number).toLocaleString("en-US");
  };

  // Handle search
  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    setFilteredData(
      data.filter(
        (row) =>
          row.customerName.toLowerCase().includes(term) ||
          row.comments.toLowerCase().includes(term) ||
          row.invoiceNumber.toLowerCase().includes(term)
      )
    );
  };

  return (
    <div className="accounting-container">
      {/* Top Section */}
      <div className="accounting-section top-section">
        <div className="top-toolbar">
          <input
            type="text"
            placeholder="Search by Customer, Comments, or Invoice"
            className="search-input"
            value={searchTerm}
            onChange={handleSearch}
          />
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
              {filteredData.map((row, index) => (
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

      {notification && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default AccountingPage;
