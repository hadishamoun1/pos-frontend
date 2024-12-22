import React from "react";
import "./dashboard.css";
import { Link } from "react-router-dom";

const sections = [
  { name: "POS System", image: "/assets/pos.jpeg" },
  { name: "Accounting", image: "/assets/accounting.jpg" },
  { name: "Inventory", image: "/assets/inventory.png" },
  { name: "Customers", image: "/assets/customers.jpeg" },
  { name: "Purchases Invoice", image: "/assets/purchase.jpg" },
  { name: "Settings", image: "/assets/settings.png" },
  { name: "Suppliers", image: "/assets/suppliers.webp" },
  { name: "Items", image: "/assets/items.webp" },
  { name: "Cost Estimator", image: "/assets/price.webp" },
  { name: "Accounts", image: "/assets/price.webp" },
];

const DashboardPage = () => {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="dashboard-main-title">Welcome to the Business Suite</h1>
        <p className="dashboard-description">
          Streamline your operations with these powerful tools.
        </p>
      </header>

      <div className="dashboard-sections">
        {sections.map((section, index) => (
          <Link
            to={`/${section.name.toLowerCase().replace(/ /g, "-")}`}
            key={index}
            className="dashboard-link"
          >
            <div className="dashboard-tile">
              <div className="tile-image-container">
                <img
                  src={section.image}
                  alt={section.name}
                  className="tile-image"
                />
              </div>
              <div className="tile-content">
                <h3 className="tile-title">{section.name}</h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
