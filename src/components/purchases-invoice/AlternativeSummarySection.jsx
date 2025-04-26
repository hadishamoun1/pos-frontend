import React from "react";
import "./styles/alternativeSummarySection.css";

const AlternativeSummarySection = ({
  shippingLine,
  onShippingLineChange,
  etd,
  onEtdChange,
  numberOfContainers,
  onNumberOfContainersChange,
  blNumber,
  onBlNumberChange,
}) => {
  return (
    <div className="summary-section">
      <h4>Shipping &amp; BL Details</h4>
      <div className="alternative-fields">
        <label>
          Shipping Line
          <input
            type="text"
            value={shippingLine}
            onChange={(e) => onShippingLineChange(e.target.value)}
            placeholder="Enter shipping line"
          />
        </label>

        <label>
          Expected Time Departure
          <input
            type="date"
            value={etd}
            onChange={(e) => onEtdChange(e.target.value)}
          />
        </label>

        <label>
          Number of Containers
          <input
            type="number"
            value={numberOfContainers}
            onChange={(e) => onNumberOfContainersChange(Number(e.target.value))}
            placeholder="e.g., 5"
          />
        </label>

        <label>
          BL Number
          <input
            type="text"
            value={blNumber}
            onChange={(e) => onBlNumberChange(e.target.value)}
            placeholder="Enter BL number"
          />
        </label>
      </div>
    </div>
  );
};

export default AlternativeSummarySection;
