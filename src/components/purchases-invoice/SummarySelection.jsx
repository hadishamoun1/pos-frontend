import React, { useMemo, useState } from "react";
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
  shippingCostComputed,
  computedCostPercentageForDisplay,

  selectedItems,
  calculatePriceCFR,
  calculateFinalCost,
  calculatePriceCFROFR,
  calculateFinalCostOFR,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // ✅ Helper: pick the best thickness on the row
  const getThickness = (it) => {
    const nums = [
      it?.thickness,
      it?.payloadVariant?.thickness,
      it?.variant?.thickness,
      it?.dimension?.thickness,
    ]
      .map((v) => (v == null ? v : Number(v)))
      .filter((n) => Number.isFinite(n) && n > 0);

    return nums.length ? nums[0] : null;
  };

  // ✅ Helper: label with thickness if available
  const displayItemLabel = (it) => {
    if (typeof it?.itemNameCombined === "string" && it.itemNameCombined.trim()) {
      return it.itemNameCombined;
    }
    const base = it?.itemName || "-";
    const th = getThickness(it);
    return th != null ? `${th} ملم ${base}` : base;
  };

  // small helper
  const safeMoney = (n) => {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  };

  const costHeaders = useMemo(() => {
    if (invoiceType === "S") {
      return ["FOB Price", "Price CFR", "Final Cost", "FOB OFR", "CFR OFR", "Final OFR"];
    }
    if (invoiceType === "G") {
      return ["FOB OFR", "CFR OFR", "Final OFR"];
    }
    if (invoiceType === "SR") {
      return ["FOB Price", "Price CFR", "Final Cost", "FOB OFR", "CFR OFR", "Final OFR"];
    }
    if (invoiceType === "RVR") {
      return ["FOB Price", "Price CFR", "Final Cost"];
    }
    return [];
  }, [invoiceType]);

  return (
    <div className={`summary-section ${collapsed ? "is-collapsed" : ""}`}>
      {/* ✅ Sticky bar + toggle */}
      <div className="summary-topbar">
        <h4 className="summary-title">Summary</h4>

        <button
          type="button"
          className="summary-toggle-btn"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "Show Summary" : "Hide Summary"}
        </button>
      </div>

      {/* ✅ Collapsible body */}
      <div className="summary-body">
        <div className="summary-grid">
          {/* ───────── LEFT: INPUTS ───────── */}
          <div className="fields">
            <label>
              Potential Cost
              <input
                type="number"
                value={
                  status === "Recieved" &&
                  typeof computedCostPercentageForDisplay === "number"
                    ? computedCostPercentageForDisplay
                    : potentialCost
                }
                onChange={(e) => setPotentialCost(Number(e.target.value))}
                disabled={!isEditable || status === "Recieved"}
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

            <label>
              Shipping Cost
              <input
                type="number"
                value={status === "Recieved" ? shippingCostComputed : shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
                disabled={!isEditable || status === "Recieved"}
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

          {/* ───────── CENTER: COST TABLE ───────── */}
          <div className="cost-table-container">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>Cost per Item</th>
                  {costHeaders.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {selectedItems?.length ? (
                  selectedItems.map((item, idx) => {
                    const cfr = calculatePriceCFR?.(item) || 0;
                    const final = calculateFinalCost?.(item) || 0;

                    const cfrOFR = calculatePriceCFROFR?.(item) || 0;
                    const finalOFR = calculateFinalCostOFR?.(item) || 0;

                    return (
                      <tr key={idx}>
                        <td style={{ direction: "rtl", textAlign: "right" }}>
                          {displayItemLabel(item)}
                        </td>

                        {/* S */}
                        {invoiceType === "S" && (
                          <>
                            <td>{safeMoney(item.unitPrice)}</td>
                            <td>{safeMoney(cfr)}</td>
                            <td>{safeMoney(final)}</td>
                            <td>{safeMoney(item.priceOFR)}</td>
                            <td>{safeMoney(cfrOFR)}</td>
                            <td>{safeMoney(finalOFR)}</td>
                          </>
                        )}

                        {/* G */}
                        {invoiceType === "G" && (
                          <>
                            <td>{safeMoney(item.priceOFR)}</td>
                            <td>{safeMoney(cfrOFR)}</td>
                            <td>{safeMoney(finalOFR)}</td>
                          </>
                        )}

                        {/* SR */}
                        {invoiceType === "SR" && (
                          <>
                            <td>{safeMoney(item.unitPrice)}</td>
                            <td>{safeMoney(cfr)}</td>
                            <td>{safeMoney(final)}</td>
                            <td>{safeMoney(item.priceOFR)}</td>
                            <td>{safeMoney(cfrOFR)}</td>
                            <td>{safeMoney(finalOFR)}</td>
                          </>
                        )}

                        {/* RVR */}
                        {invoiceType === "RVR" && (
                          <>
                            <td>{safeMoney(item.unitPrice)}</td>
                            <td>{safeMoney(cfr)}</td>
                            <td>{safeMoney(final)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={1 + costHeaders.length} style={{ textAlign: "center", opacity: 0.7 }}>
                      No selected items yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ───────── RIGHT: TOTALS ───────── */}
          <div className="totals">
            <p>Total Amount: ${safeMoney(totalAmount)}</p>
            <p>Offer Amount: ${safeMoney(totalOfferAmount)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummarySection;
