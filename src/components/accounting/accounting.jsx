import React from "react";
import "./accounting.css";

const AccountingPage = () => {
  return (
    <div className="accounting-container">
      {/* Top Section */}
      <div className="accounting-section top-section">
        <div className="top-toolbar">
          <input type="text" placeholder="Search" className="search-input" />
          <div className="button-group">
            <button className="action-button">New</button>
            <button className="action-button">Edit</button>
          </div>
        </div>
        {/* Additional content for top section can go here */}
      </div>

      {/* Bottom Section */}
      <div className="accounting-section bottom-section">
        <div className="bottom-toolbar">
          <input type="text" placeholder="Search" className="search-input" />
          <button className="action-button">Edit</button>
        </div>
        {/* Additional content for bottom section can go here */}
      </div>
    </div>
  );
};

export default AccountingPage;
