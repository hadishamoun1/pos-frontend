import React, { useState, useEffect } from "react";
import CountModal from "./countModal";
import "./inventory-activity.css";

const InventoryActivityPage = () => {
  const [rows, setRows] = useState([]);
  const [showCountModal, setShowCountModal] = useState(false);

  useEffect(() => {
    fetch("http://localhost:3000/inventory-transactions/activity")
      .then((res) => res.json())
      .then(setRows)
      .catch(console.error);
  }, []);

  return (
    <div className="inventory-activity-page">
      <div className="inventory-activity-header-bar">
        <h1 className="inventory-activity-title">Inventory Activity</h1>
        <button
          className="inventory-activity-btn-count"
          onClick={() => setShowCountModal(true)}
        >
          Count
        </button>
      </div>

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
                <th>Final Cost OFR</th>
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
                  r.transactionType === "purchase"
                    ? "Purchase"
                    : r.transactionType === "sale"
                    ? "Sales"
                    : r.transactionType || "-";
                const date = new Date(r.invoiceDate).toLocaleDateString();
                const invoiceNo = r.invoiceNumber || "—";
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

      <CountModal
        isOpen={showCountModal}
        onClose={() => setShowCountModal(false)}
      />
    </div>
  );
};

export default InventoryActivityPage;
