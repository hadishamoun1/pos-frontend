// src/components/pos-system/SearchModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./searchModal.css";
import StockTab from "./StockTab";
import AllTab from "./AllTab";
import SqmPiecesTab from "./SqmPiecesTab";
import { hasPerm } from "../auth/authz";
import { useTranslation } from "../hooks/useTranslation"; // ✅ NEW
import { axiosClient } from "../api/axiosClient";

const SearchModal = ({ isOpen, onClose, onSelectItems }) => {
  const { t } = useTranslation(); // ✅ NEW
  const [homeWarehouse, setHomeWarehouse] = useState(null);

  // ✅ permissions: control all 3 tabs
  const canStock = hasPerm("pos.search.stockTab");
  const canAll = hasPerm("pos.search.allTab");
  const canSqm = hasPerm("pos.search.sqmTab");
  // "Pictured" tab reuses the same permission as Stock — it's just a filtered view of it.
  const canMedia = canStock;

  const allowedTabs = useMemo(() => {
    const tabs = [];
    if (canStock) tabs.push("stock");
    if (canAll) tabs.push("all");
    if (canSqm) tabs.push("sqm");
    if (canMedia) tabs.push("media");
    return tabs;
  }, [canStock, canAll, canSqm, canMedia]);

  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "all" | "sqm" | "media"

  // ✅ selections stored in parent so they don't disappear on tab switch
  const [selectedStock, setSelectedStock] = useState(() => new Map());
  const [selectedAll, setSelectedAll] = useState(() => new Map());
  const [selectedSqm, setSelectedSqm] = useState(() => new Map());
  const [selectedMedia, setSelectedMedia] = useState(() => new Map());

  const stockRef = useRef(null);
  const allRef = useRef(null);
  const sqmRef = useRef(null);
  const mediaRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // reset selections on open
    setSelectedStock(new Map());
    setSelectedAll(new Map());
    setSelectedSqm(new Map());
    setSelectedMedia(new Map());

    // pick first allowed tab
    const first = allowedTabs[0] || null;
    setActiveTab(first || "all");
  }, [isOpen, allowedTabs]);

  useEffect(() => {
    if (!isOpen) return;
    axiosClient.get("/warehouses").then((res) => {
      const list = res?.data || [];
      const home = list.find((w) => w.isHome);
      if (home?.name) setHomeWarehouse(home.name.trim());
    }).catch(() => {});
  }, [isOpen]);

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
    addValues(selectedMedia);

    return keys.size;
  }, [selectedStock, selectedAll, selectedSqm, selectedMedia]);

  if (!isOpen) return null;

  // ✅ if user has no tab permissions at all
  if (allowedTabs.length === 0) {
    return (
      <div className="search-modal-overlay" onClick={onClose}>
        <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="search-modal-header">
            <h2 className="search-modal-title">{t("searchModal.title")}</h2>
            <div className="search-modal-buttons">
              <button className="search-modal-close-button" onClick={onClose}>
                {t("common.close")}
              </button>
            </div>
          </div>

          <div style={{ padding: 16 }}>{t("searchModal.noPermissionsError")}</div>
        </div>
      </div>
    );
  }

  const handleOk = () => {
    const items = [
      ...Array.from(selectedStock.values()),
      ...Array.from(selectedAll.values()),
      ...Array.from(selectedSqm.values()),
      ...Array.from(selectedMedia.values()),
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
          <h2 className="search-modal-title">{t("searchModal.title")}</h2>
          <div className="search-modal-buttons">
            <button className="search-modal-close-button" onClick={onClose}>
              {t("common.close")}
            </button>
            <button
              className="search-modal-ok-button"
              onClick={handleOk}
              disabled={selectedCount === 0}
            >
              {t("searchModal.okWithCount", { count: selectedCount })}
            </button>
          </div>
        </div>

        <div className="search-tabs" role="tablist" aria-label={t("searchModal.tabsAriaLabel")}>
          {canStock && <TabButton id="stock" label={t("searchModal.tabs.stock")} />}
          {canAll && <TabButton id="all" label={t("searchModal.tabs.all")} />}
          {canSqm && <TabButton id="sqm" label={t("searchModal.tabs.sqm")} />}
          {canMedia && <TabButton id="media" label={t("searchModal.tabs.media")} />}
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
              homeWarehouse={homeWarehouse}
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
              homeWarehouse={homeWarehouse}
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

        {canMedia && activeTab === "media" && (
          <div id="media-panel" role="tabpanel" aria-labelledby="media-tab">
            <StockTab
              ref={mediaRef}
              modalOpen={isOpen}
              isActive={activeTab === "media"}
              selectedMap={selectedMedia}
              setSelectedMap={setSelectedMedia}
              homeWarehouse={homeWarehouse}
              mediaOnly
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal;
