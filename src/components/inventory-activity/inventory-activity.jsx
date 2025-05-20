import React, { useState, useEffect } from "react";
import "./inventory-activity.css";

const InventoryActivityPage = () => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/inventory-transactions/activity")
      .then((res) => res.json())
      .then(setRows)
      .catch(console.error);
  }, []);

  return (
    <div className="inventory-activity-page">
      {/* — Page-level title, pinned above the container */}
      <h1 className="inventory-activity-page-title">Inventory Activity</h1>

      <div className="inventory-activity-container">
        <div className="inventory-activity-header">
          <button className="inventory-activity-btn-add">Add Row</button>
        </div>

        <div className="inventory-activity-table-wrapper">
          <table className="inventory-activity-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Dimensions</th>
                <th>Brand</th>
                <th>Quantity</th>
                <th>SQM</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Date</th>
                <th>Invoice #</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const name = `${r.thickness} ملم ${r.itemName}`;
                const dimension =
                  r.itemType === "box" && r.sheetsPerBox
                    ? `${r.length}×${r.width}-0${r.sheetsPerBox}`
                    : `${r.length}×${r.width}`;
                const unit =
                  r.itemType === "box"
                    ? "Box"
                    : r.itemType === "sheet"
                    ? "Sheet"
                    : "SQM";
                const status =
                  r.transactionType === "purchase" ? "Purchase" : "-";
                const date = new Date(r.invoiceDate).toLocaleDateString();
                const invoiceNo = r.invoiceNumber || "—";

                return (
                  <tr key={i}>
                    <td>{name}</td>
                    <td>{dimension}</td>
                    <td>{r.origin}</td>
                    <td>{r.quantity}</td>
                    <td>{r.sqm.toFixed(2)}</td>
                    <td>{unit}</td>
                    <td>{status}</td>
                    <td>{date}</td>
                    <td>{invoiceNo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryActivityPage;
