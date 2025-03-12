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
          {/* Customer Search Input */}
          <input
            type="text"
            value={customerInput}
            onChange={handleCustomerInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search Customer Name"
            className="pos-page-customer-name-input"
          />

          {/* Suggestions Dropdown */}
          {customerSuggestions.length > 0 && (
            <ul className="customer-suggestions-dropdown">
              {customerSuggestions.map((customer, index) => (
                <li
                  key={customer.id}
                  className={index === highlightedIndex ? "selected" : ""}
                  onClick={() => handleCustomerSelect(customer)}
                >
                  {customer.customerName}
                </li>
              ))}
            </ul>
          )}

          <button
            className="pos-page-toolbar-button pos-page-blue-button"
            style={{ marginLeft: "auto" }}
            onClick={handleSearchClick}
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetails;
