// src/pos-system/Components/HistoryModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { axiosClient } from "../../api/axiosClient";
import "./HistoryModal.css";

const HistoryModal = ({ isOpen, onClose, selectedCustomer }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedCustomerName, setSelectedCustomerName] = useState(null);
  const [allCustomerHistory, setAllCustomerHistory] = useState([]); // ✅ Store ALL history
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // ✅ Search input (live)
  const [historySearchInput, setHistorySearchInput] = useState("");

  // ✅ Pinned filters (Enter-to-pin)
  const [itemNameFilter, setItemNameFilter] = useState("");
  const [dimensionsFilter, setDimensionsFilter] = useState({
    length: "",
    width: "",
  });

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

  // ✅ Fetch ALL customer history at once
  const fetchAllCustomerHistory = async (customerName) => {
    setHistoryLoading(true);
    try {
      const response = await axiosClient.get(
        `/csv-imports/customers/${encodeURIComponent(customerName)}/history`,
        { params: { limit: 100000 } }
      );

      setAllCustomerHistory(response.data.data || []);
    } catch (error) {
      console.error("Error fetching customer history:", error);
      setAllCustomerHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  /**
   * ✅ REQUIRED BEHAVIOR:
   * - While typing in historySearchInput:
   *    - ignore pinned filters
   *    - filter only by the search input
   *    - sort ONLY by date desc (latest -> oldest)
   * - When search input is empty:
   *    - apply pinned filters
   *    - sort by itemNumber asc, then date desc inside group
   */
  const filteredAndSortedHistory = useMemo(() => {
    let filtered = [...allCustomerHistory];

    const quickSearch = (historySearchInput || "").trim();
    const quickSearchActive = quickSearch.length > 0;

    // ✅ MODE 1: while typing -> IGNORE pinned filters, only search input + date sort
    if (quickSearchActive) {
      if (quickSearch.includes("*")) {
        const parts = quickSearch.split("*").map((p) => p.trim());
        if (parts.length === 2) {
          const searchLength = parts[0];
          const searchWidth = parts[1];

          filtered = filtered.filter((item) => {
            // ✅ SWAP: DB width = actual length, DB length = actual width
            const actualLength = String(Math.round(Number(item.width || 0)));
            const actualWidth = String(Math.round(Number(item.length || 0)));

            const matchLength = searchLength
              ? actualLength === searchLength || actualLength.includes(searchLength)
              : true;
            const matchWidth = searchWidth
              ? actualWidth === searchWidth || actualWidth.includes(searchWidth)
              : true;

            return matchLength && matchWidth;
          });
        }
      } else {
        const q = quickSearch.toLowerCase();

        filtered = filtered.filter((item) => {
          const itemName = String(item.itemName || "").toLowerCase();
          const itemNumber = String(item.itemNumber || "").toLowerCase();
          const invoiceNbr = String(item.invoiceNbr || "").toLowerCase();
          const propertyCode = String(item.propertyCode || "").toLowerCase();
          const brand = String(item.itemBrand || "").toLowerCase();

          return (
            itemName.includes(q) ||
            itemNumber.includes(q) ||
            invoiceNbr.includes(q) ||
            propertyCode.includes(q) ||
            brand.includes(q)
          );
        });
      }

      // ✅ ONLY date sort
      filtered.sort((a, b) => parseMMDDYY(b.invoiceDate) - parseMMDDYY(a.invoiceDate));
      return filtered;
    }

    // ✅ MODE 2: search empty -> APPLY pinned filters, then sort by item# then date desc
    if (itemNameFilter) {
      const searchLower = itemNameFilter.toLowerCase();
      filtered = filtered.filter((item) =>
        String(item.itemName || "").toLowerCase().includes(searchLower)
      );
    }

    if (dimensionsFilter.length || dimensionsFilter.width) {
      filtered = filtered.filter((item) => {
        // ✅ SWAP
        const actualLength = String(Math.round(Number(item.width || 0)));
        const actualWidth = String(Math.round(Number(item.length || 0)));

        const searchLength = dimensionsFilter.length;
        const searchWidth = dimensionsFilter.width;

        const matchLength = searchLength
          ? actualLength === searchLength || actualLength.includes(searchLength)
          : true;
        const matchWidth = searchWidth
          ? actualWidth === searchWidth || actualWidth.includes(searchWidth)
          : true;

        return matchLength && matchWidth;
      });
    }

    // ✅ item# grouping sort + date inside group
    filtered.sort((a, b) => {
      const numA = String(a.itemNumber || "");
      const numB = String(b.itemNumber || "");

      const itemCompare = numA.localeCompare(numB, undefined, {
        numeric: true,
        sensitivity: "base",
      });

      if (itemCompare === 0) {
        return parseMMDDYY(b.invoiceDate) - parseMMDDYY(a.invoiceDate);
      }
      return itemCompare;
    });

    return filtered;
  }, [allCustomerHistory, itemNameFilter, dimensionsFilter, historySearchInput]);

  // ✅ Latest row per Item # (within CURRENT results set)
  const latestStampByItemNumber = useMemo(() => {
    const m = new Map();

    for (const row of filteredAndSortedHistory) {
      const key = String(row?.itemNumber ?? "").trim();
      if (!key) continue;

      const t = parseMMDDYY(row.invoiceDate).getTime();
      const prev = m.get(key);

      if (prev == null || t > prev) m.set(key, t);
    }

    return m;
  }, [filteredAndSortedHistory]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleCustomerClick = (customer) => {
    setSelectedCustomerName(customer.customerName);
    setShowDetails(true);

    // Reset filters when selecting a new customer
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");

    fetchAllCustomerHistory(customer.customerName);
  };

  const handleBackToList = () => {
    setShowDetails(false);
    setSelectedCustomerName(null);
    setAllCustomerHistory([]);
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");
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
          return;
        }
      }

      setItemNameFilter(historySearchInput);
      setHistorySearchInput("");
    }
  };

  const handleClearHistoryFilters = () => {
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");
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
            {(quickSearchActive || committedFiltersActive) && (
              <div className="history-results-info">
                {quickSearchActive ? (
                  <>
                    Searching “{historySearchInput.trim()}” — Showing{" "}
                    {filteredAndSortedHistory.length} of {allCustomerHistory.length}
                  </>
                ) : (
                  <>
                    Showing {filteredAndSortedHistory.length} of{" "}
                    {allCustomerHistory.length} results
                  </>
                )}
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
              ) : filteredAndSortedHistory.length === 0 ? (
                <div className="history-empty">
                  {allCustomerHistory.length === 0
                    ? "No purchase history found"
                    : "No results match your search"}
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
                      {filteredAndSortedHistory.map((item, index) => {
                        const key = String(item?.itemNumber ?? "").trim();
                        const t = parseMMDDYY(item.invoiceDate).getTime();
                        const isLatestForItem =
                          key && latestStampByItemNumber.get(key) === t;

                        return (
                          <tr
                            key={index}
                            className={`history-details-row ${
                              isLatestForItem ? "history-latest-row" : ""
                            }`}
                          >
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination footer (customer list only) */}
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
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
