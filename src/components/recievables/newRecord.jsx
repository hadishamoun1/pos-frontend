// src/components/recievables/NewRecordModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useLocation } from "react-router-dom";
import CustomerSelectionModal from "./CustomerSelectionModal";
import "./newRecord.css";
import NotificationModal from "./NotificationModal";
import { axiosClient } from "../api/axiosClient";

const DRAFT_KEY = "__receivables_create_draft__";

function fmtComma(n) {
  if (n === "" || n === null || n === undefined) return "";
  const x = Number(String(n).replace(/,/g, ""));
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function toYMD(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  if (typeof val === "string") return val.slice(0, 10);
  const d = new Date(val);
  return isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10)
    : d.toISOString().slice(0, 10);
}

function safeString(v) {
  return v == null ? "" : String(v);
}

function parseNum(v) {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function computeAmountExchanged({ currency, cashNumber, exchangeRate }) {
  const cash = parseNum(cashNumber);
  const rate = parseNum(exchangeRate);
  if (!cash || !rate) return "";

  if (String(currency).toUpperCase() === "LL") {
    // LL -> USD
    return fmtComma((cash / rate).toFixed(2));
  }
  // USD -> LL
  return fmtComma((cash * rate).toFixed(2));
}

function normalizeDraftItemToRow(item) {
  const today = new Date().toISOString().split("T")[0];

  // accept different field names safely
  const customerId = item?.customerId ?? item?.customerID ?? item?.customer_id ?? "";
  const customerName =
    item?.customerName ?? item?.customer ?? item?.name ?? item?.fullName ?? "";

  const currency = safeString(item?.currency || "USD").toUpperCase();

  const exchangeRateRaw =
    item?.exchangeRate != null && String(item.exchangeRate).trim() !== ""
      ? item.exchangeRate
      : "89,500";

  const cashNumberRaw = item?.cashNumber ?? item?.cash ?? item?.amount ?? "";
  const amountExRaw = item?.amountExchanged ?? item?.amount_exchanged ?? "";

  const cashNumber = fmtComma(cashNumberRaw);
  const exchangeRate = fmtComma(exchangeRateRaw);

  const amountExchanged =
    String(amountExRaw || "").trim() !== ""
      ? fmtComma(amountExRaw)
      : computeAmountExchanged({ currency, cashNumber, exchangeRate });

  // ✅ IMPORTANT: keep the cash-collection ids that came from CashCollectionsPage draft
  const sourceCashCollectionIds = Array.isArray(item?.sourceCashCollectionIds)
    ? item.sourceCashCollectionIds
    : [];

  return {
    customerId: safeString(customerId),
    customerName: safeString(customerName),
    type: safeString(item?.type || "S"),
    pmtType: safeString(item?.pmtType || "Cash"),
    currency,
    exchangeRate,
    cashNumber,
    amountExchanged: amountExchanged || "",
    date: toYMD(item?.date || today),

    invoiceId: item?.invoiceId == null ? "" : safeString(item.invoiceId),
    invoiceOptions: [],
    invoiceLoading: false,

    // ✅ FIX: keep incoming comments instead of forcing ""
    comments: safeString(item?.comments ?? ""),

    // ✅ NEW: preserve ids for linking after save
    sourceCashCollectionIds,
  };
}


function normalizeDraftPayload(anyDraft) {
  if (!anyDraft) return null;

  // If the caller already gave {rows:[...]}
  if (Array.isArray(anyDraft?.rows)) return anyDraft;

  // If it’s nested under common names
  if (Array.isArray(anyDraft?.draft?.rows)) return anyDraft.draft;
  if (Array.isArray(anyDraft?.prefillDraft?.rows)) return anyDraft.prefillDraft;

  // If state itself is like {rows:[...]} but without wrapper checks above
  if (Array.isArray(anyDraft)) return { rows: anyDraft };

  // If it’s a single row object
  if (typeof anyDraft === "object") return { rows: [anyDraft] };

  return null;
}

// ✅ InvoicePicker Component (COMPLETE)
function InvoicePicker({
  disabled,
  loading,
  value,
  options,
  onChange,
  placeholder = "— None —",
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 10, top: 0, width: 0 });
  const rootRef = useRef(null);

  const toYMDLocal = (val) => {
    if (!val) return "";
    if (typeof val === "string") return val.slice(0, 10);
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const fmtMoney = (n) => {
    const x = Number(n);
    if (!isFinite(x)) return "";
    return x.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const normalized = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    return list
      .map((inv) => {
        const id = inv.id ?? inv.invoiceId ?? inv.invoice_id;
        const invoiceNumber = inv.invoiceNumber ?? inv.invoice_number ?? "";
        const date = toYMDLocal(inv.date);
        const totalWithoutVAT = inv.totalWithoutVAT ?? inv.total_without_vat ?? 0;
        const totalVAT = inv.totalVAT ?? inv.total_vat ?? 0;
        const grandTotal = inv.grandTotal ?? inv.grand_total ?? 0;

        return {
          id: id != null ? String(id) : "",
          invoiceNumber: String(invoiceNumber || ""),
          date,
          totalWithoutVAT,
          totalVAT,
          grandTotal,
        };
      })
      .filter((x) => x.id);
  }, [options]);

  const selected = useMemo(
    () => normalized.find((x) => x.id === String(value)) || null,
    [normalized, value]
  );

  const displayText =
    selected?.invoiceNumber || (loading ? "Loading..." : placeholder);

  const computeMenuPos = () => {
    const el = rootRef.current;
    if (!el) return;
    const btn = el.querySelector(".inv-picker__btn");
    if (!btn) return;

    const rect = btn.getBoundingClientRect();

    const MENU_W = 750;
    const GAP = 6;

    let left = rect.right - MENU_W;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_W - 8));

    const top = rect.bottom + GAP;

    setPos({ left, top, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target)) return;
      const inPortalMenu = e.target.closest?.(".inv-picker__menu");
      if (inPortalMenu) return;
      setOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onResize = () => computeMenuPos();
    const onScroll = () => computeMenuPos();

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div className="inv-picker" ref={rootRef}>
      <button
        type="button"
        className="inv-picker__btn"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) computeMenuPos();
          setOpen((v) => !v);
        }}
        title={selected ? `Invoice ${selected.invoiceNumber}` : undefined}
      >
        <span className={`inv-picker__btnText ${selected ? "" : "muted"}`}>
          {displayText}
        </span>
        <span className="inv-picker__chev" aria-hidden="true">
          ▾
        </span>
      </button>

      {open &&
        !disabled &&
        ReactDOM.createPortal(
          <div
            className="inv-picker__menu inv-portal"
            role="listbox"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: 700,
              zIndex: 20000,
            }}
          >
            <div className="inv-picker__header">
              <div>Invoice #</div>
              <div>Date</div>
              <div>No VAT</div>
              <div>VAT</div>
              <div>Total</div>
            </div>

            <button
              type="button"
              className={`inv-picker__row ${!value ? "selected" : ""}`}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <div className="inv-picker__cell inv-nbr muted">— None —</div>
              <div className="inv-picker__cell muted">—</div>
              <div className="inv-picker__cell inv-num muted">—</div>
              <div className="inv-picker__cell inv-num muted">—</div>
              <div className="inv-picker__cell inv-num muted">—</div>
            </button>

            <div className="inv-picker__list">
              {normalized.length === 0 ? (
                <div className="inv-picker__empty">
                  {loading ? "Loading invoices..." : "No invoices for this customer."}
                </div>
              ) : (
                normalized.map((inv) => (
                  <button
                    type="button"
                    key={inv.id}
                    className={`inv-picker__row ${
                      String(value) === inv.id ? "selected" : ""
                    }`}
                    onClick={() => {
                      onChange(inv.id);
                      setOpen(false);
                    }}
                    title={`Invoice ${inv.invoiceNumber}`}
                  >
                    <div className="inv-picker__cell inv-nbr">{inv.invoiceNumber}</div>
                    <div className="inv-picker__cell">{inv.date}</div>
                    <div className="inv-picker__cell inv-num">{fmtMoney(inv.totalWithoutVAT)}</div>
                    <div className="inv-picker__cell inv-num">{fmtMoney(inv.totalVAT)}</div>
                    <div className="inv-picker__cell inv-num">{fmtMoney(inv.grandTotal)}</div>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// ✅ RowContextMenu Component (COMPLETE)
function RowContextMenu({ open, x, y, onDelete, onClose, disabled }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W = 190;
  const H = 104;

  const left = Math.max(8, Math.min(x, vw - W - 8));
  const top = Math.max(8, Math.min(y, vh - H - 8));

  return ReactDOM.createPortal(
    <div className="row-ctx" style={{ position: "fixed", left, top, zIndex: 30000 }} role="menu">
      <div className="row-ctx__panel" ref={menuRef}>
        <button
          type="button"
          className="row-ctx__item row-ctx__danger"
          onClick={() => {
            if (disabled) return;
            onDelete();
            onClose();
          }}
          disabled={disabled}
        >
          Delete
        </button>

        <button type="button" className="row-ctx__item" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}

// ✅ Main NewRecordModal Component (UPDATED)
const NewRecordModal = ({ onClose, onSave, prefillDraft }) => {
  const location = useLocation();

  const [rows, setRows] = useState([]);
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const [notification, setNotification] = useState(null);
  const [closeAfterNotification, setCloseAfterNotification] = useState(false);
  const [saving, setSaving] = useState(false);

  const inputRefs = useRef({});
  const invoiceCacheRef = useRef(new Map());

  const [rowMenu, setRowMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const closeRowMenu = () => setRowMenu({ open: false, x: 0, y: 0, rowIndex: null });

  const deleteRowAt = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const fetchCustomerInvoices = async (customerId) => {
    const key = String(customerId || "").trim();
    if (!key) return [];

    if (invoiceCacheRef.current.has(key)) {
      return invoiceCacheRef.current.get(key) || [];
    }

    const url = `/recievables/v1/customers/${key}/invoices`;
    const resp = await axiosClient.get(url);

    const list = Array.isArray(resp.data) ? resp.data : resp.data?.data || [];
    invoiceCacheRef.current.set(key, list);
    return list;
  };

  const handleAddRow = () => {
    if (saving) return;

    const today = new Date().toISOString().slice(0, 10);

    setRows((prev) => [
      ...prev,
      {
        customerId: "",
        customerName: "",
        type: "S",
        pmtType: "Cash",
        currency: "USD",
        exchangeRate: "89,500",
        cashNumber: "",
        amountExchanged: "",
        date: today,
        invoiceId: "",
        invoiceOptions: [],
        invoiceLoading: false,
        comments: "",
        sourceCashCollectionIds: [],
      },
    ]);
  };

  const handleInputChange = (index, field, value) => {
    if (saving) return;

    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };

        if (["cashNumber", "exchangeRate", "currency"].includes(field)) {
          const cash = Number(String(updated.cashNumber || "").replace(/,/g, "")) || 0;
          const rate = Number(String(updated.exchangeRate || "").replace(/,/g, "")) || 0;

          if (updated.currency === "LL" && rate) {
            updated.amountExchanged = fmtComma((cash / rate).toFixed(2));
          } else if (updated.currency === "USD" && rate) {
            updated.amountExchanged = fmtComma((cash * rate).toFixed(2));
          } else {
            updated.amountExchanged = "";
          }
        }

        return updated;
      })
    );
  };

  const handleCustomerSelect = async (customer) => {
    if (saving) return;
    const rowIndex = currentRowIndex;
    if (rowIndex === null) return;

    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              customerId: customer.id,
              customerName: customer.customerName,
              invoiceId: "",
              invoiceOptions: [],
              invoiceLoading: true,
            }
          : row
      )
    );
    setCustomerModalOpen(false);

    try {
      const invoices = await fetchCustomerInvoices(customer.id);
      setRows((prev) =>
        prev.map((row, i) =>
          i === rowIndex
            ? {
                ...row,
                invoiceOptions: invoices,
                invoiceLoading: false,
              }
            : row
        )
      );
    } catch (e) {
      setRows((prev) =>
        prev.map((row, i) =>
          i === rowIndex
            ? {
                ...row,
                invoiceOptions: [],
                invoiceLoading: false,
              }
            : row
        )
      );

      setNotification({
        type: "error",
        message:
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load invoices for this customer.",
      });
    }
  };

  const registerRef = (rowIndex, field) => (el) => {
    if (!inputRefs.current[rowIndex]) inputRefs.current[rowIndex] = {};
    inputRefs.current[rowIndex][field] = el;
  };

  const handleKeyDown = (e, rowIndex, field) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const fieldOrder = [
      "customerName",
      "type",
      "pmtType",
      "currency",
      "cashNumber",
      "exchangeRate",
      "date",
      "comments",
    ];

    const currentFieldIndex = fieldOrder.indexOf(field);
    if (currentFieldIndex === -1) return;

    if (currentFieldIndex === fieldOrder.length - 1) {
      if (rowIndex === rows.length - 1) {
        handleAddRow();
        setTimeout(() => {
          const firstField = inputRefs.current[rowIndex + 1]?.["customerName"];
          if (firstField) firstField.focus();
        }, 0);
      } else {
        const nextRowFirstField = inputRefs.current[rowIndex + 1]?.["customerName"];
        if (nextRowFirstField) nextRowFirstField.focus();
      }
    } else {
      const nextField = fieldOrder[currentFieldIndex + 1];
      const nextInput = inputRefs.current[rowIndex]?.[nextField];
      if (nextInput) nextInput.focus();
    }
  };

  // ✅ FIX: actually apply the passed draft (prop OR location OR session)
  useEffect(() => {
    let fromSession = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) fromSession = JSON.parse(raw);
    } catch {}

    const rawFromLocation = location?.state || null;

    // Priority: prop > location.state > sessionStorage
    const rawDraft = prefillDraft || rawFromLocation || fromSession;

    const norm = normalizeDraftPayload(rawDraft);

    console.log("🧾 [NewRecordModal] prefillDraft =", prefillDraft);
    console.log("🧾 [NewRecordModal] location.state =", rawFromLocation);
    console.log("🧾 [NewRecordModal] sessionDraft =", fromSession);
    console.log("🧾 [NewRecordModal] rawDraftUsed =", rawDraft);
    console.log("🧾 [NewRecordModal] normalizedDraft =", norm);

    if (norm?.rows?.length) {
      const normalizedRows = norm.rows.map(normalizeDraftItemToRow);

      console.log("🧾 [NewRecordModal] normalizedRows(APPLY) =", normalizedRows);

      setRows(normalizedRows);

      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}

      // preload invoices
      (async () => {
        try {
          const customerIds = Array.from(
            new Set(normalizedRows.map((r) => String(r.customerId || "").trim()).filter(Boolean))
          );

          if (!customerIds.length) return;

          setRows((prev) =>
            prev.map((r) =>
              r.customerId ? { ...r, invoiceLoading: true, invoiceOptions: [] } : r
            )
          );

          const pairs = await Promise.all(
            customerIds.map(async (cid) => [cid, await fetchCustomerInvoices(cid)])
          );

          const map = new Map(pairs);

          setRows((prev) =>
            prev.map((r) => {
              const cid = String(r.customerId || "").trim();
              if (!cid) return r;
              return {
                ...r,
                invoiceOptions: map.get(cid) || [],
                invoiceLoading: false,
              };
            })
          );
        } catch (e) {
          console.warn("🧾 [NewRecordModal] invoice preload failed:", e);
          setRows((prev) => prev.map((r) => ({ ...r, invoiceLoading: false })));
        }
      })();

      return;
    }

    // no draft => create default empty row
    if (rows.length === 0) handleAddRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (!rows.length) throw new Error("Add at least one row.");

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 1;

        if (!r.customerId) throw new Error(`Row ${rowNum}: Customer is required.`);
        if (!r.type) throw new Error(`Row ${rowNum}: JV Type is required.`);
        if (!r.pmtType) throw new Error(`Row ${rowNum}: Payment Type is required.`);
        if (!r.currency) throw new Error(`Row ${rowNum}: Currency is required.`);
        if (!r.cashNumber) throw new Error(`Row ${rowNum}: Cash number is required.`);
        if (r.currency === "LL" && !r.exchangeRate)
          throw new Error(`Row ${rowNum}: Exchange rate is required for LL.`);
        if (!r.amountExchanged) throw new Error(`Row ${rowNum}: Amount exchanged is required.`);
        if (!r.date) throw new Error(`Row ${rowNum}: Date is required.`);
      }

      const created = [];

