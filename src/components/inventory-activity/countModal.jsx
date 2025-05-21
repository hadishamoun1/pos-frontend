import React from "react";
import "./countModal.css";

const CountModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="count-modal-overlay" onClick={onClose}>
      <div className="count-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="count-modal-close" onClick={onClose}>
          &times;
        </button>
        <h2>Count Inventory</h2>

        <div className="count-modal-table-wrapper">
          <table className="count-modal-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Dimension</th>
                <th>Unit</th>
                <th>Date</th>
                <th className="count-col">Count</th>
              </tr>
            </thead>
            <tbody>
              {/* replace this single row with a .map(...) when you hook up real data */}
              <tr>
                <td>
                  <input
                    type="text"
                    className="count-input"
                    placeholder="Enter item name"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="count-input"
                    placeholder="e.g. 225×321-10"
                  />
                </td>
                <td>
                  <select className="count-input">
                    <option value="">Select unit</option>
                    <option value="box">Box</option>
                    <option value="sheet">Sheet</option>
                    <option value="sqm">SQM</option>
                  </select>
                </td>
                <td>
                  <input type="date" className="count-input" />
                </td>
                <td>
                  <input type="number" className="count-col" placeholder="0" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CountModal;
