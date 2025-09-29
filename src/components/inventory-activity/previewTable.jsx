// PreviewTable.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import EditCountModal from "./editModal";
import "./previewTable.css";

const PreviewTable = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    axios
      .get(`${baseUrl}/inventory-count/v1/filtered`)
      .then((res) => setRows(res.data))
      .catch((err) => {
        console.error("Failed to fetch count transactions", err);
        setError("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  if (loading) return <div className="preview-loading">Loading…</div>;
  if (error) return <div className="preview-error">{error}</div>;

  const selectedRows = rows
  .filter((r) => selected.has(r.id))
  .map((r) => ({
    ...r,
    itemBatchId: r.itemBatches?.[0]?.id || null, 
  }));

  return (
    <>
      <div className="preview-container">
        <div className="preview-header">
          <button
            className="preview-edit-btn"
            onClick={() => setEditOpen(true)}
            disabled={selected.size === 0}
          >
            Edit
          </button>
        </div>

        <table className="preview-count-table">
          <thead>
            <tr>
              <th>Select</th>
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
              <th>Condition</th> {/* ✅ New column */}
              <th>Date Received</th> {/* ✅ New column */}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const itemName = `${r.thickness} ملم ${r.itemVariantName}`;
              let dimension = `${r.length}×${r.width}`;
              if (r.itemVariantType === "box") {
                dimension += `-0${r.sheetsPerBox}`;
              }

              const firstBatch = r.itemBatches?.[0] || {};

              return (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </td>
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
                  <td>{firstBatch.condition || "-"}</td> {/* ✅ New value */}
                  <td>{firstBatch.dateReceived || "-"}</td> {/* ✅ New value */}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <EditCountModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          initialRows={selectedRows}
        />
      )}
    </>
  );
};

export default PreviewTable;
