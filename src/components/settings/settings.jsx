import React, { useState } from "react";
import GeneralSettings from "./GeneralSettings";
import InvoiceSettings from "./InvoiceSettings";
import PermissionsSettings from "./PermissionsSettings";
import PurchaseInvoiceSettings from "./PurchaseInvoiceSettings";
import ItemBatchesSettings from "./ItemBatchesSettings";
import DescriptionsSettings from "./DescriptionSorting";
import ItemNameDescriptionSettings from "./ItemNameDescriptionSettings";
import VariantRelinker from "./VariantRelinker";
import DescriptionEditor from "./editDescription";
import YearSettings from "./YearSettings";           
import CurrencySettings from "./CurrencySettings";
import InvoiceDisplayNamesPanel from "./invoiceDisplayName";   
import StockTotalsAudit from "./StockTotalsAudit";


import "./settings.css";
import InventoryAuditPage from "./Inventory-Audit";

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
      case "item-name-descriptions":
        return <ItemNameDescriptionSettings />;
      case "variant-relinker":
        return <VariantRelinker />;
      case "descriptions-editor":
        return <DescriptionEditor />;
      case "year-settings":
        return <YearSettings />;           
      case "currency-settings":
        return <CurrencySettings />;  
         case "invoice-display-name-settings":
        return <InvoiceDisplayNamesPanel />;      
      case "stock-totals-audit":
        return <StockTotalsAudit />;
           case "inventory-audit":
        return <InventoryAuditPage />;

      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="settings-container">
      <aside className="settings-sidebar">
        <h3 className="sidebar-title">Settings</h3>
        <ul className="sidebar-menu">
          <li
            className={activeTab === "general" ? "active" : ""}
            onClick={() => setActiveTab("general")}
          >
            General
          </li>
          <li
            className={activeTab === "invoice" ? "active" : ""}
            onClick={() => setActiveTab("invoice")}
          >
            Invoice Settings
          </li>
          <li
            className={activeTab === "permissions" ? "active" : ""}
            onClick={() => setActiveTab("permissions")}
          >
            Permissions
          </li>
          <li
            className={activeTab === "purchase-invoice" ? "active" : ""}
            onClick={() => setActiveTab("purchase-invoice")}
          >
            Purchase Invoice
          </li>
          <li
            className={activeTab === "item-batches" ? "active" : ""}
            onClick={() => setActiveTab("item-batches")}
          >
            Item Batches
          </li>
          <li
            className={activeTab === "descriptions" ? "active" : ""}
            onClick={() => setActiveTab("descriptions")}
          >
            Descriptions (Real)
          </li>
          <li
            className={activeTab === "item-name-descriptions" ? "active" : ""}
            onClick={() => setActiveTab("item-name-descriptions")}
          >
            Descriptions (Item Name)
          </li>
          <li
            className={activeTab === "variant-relinker" ? "active" : ""}
            onClick={() => setActiveTab("variant-relinker")}
          >
            Variant Relinker
          </li>
          <li
            className={activeTab === "descriptions-editor" ? "active" : ""}
            onClick={() => setActiveTab("descriptions-editor")}
          >
            Edit Descriptions
          </li>
          <li
            className={activeTab === "year-settings" ? "active" : ""}
            onClick={() => setActiveTab("year-settings")}
          >
            Fiscal Year
          </li>
          <li
            className={activeTab === "currency-settings" ? "active" : ""}
            onClick={() => setActiveTab("currency-settings")}
          >
            Currency
          </li>


              <li
            className={activeTab === "invoice-display-name-settings" ? "active" : ""}
            onClick={() => setActiveTab("invoice-display-name-settings")}
          >
            Invoice display
          </li>

          <li
            className={activeTab === "stock-totals-audit" ? "active" : ""}
            onClick={() => setActiveTab("stock-totals-audit")}
          >
             Stock Totals / Audit
          </li>

              <li
            className={activeTab === "inventory-audit" ? "active" : ""}
            onClick={() => setActiveTab("inventory-audit")}
          >
             Inventory Audit
          </li>

        </ul>
      </aside>
      <section className="settings-content">{renderTab()}</section>
    </div>
  );
};

export default SettingsPage;
