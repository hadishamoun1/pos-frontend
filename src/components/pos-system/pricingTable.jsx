import React, { useEffect, useState } from "react";
import axios from "axios";
import "./pricingTable.css";

const pageSize = 5;

const PricingTable = ({ presetGroups = null, onRequestLoadMore }) => {
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // customer search/suggest state (always visible)
  const [customerInput, setCustomerInput] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // view mode: 'preset' (use presetGroups) or 'customer' (browse by selected customer)
  const [viewMode, setViewMode] = useState(presetGroups != null ? "preset" : "customer");

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // When presetGroups change, move into preset mode & load them
  useEffect(() => {
    if (presetGroups != null) {
      setViewMode("preset");
      setGroups(Array.isArray(presetGroups) ? presetGroups : []);
      setSearchTerm("");
    }
  }, [presetGroups]);

  // If in customer mode and a customer is selected, load their browsing data
  useEffect(() => {
    if (viewMode === "customer" && selectedCustomerId) {
      loadInitialData(selectedCustomerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedCustomerId]);

  // --- Customer search / suggestions ---
  const fetchCustomers = async (query) => {
    try {
      const res = await axios.get(`${baseUrl}/customers/v1/search`, {
        params: { query },
      });
      setCustomerSuggestions(res.data || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setCustomerSuggestions([]);
    }
  };

  const handleCustomerInputChange = (e) => {
    const query = e.target.value;
    setCustomerInput(query);
    if (query.length > 1) fetchCustomers(query);
    else setCustomerSuggestions([]);
  };

  const handleCustomerSelect = (customer) => {
    // Switch to customer mode explicitly
    setViewMode("customer");
    setSelectedCustomerId(customer.id);
    setCustomerInput(customer.customerName);
    setCustomerSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (customerSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      setHighlightedIndex((prev) =>
        prev < customerSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && highlightedIndex !== -1) {
      handleCustomerSelect(customerSuggestions[highlightedIndex]);
    }
  };

  // --- Data loaders ---
  const loadInitialData = async (customerId) => {
    try {
      const res = await axios.get(`${baseUrl}/invoices/v1/browsing/${customerId}`);
      setGroups(res.data || []);
    } catch (err) {
      console.error("Error loading pricing data:", err);
    }
  };

  const loadMore = async (groupKey, currentPage) => {
    try {
      const nextPage = (currentPage || 1) + 1;

      if (viewMode === "preset") {
        // Delegate to parent’s by-item-batches loader
        if (typeof onRequestLoadMore === "function") {
          await onRequestLoadMore(groupKey, currentPage || 1);
        }
        return;
      }

      // Customer mode: use the classic browsing endpoint
      const res = await axios.get(
        `${baseUrl}/invoices/v1/browsing/${selectedCustomerId}`,
        { params: { groupKey, page: nextPage, limit: pageSize } }
      );

      setGroups((prev) =>
        prev.map((grp) =>
          grp.groupKey === groupKey
            ? {
                ...grp,
                page: nextPage,
                items: [...grp.items, ...(res.data?.items || [])],
                total: res.data?.total ?? grp.total,
              }
            : grp
        )
      );
    } catch (err) {
      console.error("Error loading more:", err);
    }
  };

  // --- cell helpers ---
  const toInt = (v) => (v === 0 || v ? parseInt(v, 10) : null);
  const pad3 = (n) => String(n ?? "").padStart(3, "0");
  const LRM = "\u200E";

  const getDimsParts = (item) => {
    if (item.type === "sqm") return null;
    const L = toInt(item.length);
    const W = toInt(item.width);
    if (L == null || W == null) return null;
    const spbNum = toInt(item.sheetsPerBox);
    const base = `${LRM}${W}*${L}`;
    const spb = item.type === "box" ? pad3(spbNum ?? 0) : null;
    return { base, spb };
  };

  const getQuantity = (item) => {
    if (item.type === "box") return item.box ?? 0;
    if (item.type === "sheet") return item.sheet ?? 0;
    if (item.type === "sqm") return item.sqm ?? 0;
    return item.box ?? item.sheet ?? item.sqm ?? 0;
  };

  // --- render ---
  const rows = (groups || []).flatMap((grp) => {
    const body = (grp.items || []).map((item, idx) => {
      const parts = getDimsParts(item);
      return (
        <tr
          key={`${grp.groupKey}-${idx}`}
          className={idx === 0 ? "price-browsing-latest-item-row" : ""}
        >
          <td>{item.invoiceDate}</td>
          <td>{item.invoiceNumber}</td>
          <td>{item.origin}</td>
          <td style={{ direction: "rtl", textAlign: "center" }}>
            <span className="price-browsing-item-main">
              {`${parseFloat(item.thickness)} ملم ${item.itemName}`}
            </span>
            {parts ? (
              <span className="price-browsing-item-dims">
                <span className="dims-base">{parts.base}</span>
                {parts.spb && <span className="dims-spb">-{parts.spb}</span>}
              </span>
            ) : null}
          </td>
          <td>{item.type}</td>
          <td>{getQuantity(item)}</td>
          <td>{item.unitPrice}</td>
          <td>{item.vat}</td>
          <td>{item.totalAmount}</td>
        </tr>
      );
    });

    if ((grp.items?.length || 0) < (grp.total || 0)) {
      body.push(
        <tr key={`${grp.groupKey}-loadmore`}>
          <td colSpan={9}>
            <button
              className="price-browsing-load-more-btn"
              onClick={() => loadMore(grp.groupKey, grp.page || 1)}
            >
              Load more ({grp.items?.length || 0}/{grp.total || 0})
            </button>
          </td>
        </tr>
      );
    }

    body.push(
      <tr key={`${grp.groupKey}-spacer`} className="price-browsing-group-spacer-row">
        <td colSpan={9}></td>
      </tr>
    );

    return body;
  });

  const filteredRows = rows.filter((row) => {
    if (typeof row.key === "string" && row.key.includes("loadmore")) return true;
    return (
      !searchTerm ||
      (typeof row.props?.children === "object" &&
        row.props.children.some((cell) =>
          (Array.isArray(cell.props?.children)
            ? cell.props.children.join(" ")
            : cell.props?.children
          )
            ?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        ))
    );
  });

  return (
    <div className="price-browsing-container">
      <div className="price-browsing-content">
        {/* 🔎 Customer search is ALWAYS visible now */}
        <div className="price-browsing-customer-name-row">
          <div className="price-browsing-customer-search-container">
            <input
              type="text"
              value={customerInput}
              onChange={handleCustomerInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search Customer Name"
              className="price-browsing-customer-name-input"
            />
            {customerSuggestions.length > 0 && (
              <ul className="price-browsing-suggestions-dropdown">
                {customerSuggestions.map((customer, index) => (
                  <li
                    key={customer.id}
                    className={
                      index === highlightedIndex
                        ? "price-browsing-suggestion--selected"
                        : ""
                    }
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    {customer.customerName}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <input
          type="text"
          placeholder="Search by any field"
          className="price-browsing-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="price-browsing-table-wrapper">
          <table className="price-browsing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Inv#</th>
                <th>Origin</th>
                <th>Item</th>
                <th>Type</th>
                <th>QTY</th>
                <th>Price</th>
                <th>VAT</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>{filteredRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PricingTable;
