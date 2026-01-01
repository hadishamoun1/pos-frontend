// src/pos-system/Components/SearchHistoryModal.jsx
import React, { useState } from "react";
import { axiosClient } from "../../api/axiosClient";
import "./SearchHistoryModal.css";

const SearchHistoryModal = ({ isOpen, onClose }) => {
  const [searchInput, setSearchInput] = useState("");
  const [itemName, setItemName] = useState("");
  const [dimensions, setDimensions] = useState({ length: "", width: "" });
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && searchInput.trim()) {
      e.preventDefault();

      // Check if input contains dimensions (has *)
      if (searchInput.includes("*")) {
        const parts = searchInput.split("*").map((p) => p.trim());
        if (parts.length === 2) {
          setDimensions({
            length: parts[0],
            width: parts[1],
          });
          setSearchInput("");
          return;
        }
      }

      // Otherwise, it's an item name
      setItemName(searchInput);
      setSearchInput("");
    }
  };

  const handleSearch = async () => {
    if (!itemName && !dimensions.length && !dimensions.width) {
      return;
    }

    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
      };

      if (itemName) params.itemName = itemName;
      if (dimensions.length) params.length = dimensions.length;
      if (dimensions.width) params.width = dimensions.width;

      const response = await axiosClient.get("/csv-imports/search", {
        params,
      });

      setSearchResults(response.data.data || []);
      setTotalPages(response.data.meta?.pages || 1);
    } catch (error) {
      console.error("Error searching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setItemName("");
    setDimensions({ length: "", width: "" });
    setSearchInput("");
    setSearchResults([]);
    setPage(1);
  };

  const handleRemoveItemName = () => {
    setItemName("");
  };

  const handleRemoveDimensions = () => {
    setDimensions({ length: "", width: "" });
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  // Auto-search when page changes
  React.useEffect(() => {
    if (page > 1 && (itemName || dimensions.length || dimensions.width)) {
      handleSearch();
    }
  }, [page]);

  if (!isOpen) return null;

  return (
    <div className="search-history-modal-overlay" onClick={onClose}>
      <div
        className="search-history-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="search-history-modal-header">
          <h2>Search Price History</h2>
          <button className="search-history-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Search Section */}
        <div className="search-history-search-section">
          <div className="search-history-input-container">
            <input
              type="text"
              placeholder="Type item name or dimensions (e.g., 225*321) and press Enter"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="search-history-input"
            />
            <button
              className="search-history-search-btn"
              onClick={handleSearch}
              disabled={!itemName && !dimensions.length && !dimensions.width}
            >
              Search
            </button>
            <button
              className="search-history-clear-btn"
              onClick={handleClearFilters}
            >
              Clear
            </button>
          </div>

          {/* Active Filters */}
          <div className="search-history-filters">
            {itemName && (
              <div className="search-filter-tag">
                <span>Item: {itemName}</span>
                <button onClick={handleRemoveItemName}>✕</button>
              </div>
            )}
            {(dimensions.length || dimensions.width) && (
              <div className="search-filter-tag">
                <span>
                  Dimensions: {dimensions.length || "?"} x{" "}
                  {dimensions.width || "?"}
                </span>
                <button onClick={handleRemoveDimensions}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div className="search-history-modal-body">
          {loading ? (
            <div className="search-history-loading">Searching...</div>
          ) : searchResults.length === 0 ? (
            <div className="search-history-empty">
              {itemName || dimensions.length || dimensions.width
                ? "No results found"
                : "Enter search criteria above"}
            </div>
          ) : (
            <div className="search-history-results-list">
              <table className="search-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Invoice #</th>
                    <th>Item Name</th>
                    <th>Brand</th>
                    <th>Length</th>
                    <th>Width</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((item, index) => (
                    <tr key={index} className="search-history-row">
                      <td className="text-center">
                        {item.invoiceDate
                          ? new Date(item.invoiceDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>{item.customerName || "—"}</td>
                      <td>{item.invoiceNbr || "—"}</td>
                      <td className="item-name-rtl" title={item.itemName}>
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
                      <td className="text-center">{item.qtyUnit || "—"}</td>
                      <td className="text-right price-cell">
                        $
                        {Number(item.itemSalePrice || 0).toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
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
        </div>

        {/* Pagination */}
        {searchResults.length > 0 && (
          <div className="search-history-modal-footer">
            <button
              className="search-history-pagination-btn"
              onClick={handlePreviousPage}
              disabled={page === 1}
            >
              ← Previous
            </button>
            <span className="search-history-pagination-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="search-history-pagination-btn"
              onClick={handleNextPage}
              disabled={page === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchHistoryModal;