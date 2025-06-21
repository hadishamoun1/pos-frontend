import React, { useState } from "react";
import "./inventoryDataEntry.css";

const DateCountInput = ({ onSave, onCancel }) => {
  const [entries, setEntries] = useState([{ count: "", receivedDate: "" }]);

  const handleChange = (index, field, value) => {
    const updated = [...entries];
    updated[index][field] = field === "count" ? Number(value) : value;
    setEntries(updated);
  };

  const addRow = () => {
    setEntries([...entries, { count: "", receivedDate: "" }]); // ✅
  };

  const removeRow = (index) => {
    if (entries.length > 1) {
      const updated = entries.filter((_, i) => i !== index);
      setEntries(updated);
    }
  };

  const handleSave = () => {
    const payload = entries.map(({ count, receivedDate }) => ({
      count: Number(count),
      receivedDate: receivedDate === "" ? null : receivedDate,
    }));

    onSave(payload);
  };

  return (
    <div className="inventory-date-table-container">
      <h3>Distribute Quantity by Date Received</h3>
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Count</th>
            <th>Date Received (Optional)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={index}>
              <td>
                <input
                  type="number"
                  value={entry.count}
                  onChange={(e) => handleChange(index, "count", e.target.value)}
                  placeholder="Enter count"
                  required
                />
              </td>
              <td>
                <input
                  type="month"
                  value={entry.receivedDate}
                  onChange={(e) =>
                    handleChange(index, "receivedDate", e.target.value)
                  }
                />
              </td>
              <td>
                <button
                  onClick={() => removeRow(index)}
                  className="remove-btn"
                  title="Remove Row"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inventory-actions">
        <button onClick={addRow} className="add-row-btn">
          + Add Row
        </button>
        <div className="inventory-actions">
          <button onClick={handleSave} className="save-btn">
            Save
          </button>
          <button onClick={onCancel} className="cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateCountInput;
