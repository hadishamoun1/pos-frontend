// src/components/recievables/NewRecordModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useLocation } from "react-router-dom";
import CustomerSelectionModal from "./CustomerSelectionModal";
import "./newRecord.css";
import NotificationModal from "./NotificationModal";
import { axiosClient } from "../api/axiosClient";
import { useTranslation } from "../hooks/useTranslation"; // ✅ add
import { hasPerm } from "../auth/authz";

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
    invoicePage: 1,
    invoiceHasMore: false,
    invoiceLoadingMore: false,

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
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const { t } = useTranslation(); // ✅

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
    selected?.invoiceNumber || (loading ? t("common.loading") : placeholder);

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
        title={selected ? t("receivables.invoiceTitleWithNumber", { number: selected.invoiceNumber }) : undefined}
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
              <div>{t("receivables.invoicePicker.invoiceNumber")}</div>
              <div>{t("receivables.invoicePicker.date")}</div>
              <div>{t("receivables.invoicePicker.noVat")}</div>
              <div>{t("receivables.invoicePicker.vat")}</div>
              <div>{t("receivables.invoicePicker.total")}</div>
            </div>

            <button
              type="button"
              className={`inv-picker__row ${!value ? "selected" : ""}`}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <div className="inv-picker__cell inv-nbr muted">
                {t("receivables.invoicePicker.none")}
              </div>
              <div className="inv-picker__cell muted">—</div>
              <div className="inv-picker__cell inv-num muted">—</div>
              <div className="inv-picker__cell inv-num muted">—</div>
              <div className="inv-picker__cell inv-num muted">—</div>
            </button>

            <div className="inv-picker__list">
              {normalized.length === 0 ? (
                <div className="inv-picker__empty">
                  {loading
                    ? t("receivables.invoicePicker.loadingInvoices")
                    : t("receivables.invoicePicker.noInvoicesForCustomer")}
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
                    title={t("receivables.invoiceTitleWithNumber", { number: inv.invoiceNumber })}
                  >
                    <div className="inv-picker__cell inv-nbr">{inv.invoiceNumber}</div>
                    <div className="inv-picker__cell">{inv.date}</div>
                    <div className="inv-picker__cell inv-num">{fmtMoney(inv.totalWithoutVAT)}</div>
                    <div className="inv-picker__cell inv-num">{fmtMoney(inv.totalVAT)}</div>
                    <div className="inv-picker__cell inv-num">{fmtMoney(inv.grandTotal)}</div>
                  </button>
                ))
              )}
              {hasMore && (
                <button
                  type="button"
                  className="inv-picker__load-more"
                  disabled={loadingMore}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadMore?.();
                  }}
                >
                  {loadingMore
                    ? t("receivables.invoicePicker.loadingMore")
                    : t("receivables.invoicePicker.loadMore")}
                </button>
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
  const { t } = useTranslation(); // ✅
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
          {t("common.delete")}
        </button>

        <button type="button" className="row-ctx__item" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ✅ Invoice Splitter Modal
