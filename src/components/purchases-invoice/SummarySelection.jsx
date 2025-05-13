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
  status,

  // ← new props:
  selectedItems,
  calculatePriceCFR,
  calculateFinalCost,
  calculatePriceCFROFR,
  calculateFinalCostOFR,
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
              {invoiceType === "S" && (
                <>
                  <th>FOB Price</th>
                  <th>Price CFR</th>
                  <th>Final Cost</th>
                </>
              )}
              {invoiceType === "G" && (
                <>
                  <th>FOB OFR</th>
                  <th>CFR OFR</th>
                  <th>Final OFR</th>
                </>
              )}
              {invoiceType === "SR" && status !== "Recieved" && (
                <>
                  <th>FOB Price</th>
                  <th>Price CFR</th>
                  <th>Final Cost</th>
                  <th>FOB OFR</th>
                  <th>CFR OFR</th>
                  <th>Final OFR</th>
                </>
              )}
              {invoiceType === "SR" && status === "Recieved" && (
                <>
                  <th>FOB Price</th>
                  <th>Price CFR</th>
                  <th>Final Cost</th>
                  <th>FOB OFR</th>
                  <th>CFR OFR</th>
                  <th>Final OFR</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {selectedItems.map((item, idx) => {
              // standard
              const cfr = calculatePriceCFR(item) || 0;
              const final = calculateFinalCost(item) || 0;
              // SR+Recieved
              const cfrOFR = calculatePriceCFROFR(item) || 0;
              const finalOFR = calculateFinalCostOFR(item) || 0;

              return (
                <tr key={idx}>
                  <td>{item.itemName || "-"}</td>

                  {status !== "Recieved" && invoiceType === "S" && (
                    <>
                      <td>{item.unitPrice?.toFixed(2) || "0.00"}</td>
                      <td>{cfr.toFixed(2)}</td>
                      <td>{final.toFixed(2)}</td>
                    </>
                  )}

                  {status !== "Recieved" && invoiceType === "G" && (
                    <>
                      <td>{item.priceOFR?.toFixed(2) || "0.00"}</td>
                      <td>{cfrOFR.toFixed(2)}</td>
                      <td>{finalOFR.toFixed(2)}</td>
                    </>
                  )}

              
                  {invoiceType === "SR" && status !== "Recieved" && (
                    <>
                      <td>{item.unitPrice?.toFixed(2) || "0.00"}</td>
                      <td>{cfr.toFixed(2)}</td>
                      <td>{final.toFixed(2)}</td>
                      <td>{item.priceOFR?.toFixed(2) || "0.00"}</td>
                      <td>{cfrOFR.toFixed(2)}</td>
                      <td>{finalOFR.toFixed(2)}</td>
                    </>
                  )}

                  {invoiceType === "SR" && status === "Recieved" && (
                    <>
                      <td>{item.unitPrice?.toFixed(2) || "0.00"}</td>
                      <td>{cfr.toFixed(2)}</td>
                      <td>{final.toFixed(2)}</td>
                      <td>{item.priceOFR?.toFixed(2) || "0.00"}</td>
                      <td>{cfrOFR.toFixed(2)}</td>
                      <td>{finalOFR.toFixed(2)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── TOTALS ─── */}
      <div className="totals">
        <p>Total Amount: ${totalAmount.toFixed(2)}</p>
        <p>Offer Amount: ${totalOfferAmount.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default SummarySection;
