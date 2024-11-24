import React, { useState, useEffect } from "react";

const SupplierDetails = ({
  supplierName,
  setSupplierName,
  resetAllFields,
  handleSave,
  setSupplierId, // Add a setter for supplier ID
}) => {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Default to today's date
  });
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);

  // Fetch suppliers from the API
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await fetch("http://localhost:3000/suppliers"); // Replace with your API endpoint
        const data = await response.json();
        setSuppliers(data);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };

    fetchSuppliers();
  }, []);

  // Filter suppliers based on input
  useEffect(() => {
    if (supplierName) {
      const filtered = suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(supplierName.toLowerCase())
      );
      setFilteredSuppliers(filtered);
    } else {
      setFilteredSuppliers([]);
    }
  }, [supplierName, suppliers]);

  const handleSupplierSelect = (supplier) => {
    setSupplierName(supplier.name); // Set the selected supplier's name
    setSupplierId(supplier.id); // Set the selected supplier's ID
    setFilteredSuppliers([]); // Clear the suggestions
  };

  const resetFields = () => {
    setSupplierName("");
    setDate(() => {
      const today = new Date();
      return today.toISOString().split("T")[0];
    });
    setFilteredSuppliers([]);

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
          {filteredSuppliers.length > 0 && (
            <ul className="supplier-suggestions">
              {filteredSuppliers.map((supplier) => (
                <li
                  key={supplier.id}
                  onClick={() => handleSupplierSelect(supplier)}
                  className="supplier-suggestion-item"
                >
                  {supplier.name}
                </li>
              ))}
            </ul>
          )}
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
