import React from "react";

const Header = ({ onSave, onCancel }) => (
  <header className="pricing-header">
    <button className="cancel-button" onClick={onCancel}>
      Cancel
    </button>
    <h1 className="underlined-title">Pricing Details</h1>
    <button className="save-button" onClick={onSave}>
      Save
    </button>
  </header>
);

export default Header;
