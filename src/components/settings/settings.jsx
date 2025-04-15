import React, { useState } from "react";
import GeneralSettings from "./GeneralSettings";
import InvoiceSettings from "./InvoiceSettings";
import PermissionsSettings from "./PermissionsSettings";
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
        </ul>
      </aside>
      <section className="settings-content">{renderTab()}</section>
    </div>
  );
};

export default SettingsPage;
