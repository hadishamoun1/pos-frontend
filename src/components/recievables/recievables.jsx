// src/recievables/AccountingPage.jsx
import React, { useState, useEffect, useRef } from "react";
import "./recievables.css";
import NewRecordModal from "./newRecord";
import EditRecordModal from "./editRecordModal";
import NotificationModal from "./NotificationModal";
import axios from "axios";
import io from "socket.io-client";
import RctPaper from "./rctPreview";

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
  const [searching, setSearching] = useState(false); // ⭐ NEW
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [receiptPreviewRecord, setReceiptPreviewRecord] = useState(null);

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
      customer: {
        id: sel.customerAccountId,
        name: sel.customerName,
      },
      date: sel.date,
      invoiceId: sel.refInvoice,
      type: sel.type,
      details: [
        {
          cashNumber: sel.cashNumber,
          currency: sel.currency,
          exchangeRate: sel.exchangeRate,
          amountExchanged: sel.amountExchanged,
          comments: sel.comments,
          pmtType: sel.pmtType,
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
          date: v.date.slice(0, 10),
          customerName: v.customerName,
          customerAccountId: v.customerid,
          currency: v.currency,
          exchangeRate: v.exchangeRate,
          cashNumber: v.cashNumber,
          amountExchanged: v.amountExchanged,
          refInvoice: v.invoiceId,
          invoiceNumber: v.jvNumber,
          pmtType: v.pmtType,
          comments: v.comments,
          rct: v.jvNumber,
          type: v.type,
        }));
        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        console.error("🚨 fetchData error:", err);
        setError(err.message || "Failed to load data");
        setNotification({ type: "error", message: err.message });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    try {
      socket = io(baseUrl);
      socket.on("recievables", (updated) => {
        const fmt = updated.map((v) => ({
          id: v.id,
          date: v.date.slice(0, 10),
          customerName: v.customerName,
          customerAccountId: v.customerid,
          currency: v.currency,
          exchangeRate: v.exchangeRate,
          cashNumber: v.cashNumber,
          amountExchanged: v.amountExchanged,
          refInvoice: v.invoiceId,
          invoiceNumber: v.jvNumber,
          pmtType: v.pmtType,
          comments: v.comments,
          rct: v.jvNumber,
          type: v.type,
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

  // ⭐ NEW — just record the text; server search happens in a debounced effect below
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // ⭐ NEW — Debounced server search using /journal-vouchers/search
  // It filters your existing receivables rows by the matched JV numbers from the API.
  const searchAbortRef = useRef(null);
  useEffect(() => {
    const term = (searchTerm || "").trim();
    if (!term) {
      // empty → show all
      setFilteredData(data);
      return;
    }

    // local quick filter while we wait (snappy UX)
    const t = term.toLowerCase();
    const quick = data.filter(
      (r) =>
        r.customerName.toLowerCase().includes(t) ||
        (r.refInvoice || "").toLowerCase().includes(t) ||
        (r.invoiceNumber || "").toLowerCase().includes(t) ||
        (r.comments || "").toLowerCase().includes(t) ||
        (r.pmtType || "").toLowerCase().includes(t)
    );
    setFilteredData(quick);

    // For very short inputs, avoid server calls
    if (term.length < 2) return;

    // Debounce
    const timeout = setTimeout(async () => {
      // cancel previous request if any
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setSearching(true);
      try {
        const resp = await axios.get(`${baseUrl}/journal-vouchers/v1/jv/search`, {
          params: { q: term, limit: 50, page: 1 },
          signal: controller.signal,
        });

        // Expected: resp.data.data is array with { jvNumber, ... }
        const jvRows = Array.isArray(resp.data?.data) ? resp.data.data : [];
        const jvSet = new Set(
          jvRows
            .map((r) => (r.jvNumber || "").toString().toLowerCase())
            .filter(Boolean)
        );

        // Filter your receivables list by the matched JV numbers.
        // (Keeps your table shape intact.)
        const byServer = data.filter((r) =>
          jvSet.has((r.invoiceNumber || "").toLowerCase())
        );

        // If server returned matches, show them; otherwise keep the quick local result
        setFilteredData(byServer.length ? byServer : quick);
      } catch (err) {
        if (axios.isCancel?.(err)) return;
        if (err?.name === "CanceledError") return;
        console.warn("Server search failed, using local filter:", err);
        // keep quick local result
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm, data, baseUrl]);

  const handlePreviewReceipt = (record) => {
    setReceiptPreviewRecord(record);
  };

  return (
    <>
      <div className="accounting-container">
        <div className="accounting-section top-section">
          <div className="top-toolbar">
            <input
              type="text"
              placeholder="Search by Customer or JV#"
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
            <>
              {searching && (
                <div className="searching-hint">Searching…</div> // ⭐ NEW (optional UI)
              )}
              <table className="accounting-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Customer Name</th>
                    <th>Cur</th>
                    <th>Ex Rate</th>
                    <th>Amount Ex</th>
                    <th>Cash Number</th>
                    <th>Date</th>
                    <th>Ref Invoice</th>
                    <th>JV Number</th>
                    <th>PMT Type</th>
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
                      <td>{row.refInvoice}</td>
                      <td>{row.invoiceNumber}</td>
                      <td>{row.pmtType}</td>
                      <td>{row.comments}</td>
                      <td>
                        <button
                          className="receipt-preview-button"
                          onClick={() => handlePreviewReceipt(row)}
                        >
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {isNewModalOpen && (
          <NewRecordModal
            onClose={closeNewModal}
            onSave={(created) => {
              setData((d) => [...d, ...created]);
              setFilteredData((d) => [...d, ...created]);
              closeNewModal();
            }}
          />
        )}
        {isEditModalOpen && selectedRow && (
          <EditRecordModal
            selectedRow={selectedRow}
            onClose={closeEditModal}
            onSave={(updated) => {
              const idx = data.findIndex((r) => r.id === updated.id);
              if (idx > -1) {
                const copy = [...data];
                copy[idx] = {
                  ...copy[idx],
                  date: updated.date.slice(0, 10),
                  customerName: updated.customerName,
                  customerAccountId: updated.customerid,
                  currency: updated.currency,
                  exchangeRate: updated.exchangeRate,
                  cashNumber: updated.cashNumber,
                  amountExchanged: updated.amountExchanged,
                  refInvoice: updated.invoiceId,
                  invoiceNumber: updated.jvNumber,
                  pmtType: updated.pmtType,
                  comments: updated.comments,
                  rct: updated.jvNumber,
                  type: updated.type,
                };
                setData(copy);
                setFilteredData(copy);
              }
              closeEditModal();
            }}
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
      {receiptPreviewRecord && (
        <RctPaper
          record={receiptPreviewRecord}
          onClose={() => setReceiptPreviewRecord(null)}
        />
      )}
    </>
  );
};

export default AccountingPage;
