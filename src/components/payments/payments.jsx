import React, { useState, useEffect } from "react";
import "./payments.css";
import NewRecordModal from "./newRecord";
import EditRecordModal from "./editRecordModal";
import NotificationModal from "./NotificationModal";
import axios from "axios";
import io from "socket.io-client";

const AccountingPage = () => {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const openNewModal = () => setIsNewModalOpen(true);
  const closeNewModal = () => setIsNewModalOpen(false);

  const openEditModal = () => {
    if (selectedRowIndex === null) {
      setNotification({
        type: "error",
        message: "Please select a row to edit.",
      });
      return;
    }

    const selected = data[selectedRowIndex];
    const formattedRow = {
      id: selected.id,
      customer: {
        id: selected.customerAccountId,
        name: selected.customerName,
      },
      date: selected.date,
      invoiceId: selected.invoiceNumber,
      details: [
        {
          cashNumber: selected.cashNumber,
          currency: selected.currency,
          exchangeRate: selected.exchangeRate[0], // Use the first exchange rate
          amountExchanged: selected.amountExchanged,
          comments: selected.comments,
        },
      ],
    };
    setSelectedRow(formattedRow);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedRow(null);
    setSelectedRowIndex(null);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          "http://localhost:3000/receipt-vouchers/v1/specific-fields"
        );
        const formattedData = response.data.map((voucher) => ({
          id: voucher.id,
          date: voucher.date,
          customerName: voucher.customer.name,
          customerAccountId: voucher.customer.id,
          currency: voucher.totalCrLL === "0.00" ? "USD" : "LL",
          exchangeRate: voucher.exchangeRate.map(formatNumberWithCommas),
          amountExchanged: formatNumberWithCommas(voucher.totalCr),
          cashNumber: formatNumberWithCommas(voucher.totalCr),
          invoiceNumber: voucher.invoiceId,
          comments: voucher.comments.join(", "),
          rct: "", // Leave RCT empty for now
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

    socket.on("connect", () => {
      console.log("WebSocket connected:", socket.id);
    });

    socket.on("receipt-vouchers", (updatedData) => {
      const formattedData = updatedData.map((voucher) => ({
        id: voucher.id,
        date: voucher.date,
        customerName: voucher.customer.name,
        customerAccountId: voucher.customer.id,
        currency: voucher.totalCrLL === "0.00" ? "USD" : "LL",
        exchangeRate: voucher.exchangeRate.map(formatNumberWithCommas),
        amountExchanged: formatNumberWithCommas(voucher.totalCr),
        cashNumber: formatNumberWithCommas(voucher.totalCr),
        invoiceNumber: voucher.invoiceId,
        comments: voucher.comments.join(", "),
        rct: "", // Leave RCT empty
      }));
      setData(formattedData);
      setFilteredData(formattedData);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const formatNumberWithCommas = (number) => {
    if (number === null || number === undefined) return "";
    return Number(number).toLocaleString("en-US");
  };

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
  const handleUpdateSave = async (updatedData) => {
    try {
      const response = await axios.put(
        "http://localhost:3000/receipt-vouchers/v1/bulk",
        [updatedData]
      );

      if (response.status === 200 || response.status === 201) {
        setNotification({
          type: "success",
          message: "Receipt voucher updated successfully!",
        });

        const updatedIndex = data.findIndex(
          (item) => item.id === updatedData.receiptVoucherId
        );

        if (updatedIndex !== -1) {
          const newData = [...data];
          newData[updatedIndex] = {
            ...newData[updatedIndex],
            customerName: updatedData.customerName, // Update customerName in the table
            customerAccountId: updatedData.customerAccountId, // Update customerAccountId
            invoiceNumber: updatedData.invoiceId, // Update invoiceNumber
            ...updatedData.details[0], // Update other details like cashNumber, comments, etc.
          };
          setData(newData); // Update the main data state
          setFilteredData(newData); // Update the filtered data state
        }

        closeEditModal(); // Close the edit modal
      } else {
        setNotification({
          type: "error",
          message: "Failed to update receipt voucher. Please try again.",
        });
      }
    } catch (err) {
      console.error("Update API error:", err);
      setNotification({
        type: "error",
        message:
          err.response?.data?.message || "Failed to update receipt voucher.",
      });
    }
  };

  return (
    <div className="accounting-container">
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
            <button className="action-button" onClick={openNewModal}>
              New
            </button>
            <button className="action-button" onClick={openEditModal}>
              Edit
            </button>
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
                <th>Select</th>
                <th>Customer Name</th>
                <th>Currency</th>
                <th>Exchange Rate</th>
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
                  <td>
                    <input
                      type="radio"
                      name="selectedRow"
                      onChange={() => setSelectedRowIndex(index)}
                      checked={selectedRowIndex === index}
                    />
                  </td>
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

      {isNewModalOpen && (
        <NewRecordModal
          onClose={closeNewModal}
          onSave={(newData) => {
            setData((prevData) => [...prevData, newData]);
            setFilteredData((prevData) => [...prevData, newData]);
            closeNewModal();
          }}
        />
      )}

      {isEditModalOpen && selectedRow && (
        <EditRecordModal
          selectedRow={selectedRow}
          onClose={closeEditModal}
          onSave={handleUpdateSave}
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
