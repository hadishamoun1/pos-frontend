import React, { useEffect, useState } from "react";
import axios from "axios";
import "./pricingTable.css";

const pageSize = 5;

const PricingTable = () => {
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerInput, setCustomerInput] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    if (selectedCustomerId) loadInitialData();
  }, [selectedCustomerId]);

  const fetchCustomers = async (query) => {
    try {
      const res = await axios.get(`${baseUrl}/customers/v1/search`, {
        params: { query },
      });
      setCustomerSuggestions(res.data);
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  };

  const handleCustomerInputChange = (e) => {
    const query = e.target.value;
    setCustomerInput(query);
    if (query.length > 1) fetchCustomers(query);
    else setCustomerSuggestions([]);
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerInput(customer.customerName);
    setCustomerSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (customerSuggestions.length === 0) return;
    if (e.key === "ArrowDown")
      setHighlightedIndex((prev) =>
        prev < customerSuggestions.length - 1 ? prev + 1 : prev
      );
    else if (e.key === "ArrowUp")
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    else if (e.key === "Enter" && highlightedIndex !== -1)
      handleCustomerSelect(customerSuggestions[highlightedIndex]);
  };

  const loadInitialData = async () => {
    try {
      const res = await axios.get(
        `${baseUrl}/invoices/v1/browsing/${selectedCustomerId}`
      );
      setGroups(res.data);
    } catch (err) {
      console.error("Error loading pricing data:", err);
    }
  };

  const loadMore = async (groupKey, currentPage) => {
    try {
      const nextPage = currentPage + 1;
      const res = await axios.get(
        `${baseUrl}/invoices/v1/browsing/${selectedCustomerId}`,
        {
          params: { groupKey, page: nextPage, limit: pageSize },
        }
      );

      setGroups((prev) =>
        prev.map((grp) => {
          if (grp.groupKey === groupKey) {
            // ✅ Append only the new page, not overwrite
            return {
              ...grp,
              page: nextPage,
              items: [...grp.items, ...res.data.items],
              total: res.data.total,
            };
          }
          return grp;
        })
      );
    } catch (err) {
      console.error("Error loading more:", err);
    }
  };

  const renderTableRows = () => {
    return groups.flatMap((grp) => {
      const rows = grp.items.map((item, index) => (
        <tr
          key={`${grp.groupKey}-${index}`}
          className={index === 0 ? "latest-item-row" : ""}
        >
          <td>{item.invoiceDate}</td>
          <td>{item.invoiceNumber}</td>
          <td>{item.origin}</td>
          <td>{`${parseFloat(item.thickness)} ملم ${item.itemName}`}</td>
          <td>{item.type}</td>
          <td>{item.box}</td>
          <td>{item.sheet}</td>
          <td>{item.sqm}</td>
          <td>{item.unitPrice}</td>
          <td>{item.vat}</td>
          <td>{item.totalAmount}</td>
        </tr>
      ));

      if (grp.items.length < grp.total) {
        rows.push(
          <tr key={`${grp.groupKey}-loadmore`}>
            <td colSpan={11}>
              <button
                onClick={() => loadMore(grp.groupKey, grp.page)}
                className="load-more-btn"
              >
                Load more ({grp.items.length}/{grp.total})
              </button>
            </td>
          </tr>
        );
      }

      // ✅ Add a spacer row between groups
      rows.push(
        <tr key={`${grp.groupKey}-spacer`} className="group-spacer-row">
          <td colSpan={11}></td>
        </tr>
      );

      return rows;
    });
  };

  const filteredRows = renderTableRows().filter((row) => {
    if (typeof row.key === "string" && row.key.includes("loadmore"))
      return true;
    return (
      !searchTerm ||
      (typeof row.props?.children === "object" &&
        row.props.children.some((cell) =>
          cell.props.children
            ?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        ))
    );
  });

  return (
    <div className="pricing-table-container">
      <div className="pricing-table-content">
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
          </div>
        </div>

        <input
          type="text"
          placeholder="Search by any field"
          className="pricing-table-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="pricing-table-wrapper">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Inv #</th>
                <th>Origin</th>
                <th>Item</th>
                <th>Type</th>
                <th>Box</th>
                <th>Sheet</th>
                <th>SQM</th>
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
