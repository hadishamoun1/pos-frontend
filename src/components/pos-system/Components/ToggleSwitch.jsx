import React from "react";
import "./ToggleSwitch.css";

const ToggleSwitch = ({ showOnlyCenter, setShowOnlyCenter }) => {
  return (
    <div className="toggle-switch-container">
      <label className="switch">
        <input
          type="checkbox"
          checked={showOnlyCenter}
          onChange={() => setShowOnlyCenter(!showOnlyCenter)}
        />
        <span className="slider round"></span>
      </label>
    
    </div>
  );
};

export default ToggleSwitch;
