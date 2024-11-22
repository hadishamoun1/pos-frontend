import React from "react";
import "./dashboard.css";
import { Link } from "react-router-dom";

const sections = [
  { name: "POS System", image: "/assests/pos.jpeg" },
  { name: "Accounting", image: "/assests/accounting.jpg" },
  { name: "Inventory", image: "/assests/inventory.png" },
  { name: "Customers", image: "/assests/customers.jpeg" },
  { name: "Purchases invoice", image: "/assests/purchase.jpg" },
  { name: "Settings", image: "/assests/settings.png" },
  { name: "Suppliers", image: "/assests/suppliers.webp" },
  { name: "Items", image: "/assests/items.webp" },
  { name: "Cost Estimator", image: "/assests/price.webp" },
];

const DashboardPage = () => {
  return (
    <div className="dashboard-container">
      <h1>Dashboard</h1>
      <div className="card-grid">
        {sections.map((section, index) => (
          <Link
            to={`/${section.name.toLowerCase().replace(" ", "-")}`}
            key={index}
            className="dashboard-card-link"
          >
            <div className="dashboard-card">
              <img
                src={section.image}
                alt={section.name}
                className="card-image"
              />
              <div className="card-title">{section.name}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
