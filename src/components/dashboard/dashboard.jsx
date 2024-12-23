import React from "react";
import "./dashboard.css";
import { Link } from "react-router-dom";

const sections = [

];

const DashboardPage = () => {
  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Business Hub</h1>
        <p className="dashboard-subtitle">
          Navigate through modules to manage your operations effectively
        </p>
      </header>

      <div className="dashboard-grid">
        {sections.map((section, index) => (
          <Link
            to={`/${section.name.toLowerCase().replace(/ /g, "-")}`}
            key={index}
            className="dashboard-card-link"
          >
            <div className="dashboard-card">
              <div className="dashboard-card-image-wrapper">
                <img
                  src={section.image}
                  alt={section.name}
                  className="dashboard-card-image"
                />
              </div>
              <div className="dashboard-card-content">
                <h2 className="dashboard-card-title">{section.name}</h2>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
