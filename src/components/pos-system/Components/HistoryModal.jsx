// src/pos-system/Components/HistoryModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { axiosClient } from "../../api/axiosClient";
import "./HistoryModal.css";

const HISTORY_PAGE_SIZE = 100;

const HistoryModal = ({ isOpen, onClose, selectedCustomer }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedCustomerName, setSelectedCustomerName] = useState(null);
  const [historyRows, setHistoryRows] = useState([]); // ✅ current page only, server-paginated
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // ✅ Search input (live)
  const [historySearchInput, setHistorySearchInput] = useState("");
  // Debounced version of the live input — this is what actually drives the fetch,
  // so we don't hit the server on every keystroke.
  const [debouncedQuickSearch, setDebouncedQuickSearch] = useState("");

  // ✅ Pinned filters (Enter-to-pin)
  const [itemNameFilter, setItemNameFilter] = useState("");
  const [dimensionsFilter, setDimensionsFilter] = useState({
    length: "",
    width: "",
  });

  // ✅ Server-side pagination state for the customer detail history table
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  // ✅ Helper: parse MM/DD/YY to Date
  const parseMMDDYY = (dateStr) => {
    if (!dateStr) return new Date(0);

    const parts = String(dateStr).split("/");
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);

      if (year < 100) year += year <= 50 ? 2000 : 1900;
      return new Date(year, month - 1, day);
    }

    return new Date(dateStr);
  };

  // ✅ Helper: format to dd/mm/yyyy
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const date = parseMMDDYY(dateStr);
    if (isNaN(date.getTime())) return "—";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    if (isOpen && !showDetails) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, page, searchTerm, showDetails]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get("/csv-imports/customers", {
        params: {
          page,
          limit: 50,
          search: searchTerm || undefined,
        },
      });

      setCustomers(response.data.data || []);
      setTotalPages(response.data.meta?.pages || 1);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch ONE page of a customer's history from the server, with whatever
  // search/filter is currently active.
  const fetchCustomerHistoryPage = async (customerName, pageNum) => {
    setHistoryLoading(true);
    try {
      const params = { page: pageNum, limit: HISTORY_PAGE_SIZE };

      const quickSearch = (debouncedQuickSearch || "").trim();
      if (quickSearch) {
        // Live-typing mode: ignore pinned filters, same as before.
        if (quickSearch.includes("*")) {
          const parts = quickSearch.split("*").map((p) => p.trim());
          if (parts.length === 2) {
            // ✅ SWAP: DB width = actual length, DB length = actual width
            params.width = parts[0];
            params.length = parts[1];
          }
        } else {
          params.q = quickSearch;
        }
      } else {
        if (itemNameFilter) params.itemName = itemNameFilter;
        if (dimensionsFilter.length) params.width = dimensionsFilter.length;
        if (dimensionsFilter.width) params.length = dimensionsFilter.width;
      }

      const response = await axiosClient.get(
        `/csv-imports/customers/${encodeURIComponent(customerName)}/history`,
        { params }
      );

      setHistoryRows(response.data.data || []);
      setHistoryTotalPages(response.data.meta?.pages || 1);
      setHistoryTotal(response.data.meta?.total || 0);
    } catch (error) {
      console.error("Error fetching customer history:", error);
      setHistoryRows([]);
      setHistoryTotalPages(1);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Debounce the live search box into debouncedQuickSearch
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuickSearch(historySearchInput.trim());
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [historySearchInput]);

  // Any change to the active search/filter (or opening a new customer) always
  // jumps back to page 1 and fetches it directly. Page navigation itself is
  // handled imperatively by the Previous/Next buttons below — keeping these
  // two triggers separate avoids a race where this effect and a page-change
  // effect both fire off a fetch for the same filter change (one for the
  // stale page, one for the corrected page).
  useEffect(() => {
    if (isOpen && showDetails && selectedCustomerName) {
      setHistoryPage(1);
      fetchCustomerHistoryPage(selectedCustomerName, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, showDetails, selectedCustomerName, debouncedQuickSearch, itemNameFilter, dimensionsFilter.length, dimensionsFilter.width]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleCustomerClick = (customer) => {
    // Reset filters when selecting a new customer
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");
    setDebouncedQuickSearch("");
    setHistoryPage(1);

    setSelectedCustomerName(customer.customerName);
    setShowDetails(true);
  };

  const handleBackToList = () => {
    setShowDetails(false);
    setSelectedCustomerName(null);
    setHistoryRows([]);
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");
    setDebouncedQuickSearch("");
    setHistoryPage(1);
    setHistoryTotalPages(1);
    setHistoryTotal(0);
  };

  // ✅ Enter pins the filter
  const handleHistorySearchKeyDown = (e) => {
    if (e.key === "Enter" && historySearchInput.trim()) {
      e.preventDefault();

      if (historySearchInput.includes("*")) {
        const parts = historySearchInput.split("*").map((p) => p.trim());
        if (parts.length === 2) {
          setDimensionsFilter({ length: parts[0], width: parts[1] });
          setHistorySearchInput("");
          setDebouncedQuickSearch("");
          return;
        }
      }

      setItemNameFilter(historySearchInput);
      setHistorySearchInput("");
      setDebouncedQuickSearch("");
    }
  };

  const handleClearHistoryFilters = () => {
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");
    setDebouncedQuickSearch("");
  };

  const handleRemoveItemNameFilter = () => setItemNameFilter("");
  const handleRemoveDimensionsFilter = () =>
    setDimensionsFilter({ length: "", width: "" });

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const handleHistoryPreviousPage = () => {
    if (historyPage > 1) {
      const next = historyPage - 1;
      setHistoryPage(next);
      fetchCustomerHistoryPage(selectedCustomerName, next);
    }
  };

  const handleHistoryNextPage = () => {
    if (historyPage < historyTotalPages) {
      const next = historyPage + 1;
      setHistoryPage(next);
      fetchCustomerHistoryPage(selectedCustomerName, next);
    }
  };

  if (!isOpen) return null;

  const quickSearchActive = (historySearchInput || "").trim().length > 0;
  const committedFiltersActive = !!(
    itemNameFilter ||
    dimensionsFilter.length ||
    dimensionsFilter.width
  );

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div
        className="history-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="history-modal-header">
          <div className="history-header-left">
            {showDetails && (
              <button className="history-back-button" onClick={handleBackToList}>
                ← Back
              </button>
            )}
            <h2>
              {showDetails
                ? `History - ${selectedCustomerName}`
                : "Customer Price History"}
            </h2>
          </div>
          <button className="history-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Search customers */}
        {!showDetails && (
          <div className="history-modal-search">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={handleSearch}
              className="history-search-input"
            />
          </div>
        )}

        {/* Customer history search + pinned filters */}
        {showDetails && (
          <div className="history-details-search-section">
            <div className="history-details-search-container">
              <input
                type="text"
                placeholder="Type to search (live). Press Enter to pin. Example dims: 225*321"
                value={historySearchInput}
                onChange={(e) => setHistorySearchInput(e.target.value)}
                onKeyDown={handleHistorySearchKeyDown}
                className="history-details-search-input"
              />
              <button
                className="history-details-clear-btn"
                onClick={handleClearHistoryFilters}
              >
                Clear All
              </button>
            </div>

            {/* Results count */}
            {(quickSearchActive || committedFiltersActive || historyTotal > 0) && (
              <div className="history-results-info">
                Page {historyPage} of {historyTotalPages} — {historyTotal} matching result
                {historyTotal === 1 ? "" : "s"}
              </div>
            )}

            {/* Pinned tags (hidden while typing) */}
            {!quickSearchActive && committedFiltersActive && (
              <div className="history-filter-tags">
                {itemNameFilter && (
                  <div className="history-filter-tag">
                    <span>Item: {itemNameFilter}</span>
                    <button onClick={handleRemoveItemNameFilter}>✕</button>
                  </div>
                )}
                {(dimensionsFilter.length || dimensionsFilter.width) && (
                  <div className="history-filter-tag">
                    <span>
                      Dimensions: {dimensionsFilter.length || "?"} x{" "}
                      {dimensionsFilter.width || "?"}
                    </span>
                    <button onClick={handleRemoveDimensionsFilter}>✕</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="history-modal-body">
          {/* Customer list */}
          {!showDetails && (
            <>
              {loading ? (
                <div className="history-loading">Loading customers...</div>
              ) : customers.length === 0 ? (
                <div className="history-empty">No customers found</div>
              ) : (
                <div className="history-customers-list">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Customer Name</th>
                        <th>Total Orders</th>
                        <th>Total Sales</th>
                        <th>Total VAT</th>
                        <th>First Order</th>
                        <th>Last Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer, index) => (
                        <tr
                          key={index}
                          className="history-table-row"
                          onClick={() => handleCustomerClick(customer)}
                        >
                          <td className="customer-name">{customer.customerName}</td>
                          <td className="text-center">{customer.totalOrders}</td>
                          <td className="text-right">
                            $
                            {Number(customer.totalSales || 0).toLocaleString(
                              "en-US",
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </td>
                          <td className="text-right">
                            $
                            {Number(customer.totalVat || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-center">
                            {customer.firstOrder ? formatDate(customer.firstOrder) : "—"}
                          </td>
                          <td className="text-center">
                            {customer.lastOrder ? formatDate(customer.lastOrder) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Customer history table */}
          {showDetails && (
            <>
              {historyLoading ? (
                <div className="history-loading">Loading history...</div>
              ) : historyRows.length === 0 ? (
                <div className="history-empty">
                  {quickSearchActive || committedFiltersActive
                    ? "No results match your search"
                    : "No purchase history found"}
                </div>
              ) : (
                <div className="history-details-list">
                  <table className="history-details-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Item #</th>
                        <th>Property Code</th>
                        <th>Item Name</th>
                        <th>Brand</th>
                        <th>Length</th>
                        <th>Width</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Sheet</th>
                        <th>SQM</th>
                        <th>Price</th>
                        <th>VAT</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((item, index) => (
                        <tr key={index} className="history-details-row">
                          <td className="text-center">{formatDate(item.invoiceDate)}</td>
                          <td>{item.invoiceNbr || "—"}</td>
                          <td>{item.itemNumber || "—"}</td>
                          <td>{item.propertyCode || "—"}</td>
                          <td className="item-name" title={item.itemName}>
                            {item.itemName || "—"}
                          </td>
                          <td>{item.itemBrand || "—"}</td>

                          {/* ✅ SWAP: DB width = actual length, DB length = actual width */}
                          <td className="text-right">
                            {item.width ? Number(item.width).toFixed(2) : "—"}
                          </td>
                          <td className="text-right">
                            {item.length ? Number(item.length).toFixed(2) : "—"}
                          </td>

                          <td className="text-right">{Number(item.qty || 0).toFixed(2)}</td>
                          <td className="text-center">{item.qtyUnit || "—"}</td>
                          <td className="text-center">{item.sheet || "—"}</td>
                          <td className="text-right">
                            {item.sqm ? Number(item.sqm).toFixed(2) : "—"}
                          </td>
                          <td className="text-right">
                            $
                            {Number(item.itemSalePrice || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-right">
                            %
                            {Number(item.vat || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-right total-cell">
                            $
                            {Number(item.lineTotal || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination footer */}
        <div className="history-modal-footer">
          {!showDetails && (
            <>
              <button
                className="history-pagination-btn"
                onClick={handlePreviousPage}
                disabled={page === 1}
              >
                ← Previous
              </button>
              <span className="history-pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="history-pagination-btn"
                onClick={handleNextPage}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </>
          )}

          {showDetails && (
            <>
              <button
                className="history-pagination-btn"
                onClick={handleHistoryPreviousPage}
                disabled={historyPage === 1}
              >
                ← Previous
              </button>
              <span className="history-pagination-info">
                Page {historyPage} of {historyTotalPages}
              </span>
              <button
                className="history-pagination-btn"
                onClick={handleHistoryNextPage}
                disabled={historyPage >= historyTotalPages}
              >
                Next →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
