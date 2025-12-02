// src/components/pos-system/SearchModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./searchModal.css";
import StockTab from "./StockTab";
import AllTab from "./AllTab";
import SqmPiecesTab from "./SqmPiecesTab";

const SearchModal = ({ isOpen, onClose, onSelectItems }) => {
  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "all" | "sqm"

  // ✅ selections stored in parent so they don't disappear on tab switch
  const [selectedStock, setSelectedStock] = useState(() => new Map());
  const [selectedAll, setSelectedAll] = useState(() => new Map());
  const [selectedSqm, setSelectedSqm] = useState(() => new Map());

  const stockRef = useRef(null);
  const allRef = useRef(null);
  const sqmRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("stock");
    setSelectedStock(new Map());
    setSelectedAll(new Map());
    setSelectedSqm(new Map());
  }, [isOpen]);

  const selectedCount = useMemo(() => {
    // ✅ count unique things: batchId for stock/all, sqmPieceId for sqm
    const keys = new Set();

    const addValues = (map) => {
      for (const v of map.values()) {
        if (v?.sqmPieceId != null) keys.add(`sqm:${v.sqmPieceId}`);
        else if (v?.batchId != null) keys.add(`batch:${v.batchId}`);
        else keys.add(`k:${v?.uniqueId ?? JSON.stringify(v)}`);
      }
    };

    addValues(selectedStock);
    addValues(selectedAll);
    addValues(selectedSqm);

    return keys.size;
  }, [selectedStock, selectedAll, selectedSqm]);

  if (!isOpen) return null;

  const handleOk = () => {
    const items = [
      ...Array.from(selectedStock.values()),
      ...Array.from(selectedAll.values()),
      ...Array.from(selectedSqm.values()),
    ];
    onSelectItems(items);
    onClose();
  };

  const TabButton = ({ id, label }) => (
    <button
      role="tab"
      aria-selected={activeTab === id}
      aria-controls={`${id}-panel`}
      id={`${id}-tab`}
      className={`search-tab ${activeTab === id ? "is-active" : ""}`}
      onClick={() => setActiveTab(id)}
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
              disabled={selectedCount === 0}
            >
              OK ({selectedCount})
            </button>
          </div>
        </div>

        <div className="search-tabs" role="tablist" aria-label="Search Results Tabs">
          <TabButton id="stock" label="Stock Items" />
          <TabButton id="all" label="All" />
          <TabButton id="sqm" label="SQM Pieces" />
        </div>

        {/* Panels (they can unmount now, selections still won’t be lost) */}
        {activeTab === "stock" && (
          <div id="stock-panel" role="tabpanel" aria-labelledby="stock-tab">
            <StockTab
              ref={stockRef}
              modalOpen={isOpen}
              isActive={activeTab === "stock"}
              selectedMap={selectedStock}
              setSelectedMap={setSelectedStock}
            />
          </div>
        )}

        {activeTab === "all" && (
          <div id="all-panel" role="tabpanel" aria-labelledby="all-tab">
            <AllTab
              ref={allRef}
              modalOpen={isOpen}
              isActive={activeTab === "all"}
              selectedMap={selectedAll}
              setSelectedMap={setSelectedAll}
            />
          </div>
        )}

        {activeTab === "sqm" && (
          <div id="sqm-panel" role="tabpanel" aria-labelledby="sqm-tab">
            <SqmPiecesTab
              ref={sqmRef}
              modalOpen={isOpen}
              isActive={activeTab === "sqm"}
              selectedMap={selectedSqm}
              setSelectedMap={setSelectedSqm}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal;
