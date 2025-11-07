import React, { useState } from "react";
import GeneralSettings from "./GeneralSettings";
import InvoiceSettings from "./InvoiceSettings";
import PermissionsSettings from "./PermissionsSettings";
import PurchaseInvoiceSettings from "./PurchaseInvoiceSettings";
import ItemBatchesSettings from "./ItemBatchesSettings";
import DescriptionsSettings from "./DescriptionSorting";
import ItemNameDescriptionSettings from "./ItemNameDescriptionSettings"; 

import "./settings.css";

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("general");

  const renderTab = () => {
    switch (activeTab) {
      case "general":
        return <GeneralSettings />;
      case "invoice":
        return <InvoiceSettings />;
      case "permissions":
        return <PermissionsSettings />;
      case "purchase-invoice":
        return <PurchaseInvoiceSettings />;
      case "item-batches":
        return <ItemBatchesSettings />;
      case "descriptions":
        return <DescriptionsSettings />;
      case "item-name-descriptions":                   // ← NEW
        return <ItemNameDescriptionSettings />;        // ← NEW
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="settings-container">
      <aside className="settings-sidebar">
        <h3 className="sidebar-title">Settings</h3>
        <ul className="sidebar-menu">
          <li className={activeTab === "general" ? "active" : ""} onClick={() => setActiveTab("general")}>
            General
          </li>
          <li className={activeTab === "invoice" ? "active" : ""} onClick={() => setActiveTab("invoice")}>
            Invoice Settings
          </li>
          <li className={activeTab === "permissions" ? "active" : ""} onClick={() => setActiveTab("permissions")}>
            Permissions
          </li>
          <li className={activeTab === "purchase-invoice" ? "active" : ""} onClick={() => setActiveTab("purchase-invoice")}>
            Purchase Invoice
          </li>
          <li className={activeTab === "item-batches" ? "active" : ""} onClick={() => setActiveTab("item-batches")}>
            Item Batches
          </li>
          <li className={activeTab === "descriptions" ? "active" : ""} onClick={() => setActiveTab("descriptions")}>
            Descriptions (Real)
          </li>
          <li                                                     // ← NEW
            className={activeTab === "item-name-descriptions" ? "active" : ""} 
            onClick={() => setActiveTab("item-name-descriptions")}
          >
            Descriptions (Item Name)
          </li>
        </ul>
      </aside>
      <section className="settings-content">{renderTab()}</section>
    </div>
  );
};

export default SettingsPage;
