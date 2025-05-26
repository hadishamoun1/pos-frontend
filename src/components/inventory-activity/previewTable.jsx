// PreviewTable.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./previewTable.css";

const PreviewTable = ({ onEdit }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:3000/inventory-count/v1/filtered")
      .then((res) => {
        setRows(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch count transactions", err);
        setError("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="preview-loading">Loading…</div>;
  if (error) return <div className="preview-error">{error}</div>;

  return (
    <div className="preview-container">
      <div className="preview-header">
        <button className="preview-edit-btn" onClick={onEdit}>
          Edit
        </button>
      </div>

      <table className="preview-count-table">
        <thead>
          <tr>
            <th className="count-preview-itemname">Item Name</th>
            <th>Dimensions</th>
            <th>Origin</th>
            <th>Unit</th>
            <th>Date</th>
            <th>Count</th>
            <th>SQM</th>
            <th>Type</th>
            <th>Final Cost</th>
            <th>Final OFR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // Build Item Name as "thickness itemVariantName"
            const itemName = `${r.thickness} ${r.itemVariantName}`;

            // Build dimensions
            let dimension = `${r.length}×${r.width}`;
            if (r.itemVariantType === "box") {
              dimension += `-0${r.sheetsPerBox}`;
            }

            return (
              <tr key={r.id}>
                <td className="count-preview-itemname">{itemName}</td>
                <td>{dimension}</td>
                <td>{r.origin}</td>
                <td>{r.itemVariantType}</td>
                <td>{r.date}</td>
                <td>{r.count}</td>
                <td>{r.sqm}</td>
                <td>{r.type}</td>
                <td>{r.finalCost != null ? r.finalCost : "-"}</td>
                <td>{r.finalCostOfr != null ? r.finalCostOfr : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PreviewTable;
