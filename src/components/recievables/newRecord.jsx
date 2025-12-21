import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import CustomerSelectionModal from "./CustomerSelectionModal";
import "./newRecord.css";
import NotificationModal from "./NotificationModal";
import { axiosClient } from "../api/axiosClient"; // ✅ added (api client)

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

  const toYMD = (val) => {
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
        const date = toYMD(inv.date);
        const totalWithoutVAT =
          inv.totalWithoutVAT ?? inv.total_without_vat ?? 0;
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

    const MENU_W = 750; // must match the width you use in portal style
    const GAP = 6;

    // ✅ align menu to the LEFT side (right-aligned to the button)
    let left = rect.right - MENU_W;

    // ✅ keep inside viewport
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_W - 8));

    const top = rect.bottom + GAP;

    setPos({ left, top, width: rect.width });
  };

  // close on outside click / ESC
  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      if (!rootRef.current) return;

      // click inside button/menu? ignore
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              width: 700, // fixed like your CSS
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
                  {loading
                    ? "Loading invoices..."
                    : "No invoices for this customer."}
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
                    <div className="inv-picker__cell inv-nbr">
                      {inv.invoiceNumber}
                    </div>
                    <div className="inv-picker__cell">{inv.date}</div>
                    <div className="inv-picker__cell inv-num">
                      {fmtMoney(inv.totalWithoutVAT)}
                    </div>
                    <div className="inv-picker__cell inv-num">
                      {fmtMoney(inv.totalVAT)}
                    </div>
                    <div className="inv-picker__cell inv-num">
                      {fmtMoney(inv.grandTotal)}
                    </div>
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

