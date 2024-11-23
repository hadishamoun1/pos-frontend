import React from "react";

const CostTable = ({
  selectedItems,
  shippingCost,
  invoiceAmount,
  totalFees,
  totalInvoiceAmount,
}) => {
  const calculatePriceCFR = (item) => {
    if (!invoiceAmount || !item.fobPrice) return 0;
    const shippingCostPerItem =
      parseFloat(shippingCost || 0) / parseFloat(invoiceAmount || 1);
    return (shippingCostPerItem + 1) * parseFloat(item.fobPrice);
  };

  const calculateFinalCost = (item) => {
    const cfrPrice = calculatePriceCFR(item);
    if (! totalInvoiceAmount || !totalFees) return 0;
    const feesRatio =
      parseFloat(totalFees || 0) / parseFloat( totalInvoiceAmount || 1);
    return (feesRatio + 1) * cfrPrice;
  };

  const calculateCostPercentage = () => {
    if (!totalFees || ! totalInvoiceAmount) return 0;
    return ((parseFloat(totalFees) / parseFloat( totalInvoiceAmount)) * 100).toFixed(
      2
    );
  };

  return (
    <div className="side-container">
      <h3>Cost Breakdown</h3>
      <table className="cost-table">
        <thead>
          <tr>
            <th>Cost per Item</th>
            <th>Price FOB</th>
            <th>Price CFR</th>
            <th>Final Cost</th>
          </tr>
        </thead>
        <tbody>
          {selectedItems.map((item, index) => (
            <tr key={index}>
              <td>{item.itemName || "-"}</td>
              <td>{parseFloat(item.fobPrice || 0).toFixed(2) || "-"}</td>
              <td>{calculatePriceCFR(item).toFixed(2) || "-"}</td>
              <td>{calculateFinalCost(item).toFixed(2) || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cost-text">
        <label>
          <strong>Cost:</strong>
        </label>
        <span>{`${calculateCostPercentage()}%`}</span>
      </div>
    </div>
  );
};

export default CostTable;
