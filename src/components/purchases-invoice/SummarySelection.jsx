import React from "react";

const SummarySection = ({
  vat,
  setVat,
  totalAmount,
  vatAmount,
  grandTotal,
}) => {
  return (
    <div className="summary-section">
      <label>
        VAT
        <select value={vat} onChange={(e) => setVat(Number(e.target.value))}>
          <option value="0">0%</option>
          <option value="6">6%</option>
          <option value="11">11%</option>
        </select>
      </label>
      <div className="totals">
        <p>Total Amount: ${totalAmount.toFixed(2)}</p>
        <p>VAT Amount: ${vatAmount.toFixed(2)}</p>
        <p>Grand Total: ${grandTotal.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default SummarySection;
