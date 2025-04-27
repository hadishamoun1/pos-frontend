// SummarySection.jsx
import React from "react";
import "./styles/summary.css";

const SummarySection = ({
  totalAmount,
  totalOfferAmount,
  potentialCost,
  setPotentialCost,
  finalCost,
  openItemModal,
  shippingCost,
  setShippingCost,
  numberOfContainers,
  setNumberOfContainers,
  isEditable,
}) => {
  return (
    <div className="summary-section">
      <div className="fields">
        {/* Potential vs Final */}
        <div className="row">
          <label>
            Potential Cost
            <input
              type="number"
              value={potentialCost}
              onChange={(e) => setPotentialCost(Number(e.target.value))}
              disabled={!isEditable}
            />
          </label>
          <label className="important-field">
            Final Cost
            <input
              type="number"
              value={finalCost}
              readOnly
              onClick={openItemModal}
              className="final-cost-clickable"
              placeholder="Click to calculate"
            />
          </label>
        </div>

        {/* Shipping & Containers */}
        <div className="column">
          <label>
            Shipping Cost
            <input
              type="number"
              value={shippingCost}
              onChange={(e) => setShippingCost(Number(e.target.value))}
              disabled={!isEditable}
            />
          </label>
          <label>
            Nb of Containers
            <input
              type="number"
              value={numberOfContainers}
              onChange={(e) => setNumberOfContainers(Number(e.target.value))}
              disabled={!isEditable}
            />
          </label>
        </div>
      </div>

      <div className="totals">
        <p>Total Amount: ${totalAmount.toFixed(2)}</p>
        <p>Total Offer Amount: ${totalOfferAmount.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default SummarySection;
