import React from "react";

const SupplierInput = ({
  supplierName,
  setSupplierName,
  filteredSuppliers,
  showSupplierSuggestions,
  setShowSupplierSuggestions,
}) => {
  return (
    <label style={{ position: "relative" }}>
      Supplier Name
      <input
        type="text"
        value={supplierName}
        onChange={(e) => {
          setSupplierName(e.target.value);
          setShowSupplierSuggestions(true);
        }}
        onFocus={() => setShowSupplierSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 100)}
        placeholder="Enter supplier name"
      />
      {showSupplierSuggestions && filteredSuppliers.length > 0 && (
        <div className="suggestions-box">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="suggestion-item"
              onMouseDown={() => {
                setSupplierName(supplier.name);
                setShowSupplierSuggestions(false);
              }}
            >
              {supplier.name}
            </div>
          ))}
        </div>
      )}
    </label>
  );
};

export default SupplierInput;
