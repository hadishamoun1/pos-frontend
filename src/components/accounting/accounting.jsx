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

        {/* Accounting table */}
        <table className="accounting-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Currency</th> {/* New column for Currency */}
              <th>Currency Exchange Rate</th>
              <th>Cash Number</th>
              <th>Date</th>
              <th>Invoice Number</th>
              <th>Comments</th>
              <th>RCT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John Doe</td>
              <td>USD</td> {/* Example Currency */}
              <td>1.13</td> {/* Example Currency Exchange Rate */}
              <td>12345</td>
              <td>2024-11-01</td>
              <td>INV001</td> {/* Example Invoice Number */}
              <td>Sample comment</td>
              <td>RCT123</td>
            </tr>
            {/* Additional rows can be added here */}
          </tbody>
        </table>
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
