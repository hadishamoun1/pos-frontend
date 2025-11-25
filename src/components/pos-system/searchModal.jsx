// src/components/pos-system/SearchModal.jsx
import React, { useEffect, useRef, useState } from "react";
import "./searchModal.css";
import StockTab from "./StockTab";
import AllTab from "./AllTab";
import SqmPiecesTab from "./SqmPiecesTab";

const SearchModal = ({ isOpen, onClose, onSelectItems }) => {
  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "all" | "sqm"
  const [selectedCount, setSelectedCount] = useState(0);

  const stockRef = useRef(null);
  const allRef = useRef(null);
  const sqmRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("stock");
    setSelectedCount(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOk = () => {
    let selectedData = [];

    if (activeTab === "stock" && stockRef.current) {
      selectedData = stockRef.current.collectSelected();
    } else if (activeTab === "all" && allRef.current) {
      selectedData = allRef.current.collectSelected();
    } else if (activeTab === "sqm" && sqmRef.current) {
      selectedData = sqmRef.current.collectSelected();
    }

    onSelectItems(selectedData);
    onClose();
  };

  const TabButton = ({ id, label, isActive }) => (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`${id}-panel`}
      id={`${id}-tab`}
      className={`search-tab ${isActive ? "is-active" : ""}`}
      onClick={() => {
        setActiveTab(id);
        setSelectedCount(0); // reset count when switching tabs
      }}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div
        className="search-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-modal-header">
          <h2 className="search-modal-title">Search</h2>
          <div className="search-modal-buttons">
            <button className="search-modal-close-button" onClick={onClose}>
              Close
            </button>
            <button
              className="search-modal-ok-button"
              onClick={handleOk}
              disabled={selectedCount === 0}
            >
              OK ({selectedCount})
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="search-tabs"
          role="tablist"
          aria-label="Search Results Tabs"
        >
          <TabButton
            id="stock"
            label="Stock Items"
            isActive={activeTab === "stock"}
          />
          <TabButton id="all" label="All" isActive={activeTab === "all"} />
          <TabButton
            id="sqm"
            label="SQM Pieces"
            isActive={activeTab === "sqm"}
          />
        </div>

        {activeTab === "stock" && (
          <div id="stock-panel" role="tabpanel" aria-labelledby="stock-tab">
            <StockTab
              ref={stockRef}
              isOpen={isOpen && activeTab === "stock"}
              onSelectionCountChange={setSelectedCount}
            />
          </div>
        )}

        {activeTab === "all" && (
          <div id="all-panel" role="tabpanel" aria-labelledby="all-tab">
            <AllTab
              ref={allRef}
              isOpen={isOpen && activeTab === "all"}
              onSelectionCountChange={setSelectedCount}
            />
          </div>
        )}

        {activeTab === "sqm" && (
          <div id="sqm-panel" role="tabpanel" aria-labelledby="sqm-tab">
            <SqmPiecesTab
              ref={sqmRef}
              isOpen={isOpen && activeTab === "sqm"}
              onSelectionCountChange={setSelectedCount}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal;