for (const r of rows) {
  const cashNumber = Number(String(r.cashNumber || "").replace(/,/g, ""));
  const exchangeRateRaw = String(r.exchangeRate || "").replace(/,/g, "");
  const exchangeRate = exchangeRateRaw === "" ? null : Number(exchangeRateRaw);
  const amountExchanged = Number(String(r.amountExchanged || "").replace(/,/g, ""));
  const invoiceId = r.invoiceId === "" || r.invoiceId == null ? null : Number(r.invoiceId);

  const payload = {
    customerId: Number(r.customerId),
    date: r.date,
    invoiceId,
    cashNumber,
    currency: r.currency,
    exchangeRate: exchangeRate ?? null,
    amountExchanged,
    comments: r.comments,
    type: r.type,
    pmtType: r.pmtType,
  };

  // ✅ 1) Create receivable
  const resp = await axiosClient.post(`/recievables`, payload);
  created.push(resp.data);

  // ✅ 2) Mark cash collections as linked + posted (prevents duplicates)
  const receivableEntryId = resp?.data?.id;

  const ids = Array.isArray(r.sourceCashCollectionIds)
    ? r.sourceCashCollectionIds
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0)
    : [];

  if (receivableEntryId && ids.length) {
    try {
      await axiosClient.post(`/cash-collections/v1/mark-receivable`, {
        ids,
        receivableEntryId,
      });
    } catch (markErr) {
      // ✅ Option 3: DO NOT silently continue
      // Throw so user sees clear error, instead of creating duplicates later
      throw new Error(
        markErr?.response?.data?.message ||
          `Receivable saved but failed to mark CashCollections (ids=${ids.length}).`
      );
    }
  }
}


      setNotification({ type: "success", message: "Saved successfully!" });
      setCloseAfterNotification(true);
      onSave(created);
    } catch (e) {
      setNotification({
        type: "error",
        message: e?.response?.data?.message || e?.message,
      });
      setSaving(false);
    }
  };

  const handleNotificationClose = () => {
    setNotification(null);
    if (closeAfterNotification) onClose();
  };

  return (
    <div className="payments-modal-overlay">
      <div className="payments-modal-content">
        <div className="payments-modal-header">
          <h2>New Record</h2>
          <div className="payments-modal-header-buttons">
            <button
              className="payments-modal-action-button payments-modal-cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              className="payments-modal-action-button payments-modal-save-button"
              onClick={handleSave}
              disabled={saving || rows.length === 0}
              title={rows.length === 0 ? "Add at least one row" : undefined}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="payments-modal-table-scroll">
          <table className="payments-modal-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Type</th>
                <th>Pmt Type</th>
                <th>Currency</th>
                <th>Cash Number</th>
                <th>Exchange Rate</th>
                <th>Amount Ex</th>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Comments</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  onContextMenu={(e) => {
                    if (saving) return;

                    const isInteractive = e.target.closest("input, select, textarea, button");
                    const isInvoiceUI = e.target.closest(
                      ".inv-picker__btn, .inv-picker__menu, .inv-portal"
                    );
                    if (isInteractive || isInvoiceUI) return;

                    e.preventDefault();
                    setRowMenu({
                      open: true,
                      x: e.clientX,
                      y: e.clientY,
                      rowIndex: idx,
                    });
                  }}
                >
                  <td>
                    <input
                      type="text"
                      value={row.customerName}
                      readOnly
                      disabled={saving}
                      ref={registerRef(idx, "customerName")}
                      onKeyDown={(e) => handleKeyDown(e, idx, "customerName")}
                      onClick={() => {
                        if (saving) return;
                        setCurrentRowIndex(idx);
                        setCustomerModalOpen(true);
                      }}
                    />
                  </td>

                  <td>
                    <select
                      value={row.type}
                      disabled={saving}
                      ref={registerRef(idx, "type")}
                      onKeyDown={(e) => handleKeyDown(e, idx, "type")}
                      onChange={(e) => handleInputChange(idx, "type", e.target.value)}
                    >
                      <option value="G">G</option>
                      <option value="S">S</option>
                      <option value="RVR">RVR</option>
                    </select>
                  </td>

                  <td>
                    <select
                      value={row.pmtType}
                      disabled={saving}
                      ref={registerRef(idx, "pmtType")}
                      onKeyDown={(e) => handleKeyDown(e, idx, "pmtType")}
                      onChange={(e) => handleInputChange(idx, "pmtType", e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                    </select>
                  </td>

                  <td>
                    <select
                      value={row.currency}
                      disabled={saving}
                      ref={registerRef(idx, "currency")}
                      onKeyDown={(e) => handleKeyDown(e, idx, "currency")}
                      onChange={(e) => handleInputChange(idx, "currency", e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="USD">USD</option>
                      <option value="LL">LL</option>
                    </select>
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.cashNumber}
                      disabled={saving}
                      ref={registerRef(idx, "cashNumber")}
                      onKeyDown={(e) => handleKeyDown(e, idx, "cashNumber")}
                      onChange={(e) => handleInputChange(idx, "cashNumber", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.exchangeRate}
                      disabled={saving}
                      ref={registerRef(idx, "exchangeRate")}
                      onKeyDown={(e) => handleKeyDown(e, idx, "exchangeRate")}
                      onChange={(e) => handleInputChange(idx, "exchangeRate", e.target.value)}
                    />
                  </td>

                  <td>
                    <input type="text" value={row.amountExchanged} readOnly disabled={saving} />
                  </td>

                  <td>
                    <input
                      type="date"
                      value={row.date}
                      disabled={saving}
                      ref={registerRef(idx, "date")}
                      onKeyDown={(e) => handleKeyDown(e, idx, "date")}
                      onChange={(e) => handleInputChange(idx, "date", e.target.value)}
                    />
                  </td>

                  <td>
                    <InvoicePicker
                      disabled={saving || !row.customerId}
                      loading={row.invoiceLoading}
                      value={row.invoiceId}
                      options={row.invoiceOptions}
                      onChange={(newId) => handleInputChange(idx, "invoiceId", newId)}
                      placeholder="— None —"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.comments}
                      disabled={saving}
                      ref={registerRef(idx, "comments")}
                      onKeyDown={(e) => handleKeyDown(e, idx, "comments")}
                      onChange={(e) => handleInputChange(idx, "comments", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="payments-modal-footer">
          <button className="payments-modal-action-button" onClick={handleAddRow} disabled={saving}>
            Add Row
          </button>
        </div>
      </div>

      {isCustomerModalOpen && !saving && (
        <CustomerSelectionModal
          onClose={() => setCustomerModalOpen(false)}
          onSelectCustomer={handleCustomerSelect}
        />
      )}

      {notification && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={handleNotificationClose}
        />
      )}

      <RowContextMenu
        open={rowMenu.open}
        x={rowMenu.x}
        y={rowMenu.y}
        disabled={saving}
        onClose={closeRowMenu}
        onDelete={() => {
          if (rowMenu.rowIndex == null) return;
          deleteRowAt(rowMenu.rowIndex);
        }}
      />
    </div>
  );
};

export default NewRecordModal;
