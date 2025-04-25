import React from "react";

const SupplierInput = ({
  supplierName,
  onSupplierNameChange, // ✅ controlled input
  filteredSuppliers,
  showSupplierSuggestions,
  setShowSupplierSuggestions,
  setSelectedSupplierId,
}) => {
  return (
    <label style={{ position: "relative", width: "100%" }}>
      Supplier Name
      <input
        type="text"
        value={supplierName}
        onChange={onSupplierNameChange} // ✅ dynamic suggestions
        onFocus={() => setShowSupplierSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 100)} // short delay to allow click
        placeholder="Search supplier"
        className="supplier-input"
      />
      {showSupplierSuggestions && filteredSuppliers.length > 0 && (
        <div className="suggestions-box">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="suggestion-item"
              onMouseDown={() => {
                setSelectedSupplierId(supplier.id);
                onSupplierNameChange({
                  target: { value: supplier.supplierName },
                });
                setShowSupplierSuggestions(false);
              }}
            >
              {supplier.supplierName}
            </div>
          ))}
        </div>
      )}
    </label>
  );
};

export default SupplierInput;
