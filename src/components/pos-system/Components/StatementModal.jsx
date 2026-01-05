import React, { useEffect, useState, useRef } from "react";
import "./StatementModal.css";
import StatementReportModal from "./StatementReportModal";
import { axiosClient } from "../../api/axiosClient"; // ✅ use your api client

// ✅ Custom DateInput Component with DD/MM/YYYY format
function DateInput({ value, min, onChange, disabled, label }) {
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
        calendarRef.current &&
        !calendarRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowCalendar(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCalendar]);

  const handleInputChange = (e) => {
    const input = e.target.value;
    setDisplayValue(input);

    // Try to parse DD/MM/YYYY
    const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const isoDate = `${year}-${month}-${day}`;
      onChange(isoDate);
    }
  };

  const handleCalendarDateClick = (isoDate) => {
    onChange(isoDate);
    setShowCalendar(false);
  };

  const changeMonth = (delta) => {
    const current = value ? new Date(`${value}T00:00:00`) : new Date();
    const newDate = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    const newYMD = toYMDLocal(newDate);
    onChange(newYMD);
  };

  const toYMDLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return { year, month, days };
  };

  const { year, month, days } = generateCalendar();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const minDate = min ? new Date(`${min}T00:00:00`) : null;

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder="DD/MM/YYYY"
        onChange={handleInputChange}
        onFocus={() => setShowCalendar(true)}
        disabled={disabled}
        maxLength={10}
        style={{ width: "120px" }}
      />
      {showCalendar && !disabled && (
        <div
          ref={calendarRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 1000,
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            marginTop: "4px",
          }}
        >
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            marginBottom: "8px",
            gap: "8px"
          }}>
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              style={{
                background: "transparent",
                border: "1px solid #ddd",
                borderRadius: "4px",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: "1",
              }}
              title="Previous month"
            >
              ←
            </button>
            <div style={{ fontWeight: "bold", textAlign: "center", flex: 1 }}>
              {monthNames[month]} {year}
            </div>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              style={{
                background: "transparent",
                border: "1px solid #ddd",
                borderRadius: "4px",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: "1",
              }}
              title="Next month"
            >
              →
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 32px)",
              gap: "2px",
            }}
          >
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: "bold",
                  padding: "4px 0",
                }}
              >
                {d}
              </div>
            ))}
            {days.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} />;
              }

              const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(
                day
              ).padStart(2, "0")}`;
              const isDisabled = minDate && new Date(`${isoDate}T00:00:00`) < minDate;
              const isSelected = isoDate === value;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => !isDisabled && handleCalendarDateClick(isoDate)}
                  disabled={isDisabled}
                  style={{
                    padding: "4px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                    backgroundColor: isSelected ? "#007bff" : isDisabled ? "#f5f5f5" : "white",
                    color: isSelected ? "white" : isDisabled ? "#ccc" : "black",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    fontSize: "12px",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const StatementModal = ({
  isOpen,
  onClose,
  customerId,
  defaultDate,
  customerName,
}) => {
  const [type, setType] = useState("ALL");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);

  // ✅ Minimum date restriction
  const MIN_DATE = "2026-01-02";

  const toYMDLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // ✅ Convert YYYY-MM-DD to DD/MM/YYYY for display
  const formatDateDisplay = (ymdString) => {
    if (!ymdString) return "";
    const [year, month, day] = ymdString.split("-");
    return `${day}/${month}/${year}`;
  };

  // ✅ Convert DD/MM/YYYY to YYYY-MM-DD for internal use
  const parseDateInput = (displayString) => {
    if (!displayString) return "";
    const [day, month, year] = displayString.split("/");
    if (!day || !month || !year) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
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

  // ✅ Calculate initial dates with MIN_DATE check
  const getInitialDates = () => {
    const base = defaultDate ? new Date(`${defaultDate}T00:00:00`) : new Date();
    const fromDate = addMonthsSafe(base, -1);
    const fromYMD = toYMDLocal(fromDate);
    const toYMD = toYMDLocal(base);
    
    // Ensure from date is not before MIN_DATE
    const adjustedFrom = fromYMD < MIN_DATE ? MIN_DATE : fromYMD;
    
    return { from: adjustedFrom, to: toYMD };
  };

  const [from, setFrom] = useState(() => getInitialDates().from);
  const [to, setTo] = useState(() => getInitialDates().to);

  useEffect(() => {
    if (isOpen) {
      const { from: calculatedFrom, to: calculatedTo } = getInitialDates();
      setFrom(calculatedFrom);
      setTo(calculatedTo);
      setType("ALL");
      setData(null);
      setErr("");
    }
  }, [isOpen, defaultDate]);

  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0.00";
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Loading overlay (uses CSS classes)
  function LoadingScreen({ show, text = "Generating…" }) {
    if (!show) return null;
    return (
      <div
        className="stmt-loading-overlay"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="stmt-loading-card">
          <div className="stmt-spinner" aria-hidden="true" />
          <div className="stmt-loading-text">{text}</div>
        </div>
      </div>
    );
  }

  const fetchStatement = async () => {
    if (!customerId) return;
    
    // ✅ Validate dates before fetching
    if (from < MIN_DATE) {
      setErr(`From date cannot be before ${MIN_DATE}`);
      return;
    }
    if (to < MIN_DATE) {
      setErr(`To date cannot be before ${MIN_DATE}`);
      return;
    }
    
    setLoading(true);
    setErr("");
    setData(null);

    try {
      const params = { from, to };
      if (type !== "ALL") params.type = type;

      // ✅ FIX: relative URL ONLY (axiosClient already points to /api)
      const res = await axiosClient.get(
        `/journal-vouchers/statements/customers/${customerId}`,
        { params }
      );

      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle date change with validation
  const handleFromChange = (newFrom) => {
    if (newFrom < MIN_DATE) {
      setFrom(MIN_DATE);
    } else {
      setFrom(newFrom);
    }
  };

  const handleToChange = (newTo) => {
    if (newTo < MIN_DATE) {
      setTo(MIN_DATE);
    } else {
      setTo(newTo);
    }
  };

  if (!isOpen) return null;

  // Prefer the name passed from parent; fallback to API data if needed
  const reportCustomerName =
    customerName ||
    data?.customerName ||
    data?.customer?.name ||
    data?.accountName ||
    data?.customer?.customerName ||
    "-";

  return (
    <div className="pos-modal-overlay" onClick={loading ? undefined : onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pos-modal-header">
          <h2>كشف حساب</h2>
          <button
            className="pos-modal-close"
            onClick={onClose}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className="pos-modal-controls">
          <div className="controls-left">
            <label>
              Type
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={loading}
              >
                <option value="S">S</option>
                <option value="G">G</option>
                <option value="ALL">All</option>
              </select>
            </label>

            <label>
              From
              <DateInput
                value={from}
                min={MIN_DATE}
                onChange={handleFromChange}
                disabled={loading}
              />
            </label>

            <label>
              To
              <DateInput
                value={to}
                min={MIN_DATE}
                onChange={handleToChange}
                disabled={loading}
              />
            </label>

            <button
              className="pos-page-toolbar-button pos-page-blue-button"
              onClick={fetchStatement}
              disabled={loading || !customerId}
            >
              {loading ? "Loading..." : "Generate"}
            </button>
          </div>

          <div className="controls-right">
            <button
              className="statement-report-button"
              onClick={() => setShowReportModal(true)}
              disabled={!customerId || loading}
            >
              Report
            </button>
          </div>
        </div>

        {err && <div className="pos-modal-error">{err}</div>}

        {data && (
          <div className="pos-modal-body">
            <div className="stmt-summary">
              <div>
                <strong>رصيد سابق:</strong>{" "}
                {fmt(data.openingBalance?.toFixed?.(2) ?? 0)}
              </div>
              <div>
                <strong>مجموع الفواتير:</strong>{" "}
                {fmt(data.totals?.totalDebit?.toFixed?.(2) ?? 0)}
              </div>
              <div>
                <strong>مجموع الدفعات:</strong>{" "}
                {fmt(data.totals?.totalCredit?.toFixed?.(2) ?? 0)}
              </div>
              <div>
                <strong>رصيد:</strong>{" "}
                {fmt(data.closingBalance?.toFixed?.(2) ?? 0)}
              </div>
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
                    <tr key={i}>
                      <td>{fmt(Number(r.balanceAfter || 0).toFixed(2))}</td>
                      <td>{fmt(Number(r.credit || 0).toFixed(2))}</td>
                      <td>{fmt(Number(r.debit || 0).toFixed(2))}</td>
                      <td>{r.description}</td>
                      <td>{r.docNbr}</td>
                      <td>{String(r.date).split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <StatementReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          data={data}
          from={from}
          to={to}
          type={type}
          customerName={reportCustomerName}
        />

        <LoadingScreen
          show={loading}
          text={type === "ALL" ? "Generating statement…" : `Generating (${type})…`}
        />
      </div>
    </div>
  );
};

export default StatementModal;