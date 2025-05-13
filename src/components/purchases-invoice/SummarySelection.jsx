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
  invoiceType,

  // ← new props:
  selectedItems,
  calculatePriceCFR,
  calculateFinalCost,
}) => {
  return (
    <div className="summary-section">
      {/* ─── INPUTS ─── */}
      <div className="fields">
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

      {/* ─── COST-PER-ITEM TABLE ─── */}
      <div className="cost-table-container">
        <table className="cost-table">
          <thead>
            <tr>
              <th>Cost per Item</th>
              <th>Price EXW</th>
              <th>Unit Price (FOB)</th>
              <th>Price CFR</th>
              <th>Final Cost</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.map((item, idx) => (
              <tr key={idx}>
                <td>{item.itemName || "-"}</td>
                <td>
                {"-"}
                </td>
                <td>
                  {invoiceType === "G"
                    ? item.priceOFR != null
                      ? parseFloat(item.priceOFR).toFixed(2)
                      : "-"
                    : item.unitPrice != null
                    ? parseFloat(item.unitPrice).toFixed(2)
                    : "-"}
                </td>

                 <td>{(calculatePriceCFR(item) || 0).toFixed(2)}</td>
                 <td>{(calculateFinalCost(item) || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── TOTALS ─── */}
      <div className="totals">
        <p>Total Amount: ${totalAmount.toFixed(2)}</p>
        <p>Total Offer Amount: ${totalOfferAmount.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default SummarySection;
