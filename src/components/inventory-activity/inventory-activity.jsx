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
        <div className="inventory-activity-table-wrapper">
          <table className="inventory-activity-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Dimensions</th>
                <th>Brand</th>
                <th>Quantity</th>
                <th>Qty OFR</th>
                <th>SQM</th>
                <th>SQM OFR</th>
                <th>Final Cost</th>
                <th>Final OFR</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Date</th>
                <th>Invoice #</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                // 1️⃣ Name: "<thickness> ملم <itemName>"
                const name = `${r.thickness} ملم ${r.itemName}`;

                // 2️⃣ Dimensions: "L×W[-sheetsPerBox]"
                const dimension =
                  r.itemType === "box" && r.sheetsPerBox
                    ? `${r.length}×${r.width}-0${r.sheetsPerBox}`
                    : `${r.length}×${r.width}`;

                // 3️⃣ Unit label
                const unit =
                  r.itemType === "box"
                    ? "Box"
                    : r.itemType === "sheet"
                    ? "Sheet"
                    : "SQM";

                // 4️⃣ Status label
                const status =
                  r.transactionType === "purchase"
                    ? "Purchase"
                    : r.transactionType === "sale"
                    ? "Sales"
                    : r.transactionType || "-";

                // 5️⃣ Date formatting
                const date = new Date(r.invoiceDate).toLocaleDateString();

                // 6️⃣ Invoice #
                const invoiceNo = r.invoiceNumber || "—";

                // 7️⃣ Final costs (null → dash)
                const finalCost =
                  r.finalcost != null ? Number(r.finalcost).toFixed(2) : "—";
                const finalCostOFR =
                  r.finalcostofr != null
                    ? Number(r.finalcostofr).toFixed(2)
                    : "—";

                return (
                  <tr key={i}>
                    <td>{name}</td>
                    <td>{dimension}</td>
                    <td>{r.origin}</td>
                    <td>{r.quantity}</td>
                    <td>{r.quantityofr}</td>
                    <td>{r.sqm.toFixed(2)}</td>
                    <td>{r.sqmofr.toFixed(2)}</td>
                    <td>{finalCost}</td>
                    <td>{finalCostOFR}</td>
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