/** Right click menu for rows (portaled, not clipped) */
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

  // keep inside viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W = 190;
  const H = 104;

  const left = Math.max(8, Math.min(x, vw - W - 8));
  const top = Math.max(8, Math.min(y, vh - H - 8));

  return ReactDOM.createPortal(
    <div
      className="row-ctx"
      style={{ position: "fixed", left, top, zIndex: 30000 }}
      role="menu"
    >
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

const NewRecordModal = ({ onClose, onSave }) => {
  const [rows, setRows] = useState([]);
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const [notification, setNotification] = useState(null);
  const [closeAfterNotification, setCloseAfterNotification] = useState(false);

  // ✅ prevents double save
  const [saving, setSaving] = useState(false);

  // ✅ Cache invoices per customer to avoid refetching
  const invoiceCacheRef = useRef(new Map()); // customerId -> invoices[]

  // ✅ right click menu state
  const [rowMenu, setRowMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const closeRowMenu = () =>
    setRowMenu({ open: false, x: 0, y: 0, rowIndex: null });

  const deleteRowAt = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const formatNumberWithCommas = (number) => {
    if (number === "" || number === null || number === undefined) return "";
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // ✅ Fetch invoices for customer (uses cache)
  const fetchCustomerInvoices = async (customerId) => {
    const key = String(customerId || "").trim();
    if (!key) return [];

    if (invoiceCacheRef.current.has(key)) {
      return invoiceCacheRef.current.get(key) || [];
    }

    // ✅ FIX: relative URL only
    const url = `/recievables/v1/customers/${key}/invoices`;
    const resp = await axiosClient.get(url);

    const list = Array.isArray(resp.data) ? resp.data : resp.data?.data || [];
    invoiceCacheRef.current.set(key, list);
    return list;
  };

  const handleAddRow = () => {
    if (saving) return;
    setRows((prev) => [
      ...prev,
      {
        customerId: "",
        customerName: "",
        type: "S",
        pmtType: "",
        currency: "",
        exchangeRate: "",
        cashNumber: "",
        amountExchanged: "",
        date: "",

        // ✅ invoice selection
        invoiceId: "", // string
        invoiceOptions: [],
        invoiceLoading: false,

        comments: "",
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
          const cash =
            parseFloat((updated.cashNumber || "").replace(/,/g, "")) || 0;
          const rate =
            parseFloat((updated.exchangeRate || "").replace(/,/g, "")) || 0;

          if (updated.currency === "LL" && rate) {
            updated.amountExchanged = formatNumberWithCommas(
              (cash / rate).toFixed(2)
            );
          } else if (updated.currency === "USD" && rate) {
            updated.amountExchanged = formatNumberWithCommas(
              (cash * rate).toFixed(2)
            );
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

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (!rows.length) throw new Error("Add at least one row.");

      const created = [];

      for (const r of rows) {
        if (!r.customerId) throw new Error("Customer is required.");
        if (!r.type) throw new Error("JV Type is required.");
        if (!r.pmtType) throw new Error("Payment Type is required.");
        if (!r.currency) throw new Error("Currency is required.");
        if (!r.cashNumber) throw new Error("Cash number is required.");

        if (r.currency === "LL" && !r.exchangeRate)
          throw new Error("Exchange rate is required for LL.");

        if (!r.amountExchanged)
          throw new Error("Amount exchanged is required.");
        if (!r.date) throw new Error("Date is required.");

        const cashNumber = parseFloat((r.cashNumber || "").replace(/,/g, ""));
        if (!Number.isFinite(cashNumber))
          throw new Error("Invalid cash number.");

        const exchangeRateRaw = (r.exchangeRate || "").replace(/,/g, "");
        const exchangeRate =
          exchangeRateRaw === "" ? null : parseFloat(exchangeRateRaw);

        if (r.currency === "LL" && !Number.isFinite(exchangeRate)) {
          throw new Error("Invalid exchange rate.");
        }

        const amountExchanged = parseFloat(
          (r.amountExchanged || "").replace(/,/g, "")
        );
        if (!Number.isFinite(amountExchanged))
          throw new Error("Invalid amount exchanged.");

        const invoiceId =
          r.invoiceId === "" || r.invoiceId == null ? null : Number(r.invoiceId);

        if (invoiceId !== null && !Number.isFinite(invoiceId)) {
          throw new Error("Invalid invoice selection.");
        }

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

        // ✅ FIX: relative URL only
        const resp = await axiosClient.post(`/recievables`, payload);
        created.push(resp.data);
      }

      setNotification({ type: "success", message: "Saved successfully!" });
      setCloseAfterNotification(true);
      onSave(created);
    } catch (e) {
      setNotification({
        type: "error",
        message: e?.response?.data?.message || e?.message,
      });
    } finally {
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

        {/* ✅ Wrap table for horizontal scroll */}
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

                    // Allow normal menu inside form controls or invoice portal
                    const isInteractive = e.target.closest(
                      "input, select, textarea, button"
                    );
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
                      onChange={(e) =>
                        handleInputChange(idx, "type", e.target.value)
                      }
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
                      onChange={(e) =>
                        handleInputChange(idx, "pmtType", e.target.value)
                      }
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
                      onChange={(e) =>
                        handleInputChange(idx, "currency", e.target.value)
                      }
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
                      onChange={(e) =>
                        handleInputChange(idx, "cashNumber", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.exchangeRate}
                      disabled={saving}
                      onChange={(e) =>
                        handleInputChange(idx, "exchangeRate", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.amountExchanged}
                      readOnly
                      disabled={saving}
                    />
                  </td>

                  <td>
                    <input
                      type="date"
                      value={row.date}
                      disabled={saving}
                      onChange={(e) =>
                        handleInputChange(idx, "date", e.target.value)
                      }
                    />
                  </td>

                  {/* ✅ Invoice picker (closed shows ONLY invoice number) */}
                  <td>
                    <InvoicePicker
                      disabled={saving || !row.customerId}
                      loading={row.invoiceLoading}
                      value={row.invoiceId}
                      options={row.invoiceOptions}
                      onChange={(newId) =>
                        handleInputChange(idx, "invoiceId", newId)
                      }
                      placeholder="— None —"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.comments}
                      disabled={saving}
                      onChange={(e) =>
                        handleInputChange(idx, "comments", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="payments-modal-footer">
          <button
            className="payments-modal-action-button"
            onClick={handleAddRow}
            disabled={saving}
          >
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

      {/* ✅ Right-click row menu */}
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
