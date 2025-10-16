// src/components/pos-system/SearchModal.jsx
import React, { useEffect, useRef, useState } from "react";
import "./searchModal.css";
import StockTab from "./StockTab";
import AllTab from "./AllTab";

const SearchModal = ({ isOpen, onClose, onSelectItems }) => {
  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "all"
  const [selectedCount, setSelectedCount] = useState(0);
  const stockRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("stock");
    setSelectedCount(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOk = () => {
    if (activeTab === "stock" && stockRef.current) {
      const selectedData = stockRef.current.collectSelected();
      onSelectItems(selectedData);
      onClose();
      return;
    }
    // Future: collect from "All" tab too
    onSelectItems([]);
    onClose();
  };

  const TabButton = ({ id, label, isActive, onClick }) => (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`${id}-panel`}
      id={`${id}-tab`}
      className={`search-tab ${isActive ? "is-active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <h2 className="search-modal-title">Search</h2>
          <div className="search-modal-buttons">
            <button className="search-modal-close-button" onClick={onClose}>
              Close
            </button>
            <button
              className="search-modal-ok-button"
              onClick={handleOk}
              disabled={activeTab === "stock" ? selectedCount === 0 : true}
              title={activeTab === "stock" ? undefined : "Not available on this tab yet"}
            >
              OK ({activeTab === "stock" ? selectedCount : 0})
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="search-tabs" role="tablist" aria-label="Search Results Tabs">
          <TabButton
            id="stock"
            label="Stock Items"
            isActive={activeTab === "stock"}
            onClick={() => setActiveTab("stock")}
          />
          <TabButton
            id="all"
            label="All"
            isActive={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          />
        </div>

        {activeTab === "stock" && (
          <div id="stock-panel" role="tabpanel" aria-labelledby="stock-tab">
            <StockTab
              ref={stockRef}
              // ✅ Only “open” when modal is open AND this tab is active
              isOpen={isOpen && activeTab === "stock"}
              onSelectionCountChange={setSelectedCount}
            />
          </div>
        )}

        {activeTab === "all" && (
          <div id="all-panel" role="tabpanel" aria-labelledby="all-tab">
            <AllTab
              // ✅ Tell AllTab when it’s open so it fetches
              isOpen={isOpen && activeTab === "all"}
              // (No selection wiring yet)
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal;
