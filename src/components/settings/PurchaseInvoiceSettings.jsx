import React, { useEffect, useState } from "react";
import axios from "axios";
import NotificationModal from "../recievables/NotificationModal";
import "./styles/PurchaseinvoiceSettings.css";

const PurchaseInvoiceSettings = () => {
  const [accounts, setAccounts] = useState([]);
  const [rows, setRows] = useState([]);
  const [notification, setNotification] = useState({
    show: false,
    type: "",
    message: "",
  });
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // Fetch accounts and existing settings on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsRes, settingsRes] = await Promise.all([
          axios.get(`${baseUrl}/accounts/v1/acc-flat-arranged`),
          axios.get(`${baseUrl}/purchase-invoice-setting`),
        ]);

        setAccounts(accountsRes.data);

        const formattedSettings = settingsRes.data.map((item) => ({
          ...item,
          isNew: false,
        }));

        setRows(formattedSettings);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };

    fetchData();
  }, []);

  const renderAccountOptions = (accounts, level = 0) =>
    accounts.map((acc) => (
      <React.Fragment key={acc.id}>
        <option value={acc.id} data-account-number={acc.accountNumber}>
          {`${acc.accountNumber} - ${acc.accountName}`}
        </option>
        {acc.children?.length > 0 &&
          renderAccountOptions(acc.children, level + 1)}
      </React.Fragment>
    ));

  const handleChange = (e, index) => {
    const { name, value, type, checked } = e.target;
    const updated = [...rows];
    updated[index][name] = type === "checkbox" ? checked : value;
    updated[index].isNew = true;
    setRows(updated);
  };

  const handleAccountChange = (e, index) => {
    const selectedId = e.target.value;
    const selectedOption = e.target.selectedOptions[0];
    const selectedAccountNumber = selectedOption.getAttribute(
      "data-account-number"
    );

    const updated = [...rows];
    updated[index].accountId = parseInt(selectedId);
    updated[index].accountNumber = selectedAccountNumber;
    updated[index].isNew = true;
    setRows(updated);
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        chargeName: "",
        type: "amount",
        accountId: "",
        accountNumber: "",
        atc: false,
        shipping: false,
        value: 0,
        valueEx: 0,
        currency: "USD",
        exchangeRate: 1.0,
        isNew: true,
      },
    ]);
  };

  const handleSave = async () => {
    const newRows = rows.filter((row) => row.isNew);
    if (newRows.length === 0) {
      setNotification({
        show: true,
        type: "warning",
        message: "No new charges to save.",
      });
      return;
    }

    const sanitized = newRows.map((row) => ({
      ...row,
      value: row.value || 0,
      valueEx: row.valueEx || 0,
      exchangeRate: row.exchangeRate || 0,
    }));

    try {
      await axios.post(
        `${baseUrl}/purchase-invoice-setting`,
        sanitized
      );
      setNotification({
        show: true,
        type: "success",
        message: "New charges saved successfully!",
      });
      // Reset 'isNew' flag after successful save
      setRows((prev) => prev.map((r) => ({ ...r, isNew: false })));
    } catch (error) {
      console.error("Save failed", error);
      setNotification({
        show: true,
        type: "error",
        message: "Failed to save charges. Please try again.",
      });
    }
  };

  return (
    <div>
      <div className="settings-header-wrapper">
        <div className="settings-header">
          <h2>Purchase Invoice Charges</h2>
          <div>
            <button className="PI-add-row-button" onClick={addRow}>
              + Add Row
            </button>
            <button
              className="purchase-invoice-save-button"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>

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
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                <input
                  name="chargeName"
                  type="text"
                  placeholder="Charge Name"
                  className="charge-name-input"
                  value={row.chargeName}
                  onChange={(e) => handleChange(e, i)}
                />
              </td>
              <td>
                <select
                  name="type"
                  value={row.type}
                  onChange={(e) => handleChange(e, i)}
                >
                  <option value="amount">Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </td>
              <td>
                <select
                  className="account-dropdown"
                  onChange={(e) => handleAccountChange(e, i)}
                  defaultValue={row.accountId}
                >
                  <option value="">Select Account</option>
                  {renderAccountOptions(accounts)}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  name="atc"
                  checked={row.atc}
                  onChange={(e) => handleChange(e, i)}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  name="shipping"
                  checked={row.shipping}
                  onChange={(e) => handleChange(e, i)}
                />
              </td>
              <td>
                <input
                  name="value"
                  type="number"
                  placeholder="0.00"
                  value={row.value}
                  onChange={(e) => handleChange(e, i)}
                />
              </td>
              <td>
                <input
                  name="valueEx"
                  type="number"
                  placeholder="0.00"
                  value={row.valueEx}
                  onChange={(e) => handleChange(e, i)}
                />
              </td>
              <td>
                <select
                  name="currency"
                  value={row.currency}
                  onChange={(e) => handleChange(e, i)}
                >
                  <option value="USD">USD</option>
                  <option value="LL">LL</option>
                </select>
              </td>
              <td>
                <input
                  name="exchangeRate"
                  type="number"
                  value={row.exchangeRate}
                  onChange={(e) => handleChange(e, i)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {notification.show && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={() =>
            setNotification({ show: false, type: "", message: "" })
          }
        />
      )}
    </div>
  );
};

export default PurchaseInvoiceSettings;
