import React from "react";

const InvoiceDetails = ({
  invoiceAmount,
  setInvoiceAmount,
  shippingCost,
  setShippingCost,
  totalInvoiceAmount,
}) => (
  <div className="section">
    <div className="section-title">Invoice Details</div>
    <div className="field-grid">
      <div className="field">
        <label>Invoice Amount</label>
        <div className="input-with-prefix">
          <span className="input-prefix">$</span>
          <input
            type="text"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
            placeholder="Enter Invoice Amount"
          />
        </div>
      </div>
      <div className="field">
        <label>Shipping Cost</label>
        <div className="input-with-prefix">
          <span className="input-prefix">$</span>
          <input
            type="text"
            value={shippingCost}
            onChange={(e) => setShippingCost(e.target.value)}
            placeholder="Enter Shipping Cost"
          />
        </div>
      </div>
    </div>
    <div className="total-row">
      <div className="total-field">
        <label>Total Invoice Amount</label>
        <input
          type="text"
          value={`$${totalInvoiceAmount.toFixed(2)}`}
          readOnly
        />
      </div>
    </div>
  </div>
);

export default InvoiceDetails;
