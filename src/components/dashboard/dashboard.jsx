import React from "react";
import "./dashboard.css";
import { Link } from "react-router-dom";

const sections = [
  { name: "POS System", image: "/assests/accounting.jpeg" },
  { name: "Invoices", image: "/path/to/invoices-image.jpg" },
  { name: "Inventory", image: "/path/to/inventory-image.jpg" },
  { name: "Customers", image: "/path/to/customers-image.jpg" },
  { name: "Settings", image: "/path/to/settings-image.jpg" },
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
