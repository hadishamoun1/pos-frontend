import React from "react";

const SummarySection = ({
  totalAmount,
  totalOfferAmount,
  potentialCost,
  setPotentialCost,
  shippingCost,
  setShippingCost,
  numberOfContainers,
  setNumberOfContainers,
}) => {
  return (
    <div className="summary-section">
      <div className="fields">
        <label>
          Potential Cost
          <input
            type="number"
            value={potentialCost}
            onChange={(e) => setPotentialCost(Number(e.target.value))}
          />
        </label>
        <label>
          Shipping Cost
          <input
            type="number"
            value={shippingCost}
            onChange={(e) => setShippingCost(Number(e.target.value))}
          />
        </label>
        <label>
          Number of Containers
          <input
            type="number"
            value={numberOfContainers}
            onChange={(e) => setNumberOfContainers(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="totals">
        <p>Total Amount: ${totalAmount.toFixed(2)}</p>
        <p>Total Offer Amount: ${totalOfferAmount.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default SummarySection;
