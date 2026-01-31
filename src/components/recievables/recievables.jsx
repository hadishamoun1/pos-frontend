// src/recievables/AccountingPage.jsx
import React, { useState, useEffect, useRef } from "react";
import "./recievables.css";
import NewRecordModal from "./newRecord";
import EditRecordModal from "./editRecordModal";
import NotificationModal from "./NotificationModal";
import { axiosClient } from "../api/axiosClient";
import { io } from "socket.io-client";
import RctPaper from "./rctPreview";
import { createSocket } from "../api/socketClient";
import StatementModal from "../pos-system/Components/StatementModal";
import { hasPerm } from "../auth/authz";
import { useNavigate, useLocation } from "react-router-dom";
import DailyReceivablesModal from "./DailyReceivablesModal";

// ✅ MUST MATCH ViewCashflowModal
const DRAFT_KEY = "__receivables_create_draft__";

const AccountingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [receiptPreviewRecord, setReceiptPreviewRecord] = useState(null);

  const [newlyAddedIds, setNewlyAddedIds] = useState(new Set());

  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [stmtCustomerId, setStmtCustomerId] = useState(null);
  const [stmtCustomerName, setStmtCustomerName] = useState("");
  const [stmtDefaultDate, setStmtDefaultDate] = useState(null);

  // ✅ NEW: State for Daily Receivables Modal
  const [isDailyReceivablesOpen, setIsDailyReceivablesOpen] = useState(false);

  // ✅ NEW: incoming draft from CashCollections preview
  const [incomingDraft, setIncomingDraft] = useState(null);

  const canCreate = hasPerm("recievables.create");
  const canUpdate = hasPerm("recievables.update");
  const canDelete = hasPerm("recievables.delete");

  const openNewModal = () => setIsNewModalOpen(true);
  const closeNewModal = () => {
    setIsNewModalOpen(false);
    // keep incomingDraft unless you want to clear it
    // setIncomingDraft(null);
  };

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
      await axiosClient.delete(`/recievables/${id}`);

      setNotification({ type: "success", message: "Deleted successfully." });
      setSelectedRowIndex(null);
      closeDeleteModal();
    } catch {
      setNotification({ type: "error", message: "Delete failed." });
    }
  };

  const openStatement = () => {
    if (selectedRowIndex === null) {
      setNotification({
        type: "error",
        message: "Please select a row to open statement.",
      });
      return;
    }

    const sel = filteredData[selectedRowIndex];
    const cid = sel?.customerAccountId;

    if (!cid) {
      setNotification({
        type: "error",
        message: "Selected row has no customer id.",
      });
      return;
    }

    setStmtCustomerId(cid);
    setStmtCustomerName(sel?.customerName || "");
    setStmtDefaultDate(null);

    setIsStatementOpen(true);
  };

  const handleViewJournalVoucher = async () => {
    if (selectedRowIndex === null) {
      setNotification({
        type: "error",
        message: "Please select a receipt entry first.",
      });
      return;
    }

    const selectedEntry = filteredData[selectedRowIndex];
    const receiptEntryId = selectedEntry.id;

    if (!receiptEntryId) {
      setNotification({
        type: "error",
        message: "Selected entry has no ID.",
      });
      return;
    }

    try {
      const response = await axiosClient.get(
        `/recievables/${receiptEntryId}/journal-voucher`
      );

      const data = response.data;

      if (!data.journalVoucher) {
        setNotification({
          type: "info",
          message: "No journal voucher found for this receipt entry.",
        });
        return;
      }

      navigate(`/journal-voucher/${data.journalVoucher.id}`);
    } catch (error) {
      console.error("Error fetching journal voucher:", error);
      setNotification({
        type: "error",
        message:
          error?.response?.data?.message ||
          "Failed to fetch journal voucher. Please try again.",
      });
    }
  };

  // ✅ NEW: Open Daily Receivables Modal
  const openDailyReceivables = () => {
    setIsDailyReceivablesOpen(true);
  };

  // ✅ NEW: detect draft coming from CashCollections preview
  useEffect(() => {
    // DEBUG: show what we received

    let draft = location.state?.draft || null;


    if (!draft) {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);

        if (raw) {
          draft = JSON.parse(raw);
        }
      } catch (err) {
        console.warn("🧾 [Receivables] failed to parse draft:", err);
      }
    }


    // If no draft, nothing to do
    if (!draft || !draft?.rows?.length) {
      if (draft && Array.isArray(draft.rows) && draft.rows.length === 0) {
        console.warn("❌ [Receivables] Draft exists but rows is empty []");
      }
      return;
    }

    // Permission check
    if (!canCreate) {
      setNotification({
        type: "error",
        message: "No permission: recievables.create",
      });
      return;
    }

    // Save to local state so we can pass it to modal
    setIncomingDraft(draft);

    // Open the modal
    setIsNewModalOpen(true);

    // Clear session storage (optional, but helps prevent reuse)
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}

    // Clear router state so refresh/back doesn't reopen
    try {
      navigate(location.pathname, { replace: true, state: {} });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  useEffect(() => {
    let socket;

    const fetchData = async () => {
      try {
        const res = await axiosClient.get(`/recievables/v1/summary`);

        const formatted = (res.data || []).map((v) => ({
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
        setError(err?.message || "Failed to load data");
        setNotification({
          type: "error",
          message: err?.response?.data?.message || err?.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    try {
      socket = createSocket();

      socket.on("connect", () => {
        console.log("✅ Socket connected for receivables");
      });

      socket.on("connect_error", (err) => {
        console.warn("Socket connection error:", err);
      });

      socket.on("recievables", (updated) => {
        

        const fmt = (updated || []).map((v) => ({
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

        setData((prevData) => {
 

          const prevIds = new Set(prevData.map((item) => item.id));
          const newIds = new Set();

          fmt.forEach((item) => {
            if (!prevIds.has(item.id)) {
              newIds.add(item.id);
          
            }
          });

          if (newIds.size > 0) {
            
            setNewlyAddedIds(newIds);

            setTimeout(() => {
             
              setNewlyAddedIds(new Set());
            }, 5000);
          } else {
            console.log("❌ No new items detected");
          }

          return fmt;
        });

        setFilteredData(fmt);
      });
    } catch (err) {
      console.warn("Socket.io not available:", err);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const formatNumberWithCommas = (n) =>
    n != null ? Number(n).toLocaleString("en-US") : "";

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const searchAbortRef = useRef(null);
  useEffect(() => {
    const term = (searchTerm || "").trim();
    if (!term) {
      setFilteredData(data);
      return;
    }

    const norm = (v) => String(v ?? "").toLowerCase();
    const t = norm(term);

    const quick = data.filter(
      (r) =>
        norm(r.customerName).includes(t) ||
        norm(r.refInvoice).includes(t) ||
        norm(r.invoiceNumber).includes(t) ||
        norm(r.comments).includes(t) ||
        norm(r.pmtType).includes(t)
    );

    setFilteredData(quick);
    if (term.length < 2) return;

    const timeout = setTimeout(async () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setSearching(true);
      try {
        const resp = await axiosClient.get(`/journal-vouchers/v1/jv/search`, {
          params: { q: term, limit: 50, page: 1 },
          signal: controller.signal,
        });

        const jvRows = Array.isArray(resp.data?.data) ? resp.data.data : [];
        const jvSet = new Set(
          jvRows
            .map((r) => (r.jvNumber || "").toString().toLowerCase())
            .filter(Boolean)
        );

        const byServer = data.filter((r) =>
          jvSet.has((r.invoiceNumber || "").toLowerCase())
        );

        setFilteredData(byServer.length ? byServer : quick);
      } catch (err) {
        if (err?.code === "ERR_CANCELED") return;
        if (err?.name === "CanceledError") return;
        console.warn("Server search failed, using local filter:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm, data]);

  const handlePreviewReceipt = (record) => {
    setReceiptPreviewRecord(record);
  };

  useEffect(() => {
  }, [newlyAddedIds]);

  // ✅ DEBUG: see exactly what will be passed to the modal

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
              {canCreate && (
                <button className="action-button" onClick={openNewModal}>
                  New
                </button>
              )}

              {canUpdate && (
                <button className="action-button" onClick={openEditModal}>
                  Edit
                </button>
              )}

              {canDelete && (
                <button className="delete-button" onClick={openDeleteModal}>
                  Delete
                </button>
              )}

              <button
                className="action-button-stmt"
                onClick={openStatement}
                title={
                  selectedRowIndex === null
                    ? "Select a row first"
                    : "Open statement for selected customer"
                }
              >
                Stmt
              </button>

              <button
                className="action-button-jv"
                onClick={handleViewJournalVoucher}
                title={
                  selectedRowIndex === null
                    ? "Select a receipt entry first"
                    : "View journal voucher for selected entry"
                }
              >
                View JV
              </button>

              {/* ✅ NEW: Daily Receivables Button */}
              <button
                className="action-button-daily"
                onClick={openDailyReceivables}
                title="View daily receivables report"
              >
                Daily Report
              </button>
            </div>
          </div>

          

          {loading ? (
            <p>Loading data...</p>
          ) : error ? (
            <p className="error-text">{error}</p>
          ) : (
            <>
              {searching && <div className="searching-hint">Searching…</div>}
              <table className="accounting-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Customer Name</th>
                    <th>Date</th>
                    <th>Cash Number</th>
                    <th>Cur</th>
                    <th>Ex Rate</th>
                    <th>Amount Ex</th>
                    <th>Ref Invoice</th>
                    <th>JV Number</th>
                    <th>PMT Type</th>
                    <th>Comments</th>
                    <th>RCT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const hasGlow = newlyAddedIds.has(row.id);

                    return (
                      <tr key={row.id} className={hasGlow ? "newly-added" : ""}>
                        <td>
                          <input
                            type="radio"
                            name="selectedRow"
                            checked={selectedRowIndex === idx}
                            onChange={() => setSelectedRowIndex(idx)}
                          />
                        </td>
                        <td>{row.customerName}</td>
                        <td>{row.date}</td>
                        <td>{formatNumberWithCommas(row.cashNumber)}</td>
                        <td>{row.currency}</td>
                        <td>{row.exchangeRate}</td>
                        <td>{formatNumberWithCommas(row.amountExchanged)}</td>
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
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {isNewModalOpen && (
          <NewRecordModal
            onClose={closeNewModal}
            onSave={(created) => {
              closeNewModal();
            }}
            // ✅ PASS DRAFT (we pass 2 prop names to be safe)
            prefillDraft={incomingDraft}
            draft={incomingDraft}
          />
        )}

        {isEditModalOpen && selectedRow && (
          <EditRecordModal
            selectedRow={selectedRow}
            onClose={closeEditModal}
            onSave={(updated) => {
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

      <StatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        customerId={stmtCustomerId}
        defaultDate={stmtDefaultDate}
        customerName={stmtCustomerName}
      />

      {/* ✅ NEW: Daily Receivables Modal */}
      <DailyReceivablesModal
        isOpen={isDailyReceivablesOpen}
        onClose={() => setIsDailyReceivablesOpen(false)}
      />
    </>
  );
};

export default AccountingPage;
