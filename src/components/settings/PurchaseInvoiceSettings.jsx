import React from "react";
import "./styles/PurchaseinvoiceSettings.css";
const PurchaseInvoiceSettings = () => {
  return (
    <div>
      <h2>Purchase Invoice Charges</h2>
      <table className="settings-table">
        <thead>
          <tr>
            <th>Charge Name</th>
            <th>Type</th>
            <th>Account Number</th>
            <th>ATC</th>
            <th>Shipping</th>
            <th>Value</th>
            <th>Value Ex</th>
            <th>Currency</th>
            <th>Exchange Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input
                type="text"
                placeholder="Charge Name"
                className="charge-name-input"
              />
            </td>
            <td>
              <select>
                <option value="amount">Amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </td>
            <td>
              <select>
                <option value="">Select Account</option>
                <option value="1001">1001 - Inventory</option>
                <option value="2001">2001 - Freight</option>
              </select>
            </td>
            <td>
              <input type="checkbox" />
            </td>
            <td>
              <input type="checkbox" />
            </td>
            <td>
              <input type="number" placeholder="0.00" />
            </td>
            <td>
              <input type="number" placeholder="0.00" />
            </td>
            <td>
              <select>
                <option value="USD">USD</option>
                <option value="LL">LL</option>
              </select>
            </td>
            <td>
              <input type="number" placeholder="1.0" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default PurchaseInvoiceSettings;
