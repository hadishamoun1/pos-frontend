// UnitPriceModal.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles/unitPriceModel.css";

export default function UnitPriceModal({
  isVisible,
  onClose,
  onSave,
  isEditable,
  invoiceId, // ← optional for edit
}) {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // delete‐menu state
  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  // Close delete menu
  const closeDeleteMenu = () =>
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });

  // Right-click handler for delete
  const handleRowContext = (e, index) => {
    e.preventDefault();
    if (!isEditable) return;
    setDeleteMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      rowIndex: index,
    });
  };

  // Delete one row
  const handleDeleteRow = () => {
    if (deleteMenu.rowIndex == null) return;
    setRows(rows.filter((_, i) => i !== deleteMenu.rowIndex));
    closeDeleteMenu();
  };

  // Add a blank row
  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        id: undefined,
        purchaseInvoiceSettingId: null,
        chargeName: "",
        accountId: null,
        accountNumber: "",
        chargeType: "amount",
        value: 0,
        valueOFR: 0,
        currency: "usd",
        valueExch: 0,
        valueExchOFR: 0,
        addToItemCost: false,
        invoiceNbTax: "",
        supplierId: null,
        supplierOfTax: "",
        accNbOfSupplier: "",
        shipping: false,
      },
    ]);
  };

  // Fetch suppliers, accounts, and rows on open
  useEffect(() => {
    if (!isVisible) return;

    // suppliers
    axios
      .get(`${baseUrl}/suppliers`)
      .then((res) => setSuppliers(res.data))
      .catch(console.error);

    // accounts (flat, nested)
    axios
      .get(`${baseUrl}/accounts/v1/acc-flat-arranged`)
      .then((res) => setAccounts(res.data))
      .catch(console.error);

    if (invoiceId) {
      // editing → load existing rows
      axios
        .get(`${baseUrl}/purchase-invoices/${invoiceId}`)
        .then((res) => {
          setRows(
            res.data.unitPriceRows.map((r) => ({
              id: r.id,
              purchaseInvoiceSettingId: r.purchaseInvoiceSettingId,
              chargeName: r.chargeName,
              accountId: r.accountId,
              accountNumber: r.account?.accountNumber || "",
              chargeType: r.chargeType,
              value: Number(r.value),
              valueOFR: Number(r.valueOFR),
              currency: r.currency,
              valueExch: Number(r.valueExch),
              valueExchOFR: Number(r.valueExchOFR),
              addToItemCost: r.addToItemCost,
              invoiceNbTax: r.invoiceNbTax,
              supplierId: r.supplierId,
              supplierOfTax: r.supplier?.supplierName || "",
              accNbOfSupplier: r.supplier?.account?.accountNumber || "",
              shipping: r.shipping,
            }))
          );
        })
        .catch(console.error);
    } else {
      // new → load default settings
      axios
        .get(`${baseUrl}/purchase-invoice-setting`)
        .then((res) => {
          setRows(
            res.data.map((row) => ({
              id: undefined,
              purchaseInvoiceSettingId: row.id,
              chargeName: row.chargeName || "",
              accountId: row.accountId ?? null,
              accountNumber: row.accountNumber ?? "",
              chargeType: row.type || "amount",
              value: row.value || 0,
              valueOFR: 0,
              currency: (row.currency || "USD").toLowerCase(),
              valueExch: row.valueEx || 0,
              valueExchOFR: 0,
              addToItemCost: row.atc || false,
              invoiceNbTax: "",
              supplierId: null,
              supplierOfTax: "",
              accNbOfSupplier: "",
              shipping: row.shipping || false,
            }))
          );
        })
        .catch(console.error);
    }
  }, [isVisible, invoiceId]);

  // once suppliers or accounts load, fill in derived fields
  useEffect(() => {
    if (suppliers.length) {
      setRows((rs) =>
        rs.map((r) => {
          if (r.supplierId) {
            const sup = suppliers.find((s) => s.id === r.supplierId);
            return {
              ...r,
              accNbOfSupplier: sup?.supplierAccountNumber || "",
            };
          }
          return r;
        })
      );
    }
  }, [suppliers]);

  // recursively render nested account options
  const renderAccountOptions = (list, level = 0) =>
    list.map((acc) => (
      <React.Fragment key={acc.id}>
        <option value={acc.id} data-account-number={acc.accountNumber}>
          {`${"  ".repeat(level)}${acc.accountNumber} – ${acc.accountName}`}
        </option>
        {acc.children?.length > 0 &&
          renderAccountOptions(acc.children, level + 1)}
      </React.Fragment>
    ));

  // handle inputs
  const handleInput = (i, field, val) => {
    const copy = [...rows];
    copy[i][field] = field === "chargeType" ? val : +val || val;
    setRows(copy);
  };
  const handleToggle = (i, field) => {
    const copy = [...rows];
    copy[i][field] = !copy[i][field];
    setRows(copy);
  };
  const handleSupplierChange = (i, supId) => {
    const copy = [...rows];
    copy[i].supplierId = +supId;
    const sup = suppliers.find((s) => s.id === +supId);
    copy[i].accNbOfSupplier = sup?.supplierAccountNumber || "";
    setRows(copy);
  };
  const handleAccountChange = (i, acctId, e) => {
    const copy = [...rows];
    copy[i].accountId = +acctId;
    const acctNumber = e.target.selectedOptions[0].getAttribute(
      "data-account-number"
    );
    copy[i].accountNumber = acctNumber || "";
    setRows(copy);
  };

  const save = () => onSave(rows);

  if (!isVisible) return null;
  return (
    <div className="unit-price-modal-overlay" onClick={closeDeleteMenu}>
      <div
        className="unit-price-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Unit Price Details</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="unit-price-table-container">
          <table className="unit-price-table">
            <thead>
              <tr>
                <th>Charge Name</th>
                <th>Charge Account</th> {/* ← new column */}
                <th>Type</th>
                <th>Value</th>
                <th>Value OFR</th>
                <th>Currency</th>
                <th>Exch.</th>
                <th>Exch. OFR</th>
                <th>ATC</th>
                <th>Nb Tax</th>
                <th>Supplier of Tax</th>
                <th>Acc. Nb</th>
                <th>Shipping</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} onContextMenu={(e) => handleRowContext(e, i)}>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={r.chargeName}
                      onChange={(e) =>
                        handleInput(i, "chargeName", e.target.value)
                      }
                    />
                  </td>

                  {/* ——— Charge Account dropdown ——— */}
                  <td>
                    <select
                      disabled={!isEditable}
                      value={r.accountId || ""}
                      onChange={(e) =>
                        handleAccountChange(i, e.target.value, e)
                      }
                    >
                      <option value="">Select Account</option>
                      {renderAccountOptions(accounts)}
                    </select>
                  </td>

                  <td>
                    <select
                      disabled={!isEditable}
                      value={r.chargeType}
                      onChange={(e) =>
                        handleInput(i, "chargeType", e.target.value)
                      }
                    >
                      <option value="amount">Amount</option>
                      <option value="percent">Percent</option>
                    </select>
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.value}
                      onChange={(e) => handleInput(i, "value", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueOFR}
                      onChange={(e) =>
                        handleInput(i, "valueOFR", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      disabled={!isEditable}
                      value={r.currency}
                      onChange={(e) =>
                        handleInput(i, "currency", e.target.value)
                      }
                    >
                      <option value="usd">USD</option>
                      <option value="euro">Euro</option>
                      <option value="ll">LL</option>
                    </select>
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueExch}
                      onChange={(e) =>
                        handleInput(i, "valueExch", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueExchOFR}
                      onChange={(e) =>
                        handleInput(i, "valueExchOFR", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="checkbox"
                      checked={r.addToItemCost}
                      onChange={() => handleToggle(i, "addToItemCost")}
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={r.invoiceNbTax}
                      onChange={(e) =>
                        handleInput(i, "invoiceNbTax", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      disabled={!isEditable}
                      value={r.supplierId || ""}
                      onChange={(e) => handleSupplierChange(i, e.target.value)}
                    >
                      <option value="">-- select --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.supplierName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      readOnly
                      value={r.accNbOfSupplier}
                      placeholder="Acct #"
                    />
                  </td>
                  <td>
                    <input
                      disabled={!isEditable}
                      type="checkbox"
                      checked={r.shipping}
                      onChange={() => handleToggle(i, "shipping")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deleteMenu.visible && (
          <div
            className="context-menu-purchases"
            style={{
              position: "absolute",
              top: deleteMenu.y,
              left: deleteMenu.x,
              zIndex: 1000,
            }}
          >
            <button onClick={handleDeleteRow}>Delete Row</button>
          </div>
        )}

        <div className="table-actions">
          <button
            className="unit-price-add-row-button"
            disabled={!isEditable}
            onClick={handleAddRow}
          >
            + Add Row
          </button>
          <button
            className="unit-price-save-button"
            disabled={!isEditable}
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
