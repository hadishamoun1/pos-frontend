import React, { useEffect, useMemo, useState } from "react";
import "./CustomerSelectionModal.css";

const fmtMoney = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

const buildDisplayName = (c) => {
  const first = (c.firstName || "").trim();
  const middle = (c.middleName || "").trim();
  const base = (c.customerName || "").trim();
  const full = [first, middle].filter(Boolean).join(" ").trim();

  return {
    main: full || base || "-",
    sub: full && base && base !== full ? base : "",
  };
};

const CustomerSelectionModal = ({ onClose, onSelectCustomer }) => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const baseUrl = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${baseUrl}/customers/v1/basic-details`);
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error fetching customers:", e);
      }
    };
    fetchCustomers();
  }, [baseUrl]);

  const filtered = useMemo(() => {
    const q = String(searchTerm || "").toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((c) => {
      const name = buildDisplayName(c);
      const hay = [
        name.main,
        name.sub,
        c.customerAccountNumber,
        c.phoneNumber,
        c.area,
        c.closingBalanceS,
        c.closingBalanceG,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [customers, searchTerm]);

  return (
    <div className="cust-overlay" onMouseDown={onClose}>
      <div className="cust-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cust-header">
          <div>
            <div className="cust-badge">Customers</div>
            <h2>Select Customer</h2>
            <div className="cust-subtitle">Double click to choose</div>
          </div>

          <button
            type="button"
            className="cust-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="cust-search">
          <div className="cust-searchbox">
            <span className="cust-searchicon">⌕</span>
            <input
              type="text"
              placeholder="Search name, account, phone, area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm ? (
              <button
                className="cust-clear"
                onClick={() => setSearchTerm("")}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="cust-count">{filtered.length} results</div>
        </div>

        <div className="cust-table-wrap">
          <table className="cust-table">
            <thead>
              <tr>
                <th style={{ width: "34%" }}>Name</th>
                <th className="th-acc">Account #</th>
                <th className="th-phone">Phone</th>
                <th className="th-area">Area</th>
                <th className="th-balance">رصيد S</th>
                <th className="th-balance">رصيد G</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => {
                const name = buildDisplayName(c);
                const sVal = Number(c.closingBalanceS);
                const gVal = Number(c.closingBalanceG);

                return (
                  <tr
                    key={c.id}
                    onDoubleClick={() => {
                      onSelectCustomer(c);
                      onClose();
                    }}
                  >
                    <td className="cust-namecell">
                      <div className="cust-name">{name.main}</div>
                      {name.sub ? (
                        <div className="cust-subname">{name.sub}</div>
                      ) : null}
                    </td>

                    <td>{c.customerAccountNumber || "-"}</td>
                    <td>{c.phoneNumber || "-"}</td>
                    <td>{c.area || "-"}</td>

                    <td className={`td-balance ${sVal < 0 ? "neg" : "pos"}`}>
                      {fmtMoney(c.closingBalanceS)}
                    </td>
                    <td className={`td-balance ${gVal < 0 ? "neg" : "pos"}`}>
                      {fmtMoney(c.closingBalanceG)}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="cust-empty">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="cust-footer">
          <span className="cust-footnote">
            Balances are closing balances up to today (from your API).
          </span>
        </div>
      </div>
    </div>
  );
};

export default CustomerSelectionModal;
