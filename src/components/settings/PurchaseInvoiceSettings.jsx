import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles/PurchaseinvoiceSettings.css";

const PurchaseInvoiceSettings = () => {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:3000/accounts/v1/acc-flat-arranged")
      .then((res) => {
        setAccounts(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch accounts", err);
      });
  }, []);

  // ✅ Recursively render accounts with indentation
  const renderAccountOptions = (accounts, level = 0) => {
    return accounts.map((acc) => (
      <React.Fragment key={acc.id}>
        <option value={acc.id}>
          {`${acc.accountNumber} - ${acc.accountName}`}
        </option>
        {acc.children &&
          acc.children.length > 0 &&
          renderAccountOptions(acc.children, level + 1)}
      </React.Fragment>
    ));
  };

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
              <select className="account-dropdown">
                <option value="">Select Account</option>
                {renderAccountOptions(accounts)}
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
