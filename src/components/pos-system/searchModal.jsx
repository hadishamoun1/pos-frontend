// src/components/pos-system/SearchModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./searchModal.css";
import StockTab from "./StockTab";
import AllTab from "./AllTab";
import SqmPiecesTab from "./SqmPiecesTab";
import { hasPerm } from "../auth/authz"; 

const SearchModal = ({ isOpen, onClose, onSelectItems }) => {
  // ✅ permissions: control all 3 tabs
  const canStock = hasPerm("pos.search.stockTab");
  const canAll = hasPerm("pos.search.allTab");
  const canSqm = hasPerm("pos.search.sqmTab");

  const allowedTabs = useMemo(() => {
    const tabs = [];
    if (canStock) tabs.push("stock");
    if (canAll) tabs.push("all");
    if (canSqm) tabs.push("sqm");
    return tabs;
  }, [canStock, canAll, canSqm]);

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

    // reset selections on open
    setSelectedStock(new Map());
    setSelectedAll(new Map());
    setSelectedSqm(new Map());

    // pick first allowed tab
    const first = allowedTabs[0] || null;
    setActiveTab(first || "all");
  }, [isOpen, allowedTabs]);

  // if permissions change or active tab is no longer allowed, move to first allowed
  useEffect(() => {
    if (!isOpen) return;
    if (!allowedTabs.length) return;

    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab, isOpen]);

  const selectedCount = useMemo(() => {
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

  // ✅ if user has no tab permissions at all
  if (allowedTabs.length === 0) {
    return (
      <div className="search-modal-overlay" onClick={onClose}>
        <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="search-modal-header">
            <h2 className="search-modal-title">Search</h2>
            <div className="search-modal-buttons">
              <button className="search-modal-close-button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            ERROR!. Please Contact the Administrator.
          </div>
        </div>
      </div>
    );
  }

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
          {canStock && <TabButton id="stock" label="Stock Items" />}
          {canAll && <TabButton id="all" label="All" />}
          {canSqm && <TabButton id="sqm" label="SQM Pieces" />}
        </div>

        {/* Panels */}
        {canStock && activeTab === "stock" && (
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

        {canAll && activeTab === "all" && (
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

        {canSqm && activeTab === "sqm" && (
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
