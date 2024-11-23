import React from "react";

const SupplierDetails = ({ supplierName, setSupplierName }) => (
  <div className="section">
    <div className="section-title">Supplier Details</div>
    <div className="supplier-details-row">
      <div className="field">
        <label>Supplier Name</label>
        <input
          className="field-supplier"
          type="text"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="Enter Supplier Name"
        />
      </div>
    </div>
  </div>
);

export default SupplierDetails;
