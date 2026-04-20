// src/recievables/AccountingPage.jsx
import React, { useState, useEffect, useRef } from "react";
import "./recievables.css";
import NewRecordModal from "./newRecord";
import EditRecordModal from "./editRecordModal";
import NotificationModal from "./NotificationModal";
import { axiosClient } from "../api/axiosClient";
import RctPaper from "./rctPreview";
import { createSocket } from "../api/socketClient";
import StatementModal from "../pos-system/Components/StatementModal";
import { hasPerm } from "../auth/authz";
import { useNavigate, useLocation } from "react-router-dom";
import DailyReceivablesModal from "./DailyReceivablesModal";
import { useTranslation } from "../hooks/useTranslation";

// ✅ MUST MATCH ViewCashflowModal
const DRAFT_KEY = "__receivables_create_draft__";

const AccountingPage = () => {
  const { t, language } = useTranslation(); // ✅ use language for stable dependency
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
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterCashNumber, setFilterCashNumber] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
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

  // ✅ Daily Receivables Modal
  const [isDailyReceivablesOpen, setIsDailyReceivablesOpen] = useState(false);

  // ✅ incoming draft from CashCollections preview
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
        message: t("receivables.page.errors.selectRowToEdit"),
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
        message: t("receivables.page.errors.selectRowToDelete"),
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
      setNotification({
        type: "success",
        message: t("receivables.page.messages.deletedSuccessfully"),
      });
      setSelectedRowIndex(null);
      closeDeleteModal();
    } catch {
      setNotification({
        type: "error",
        message: t("receivables.page.errors.deleteFailed"),
      });
    }
  };

  const openStatement = () => {
    if (selectedRowIndex === null) {
      setNotification({
        type: "error",
        message: t("receivables.page.errors.selectRowToOpenStatement"),
      });
      return;
    }

    const sel = filteredData[selectedRowIndex];
    const cid = sel?.customerAccountId;

    if (!cid) {
      setNotification({
        type: "error",
        message: t("receivables.page.errors.selectedRowNoCustomerId"),
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
        message: t("receivables.page.errors.selectReceiptEntryFirst"),
      });
      return;
    }

    const selectedEntry = filteredData[selectedRowIndex];
    const receiptEntryId = selectedEntry.id;

    if (!receiptEntryId) {
      setNotification({
        type: "error",
        message: t("receivables.page.errors.selectedEntryNoId"),
      });
      return;
    }

    try {
      const response = await axiosClient.get(
        `/recievables/${receiptEntryId}/journal-voucher`
      );
      const respData = response.data;

      if (!respData.journalVoucher) {
        setNotification({
          type: "info",
          message: t("receivables.page.messages.noJournalVoucherFound"),
        });
        return;
      }

      navigate(`/journal-voucher/${respData.journalVoucher.id}`);
    } catch (error) {
      console.error("Error fetching journal voucher:", error);
      setNotification({
        type: "error",
        message:
          error?.response?.data?.message ||
          t("receivables.page.errors.failedFetchJournalVoucher"),
      });
    }
  };

  // ✅ Open Daily Receivables Modal
  const openDailyReceivables = () => setIsDailyReceivablesOpen(true);

  // ✅ detect draft coming from CashCollections preview
  useEffect(() => {
    let draft = location.state?.draft || null;

    if (!draft) {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) draft = JSON.parse(raw);
      } catch (err) {
        console.warn("🧾 [Receivables] failed to parse draft:", err);
      }
    }

    if (!draft || !draft?.rows?.length) return;

    if (!canCreate) {
      setNotification({
        type: "error",
        message: t("receivables.page.errors.noPermissionCreate"),
      });
      return;
    }

    setIncomingDraft(draft);
    setIsNewModalOpen(true);

    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}

    try {
      navigate(location.pathname, { replace: true, state: {} });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ✅ FIXED: do NOT depend on `t` (which may change every render)
  // Use `language` instead (only changes when language changes).
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
        setError(err?.message || t("receivables.page.errors.failedLoadData"));
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
            if (!prevIds.has(item.id)) newIds.add(item.id);
          });

          if (newIds.size > 0) {
            setNewlyAddedIds(newIds);
            setTimeout(() => setNewlyAddedIds(new Set()), 5000);
          }

          return fmt;
        });

        setFilteredData(fmt);
      });
    } catch (err) {
      console.warn("Socket.io not available:", err);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [language]); // ✅ FIX (was [t])

  const formatNumberWithCommas = (n) =>
    n != null ? Number(n).toLocaleString("en-US") : "";

  const handleSearch = (e) => setSearchTerm(e.target.value);

  const clearFilters = () => {
    setFilterCustomer("");
    setFilterCashNumber("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearchTerm("");
  };

  const hasActiveFilters = filterCustomer || filterCashNumber || filterDateFrom || filterDateTo;

  const searchAbortRef = useRef(null);
  useEffect(() => {
    const norm = (v) => String(v ?? "").toLowerCase();
    const term = (searchTerm || "").trim();

    let result = data;

    // Filter by customer name
    if (filterCustomer.trim()) {
      const fc = norm(filterCustomer.trim());
      result = result.filter((r) => norm(r.customerName).includes(fc));
    }

    // Filter by cash number
    if (filterCashNumber.trim()) {
      const fn = norm(filterCashNumber.trim());
      result = result.filter((r) => norm(r.cashNumber).includes(fn));
    }

    // Filter by date range
    if (filterDateFrom) {
      result = result.filter((r) => r.date >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter((r) => r.date <= filterDateTo);
    }

    // General search term
    if (term) {
      const tt = norm(term);
      result = result.filter(
        (r) =>
          norm(r.customerName).includes(tt) ||
          norm(r.refInvoice).includes(tt) ||
          norm(r.invoiceNumber).includes(tt) ||
          norm(r.comments).includes(tt) ||
          norm(r.pmtType).includes(tt)
      );
    }

    setFilteredData(result);

    if (!term || term.length < 2) return;

    const timeout = setTimeout(async () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
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

        const byServer = result.filter((r) =>
          jvSet.has((r.invoiceNumber || "").toLowerCase())
        );

        setFilteredData(byServer.length ? byServer : result);
      } catch (err) {
        if (err?.code === "ERR_CANCELED") return;
        if (err?.name === "CanceledError") return;
        console.warn("Server search failed, using local filter:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm, filterCustomer, filterCashNumber, filterDateFrom, filterDateTo, data]);

  const handlePreviewReceipt = (record) => setReceiptPreviewRecord(record);

  return (
    <>
      <div className="accounting-container">
        <div className="accounting-section top-section">
          <div className="top-toolbar">
            <div className="rct-filters">
              <input
                type="text"
                placeholder="Customer name…"
                className="rct-filter-input"
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
              />
              <input
                type="text"
                placeholder="Cash number…"
                className="rct-filter-input"
                value={filterCashNumber}
                onChange={(e) => setFilterCashNumber(e.target.value)}
              />
              <label className="rct-filter-label">From</label>
              <input
                type="date"
                className="rct-filter-input rct-filter-date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
              <label className="rct-filter-label">To</label>
              <input
                type="date"
                className="rct-filter-input rct-filter-date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
              {hasActiveFilters && (
                <button className="rct-filter-clear" onClick={clearFilters} title="Clear all filters">
                  ✕ Clear
                </button>
              )}
              <span className="rct-filter-count">
                {filteredData.length} / {data.length}
              </span>
            </div>

            <div className="button-group">
              {canCreate && (
                <button className="action-button" onClick={openNewModal}>
                  {t("receivables.page.buttons.new")}
                </button>
              )}

              {canUpdate && (
                <button className="action-button" onClick={openEditModal}>
                  {t("common.edit")}
                </button>
              )}

              {canDelete && (
                <button className="delete-button" onClick={openDeleteModal}>
                  {t("common.delete")}
                </button>
              )}

              <button
                className="action-button-stmt"
                onClick={openStatement}
                title={
                  selectedRowIndex === null
                    ? t("receivables.page.titles.selectRowFirst")
                    : t("receivables.page.titles.openStatementForSelectedCustomer")
                }
              >
                {t("receivables.page.buttons.statementShort")}
              </button>

              <button
                className="action-button-jv"
                onClick={handleViewJournalVoucher}
                title={
                  selectedRowIndex === null
                    ? t("receivables.page.titles.selectReceiptEntryFirst")
                    : t("receivables.page.titles.viewJournalVoucherForSelectedEntry")
                }
              >
                {t("receivables.page.buttons.viewJv")}
              </button>

              <button
                className="action-button-daily"
                onClick={openDailyReceivables}
                title={t("receivables.page.titles.viewDailyReceivables")}
              >
                {t("receivables.page.buttons.dailyReport")}
              </button>
            </div>
          </div>

          {loading ? (
            <p>{t("receivables.page.loadingData")}</p>
          ) : error ? (
            <p className="error-text">{error}</p>
          ) : (
            <>
              {searching && (
                <div className="searching-hint">
                  {t("receivables.page.searching")}
                </div>
              )}

              <table className="accounting-table">
                <thead>
                  <tr>
                    <th>{t("common.select")}</th>
                    <th>{t("receivables.page.table.customerName")}</th>
                    <th>{t("receivables.page.table.date")}</th>
                    <th>{t("receivables.page.table.cashNumber")}</th>
                    <th>{t("receivables.page.table.currencyShort")}</th>
                    <th>{t("receivables.page.table.exchangeRateShort")}</th>
                    <th>{t("receivables.page.table.amountEx")}</th>
                    <th>{t("receivables.page.table.refInvoice")}</th>
                    <th>{t("receivables.page.table.jvNumber")}</th>
                    <th>{t("receivables.page.table.paymentType")}</th>
                    <th>{t("receivables.page.table.comments")}</th>
                    <th>{t("receivables.page.table.rct")}</th>
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
                            aria-label={t("receivables.page.table.selectRowAria")}
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
                            {t("receivables.page.buttons.receipt")}
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
            onSave={() => closeNewModal()}
            prefillDraft={incomingDraft}
            draft={incomingDraft}
          />
        )}

        {isEditModalOpen && selectedRow && (
          <EditRecordModal
            selectedRow={selectedRow}
            onClose={closeEditModal}
            onSave={() => closeEditModal()}
          />
        )}

        {isDeleteModalOpen && (
          <NotificationModal
            type="warning"
            message={t("receivables.page.confirmDeleteMessage")}
            onClose={closeDeleteModal}
            onConfirm={handleDelete}
            confirmLabel={t("common.yes")}
            cancelLabel={t("common.no")}
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

      <DailyReceivablesModal
        isOpen={isDailyReceivablesOpen}
        onClose={() => setIsDailyReceivablesOpen(false)}
      />
    </>
  );
};

export default AccountingPage;
