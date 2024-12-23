import React from "react";
import "./dashboard.css";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

library.add(fas);

const sections = [
  { name: "POS System", icon: "cash-register", link: "/pos-system" },
  { name: "Accounting", icon: "chart-line", link: "/accounting" },
  { name: "Inventory", icon: "warehouse", link: "/inventory" },
  { name: "Customers", icon: "users", link: "/customers" },
  {
    name: "Purchases Invoice",
    icon: "file-invoice",
    link: "/purchases-invoice",
  },
  { name: "Settings", icon: "cog", link: "/settings" },
  { name: "Suppliers", icon: "truck", link: "/suppliers" },
  { name: "Items", icon: "box", link: "/items" },
  { name: "Cost Estimator", icon: "calculator", link: "/cost-estimator" },
  { name: "Accounts", icon: "money-bill-wave", link: "/accounts" },
];

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Business Overview</h1>
    
      <div className="modules-section">
        <h2>Modules</h2>
        <div className="module-grid">
          {sections.map((section, index) => (
            <Link to={section.link} key={index} className="module-card">
              <div className="module-icon">
                <FontAwesomeIcon icon={section.icon} size="2xl" />
              </div>
              <h3>{section.name.toLowerCase().replace(" ", "-")}</h3>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
