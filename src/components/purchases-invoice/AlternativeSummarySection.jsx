import React from "react";
import "./styles/alternativeSummarySection.css";

const AlternativeSummarySection = () => {
  return (
    <div className="summary-section">
      <h4>Shipping & BL Details</h4>
      <div className="alternative-fields">
        <label>
          Shipping Line
          <input type="text" placeholder="Enter shipping line" />
        </label>

        <label>
          Expected Time Departure
          <input type="date" />
        </label>

        <label>
          Number of Containers
          <input type="number" placeholder="e.g., 5" />
        </label>

        <label>
          BL Number
          <input type="text" placeholder="Enter BL number" />
        </label>
      </div>
    </div>
  );
};

export default AlternativeSummarySection;
