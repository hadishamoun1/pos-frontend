import React, { useState } from "react";
import "./countModal.css";

const CountModal = ({ isOpen, onClose }) => {
  const [rows, setRows] = useState([
    { name: "", dimension: "", unit: "", date: "", count: "" },
  ]);

  if (!isOpen) return null;

  const addRow = () =>
    setRows([
      ...rows,
      { name: "", dimension: "", unit: "", date: "", count: "" },
    ]);

  const resetAll = () =>
    setRows([{ name: "", dimension: "", unit: "", date: "", count: "" }]);

  const handleSave = () => {
    console.log("Saving rows:", rows);
    onClose();
  };

  const updateCell = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
  };

  return (
    <div className="count-modal-overlay" onClick={onClose}>
      <div className="count-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="count-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="count-modal-header">
          <h2>Count Inventory</h2>
          <div className="header-buttons">
            <button className="count-modal-btn reset-btn" onClick={resetAll}>
              Reset
            </button>
            <button className="count-modal-btn save-btn" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>

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
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="text"
                      className="count-input"
                      value={r.name}
                      onChange={(e) => updateCell(i, "name", e.target.value)}
                      placeholder="Enter item name"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="count-input"
                      value={r.dimension}
                      onChange={(e) =>
                        updateCell(i, "dimension", e.target.value)
                      }
                      placeholder="e.g. 225×321-10"
                    />
                  </td>
                  <td>
                    <select
                      className="count-input"
                      value={r.unit}
                      onChange={(e) => updateCell(i, "unit", e.target.value)}
                    >
                      <option value="">Select unit</option>
                      <option value="box">Box</option>
                      <option value="sheet">Sheet</option>
                      <option value="sqm">SQM</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      className="count-input"
                      value={r.date}
                      onChange={(e) => updateCell(i, "date", e.target.value)}
                    />
                  </td>
                  <td className="count-col">
                    <input
                      type="number"
                      className="count-input"
                      value={r.count}
                      onChange={(e) => updateCell(i, "count", e.target.value)}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="count-modal-add-row" onClick={addRow}>
          + Add Row
        </button>
      </div>
    </div>
  );
};

export default CountModal;
