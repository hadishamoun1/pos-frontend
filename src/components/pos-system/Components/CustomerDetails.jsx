import React from "react";

const CustomerDetails = ({
  currencyRate,
  setCurrencyRate,
  vat,
  setVat,
  customerInput,
  handleCustomerInputChange,
  handleKeyDown,
  customerSuggestions,
  handleCustomerSelect,
  highlightedIndex,
  handleSearchClick,
  setHighlightedIndex,
  isEditable,
  handleGetPriceClick,
  cutMode,
  onToggleCutMode,

  // ✅ ADD THESE
  currencyCode,
  onCurrencyCodeChange,
}) => {
  return (
    <div>
      {/* Dropdowns & Checkbox Row */}
      <div className="pos-page-toolbar-row">
        <div className="pos-page-dropdown-container">
          <select
            className="pos-page-exchange-rate-dropdown"
            value={currencyRate}
            onChange={(e) => setCurrencyRate(e.target.value)}
          >
            <option value="89000">89,000</option>
            <option value="1500">1500</option>
          </select>

          <select
            className="pos-page-vat-dropdown"
            value={vat}
            onChange={(e) => setVat(e.target.value)}
          >
            <option value="0">0%</option>
            <option value="6">6%</option>
            <option value="11">11%</option>
          </select>

          {/* ✅ Currency Dropdown */}
          <select
            className="pos-page-currency-dropdown"
            value={currencyCode || "USD"}
            onChange={(e) => onCurrencyCodeChange?.(e.target.value)}
            disabled={!isEditable}
            title={!isEditable ? "Click Edit first" : "Currency"}
          >
            <option value="USD">USD</option>
            <option value="LL">LL</option>
            <option value="LBP">LBP</option>
          </select>
        </div>

        <div className="pos-page-checkbox-container">
          <input type="checkbox" id="company-name-checkbox" />
          <label
            htmlFor="company-name-checkbox"
            className="pos-page-checkbox-label"
          >
            Company Name
          </label>
        </div>
      </div>

      {/* Customer Name Input Row */}
      <div className="pos-page-customer-name-row">
        <label className="pos-page-customer-name-label">Customer Name</label>
        <div className="pos-page-customer-search-container">
          <input
            type="text"
            value={customerInput}
            onChange={handleCustomerInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search Customer Name"
            className="pos-page-customer-name-input"
          />

          {customerSuggestions.length > 0 && (
            <ul className="customer-suggestions-dropdown" role="listbox">
              {customerSuggestions.map((c, index) => (
                <li
                  key={c.id ?? index}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={`cust-sugg ${
                    index === highlightedIndex ? "is-active" : ""
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleCustomerSelect(c)}
                >
                  <div className="cust-sugg-avatar">
                    {String(c.customerName || c.firstName || "?")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="cust-sugg-content" dir="auto">
                    <div className="cust-sugg-line1" dir="auto">
                      <span
                        className="cust-sugg-name"
                        dir="auto"
                        title={c.customerName || ""}
                      >
                        {c.customerName || "—"}
                      </span>
                      {c.firstName ? (
                        <span className="cust-sugg-first" dir="auto">
                          ({c.firstName})
                        </span>
                      ) : null}
                    </div>

                    <div className="cust-sugg-line2">
                      {c.phoneNumber ? (
                        <span className="cust-sugg-pill">
                          <span className="cust-icon">📞</span>
                          {c.phoneNumber}
                        </span>
                      ) : null}

                      {c.address ? (
                        <span
                          className="cust-sugg-addr"
                          dir="auto"
                          title={c.address}
                        >
                          <span className="cust-icon">📍</span>
                          {c.address}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            className="pos-page-toolbar-button pos-page-blue-button"
            style={{ marginLeft: "auto" }}
            onClick={handleSearchClick}
            disabled={!isEditable}
            title={!isEditable ? "Click Edit first" : "Search Items"}
          >
            Search Items
          </button>

          <button
            className="pos-page-toolbar-button pos-page-red-button"
            style={{ marginLeft: "8px" }}
            onClick={onToggleCutMode}
            disabled={!isEditable}
            title={!isEditable ? "Click Edit first" : "Cut Mode"}
          >
            {cutMode ? "Cut (ON)" : "Cut"}
          </button>

          <button
            className="pos-page-toolbar-button pos-page-orange-button"
            style={{ marginLeft: "8px" }}
            onClick={handleGetPriceClick}
          >
            Get Price
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetails;
