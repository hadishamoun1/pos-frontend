import React, { useState } from "react";
import "./styles/unitPriceModal.css";

const UnitPriceModal = ({ isVisible, onClose, item, onSave }) => {
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice || "");

  if (!isVisible) return null;

  const handleSave = () => {
    if (unitPrice > 0) {
      onSave(unitPrice);
      onClose();
    } else {
      alert("Please enter a valid unit price.");
    }
  };

  return (
    <div className="unit-price-modal-overlay">
      <div className="unit-price-modal-content">
        <h3>Set Unit Price</h3>
        <div className="modal-body">
          <label>
            Unit Price:
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              placeholder="Enter unit price"
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="save-button" onClick={handleSave}>
            Save
          </button>
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitPriceModal;
