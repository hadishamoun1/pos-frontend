import React from "react";
import "./inventory-activity.css";

const InventoryActivityPage = () => {
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
                <th>SQ M</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Date</th>
                <th>Invoice #</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <input
                    type="text"
                    className="inventory-activity-input"
                    placeholder="e.g. Widget A"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="inventory-activity-input"
                    placeholder="e.g. 10×20×5"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="inventory-activity-input"
                    placeholder="e.g. Acme"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="inventory-activity-input"
                    placeholder="0"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="inventory-activity-input"
                    placeholder="0.00"
                    step="0.01"
                  />
                </td>
                <td>
                  <select className="inventory-activity-select">
                    <option value="">Unit</option>
                    <option value="pcs">Sheet</option>
                    <option value="box">Box</option>
                    <option value="kg">SQM</option>
                  </select>
                </td>
                <td>
                  <select className="inventory-activity-select">
                    <option value="">Status</option>
                    <option value="in-stock">Sales</option>
                    <option value="out-stock">Purchase</option>
                    <option value="reserved">Counted</option>
                  </select>
                </td>
                <td>
                  <input type="date" className="inventory-activity-date" />
                </td>
                <td>
                  <select className="inventory-activity-select">
                    <option value="">Select invoice</option>
                    <option value="INV-001">INV-001</option>
                    <option value="INV-002">INV-002</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryActivityPage;
