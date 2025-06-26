import React, { useState, useEffect } from "react";
import "./inventoryDataEntry.css";

const DateCountInput = ({
  onSave,
  onCancel,
  unit,
  length,
  width,
  sheetsPerBox,
  originalBalance,
  itemName,
  thickness,
}) => {
  const [entries, setEntries] = useState([
    { count: "", receivedDate: "", status: "adj+" },
  ]);
  const [calculatedCountSQM, setCalculatedCountSQM] = useState(0);
  const [disableSave, setDisableSave] = useState(false);
  const itemLabel = `${length}*${width}-${sheetsPerBox
    ?.toString()
    .padStart(3, "0")} ${thickness}ملم ${itemName}`;

  const len = Number(length) / 100; // Convert cm to meters
  const wid = Number(width) / 100;
  const sheets = Number(sheetsPerBox);
  const lowerUnit = unit?.toLowerCase();

  let totalSQM = 0;
  let calculatedQty = 0;

  for (const e of entries) {
    const count = Number(e.count);
    if (isNaN(count)) continue;

    calculatedQty += count;

    if (lowerUnit === "box") {
      totalSQM += count * len * wid * sheets;
    } else if (lowerUnit === "sheet") {
      totalSQM += count * len * wid;
    } else if (lowerUnit === "sqm") {
      totalSQM += count;
    }
  }

  const sqmPerUnit =
    lowerUnit === "box"
      ? len * wid * sheets
      : lowerUnit === "sheet"
      ? len * wid
      : 1;

  const originalQty =
    sqmPerUnit === 0
      ? 0
      : Math.round((originalBalance / sqmPerUnit) * 100) / 100;

  const remainingQty = Math.round((originalQty - calculatedQty) * 100) / 100;
  const remainingSQM = Math.round((originalBalance - totalSQM) * 100) / 100;

  useEffect(() => {
    setCalculatedCountSQM(Math.round(totalSQM * 100) / 100);
    setDisableSave(calculatedQty > originalQty || remainingQty !== 0);
  }, [entries]);

  const handleChange = (index, field, value) => {
    const updated = [...entries];
    updated[index][field] = field === "count" ? Number(value) : value;
    setEntries(updated);
  };

  const addRow = () => {
    setEntries([...entries, { count: "", receivedDate: "", status: "adj+" }]);
  };

  const removeRow = (index) => {
    if (entries.length > 1) {
      const updated = entries.filter((_, i) => i !== index);
      setEntries(updated);
    }
  };

  const handleSave = () => {
    if (disableSave) return;

    const payload = entries.map(({ count, receivedDate, status }) => ({
      count: Number(count),
      receivedDate: receivedDate === "" ? null : receivedDate,
      status,
    }));
    onSave(payload);
  };

  const getItemLabel = () => {
    const len = length?.toString();
    const wid = width?.toString();
    const thick = `${thickness}ملم`;
    const name = itemName;

    if (unit?.toLowerCase() === "box") {
      const sheets = sheetsPerBox?.toString().padStart(3, "0");
      return `${len}*${wid}-${sheets} ${thick} ${name}`;
    } else {
      return `${len}*${wid} ${thick} ${name}`;
    }
  };

  return (
    <div className="inventory-date-table-container">
      <h3>
        <span className="inventory-date-table-title">
          Distribute Quantity by Date Received
        </span>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            fontSize: "1.1rem",
            fontWeight: "500",
          }}
        >
          <div className="item-dimensions">
            {unit?.toLowerCase() === "box"
              ? `${length}*${width}-${sheetsPerBox
                  ?.toString()
                  .padStart(3, "0")}`
              : `${length}*${width}`}
          </div>
          <div
            className="item-name-thickness"
            style={{ direction: "rtl", textAlign: "right" }}
          >
            {`${thickness}ملم ${itemName}`}
          </div>
        </div>
      </h3>

      <table className="inventory-table">
        <thead>
          <tr>
            <th>Count</th>
            <th>Date Received (Optional)</th>
            <th>Status</th>
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
              <td className="status-col">
                <select
                  value={entry.status}
                  onChange={(e) =>
                    handleChange(index, "status", e.target.value)
                  }
                >
                  <option value="adj+">adj+</option>
                  <option value="adj-">adj-</option>
                  <option value="breakage">breakage</option>
                </select>
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

      <div className="inventory-summary dual-summary">
        <div className="summary-column">
          <p>
            <strong>Original Balance (sqm):</strong> {originalBalance}
          </p>
          <p>
            <strong>Calculated Count (sqm):</strong> {calculatedCountSQM}
          </p>
          <p>
            <strong>Remaining Balance (sqm):</strong>{" "}
            <span style={{ color: remainingSQM < 0 ? "red" : "inherit" }}>
              {remainingSQM}
            </span>
          </p>
        </div>

        <div className="summary-column">
          <p>
            <strong>Original Balance (qty):</strong> {originalQty}
          </p>
          <p>
            <strong>Calculated Count (qty):</strong>{" "}
            <span
              style={{ color: calculatedQty > originalQty ? "red" : "inherit" }}
            >
              {calculatedQty}
            </span>
          </p>
          <p>
            <strong>Remaining Balance (qty):</strong>{" "}
            <span style={{ color: remainingQty < 0 ? "red" : "inherit" }}>
              {remainingQty}
            </span>
          </p>
        </div>
      </div>

      <div className="inventory-actions-wrapper">
        {disableSave && (
          <p className="inventory-warning-msg">
            ⚠️ Cannot save:
            {calculatedQty > originalQty
              ? " Count exceeds original quantity."
              : remainingQty !== 0 || remainingSQM !== 0
              ? " You must fully allocate the balance before saving."
              : ""}
          </p>
        )}

        <div className="inventory-actions">
          <button onClick={addRow} className="add-row-btn">
            + Add Row
          </button>
          <div className="inventory-actions">
            <button
              onClick={handleSave}
              className="save-btn"
              disabled={disableSave}
              style={{
                opacity: disableSave ? 0.6 : 1,
                cursor: disableSave ? "not-allowed" : "pointer",
              }}
            >
              Save
            </button>
            <button onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateCountInput;
