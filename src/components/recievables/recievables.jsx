// src/recievables/AccountingPage.jsx
import React, { useState, useEffect } from "react";
import "./recievables.css";
import NewRecordModal from "./newRecord";
import EditRecordModal from "./editRecordModal";
import NotificationModal from "./NotificationModal";
import axios from "axios";
import io from "socket.io-client";

const AccountingPage = () => {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

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
    const sel = filteredData[selectedRowIndex];
    setSelectedRow({
      id: sel.id,
      customer: { id: sel.customerAccountId, name: sel.customerName },
      date: sel.date,
      invoiceId: sel.invoiceNumber,
      details: [
        {
          cashNumber: sel.cashNumber,
          currency: sel.currency,
          exchangeRate: sel.exchangeRate,
          amountExchanged: sel.amountExchanged,
          comments: sel.comments,
        },
      ],
    });
    setIsEditModalOpen(true);
  };
  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedRow(null);
    setSelectedRowIndex(null);
  };

  const openDeleteModal = () => {
    if (selectedRowIndex === null) {
      setNotification({
        type: "error",
        message: "Please select a row to delete.",
      });
      return;
    }
    setIsDeleteModalOpen(true);
  };
  const closeDeleteModal = () => setIsDeleteModalOpen(false);

  const handleDelete = async () => {
    const id = filteredData[selectedRowIndex].id;
    try {
      await axios.delete(`${baseUrl}/recievables/${id}`);
      setNotification({ type: "success", message: "Deleted successfully." });
      const next = data.filter((r) => r.id !== id);
      setData(next);
      setFilteredData(next);
      setSelectedRowIndex(null);
      closeDeleteModal();
    } catch {
      setNotification({ type: "error", message: "Delete failed." });
    }
  };

  useEffect(() => {
    let socket;

    const fetchData = async () => {
      try {
        const res = await axios.get(`${baseUrl}/recievables/v1/summary`);
        const formatted = res.data.map((v) => ({
          id: v.id,
          date: v.date.slice(0, 10), // "YYYY-MM-DD"
          customerName: v.customerName, // flat field
          currency: v.currency, // "LL" or "USD"
          exchangeRate: v.exchangeRate, // e.g. "1500.0000"
          cashNumber: v.cashNumber, // e.g. "1500000.00"
          amountExchanged: v.amountExchanged, // e.g. "1000.00"
          invoiceNumber: v.jvNumber, // flat field
          comments: v.comments, // flat field
          rct: v.jvNumber, // your auto-gen JV#
        }));
        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        console.error("🚨 fetchData error:", err);
        setError(err.message || "Failed to load data");
        setNotification({
          type: "error",
          message: err.response?.data?.message || err.message,
        });
      } finally {
        // **guarantee we turn loading off**
        setLoading(false);
      }
    };

    fetchData();

    // only attempt socket if your backend socket is up
    try {
      socket = io(baseUrl);
      socket.on("recievables", (updated) => {
        const fmt = updated.map((v) => ({
          id: v.id,
          date: v.date.slice(0, 10),
          customerName: v.customerName,
          currency: v.currency,
          exchangeRate: v.exchangeRate,
          cashNumber: v.cashNumber,
          amountExchanged: v.amountExchanged,
          invoiceNumber: v.jvNumber,
          comments: v.comments,
          rct: v.jvNumber,
        }));
        setData(fmt);
        setFilteredData(fmt);
      });
    } catch {
      console.warn("Socket.io not available at", baseUrl);
    }

    return () => socket && socket.disconnect();
  }, [baseUrl]);

  const formatNumberWithCommas = (n) =>
    n != null ? Number(n).toLocaleString("en-US") : "";

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    setFilteredData(
      data.filter(
        (r) =>
          r.customerName.toLowerCase().includes(term) ||
          r.comments.toLowerCase().includes(term) ||
          r.invoiceNumber.toLowerCase().includes(term)
      )
    );
  };

  const handleNewSave = (newEntry) => {
    setData((d) => [...d, newEntry]);
    setFilteredData((d) => [...d, newEntry]);
    closeNewModal();
  };

  const handleUpdateSave = (updated) => {
    const idx = data.findIndex((r) => r.id === updated.id);
    if (idx > -1) {
      const copy = [...data];
      copy[idx] = {
        id: updated.id,
        date: updated.date.slice(0, 10),
        customerName: updated.customer.name,
        customerAccountId: updated.customer.id,
        currency: updated.currency,
        exchangeRate: updated.exchangeRate,
        cashNumber: updated.cashNumber,
        amountExchanged: updated.amountExchanged,
        invoiceNumber: updated.invoiceId,
        comments: updated.comments,
        rct: updated.jvNumber,
      };
      setData(copy);
      setFilteredData(copy);
    }
    closeEditModal();
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
            <button className="delete-button" onClick={openDeleteModal}>
              Delete
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
                <th>Amount Ex</th>
                <th>Cash Number</th>
                <th>Date</th>
                <th>Invoice Number</th>
                <th>Comments</th>
                <th>RCT</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="radio"
                      name="selectedRow"
                      checked={selectedRowIndex === idx}
                      onChange={() => setSelectedRowIndex(idx)}
                    />
                  </td>
                  <td>{row.customerName}</td>
                  <td>{row.currency}</td>
                  <td>{row.exchangeRate}</td>
                  <td>{formatNumberWithCommas(row.amountExchanged)}</td>
                  <td>{formatNumberWithCommas(row.cashNumber)}</td>
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
        <NewRecordModal onClose={closeNewModal} onSave={handleNewSave} />
      )}
      {isEditModalOpen && selectedRow && (
        <EditRecordModal
          selectedRow={selectedRow}
          onClose={closeEditModal}
          onSave={handleUpdateSave}
        />
      )}
      {isDeleteModalOpen && (
        <NotificationModal
          type="warning"
          message="Are you sure you want to delete this entry?"
          onClose={closeDeleteModal}
          onConfirm={handleDelete}
          confirmLabel="Yes"
          cancelLabel="No"
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
