import React, { useState } from "react";

const SupplierDetails = ({ supplierName, setSupplierName, resetAllFields }) => {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Default to today's date
  });

  const resetFields = () => {
    setSupplierName("");
    setDate(() => {
      const today = new Date();
      return today.toISOString().split("T")[0];
    });

    // Call the resetAllFields to reset other sections
    if (resetAllFields) {
      resetAllFields();
    }
  };

  return (
    <div className="section">
      <div className="section-header">
        <h3 className="section-title">Supplier Details</h3>
        <button className="reset-button" onClick={resetFields}>
          New
        </button>
      </div>
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
        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default SupplierDetails;
