// src/components/CountModal.jsx
import React from "react";
import "./countModal.css";

const CountModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="count-modal-overlay" onClick={onClose}>
      <div className="count-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="count-modal-close" onClick={onClose}>
          ×
        </button>
        <h2>Count Inventory</h2>
        <p>Implement your counting workflow here.</p>
        {/* TODO: add your inputs, buttons, etc. */}
      </div>
    </div>
  );
};

export default CountModal;
