// src/pos-system/Components/HistoryModal.jsx
import React, { useState, useEffect } from "react";
import { axiosClient } from "../../api/axiosClient";
import "./HistoryModal.css";

const HistoryModal = ({ isOpen, onClose, selectedCustomer }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [selectedCustomerName, setSelectedCustomerName] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [showDetails, setShowDetails] = useState(false);

  // ✅ Search filters for customer history
  const [historySearchInput, setHistorySearchInput] = useState("");
  const [itemNameFilter, setItemNameFilter] = useState("");
  const [dimensionsFilter, setDimensionsFilter] = useState({ length: "", width: "" });

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

  // ✅ Updated: Fetch customer history with optional filters
 const fetchCustomerHistory = async (customerName, pageNum = 1, filters = {}) => {
  setHistoryLoading(true);
  try {
    const params = {
      page: pageNum,
      limit: 50,
    };

    if (filters.itemName) params.itemName = filters.itemName;
    if (filters.length) params.length = filters.length;
    if (filters.width) params.width = filters.width;

    // ✅ IMPORTANT: customer-scoped endpoint
    const response = await axiosClient.get(
      `/csv-imports/customers/${encodeURIComponent(customerName)}/history`,
      { params }
    );

    setCustomerHistory(response.data.data || []);
    setHistoryTotalPages(response.data.meta?.pages || 1);
  } catch (error) {
    console.error("Error fetching customer history:", error);
  } finally {
    setHistoryLoading(false);
  }
};


  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleCustomerClick = (customer) => {
    setSelectedCustomerName(customer.customerName);
    setShowDetails(true);
    setHistoryPage(1);
    // Reset filters when selecting a new customer
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");
    fetchCustomerHistory(customer.customerName, 1);
  };

  const handleBackToList = () => {
    setShowDetails(false);
    setSelectedCustomerName(null);
    setCustomerHistory([]);
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");
  };

  // ✅ Execute search with current filters
  const executeHistorySearch = () => {
    if (!selectedCustomerName) return;

    const filters = {};
    if (itemNameFilter) filters.itemName = itemNameFilter;
    if (dimensionsFilter.length) filters.length = dimensionsFilter.length;
    if (dimensionsFilter.width) filters.width = dimensionsFilter.width;

    setHistoryPage(1);
    fetchCustomerHistory(selectedCustomerName, 1, filters);
  };

  // ✅ Handle search input in customer details - AUTO SEARCH on Enter
  const handleHistorySearchKeyDown = (e) => {
    if (e.key === "Enter" && historySearchInput.trim()) {
      e.preventDefault();

      // Check if input contains dimensions (has *)
      if (historySearchInput.includes("*")) {
        const parts = historySearchInput.split("*").map((p) => p.trim());
        if (parts.length === 2) {
          const newDimensions = {
            length: parts[0],
            width: parts[1],
          };
          setDimensionsFilter(newDimensions);
          setHistorySearchInput("");
          
          // ✅ AUTO SEARCH with new dimensions
          const filters = {};
          if (itemNameFilter) filters.itemName = itemNameFilter;
          if (parts[0]) filters.length = parts[0];
          if (parts[1]) filters.width = parts[1];
          
          setHistoryPage(1);
          fetchCustomerHistory(selectedCustomerName, 1, filters);
          return;
        }
      }

      // Otherwise, it's an item name
      const newItemName = historySearchInput;
      setItemNameFilter(newItemName);
      setHistorySearchInput("");
      
      // ✅ AUTO SEARCH with new item name
      const filters = { itemName: newItemName };
      if (dimensionsFilter.length) filters.length = dimensionsFilter.length;
      if (dimensionsFilter.width) filters.width = dimensionsFilter.width;
      
      setHistoryPage(1);
      fetchCustomerHistory(selectedCustomerName, 1, filters);
    }
  };

  // ✅ Clear filters and reload all data
  const handleClearHistoryFilters = () => {
    setItemNameFilter("");
    setDimensionsFilter({ length: "", width: "" });
    setHistorySearchInput("");
    setHistoryPage(1);
    fetchCustomerHistory(selectedCustomerName, 1);
  };

  const handleRemoveItemNameFilter = () => {
    setItemNameFilter("");
    
    // ✅ AUTO SEARCH after removing filter
    const filters = {};
    if (dimensionsFilter.length) filters.length = dimensionsFilter.length;
    if (dimensionsFilter.width) filters.width = dimensionsFilter.width;
    
    setHistoryPage(1);
    fetchCustomerHistory(selectedCustomerName, 1, filters);
  };

  const handleRemoveDimensionsFilter = () => {
    setDimensionsFilter({ length: "", width: "" });
    
    // ✅ AUTO SEARCH after removing filter
    const filters = {};
    if (itemNameFilter) filters.itemName = itemNameFilter;
    
    setHistoryPage(1);
    fetchCustomerHistory(selectedCustomerName, 1, filters);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const handleHistoryPreviousPage = () => {
    if (historyPage > 1) {
      const newPage = historyPage - 1;
      setHistoryPage(newPage);
      
      const filters = {};
      if (itemNameFilter) filters.itemName = itemNameFilter;
      if (dimensionsFilter.length) filters.length = dimensionsFilter.length;
      if (dimensionsFilter.width) filters.width = dimensionsFilter.width;
      
      fetchCustomerHistory(selectedCustomerName, newPage, filters);
    }
  };

  const handleHistoryNextPage = () => {
    if (historyPage < historyTotalPages) {
      const newPage = historyPage + 1;
      setHistoryPage(newPage);
      
      const filters = {};
      if (itemNameFilter) filters.itemName = itemNameFilter;
      if (dimensionsFilter.length) filters.length = dimensionsFilter.length;
      if (dimensionsFilter.width) filters.width = dimensionsFilter.width;
      
      fetchCustomerHistory(selectedCustomerName, newPage, filters);
    }
  };

  if (!isOpen) return null;

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
              <button
                className="history-back-button"
                onClick={handleBackToList}
              >
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

        {/* Search Bar (only show in customer list view) */}
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

        {/* ✅ Search Bar for Customer History Details - NO SEARCH BUTTON */}
        {showDetails && (
          <div className="history-details-search-section">
            <div className="history-details-search-container">
              <input
                type="text"
                placeholder="Type item name or dimensions (e.g., 225*321) and press Enter to search"
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

            {/* Active Filters */}
            {(itemNameFilter || dimensionsFilter.length || dimensionsFilter.width) && (
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

        {/* Modal Body */}
        <div className="history-modal-body">
          {/* Customer List View */}
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
                          <td className="customer-name">
                            {customer.customerName}
                          </td>
                          <td className="text-center">
                            {customer.totalOrders}
                          </td>
                          <td className="text-right">
                            $
                            {Number(customer.totalSales || 0).toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </td>
                          <td className="text-right">
                            $
                            {Number(customer.totalVat || 0).toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </td>
                          <td className="text-center">
                            {customer.firstOrder
                              ? new Date(
                                  customer.firstOrder
                                ).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="text-center">
                            {customer.lastOrder
                              ? new Date(
                                  customer.lastOrder
                                ).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Customer Details View - WITH ALL FIELDS */}
          {showDetails && (
            <>
              {historyLoading ? (
                <div className="history-loading">Loading history...</div>
              ) : customerHistory.length === 0 ? (
                <div className="history-empty">No purchase history found</div>
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
                      {customerHistory.map((item, index) => (
                        <tr key={index} className="history-details-row">
                          <td className="text-center">
                            {item.invoiceDate
                              ? new Date(item.invoiceDate).toLocaleDateString()
                              : "—"}
                          </td>
                          <td>{item.invoiceNbr || "—"}</td>
                          <td>{item.itemNumber || "—"}</td>
                          <td>{item.propertyCode || "—"}</td>
                          <td className="item-name" title={item.itemName}>
                            {item.itemName || "—"}
                          </td>
                          <td>{item.itemBrand || "—"}</td>
                          <td className="text-right">
                            {item.length ? Number(item.length).toFixed(2) : "—"}
                          </td>
                          <td className="text-right">
                            {item.width ? Number(item.width).toFixed(2) : "—"}
                          </td>
                          <td className="text-right">
                            {Number(item.qty || 0).toFixed(2)}
                          </td>
                          <td className="text-center">
                            {item.qtyUnit || "—"}
                          </td>
                          <td className="text-center">
                            {item.sheet || "—"}
                          </td>
                          <td className="text-right">
                            {item.sqm ? Number(item.sqm).toFixed(2) : "—"}
                          </td>
                          <td className="text-right">
                            $
                            {Number(item.itemSalePrice || 0).toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
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
                            {Number(item.lineTotal || 0).toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
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

        {/* Pagination */}
        <div className="history-modal-footer">
          {!showDetails ? (
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
          ) : (
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
                disabled={historyPage === historyTotalPages}
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