function InvoiceSplitterModal({ open, onClose, onConfirm, originalAmount, currency, invoices, invoiceLoading, baseRow }) {
  const [selections, setSelections] = useState([]);

  useEffect(() => {
    if (open) setSelections([]);
  }, [open]);

  const normalized = useMemo(() => {
    const list = Array.isArray(invoices) ? invoices : [];
    return list
      .map((inv) => {
        const id = inv.id ?? inv.invoiceId ?? inv.invoice_id;
        const invoiceNumber = inv.invoiceNumber ?? inv.invoice_number ?? "";
        const date = inv.date ? String(inv.date).slice(0, 10) : "";
        const grandTotal = Number(inv.grandTotal ?? inv.grand_total ?? 0);
        const totalWithoutVAT = Number(inv.totalWithoutVAT ?? inv.total_without_vat ?? 0);
        const totalVAT = Number(inv.totalVAT ?? inv.total_vat ?? 0);
        return { id: id != null ? String(id) : "", invoiceNumber: String(invoiceNumber), date, grandTotal, totalWithoutVAT, totalVAT };
      })
      .filter((x) => x.id);
  }, [invoices]);

  const totalSelected = selections.reduce((s, x) => s + x.amount, 0);
  const remaining = Math.max(0, originalAmount - totalSelected);

  const fmtAmt = (n) =>
    Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleInvoiceClick = (inv) => {
    const id = String(inv.id);
    const alreadySel = selections.find((s) => s.invoiceId === id);
    if (alreadySel) {
      setSelections((prev) => prev.filter((s) => s.invoiceId !== id));
      return;
    }
    if (remaining <= 0) return;
    const amount = parseFloat(Math.min(inv.grandTotal, remaining).toFixed(2));
    setSelections((prev) => [...prev, { invoiceId: id, invoiceNumber: inv.invoiceNumber, amount, grandTotal: inv.grandTotal }]);
  };

  const handleAmountChange = (invoiceId, rawVal) => {
    const val = parseNum(rawVal);
    if (!Number.isFinite(val) || val < 0) return;
    setSelections((prev) =>
      prev.map((s) => (s.invoiceId === invoiceId ? { ...s, amount: val } : s))
    );
  };

  const handleQuickAmount = (invoiceId, quickAmt, currencyOverride = null) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.invoiceId !== invoiceId) return s;
        const budget = remaining + s.amount;
        return { ...s, amount: parseFloat(Math.min(quickAmt, budget).toFixed(2)), currencyOverride };
      })
    );
  };

  const buildSplitRow = (amt, invoiceId, currencyOverride = null) => {
    const currency = currencyOverride || baseRow.currency;
    // If forcing LL on a USD-denominated amount, convert to LBP first
    let finalAmt = amt;
    if (currencyOverride === "LL" && baseRow.currency !== "LL") {
      const rate = parseNum(baseRow.exchangeRate);
      if (rate) finalAmt = parseFloat((amt * rate).toFixed(2));
    }
    const cashNumber = fmtComma(finalAmt);
    const amountExchanged = computeAmountExchanged({
      currency,
      cashNumber: finalAmt,
      exchangeRate: baseRow.exchangeRate,
    });
    return { ...baseRow, currency, invoiceId, cashNumber, amountExchanged, invoiceOptions: baseRow.invoiceOptions, invoiceLoading: false };
  };

  const handleConfirm = () => {
    const out = selections.map((sel) => buildSplitRow(sel.amount, sel.invoiceId, sel.currencyOverride));
    if (remaining > 0.005) out.push(buildSplitRow(remaining, ""));
    onConfirm(out);
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="inv-splitter-overlay" onMouseDown={onClose}>
      <div className="inv-splitter-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="inv-splitter-header">
          <div className="inv-splitter-title">Split Payment</div>
          <button className="inv-splitter-close" type="button" onClick={onClose}>×</button>
        </div>

        <div className="inv-splitter-balance">
          <div className="inv-splitter-balance-item">
            <span className="lbl">Original</span>
            <span className="val">{currency} {fmtAmt(originalAmount)}</span>
          </div>
          <div className="inv-splitter-balance-item">
            <span className="lbl">Allocated</span>
            <span className="val alloc">{currency} {fmtAmt(totalSelected)}</span>
          </div>
          <div className="inv-splitter-balance-item">
            <span className="lbl">Remaining</span>
            <span className={`val ${remaining <= 0.005 ? "zero" : "rem"}`}>{currency} {fmtAmt(remaining)}</span>
          </div>
        </div>

        <div className="inv-splitter-body">
          {invoiceLoading ? (
            <div className="inv-splitter-empty">Loading invoices…</div>
          ) : normalized.length === 0 ? (
            <div className="inv-splitter-empty">No open invoices for this customer.</div>
          ) : (
            <table className="inv-splitter-table">
              <thead>
                <tr>
                  <th className="inv-splitter-th-nbr">Invoice #</th>
                  <th>Date</th>
                  <th>Excl. VAT</th>
                  <th>VAT</th>
                  <th>Grand Total</th>
                  <th>Allocate ({currency})</th>
                </tr>
              </thead>
              <tbody>
                {normalized.map((inv) => {
                  const sel = selections.find((s) => s.invoiceId === inv.id);
                  const isSelected = !!sel;
                  const canSelect = !isSelected && remaining > 0;
                  return (
                    <tr
                      key={inv.id}
                      className={isSelected ? "sel" : canSelect ? "" : "dim"}
                      onClick={() => handleInvoiceClick(inv)}
                    >
                      <td className="inv-splitter-nbr">{inv.invoiceNumber}</td>
                      <td>{inv.date}</td>
                      <td className="inv-splitter-num">{fmtAmt(inv.totalWithoutVAT)}</td>
                      <td className="inv-splitter-num">{fmtAmt(inv.totalVAT)}</td>
                      <td className="inv-splitter-num">{fmtAmt(inv.grandTotal)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {isSelected ? (
                          <div className="inv-splitter-allocate-cell" onClick={(e) => e.stopPropagation()}>
                            {sel.currencyOverride === "LL" && (() => {
                              const rate = parseNum(baseRow.exchangeRate);
                              const llAmt = rate ? parseFloat((sel.amount * rate).toFixed(0)) : null;
                              return llAmt ? (
                                <div className="inv-splitter-ll-preview">
                                  LL {llAmt.toLocaleString("en-US")}
                                </div>
                              ) : null;
                            })()}
                            <div className="inv-splitter-quick-btns">
                              {inv.totalWithoutVAT > 0 && (
                                <button type="button" className="inv-splitter-quick excl" onClick={() => handleQuickAmount(inv.id, inv.totalWithoutVAT, null)}>
                                  Excl. VAT
                                </button>
                              )}
                              {inv.totalVAT > 0 && (
                                <button type="button" className="inv-splitter-quick vat" onClick={() => handleQuickAmount(inv.id, inv.totalVAT, "LL")}>
                                  VAT (LL)
                                </button>
                              )}
                              {inv.totalWithoutVAT > 0 && (
                                <button type="button" className="inv-splitter-quick totalexcl" onClick={() => handleQuickAmount(inv.id, inv.totalWithoutVAT, null)}>
                                  Total excl. VAT
                                </button>
                              )}
                              <button type="button" className="inv-splitter-quick total" onClick={() => handleQuickAmount(inv.id, inv.grandTotal, null)}>
                                Grand Total
                              </button>
                            </div>
                            <input
                              className="inv-splitter-amt-input"
                              type="text"
                              value={sel.amount}
                              onChange={(e) => handleAmountChange(inv.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <span className="inv-splitter-dash">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="inv-splitter-footer">
          <div className="inv-splitter-info">
            {selections.length > 0 && (
              <span>
                {selections.length} invoice{selections.length > 1 ? "s" : ""} selected
                {remaining > 0.005 ? ` · ${currency} ${fmtAmt(remaining)} unallocated` : " · fully allocated"}
              </span>
            )}
          </div>
          <div className="inv-splitter-footer-btns">
            <button type="button" className="inv-splitter-btn cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="inv-splitter-btn confirm" disabled={selections.length === 0} onClick={handleConfirm}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ✅ Main NewRecordModal Component (UPDATED)
const NewRecordModal = ({ onClose, onSave, prefillDraft }) => {
  const { t } = useTranslation(); // ✅
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

  const [splitter, setSplitter] = useState({ open: false, rowIndex: null });

  const handleSplitConfirm = (splitRows) => {
    const idx = splitter.rowIndex;
    setRows((prev) => [...prev.slice(0, idx), ...splitRows, ...prev.slice(idx + 1)]);
    setSplitter({ open: false, rowIndex: null });
  };

  const fetchCustomerInvoices = async (customerId, page = 1) => {
    const key = String(customerId || "").trim();
    if (!key) return { list: [], hasMore: false };

    if (page === 1 && invoiceCacheRef.current.has(key)) {
      return invoiceCacheRef.current.get(key);
    }

    const url = `/recievables/v1/customers/${key}/invoices`;
    const resp = await axiosClient.get(url, { params: { page, limit: 50 } });

    const list = Array.isArray(resp.data) ? resp.data : resp.data?.data || [];
    const meta = resp.data?.meta;
    const hasMore = meta ? meta.page < meta.pages : false;
    const result = { list, hasMore };

    if (page === 1) {
      invoiceCacheRef.current.set(key, result);
    }

    return result;
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
        invoicePage: 1,
        invoiceHasMore: false,
        invoiceLoadingMore: false,
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
      const { list, hasMore } = await fetchCustomerInvoices(customer.id, 1);
      setRows((prev) =>
        prev.map((row, i) =>
          i === rowIndex
            ? {
                ...row,
                invoiceOptions: list,
                invoiceLoading: false,
                invoicePage: 1,
                invoiceHasMore: hasMore,
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
                invoicePage: 1,
                invoiceHasMore: false,
              }
            : row
        )
      );

      setNotification({
        type: "error",
        message:
          e?.response?.data?.message ||
          e?.message ||
          t("receivables.errors.failedLoadInvoices"),
      });
    }
  };

  const handleLoadMoreInvoices = async (rowIndex) => {
    const row = rows[rowIndex];
    if (!row || !row.customerId || row.invoiceLoadingMore || !row.invoiceHasMore) return;

    const nextPage = (row.invoicePage || 1) + 1;
    const key = String(row.customerId).trim();

    setRows((prev) =>
      prev.map((r, i) => (i === rowIndex ? { ...r, invoiceLoadingMore: true } : r))
    );

    try {
      const url = `/recievables/v1/customers/${key}/invoices`;
      const resp = await axiosClient.get(url, { params: { page: nextPage, limit: 50 } });

      const newList = Array.isArray(resp.data) ? resp.data : resp.data?.data || [];
      const meta = resp.data?.meta;
      const hasMore = meta ? meta.page < meta.pages : false;

      setRows((prev) =>
        prev.map((r, i) =>
          i === rowIndex
            ? {
                ...r,
                invoiceOptions: [...r.invoiceOptions, ...newList],
                invoicePage: nextPage,
                invoiceHasMore: hasMore,
                invoiceLoadingMore: false,
              }
            : r
        )
      );

      const cached = invoiceCacheRef.current.get(key);
      if (cached) {
        invoiceCacheRef.current.set(key, {
          list: [...(cached.list || []), ...newList],
          hasMore,
        });
      }
    } catch {
      setRows((prev) =>
        prev.map((r, i) => (i === rowIndex ? { ...r, invoiceLoadingMore: false } : r))
      );
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

    if (norm?.rows?.length) {
      const normalizedRows = norm.rows.map(normalizeDraftItemToRow);
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
            customerIds.map(async (cid) => [cid, await fetchCustomerInvoices(cid, 1)])
          );
          const map = new Map(pairs);

          setRows((prev) =>
            prev.map((r) => {
              const cid = String(r.customerId || "").trim();
              if (!cid) return r;
              const { list = [], hasMore = false } = map.get(cid) || {};
              return {
                ...r,
                invoiceOptions: list,
                invoiceLoading: false,
                invoicePage: 1,
                invoiceHasMore: hasMore,
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

    if (rows.length === 0) handleAddRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (!rows.length) throw new Error(t("receivables.errors.addAtLeastOneRow"));

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 1;

        if (!r.customerId) throw new Error(t("receivables.errors.rowCustomerRequired", { row: rowNum }));
        if (!r.type) throw new Error(t("receivables.errors.rowTypeRequired", { row: rowNum }));
        if (!r.pmtType) throw new Error(t("receivables.errors.rowPaymentTypeRequired", { row: rowNum }));
        if (!r.currency) throw new Error(t("receivables.errors.rowCurrencyRequired", { row: rowNum }));
        if (!r.cashNumber) throw new Error(t("receivables.errors.rowCashNumberRequired", { row: rowNum }));
        if (r.currency === "LL" && !r.exchangeRate)
          throw new Error(t("receivables.errors.rowExchangeRateRequiredForLL", { row: rowNum }));
        if (!r.amountExchanged) throw new Error(t("receivables.errors.rowAmountExchangedRequired", { row: rowNum }));
        if (!r.date) throw new Error(t("receivables.errors.rowDateRequired", { row: rowNum }));
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

        const resp = await axiosClient.post(`/recievables`, payload);
        created.push(resp.data);

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
            throw new Error(
              markErr?.response?.data?.message ||
                t("receivables.errors.failedMarkCashCollections", { count: ids.length })
            );
          }
        }
      }

      setNotification({ type: "success", message: t("receivables.messages.savedSuccessfully") });
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
          <h2>{t("receivables.newRecord.title")}</h2>
          <div className="payments-modal-header-buttons">
            <button
              className="payments-modal-action-button payments-modal-cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              {t("common.cancel")}
            </button>

            <button
              className="payments-modal-action-button payments-modal-save-button"
              onClick={handleSave}
              disabled={saving || rows.length === 0}
              title={rows.length === 0 ? t("receivables.newRecord.addAtLeastOneRowTitle") : undefined}
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>

        <div className="payments-modal-table-scroll">
          <table className="payments-modal-table">
            <thead>
              <tr>
                <th>{t("receivables.newRecord.headers.customerName")}</th>
                <th>{t("receivables.newRecord.headers.type")}</th>
                <th>{t("receivables.newRecord.headers.paymentType")}</th>
                <th>{t("receivables.newRecord.headers.currency")}</th>
                <th>{t("receivables.newRecord.headers.cashNumber")}</th>
                <th>{t("receivables.newRecord.headers.exchangeRate")}</th>
                <th>{t("receivables.newRecord.headers.amountEx")}</th>
                <th>{t("receivables.newRecord.headers.date")}</th>
                <th>{t("receivables.newRecord.headers.invoiceNumber")}</th>
                <th>{t("receivables.newRecord.headers.comments")}</th>
                <th>Split</th>
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
                      title={t("receivables.newRecord.pickCustomerTitle")}
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
                      <option value="G">{t("receivables.types.G")}</option>
                      <option value="S">{t("receivables.types.S")}</option>
                      {hasPerm("recievables.rvr") && (
                        <option value="RVR">{t("receivables.types.RVR")}</option>
                      )}
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
                      <option value="">{t("common.select")}</option>
                      <option value="Cash">{t("receivables.paymentTypes.cash")}</option>
                      <option value="Check">{t("receivables.paymentTypes.check")}</option>
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
                      <option value="">{t("common.select")}</option>
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
                      placeholder={t("receivables.invoicePicker.none")}
                      hasMore={row.invoiceHasMore}
                      loadingMore={row.invoiceLoadingMore}
                      onLoadMore={() => handleLoadMoreInvoices(idx)}
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

                  <td>
                    {row.customerId && parseNum(row.cashNumber) > 0 && (
                      <button
                        type="button"
                        className="inv-splitter-trigger"
                        disabled={saving}
                        title="Split this payment across invoices"
                        onClick={() => setSplitter({ open: true, rowIndex: idx })}
                      >
                        Split
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="payments-modal-footer">
          <button className="payments-modal-action-button" onClick={handleAddRow} disabled={saving}>
            {t("receivables.newRecord.addRow")}
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

      {splitter.open && splitter.rowIndex != null && rows[splitter.rowIndex] && (
        <InvoiceSplitterModal
          open={splitter.open}
          onClose={() => setSplitter({ open: false, rowIndex: null })}
          onConfirm={handleSplitConfirm}
          originalAmount={parseNum(rows[splitter.rowIndex].cashNumber)}
          currency={rows[splitter.rowIndex].currency || "USD"}
          invoices={rows[splitter.rowIndex].invoiceOptions || []}
          invoiceLoading={rows[splitter.rowIndex].invoiceLoading || false}
          baseRow={rows[splitter.rowIndex]}
        />
      )}
    </div>
  );
};

export default NewRecordModal;
