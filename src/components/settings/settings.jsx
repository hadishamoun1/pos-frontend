import React, { useMemo, useState, useEffect } from "react";
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
import LogoutAllUsersPage from "./LogoutAllUsersPage";
import InventoryAuditPage from "./Inventory-Audit";
import InvoiceAuditPage from "./InvoiceAuditPage";
import AccountingRoleSettings from "./AccountingRoleSettings";
import LinkedPartySettings from "./LinkedPartySettings";
import CompanySettings from "./CompanySettings";
import WarehouseSettings from "./WarehouseSettings";
import SecurityLockdownSettings from "./Securitylockdownsettings";
import FileBrowser from "./FileBrowser";
import ApiDelaySettings from "./ApiDelaySettings";
import PosControlsSettings from "./PosControlsSettings";
import BulkRvrSettings from "./BulkRvrSettings";
import { hasPerm } from "../auth/authz";
import "./settings.css";

const SettingsPage = () => {
  const TABS = useMemo(
    () => [
      { key: "general", label: "General", perm: "settings.general", component: <GeneralSettings /> },
      { key: "invoice", label: "Invoice Settings", perm: "settings.invoice", component: <InvoiceSettings /> },
      { key: "permissions", label: "Permissions", perm: "settings.permissions", component: <PermissionsSettings /> },
      { key: "purchase-invoice", label: "Purchase Invoice", perm: "settings.purchaseInvoice", component: <PurchaseInvoiceSettings /> },
      { key: "item-batches", label: "Item Batches", perm: "settings.itemBatches", component: <ItemBatchesSettings /> },
      { key: "descriptions", label: "Descriptions (Real)", perm: "settings.descriptionsReal", component: <DescriptionsSettings /> },
      { key: "item-name-descriptions", label: "Descriptions (Item Name)", perm: "settings.descriptionsItemName", component: <ItemNameDescriptionSettings /> },
      { key: "variant-relinker", label: "Variant Relinker", perm: "settings.variantRelinker", component: <VariantRelinker /> },
      { key: "descriptions-editor", label: "Edit Descriptions", perm: "settings.editDescriptions", component: <DescriptionEditor /> },
      { key: "year-settings", label: "Fiscal Year", perm: "settings.fiscalYear", component: <YearSettings /> },
      { key: "currency-settings", label: "Currency", perm: "settings.currency", component: <CurrencySettings /> },
      { key: "account-roles", label: "Account Roles", perm: "settings.accountRoles", component: <AccountingRoleSettings /> },
      { key: "linked-parties", label: "Linked Parties", perm: "settings.linkedParties", component: <LinkedPartySettings /> },
      { key: "invoice-display-name-settings", label: "Invoice display", perm: "settings.invoiceDisplay", component: <InvoiceDisplayNamesPanel /> },
      { key: "stock-totals-audit", label: "Stock Totals / Audit", perm: "settings.stockTotalsAudit", component: <StockTotalsAudit /> },
      { key: "inventory-audit", label: "Inventory Audit", perm: "settings.inventoryAudit", component: <InventoryAuditPage /> },
      { key: "invoice-audit", label: "Invoice Audit", perm: "settings.invoiceAudit", component: <InvoiceAuditPage /> },
      { key: "logout-users", label: "Users Logout", perm: "settings.logoutUsers", component: <LogoutAllUsersPage /> },
      { key: "company-settings", label: "Company", perm: "settings.company", component: <CompanySettings /> },
      { key: "warehouse-settings", label: "Warehouses", perm: "settings.company", component: <WarehouseSettings /> },

      { key: "security-lockdown", label: "Security Lockdown", perm: "settings.logoutUsers", component: <SecurityLockdownSettings /> },
      { key: "pos-controls", label: "POS Controls", perm: "settings.posControls", component: <PosControlsSettings /> },
      { key: "bulk-rvr", label: "Bulk RVR", perm: "recievables.rvr", component: <BulkRvrSettings /> },
      { key: "file-browser", label: "File Browser", perm: "users.manage", component: <FileBrowser /> },
      { key: "api-delay", label: "API Delay", perm: "settings.delay", component: <ApiDelaySettings /> },
    ],
    []
  );

  const allowedTabs = useMemo(() => {
    return TABS.filter((t) => hasPerm(t.perm));
  }, [TABS]);

  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    if (!allowedTabs.length) return;
    const ok = allowedTabs.some((t) => t.key === activeTab);
    if (!ok) setActiveTab(allowedTabs[0].key);
  }, [allowedTabs, activeTab]);

  const active = allowedTabs.find((t) => t.key === activeTab) || allowedTabs[0] || null;

  if (!allowedTabs.length) {
    return (
      <div className="settings-container">
        <div style={{ padding: 16 }}>
          You do not have permission to view any settings sections.
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <aside className="settings-sidebar">
        <h3 className="sidebar-title">Settings</h3>

        <ul className="sidebar-menu">
          {allowedTabs.map((t) => (
            <li
              key={t.key}
              className={activeTab === t.key ? "active" : ""}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </li>
          ))}
        </ul>
      </aside>

      <section className="settings-content">{active?.component}</section>
    </div>
  );
};

export default SettingsPage;