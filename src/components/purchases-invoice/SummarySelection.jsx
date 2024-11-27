import React from "react";

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
}) => {
  return (
    <div className="summary-section">
      <div className="fields">
        {/* Row for Potential Cost and Final Cost */}
        <div className="row">
          <label>
            Potential Cost
            <input
              type="number"
              value={potentialCost}
              onChange={(e) => setPotentialCost(Number(e.target.value))}
            />
          </label>
          <label className="important-field">
            Final Cost
            <input
              type="number"
              value={finalCost}
              readOnly // Prevent direct editing
              onClick={openItemModal} // Open the modal on click
              placeholder="Click to calculate final cost"
            />
          </label>
        </div>
        {/* Column for Shipping Cost and Number of Containers */}
        <div className="column">
          <label>
            Shipping Cost
            <input
              type="number"
              value={shippingCost}
              onChange={(e) => setShippingCost(Number(e.target.value))}
            />
          </label>
          <label>
            Nb of Containers
            <input
              type="number"
              value={numberOfContainers}
              onChange={(e) => setNumberOfContainers(Number(e.target.value))}
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
