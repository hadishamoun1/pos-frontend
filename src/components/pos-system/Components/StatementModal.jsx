import React, { useEffect, useState, useRef } from "react";
import "./StatementModal.css";
import StatementReportModal from "./StatementReportModal";
import { axiosClient } from "../../api/axiosClient";

// ─────────────────────────────────────────────
//  DateInput (unchanged)
// ─────────────────────────────────────────────
function DateInput({ value, min, onChange, disabled }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const inputRef = useRef(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    if (value) {
      const [year, month, day] = value.split("-");
      setDisplayValue(`${day}/${month}/${year}`);
    }
  }, [value]);

  useEffect(() => {
    if (!showCalendar) return;
    const handleClickOutside = (e) => {
      if (
        calendarRef.current && !calendarRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) setShowCalendar(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCalendar]);

  const handleInputChange = (e) => {
    const input = e.target.value;
    setDisplayValue(input);
    const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      onChange(`${year}-${month}-${day}`);
    }
  };

  const handleCalendarDateClick = (isoDate) => { onChange(isoDate); setShowCalendar(false); };

  const toYMDLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const changeMonth = (delta) => {
    const current = value ? new Date(`${value}T00:00:00`) : new Date();
    const newDate = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    onChange(toYMDLocal(newDate));
  };

  const generateCalendar = () => {
    const current = value ? new Date(`${value}T00:00:00`) : new Date();
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return { year, month, days };
  };

  const { year, month, days } = generateCalendar();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const minDate = min ? new Date(`${min}T00:00:00`) : null;

  return (
    <div style={{ position: "relative" }}>
      <input ref={inputRef} type="text" value={displayValue} placeholder="DD/MM/YYYY"
        onChange={handleInputChange} onFocus={() => setShowCalendar(true)}
        disabled={disabled} maxLength={10} style={{ width: "120px" }} />
      {showCalendar && !disabled && (
        <div ref={calendarRef} style={{
          position: "absolute", top: "100%", left: 0, zIndex: 1000,
          backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px",
          padding: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", marginTop: "4px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", gap: "8px" }}>
            <button type="button" onClick={() => changeMonth(-1)}
              style={{ background: "transparent", border: "1px solid #ddd", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "16px", lineHeight: "1" }}>←</button>
            <div style={{ fontWeight: "bold", textAlign: "center", flex: 1 }}>{monthNames[month]} {year}</div>
            <button type="button" onClick={() => changeMonth(1)}
              style={{ background: "transparent", border: "1px solid #ddd", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "16px", lineHeight: "1" }}>→</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 32px)", gap: "2px" }}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: "11px", fontWeight: "bold", padding: "4px 0" }}>{d}</div>
            ))}
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isDisabled = minDate && new Date(`${isoDate}T00:00:00`) < minDate;
              const isSelected = isoDate === value;
              return (
                <button key={day} type="button"
                  onClick={() => !isDisabled && handleCalendarDateClick(isoDate)}
                  disabled={isDisabled}
                  style={{
                    padding: "4px", border: "1px solid #ddd", borderRadius: "3px",
                    backgroundColor: isSelected ? "#007bff" : isDisabled ? "#f5f5f5" : "white",
                    color: isSelected ? "white" : isDisabled ? "#ccc" : "black",
                    cursor: isDisabled ? "not-allowed" : "pointer", fontSize: "12px",
                  }}>{day}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  InvoiceItemsRow — inline expanded panel
//  onLoaded(docNbr, invoiceData) — reports data up to parent
// ─────────────────────────────────────────────
function InvoiceItemsRow({ docNbr, colSpan, onLoaded, isRevo }) {
  const [state, setState] = useState("loading");
  const [invoice, setInvoice] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  const fmt = (v, fallback = "—") => {
    if (v === null || v === undefined || v === "") return fallback;
    const n = Number(v);
    if (!isFinite(n)) return fallback;
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtQty = (v) => {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—";
  };

  const fmtDim = (v) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return isFinite(n) && n > 0 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : null;
  };

  useEffect(() => {
    if (!docNbr) return;
    setState("loading");
    axiosClient
      .get(`/invoices/v1/filtered/search`, { params: { q: docNbr, limit: 5 } })
      .then(({ data }) => {
        const match = (data?.data || []).find((inv) => inv.invoiceNumber === docNbr);
        if (!match) { setState("error"); setErrMsg("Invoice not found"); return Promise.resolve(null); }
        return axiosClient.get(`/invoices/v1/${match.id}`);
      })
      .then((res) => {
        if (!res) return;
        setInvoice(res.data);
        setState("loaded");
        // ✅ Report fetched data up to StatementModal
        onLoaded?.(docNbr, res.data);
      })
      .catch((e) => {
        setState("error");
        setErrMsg(e?.response?.data?.message || e.message || "Failed to load invoice");
      });
  }, [docNbr]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <tr className="stmt-inv-expand-row">
      <td colSpan={colSpan}>
        {state === "loading" && (
          <div className="stmt-inv-loading">
            <span className="stmt-inv-spinner" />
            <span>Loading invoice items…</span>
          </div>
        )}
        {state === "error" && (
          <div className="stmt-inv-error">
            <span className="stmt-inv-error-icon">⚠</span>
            <span>{errMsg}</span>
          </div>
        )}
        {state === "loaded" && invoice && (
          <div className="stmt-inv-panel">
            {/* ── Meta bar ── */}
            <div className="stmt-inv-meta">
              <div className="stmt-inv-meta-left">
                <span className="stmt-inv-meta-label">Invoice</span>
                <span className="stmt-inv-meta-number">{invoice.invoiceNumber}</span>
                <span className="stmt-inv-meta-sep">·</span>
                <span className="stmt-inv-meta-date">{String(invoice.date).split("T")[0]}</span>
                <span className={`stmt-inv-type-tag stmt-inv-type-tag--${(invoice.invoiceType || "").toLowerCase()}`}>
                  {invoice.invoiceType}
                </span>
              </div>
              <div className="stmt-inv-meta-right">
                <div className="stmt-inv-meta-stat">
                  <span className="stmt-inv-meta-stat-label">Without VAT</span>
                  <span className="stmt-inv-meta-stat-value">{fmt(invoice.totalWithoutVAT)}</span>
                </div>
                <div className="stmt-inv-meta-divider" />
                <div className="stmt-inv-meta-stat">
                  <span className="stmt-inv-meta-stat-label">VAT</span>
                  <span className="stmt-inv-meta-stat-value">{fmt(invoice.totalVAT)}</span>
                </div>
                <div className="stmt-inv-meta-divider" />
                <div className="stmt-inv-meta-stat stmt-inv-meta-stat--total">
                  <span className="stmt-inv-meta-stat-label">Grand Total</span>
                  <span className="stmt-inv-meta-stat-value">
                    {fmt(invoice.grandTotal)} {invoice.currencyCode || ""}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Items table ── */}
            {(!invoice.items || invoice.items.length === 0) ? (
              <div className="stmt-inv-empty">No items found for this invoice.</div>
            ) : (
              <div className="stmt-inv-table-wrap">
                <table className="stmt-inv-table">
                  <thead>
                    <tr>
                      <th className="stmt-inv-th-idx">#</th>
                      <th className="stmt-inv-th-name">Item Name</th>
                      <th className="stmt-inv-th-num">Qty</th>
                      <th className="stmt-inv-th-num">Dimensions</th>
                      <th className="stmt-inv-th-num">SQM</th>
                      <th className="stmt-inv-th-num">Unit Price</th>
                      {!isRevo && <th className="stmt-inv-th-num">VAT %</th>}
                      <th className="stmt-inv-th-num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((it, idx) => {
                      const L = fmtDim(it.length);
                      const W = fmtDim(it.width);
                      const spb = it.sheetsPerBox != null && Number(it.sheetsPerBox) > 0
                        ? String(Math.round(Number(it.sheetsPerBox))).padStart(3, "0")
                        : null;
                      const dimStr = L && W
                        ? `${L}×${W}${spb ? `-${spb}` : ""}`
                        : L || W || "—";
                      const displayName = it.invoiceDisplayName || it.itemName || `Item ${idx + 1}`;
                      return (
                        <tr key={it.invoiceItemId ?? idx} className="stmt-inv-item-row">
                          <td className="stmt-inv-td-idx">{idx + 1}</td>
                          <td className="stmt-inv-td-name">{displayName}</td>
                          <td className="stmt-inv-td-num">{fmtQty(it.quantity)}</td>
                          <td className="stmt-inv-td-num stmt-inv-td-dim">{dimStr}</td>
                          <td className="stmt-inv-td-num">{fmt(it.sqm)}</td>
                          <td className="stmt-inv-td-num">{fmt(it.unitPrice)}</td>
                          {!isRevo && (
                            <td className="stmt-inv-td-num stmt-inv-td-vat">
                              {invoice.vatPercentage != null && Number(invoice.vatPercentage) > 0
                                ? `${Number(invoice.vatPercentage)}%`
                                : "—"}
                            </td>
                          )}
                          <td className="stmt-inv-td-num stmt-inv-td-total">{fmt(it.totalAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="stmt-inv-tfoot-row">
                      <td colSpan={isRevo ? 4 : 5} className="stmt-inv-tfoot-label">
                        {invoice.items.length} item{invoice.items.length !== 1 ? "s" : ""}
                      </td>
                      <td className="stmt-inv-td-num stmt-inv-tfoot-num" />
                      {!isRevo && (
                        <td className="stmt-inv-td-num stmt-inv-tfoot-num">
                          {invoice.vatPercentage != null && Number(invoice.vatPercentage) > 0
                            ? `${Number(invoice.vatPercentage)}%`
                            : "—"}
                        </td>
                      )}
                      <td className="stmt-inv-td-num stmt-inv-tfoot-num stmt-inv-tfoot-grand">{fmt(invoice.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
//  StatementRow — controlled expand/collapse
// ─────────────────────────────────────────────
function StatementRow({ r, fmt, colSpan, onInvoiceLoaded, isRevo, expanded, onToggle }) {
  const isInvoiceRow = Boolean(r.docNbr && /^[A-Z]+\d{2}-\d+$/.test(r.docNbr.trim()));

  return (
    <>
      <tr
        className={`stmt-row${isInvoiceRow ? " stmt-row--expandable" : ""}${expanded ? " stmt-row--expanded" : ""}`}
        onClick={() => isInvoiceRow && onToggle(r.docNbr.trim())}
        title={isInvoiceRow ? "Click to view invoice items" : undefined}
      >
        <td>{fmt(Number(r.balanceAfter || 0).toFixed(2))}</td>
        <td>{fmt(Number(r.credit || 0).toFixed(2))}</td>
        <td>{fmt(Number(r.debit || 0).toFixed(2))}</td>
        <td>{r.description}</td>
        <td className="stmt-docnbr-cell">
          {isInvoiceRow
            ? <span className="stmt-docnbr-invoice">{r.docNbr}</span>
            : r.docNbr}
          {isInvoiceRow && (
            <span className="stmt-expand-chevron" aria-hidden="true">
              {expanded ? "▲" : "▼"}
            </span>
          )}
        </td>
        <td>{String(r.date).split("T")[0]}</td>
      </tr>

      {expanded && isInvoiceRow && (
        <InvoiceItemsRow
          docNbr={r.docNbr.trim()}
          colSpan={colSpan}
          onLoaded={onInvoiceLoaded}
          isRevo={isRevo}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
//  StatementModal
// ─────────────────────────────────────────────
const StatementModal = ({ isOpen, onClose, customerId, defaultDate, customerName }) => {
  const [type, setType] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);

  // ✅ Map of docNbr → full invoice data for every row the user has expanded
  const [expandedInvoices, setExpandedInvoices] = useState({});
  // ✅ Set of currently open docNbr keys
  const [expandedRows, setExpandedRows] = useState(new Set());

  const handleInvoiceLoaded = (docNbr, invoiceData) => {
    setExpandedInvoices((prev) => ({ ...prev, [docNbr]: invoiceData }));
  };

  // ✅ Toggle: if collapsing, remove from both sets so report stays in sync
  const handleToggle = (docNbr) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(docNbr)) {
        next.delete(docNbr);
        // Remove from expandedInvoices so it won't appear in print
        setExpandedInvoices((inv) => {
          const copy = { ...inv };
          delete copy[docNbr];
          return copy;
        });
      } else {
        next.add(docNbr);
      }
      return next;
    });
  };

  const [companyKey, setCompanyKey] = useState("shamoun");
  useEffect(() => {
    axiosClient.get("/company")
      .then(({ data }) => {
        const active = Array.isArray(data) ? data.find((c) => c.isActive) : null;
        setCompanyKey(active?.companyName?.toLowerCase().includes("revo") ? "revo" : "shamoun");
      })
      .catch(() => setCompanyKey("shamoun"));
  }, []);

  const MIN_DATE = "2026-01-02";

  const toYMDLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const addMonthsSafe = (date, deltaMonths) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + deltaMonths);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  };

  const getInitialDates = () => {
    const base = defaultDate ? new Date(`${defaultDate}T00:00:00`) : new Date();
    const fromDate = addMonthsSafe(base, -1);
    const fromYMD = toYMDLocal(fromDate);
    const toYMD = toYMDLocal(base);
    return { from: fromYMD < MIN_DATE ? MIN_DATE : fromYMD, to: toYMD };
  };

  const [from, setFrom] = useState(() => getInitialDates().from);
  const [to, setTo] = useState(() => getInitialDates().to);

  useEffect(() => {
    if (isOpen) {
      const { from: f, to: t } = getInitialDates();
      setFrom(f); setTo(t); setType("ALL"); setData(null); setErr("");
      // ✅ Clear expanded state when statement is re-opened
      setExpandedInvoices({});
      setExpandedRows(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultDate]);

  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function LoadingScreen({ show, text = "Generating…" }) {
    if (!show) return null;
    return (
      <div className="stmt-loading-overlay" role="status" aria-live="polite" aria-busy="true">
        <div className="stmt-loading-card">
          <div className="stmt-spinner" aria-hidden="true" />
          <div className="stmt-loading-text">{text}</div>
        </div>
      </div>
    );
  }

  const fetchStatement = async () => {
    if (!customerId) return;
    if (from < MIN_DATE) { setErr(`From date cannot be before ${MIN_DATE}`); return; }
    if (to < MIN_DATE) { setErr(`To date cannot be before ${MIN_DATE}`); return; }
    setLoading(true); setErr(""); setData(null);
    setExpandedInvoices({}); // clear on new fetch
    setExpandedRows(new Set());
    try {
      const params = { from, to };
      if (type !== "ALL") params.type = type;
      const res = await axiosClient.get(`/journal-vouchers/statements/customers/${customerId}`, { params });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFromChange = (v) => setFrom(v < MIN_DATE ? MIN_DATE : v);
  const handleToChange   = (v) => setTo(v < MIN_DATE ? MIN_DATE : v);

  if (!isOpen) return null;

  const reportCustomerName =
    customerName || data?.customerName || data?.customer?.name ||
    data?.accountName || data?.customer?.customerName || "-";

  const COL_SPAN = 6;

  return (
    <div className="pos-modal-overlay" onClick={loading ? undefined : onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pos-modal-header">
          <h2>كشف حساب</h2>
          <button className="pos-modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div className="pos-modal-controls">
          <div className="controls-left">
            <label>Type
              <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
                <option value="S">S</option>
                <option value="G">G</option>
                <option value="ALL">All</option>
              </select>
            </label>
            <label>From <DateInput value={from} min={MIN_DATE} onChange={handleFromChange} disabled={loading} /></label>
            <label>To <DateInput value={to} min={MIN_DATE} onChange={handleToChange} disabled={loading} /></label>
            <button className="pos-page-toolbar-button pos-page-blue-button"
              onClick={fetchStatement} disabled={loading || !customerId}>
              {loading ? "Loading..." : "Generate"}
            </button>
          </div>
          <div className="controls-right">
            <button className="statement-report-button"
              onClick={() => setShowReportModal(true)} disabled={!customerId || loading}>
              Report
            </button>
          </div>
        </div>

        {err && <div className="pos-modal-error">{err}</div>}

        {data && (
          <div className="pos-modal-body">
            <div className="stmt-summary-cards">
              <div className="stmt-summary-card">
                <span className="stmt-summary-card-label">رصيد سابق</span>
                <span className="stmt-summary-card-value">{fmt(data.openingBalance?.toFixed?.(2) ?? 0)}</span>
              </div>
              <div className="stmt-summary-card stmt-summary-card--debit">
                <span className="stmt-summary-card-label">مجموع الفواتير</span>
                <span className="stmt-summary-card-value">{fmt(data.totals?.totalDebit?.toFixed?.(2) ?? 0)}</span>
              </div>
              <div className="stmt-summary-card stmt-summary-card--credit">
                <span className="stmt-summary-card-label">مجموع الدفعات</span>
                <span className="stmt-summary-card-value">{fmt(data.totals?.totalCredit?.toFixed?.(2) ?? 0)}</span>
              </div>
              <div className="stmt-summary-card stmt-summary-card--balance">
                <span className="stmt-summary-card-label">الرصيد</span>
                <span className="stmt-summary-card-value">{fmt(data.closingBalance?.toFixed?.(2) ?? 0)}</span>
              </div>
            </div>

            <div className="stmt-expand-hint">
              <span className="stmt-expand-hint-icon">📋</span>
              Invoice rows are expandable — click to view items
              {Object.keys(expandedInvoices).length > 0 && (
                <span className="stmt-expand-hint-count">
                  {Object.keys(expandedInvoices).length} expanded — will appear in print
                </span>
              )}
            </div>

            <div className="stmt-table-wrap">
              <table className="stmt-table">
                <thead>
                  <tr>
                    <th>رصيد</th>
                    <th>لكم</th>
                    <th>عليكم</th>
                    <th>شرح</th>
                    <th>رقم الفاتورة</th>
                    <th>تاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items?.map((r, i) => (
                    <StatementRow
                      key={i}
                      r={r}
                      fmt={fmt}
                      colSpan={COL_SPAN}
                      onInvoiceLoaded={handleInvoiceLoaded}
                      isRevo={companyKey === "revo"}
                      expanded={Boolean(r.docNbr && expandedRows.has(r.docNbr.trim()))}
                      onToggle={handleToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ✅ Pass expandedInvoices to the report modal so it can print them */}
        <StatementReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          data={data}
          from={from}
          to={to}
          type={type}
          customerName={reportCustomerName}
          company={companyKey}
          expandedInvoices={expandedInvoices}
        />

        <LoadingScreen show={loading}
          text={type === "ALL" ? "Generating statement…" : `Generating (${type})…`} />
      </div>
    </div>
  );
};

export default StatementModal;