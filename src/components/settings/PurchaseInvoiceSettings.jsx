// src/components/.../PurchaseInvoiceSettings.jsx
import React, { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient"; // ✅ adjust path if needed
import NotificationModal from "../recievables/NotificationModal";
import RecomputeCostsPanel from "./RecomputeCostsPanel"; 
import "./styles/PurchaseinvoiceSettings.css";

const PurchaseInvoiceSettings = () => {
  const [accounts, setAccounts] = useState([]);
  const [rows, setRows] = useState([]);

  const [notification, setNotification] = useState({
    show: false,
    type: "",       // "success" | "error" | "warning"
    message: "",
    mode: "info",   // "info" | "confirm"
  });

  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const [pendingDelete, setPendingDelete] = useState(null); // { index, id } | null

  // ───────────────────────── fetch data on mount ─────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsRes, settingsRes] = await Promise.all([
          axiosClient.get(`/accounts/v1/acc-flat-arranged`),
          axiosClient.get(`/purchase-invoice-setting`),
        ]);

        setAccounts(accountsRes.data || []);
        setRows((settingsRes.data || []).map((item) => ({ ...item })));
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };

    fetchData();
  }, []);

  // ───────────────────────── helpers ─────────────────────────
  const renderAccountOptions = (accountsList, level = 0) =>
    (accountsList || []).map((acc) => (
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
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index] };
      updated[index][name] = type === "checkbox" ? checked : value;
      return updated;
    });
  };

  const handleAccountChange = (e, index) => {
    const selectedId = e.target.value;
    const selectedOption = e.target.selectedOptions[0];
    const selectedAccountNumber =
      selectedOption?.getAttribute("data-account-number") || "";

    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index] };
      updated[index].accountId = selectedId ? parseInt(selectedId, 10) : null;
      updated[index].accountNumber = selectedAccountNumber;
      return updated;
    });
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
      },
    ]);
  };

  // Save only NEW rows (those without an id)
  const handleSave = async () => {
    const newRows = rows.filter((row) => !row.id);

    if (newRows.length === 0) {
      setNotification({
        show: true,
        type: "warning",
        message: "No new charges to save.",
        mode: "info",
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
      await axiosClient.post(`/purchase-invoice-setting`, sanitized);
      setNotification({
        show: true,
        type: "success",
        message: "New charges saved successfully!",
        mode: "info",
      });
    } catch (error) {
      console.error("Save failed", error);
      setNotification({
        show: true,
        type: "error",
        message: "Failed to save charges. Please try again.",
        mode: "info",
      });
    }
  };

  // ───────────────────────── delete menu (right-click) ─────────────────────────
  const openDeleteMenu = (e, rowIndex) => {
    e.preventDefault();
    setDeleteMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex });
  };

  const closeDeleteMenu = () => {
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  const handleDeleteClick = () => {
    if (deleteMenu.rowIndex == null) return;

    const row = rows[deleteMenu.rowIndex];
    setPendingDelete({ index: deleteMenu.rowIndex, id: row?.id || null });
    closeDeleteMenu();

    setNotification({
      show: true,
      type: "warning",
      message: "Are you sure you want to delete this charge?",
      mode: "confirm",
    });
  };

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, show: false }));
    setPendingDelete(null);
  };

  const handleNotificationConfirm = async () => {
    if (notification.mode !== "confirm") {
      handleNotificationClose();
      return;
    }

    if (pendingDelete) {
      const { index, id } = pendingDelete;
      try {
        if (id) {
          await axiosClient.delete(`/purchase-invoice-setting/${id}`);
        }
        setRows((prev) => prev.filter((_, i) => i !== index));
        setNotification({
          show: true,
          type: "success",
          message: "Charge deleted successfully.",
          mode: "info",
        });
      } catch (error) {
        console.error("Delete failed", error);
        setNotification({
          show: true,
          type: "error",
          message: "Failed to delete charge.",
          mode: "info",
        });
      } finally {
        setPendingDelete(null);
      }
      return;
    }

    handleNotificationClose();
  };

  return (
    <div
      className="purchase-invoice-settings-container"
      onClick={closeDeleteMenu}
    >

      {/* ✅ Recompute panel — full live progress UI, replaces old date+button approach */}
      <div style={{ marginBottom: 24 }}>
        <RecomputeCostsPanel />
      </div>

      <div className="purchase-invoice-settings-header-wrapper">
        <div className="purchase-invoice-settings-header">
          <h2>Purchase Invoice Charges</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="purchase-invoice-settings-add-row-button"
              onClick={addRow}
            >
              + Add Row
            </button>
            <button
              className="purchase-invoice-settings-save-button"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="purchase-invoice-settings-table-wrapper">
        <table className="purchase-invoice-settings-table">
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
              <tr
                key={row.id || `new-${i}`}
                onContextMenu={(e) => openDeleteMenu(e, i)}
                className="purchase-invoice-settings-row"
              >
                <td>
                  <input
                    name="chargeName"
                    type="text"
                    placeholder="Charge Name"
                    className="purchase-invoice-settings-charge-name-input"
                    value={row.chargeName || ""}
                    onChange={(e) => handleChange(e, i)}
                  />
                </td>
                <td>
                  <select
                    name="type"
                    value={row.type || "amount"}
                    onChange={(e) => handleChange(e, i)}
                  >
                    <option value="amount">Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </td>
                <td>
                  <select
                    className="purchase-invoice-settings-account-dropdown"
                    onChange={(e) => handleAccountChange(e, i)}
                    value={row.accountId || ""}
                  >
                    <option value="">Select Account</option>
                    {renderAccountOptions(accounts)}
                  </select>
                </td>
                <td className="purchase-invoice-settings-checkbox-cell">
                  <input
                    type="checkbox"
                    name="atc"
                    checked={!!row.atc}
                    onChange={(e) => handleChange(e, i)}
                  />
                </td>
                <td className="purchase-invoice-settings-checkbox-cell">
                  <input
                    type="checkbox"
                    name="shipping"
                    checked={!!row.shipping}
                    onChange={(e) => handleChange(e, i)}
                  />
                </td>
                <td>
                  <input
                    name="value"
                    type="number"
                    placeholder="0.00"
                    value={row.value ?? 0}
                    onChange={(e) => handleChange(e, i)}
                  />
                </td>
                <td>
                  <input
                    name="valueEx"
                    type="number"
                    placeholder="0.00"
                    value={row.valueEx ?? 0}
                    onChange={(e) => handleChange(e, i)}
                  />
                </td>
                <td>
                  <select
                    name="currency"
                    value={row.currency || "USD"}
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
                    value={row.exchangeRate ?? 0}
                    onChange={(e) => handleChange(e, i)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Right-click context menu */}
      {deleteMenu.visible && (
        <div
          className="purchase-invoice-settings-context-menu"
          style={{ top: deleteMenu.y, left: deleteMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleDeleteClick}>Delete Row</button>
        </div>
      )}

      {/* Notification / Confirm modal */}
      {notification.show && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={handleNotificationClose}
          onConfirm={
            notification.mode === "confirm"
              ? handleNotificationConfirm
              : handleNotificationClose
          }
          cancelLabel={notification.mode === "confirm" ? "No" : null}
          confirmLabel={notification.mode === "confirm" ? "Yes" : "OK"}
        />
      )}
    </div>
  );
};

export default PurchaseInvoiceSettings;