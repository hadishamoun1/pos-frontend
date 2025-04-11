// AlternativeSummarySection.js
import React from "react";

const AlternativeSummarySection = () => {
  return (
    <div className="summary-section">
      <h4>Alternative Summary View</h4>
      {/* Add your own fields below */}
      <label>
        Custom Field 1
        <input type="text" placeholder="Something" />
      </label>
      <label>
        Custom Field 2
        <input type="number" placeholder="123" />
      </label>
    </div>
  );
};

export default AlternativeSummarySection;
