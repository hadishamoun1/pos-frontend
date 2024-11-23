import React, { useState } from "react";

const SupplierDetails = ({
  supplierName,
  setSupplierName,
  resetAllFields,
  handleSave, // Add a save handler prop
}) => {
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

    if (resetAllFields) {
      resetAllFields();
    }
  };

  return (
    <div className="section">
      <div className="section-header">
        <h3 className="section-title">Supplier Details</h3>
        <div className="button-group">
          <button className="reset-button" onClick={resetFields}>
            New
          </button>
          <button className="save-button" onClick={handleSave}>
            Save
          </button>
        </div>
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
