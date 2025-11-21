import React, { useState, useRef } from "react";
import axios from "axios";
import TransferSearchModal from "./transferSearchModal";
import PreviewTransferTable from "./previewTransferTable";
import NotificationModal from "../recievables/NotificationModal";
import "./transferModal.css";

const baseUrl = process.env.REACT_APP_API_BASE_URL;
const TYPE_OPTIONS = ["G"];
const LOCATION_OPTIONS = [
  "JF",
  "FJ",
  "BOSTS",
  "STBOS",
  "Breakage",
  "Adjustment +",
  "Adjustment -",
  "Defects",
];

export default function TransferModal({ isOpen, onClose }) {
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState({
    transferNumber: "",
    date: new Date().toISOString().slice(0, 10),
    type: TYPE_OPTIONS[0],
    location: LOCATION_OPTIONS[0],
  });
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // ✅ Extra modal for FJ target box selection
  const [boxSearchOpen, setBoxSearchOpen] = useState(false);
  const [boxTargetRowIndex, setBoxTargetRowIndex] = useState(null);

  const [notif, setNotif] = useState({
    open: false,
    type: "",
    message: "",
  });
  const wrapperRef = useRef();

  if (!isOpen) return null;

  const resetAll = () => {
    setDetails({
      transferNumber: "",
      date: new Date().toISOString().slice(0, 10),
      type: TYPE_OPTIONS[0],
      location: LOCATION_OPTIONS[0],
    });
    setRows([]);
    setPreviewing(false);
  };

  const handleDetailChange = (e) => {
    setDetails((d) => ({ ...d, [e.target.name]: e.target.value }));
  };

  const handleSelectItems = (items) => {
    const mapped = items.map((i) => ({
      itemBatchId: i.batchId,
      itemVariantId: i.itemVariantId, // keep in case needed
      name: `${i.thickness} ملم ${i.itemName}`,
      origin: i.origin,
      type: i.itemVariantType,
      length: i.length,
      width: i.width,
      sheetsPerBox: i.sheetsPerBox,
      condition: i.condition,
      dateReceived: i.dateReceived,
      balanceOFR: i.balanceOFR,
      quantity: 0,
      sqm: 0,
      price: 0,
      // FJ target box info
      toItemVariantId: null,
      toBoxLabel: "",
      toSheetsPerBox: null,
    }));
    setRows((prev) => [...prev, ...mapped]);
    setSearchOpen(false);
  };

  const getDimensionDisplay = (row) => {
    const len = Math.floor(row.length);
    const wid = Math.floor(row.width);
    if (row.type === "box") return `${len}x${wid}-${row.sheetsPerBox}`;
    if (row.type === "sheet") return `${len}x${wid}`;
    return `0x0`;
  };

  const updateRowField = (idx, field, value) =>
    setRows((rs) => {
      const copy = [...rs];
      const row = { ...copy[idx], [field]: value };

      const len = parseFloat(row.length) || 0;
      const wid = parseFloat(row.width) || 0;
      const m2 = (len / 100) * (wid / 100);
      const qty = parseFloat(row.quantity) || 0;

      if (field === "quantity") {
        // ✅ Special case for FJ: quantity = number of boxes,
        // and sqm is based on chosen BOX's sheetsPerBox
        if (details.location === "FJ" && row.type === "sheet") {
          if (row.toSheetsPerBox) {
            row.sqm = (m2 * row.toSheetsPerBox * qty).toFixed(2);
          } else {
            // user didn't choose a box yet
            row.sqm = "";
          }
        } else {
          // normal behavior for all other locations
          if (row.type === "box") {
            row.sqm = (m2 * row.sheetsPerBox * qty).toFixed(2);
          } else if (row.type === "sheet") {
            row.sqm = (m2 * qty).toFixed(2);
          } else if (row.type === "sqm") {
            row.sqm = qty.toFixed(2);
          }
        }
      }

      copy[idx] = row;
      return copy;
    });

  const closeNotif = () => {
    setNotif((n) => ({ ...n, open: false }));
    if (notif.type === "success") onClose();
  };

  // 🔹 FJ: open the box-picker for a specific row
  const handleOpenBoxPicker = (rowIndex) => {
    setBoxTargetRowIndex(rowIndex);
    setBoxSearchOpen(true);
  };

  // 🔹 FJ: when a box is chosen for a row
  const handleSelectBoxForRow = (items) => {
    const selected = items && items[0];
    if (!selected || boxTargetRowIndex == null) {
      setBoxSearchOpen(false);
      return;
    }

    setRows((prev) => {
      const copy = [...prev];
      const row = { ...copy[boxTargetRowIndex] };

      const len = parseFloat(row.length) || 0;
      const wid = parseFloat(row.width) || 0;
      const m2 = (len / 100) * (wid / 100);
      const qty = parseFloat(row.quantity) || 0;

      const sheetsPerBox = selected.sheetsPerBox || 0;

      row.toItemVariantId = selected.itemVariantId;
      row.toSheetsPerBox = sheetsPerBox;

      row.toBoxLabel = `${selected.thickness} ملم ${selected.itemName} - ${Math.floor(
        selected.length || 0
      )}x${Math.floor(selected.width || 0)}-${sheetsPerBox}`;

      // recompute sqm if quantity already set
      if (details.location === "FJ" && row.type === "sheet" && qty > 0) {
        row.sqm = (m2 * sheetsPerBox * qty).toFixed(2);
      }

      copy[boxTargetRowIndex] = row;
      return copy;
    });

    setBoxSearchOpen(false);
    setBoxTargetRowIndex(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // ✅ Extra checks for FJ
      if (details.location === "FJ") {
        const withQty = rows.filter((r) => Number(r.quantity) > 0);

        // only sheet rows allowed
        const badTypes = withQty.filter((r) => r.type !== "sheet");
        if (badTypes.length > 0) {
          setNotif({
            open: true,
            type: "error",
            message: "FJ transfers only accept sheet items.",
          });
          setSaving(false);
          return;
        }

        // every row with quantity must have a chosen target box
        const missingBox = withQty.filter((r) => !r.toItemVariantId);
        if (missingBox.length > 0) {
          setNotif({
            open: true,
            type: "error",
            message:
              "Please choose the target box item for all FJ rows that have quantity.",
          });
          setSaving(false);
          return;
        }
      }

      const payloadItems = rows
        .filter((r) => Number(r.quantity) > 0)
        .map((r) => ({
          itemBatchId: r.itemBatchId,
          quantity: Number(r.quantity),
          sqm: Number(r.sqm) || 0,
          price: Number(r.price) || 0,
          // send target box variant for FJ
          ...(details.location === "FJ" && r.toItemVariantId
            ? { toItemVariantId: r.toItemVariantId }
            : {}),
        }));

      if (payloadItems.length === 0) {
        setNotif({
          open: true,
          type: "error",
          message: "No lines with quantity entered.",
        });
        setSaving(false);
        return;
      }

      await axios.post(`${baseUrl}/transfers`, {
        date: details.date,
        type: details.type,
        location: details.location,
        items: payloadItems,
      });

      setNotif({
        open: true,
        type: "success",
        message: "Transfer saved successfully!",
      });
      resetAll();
    } catch (err) {
      console.error("Failed to save transfer", err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "Save failed — please try again.";
      setNotif({
        open: true,
        type: "error",
        message: serverMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="transfer-modal-overlay"
        onClick={onClose}
        ref={wrapperRef}
      >
        <div
          className="transfer-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="transfer-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            &times;
          </button>

          <h2 className="transfer-txt">Transfer Inventory</h2>
          <div className="transfer-modal-header">
            <div className="transfer-action-buttons">
              <button
                className={`btn transfer-action-btn ${
                  !previewing ? "active" : ""
                }`}
                onClick={() => setPreviewing(false)}
                disabled={saving}
              >
                Create Transfer
              </button>
              <button
                className={`btn transfer-action-btn ${
                  previewing ? "active" : ""
                }`}
                onClick={() => setPreviewing(true)}
                disabled={saving}
              >
                Preview
              </button>
            </div>
          </div>

          {!previewing && (
            <div className="detail-actions">
              <button
                className="btn transfer-reset-btn"
                onClick={resetAll}
                disabled={saving}
              >
                Reset
              </button>
              <button
                className="btn transfer-save-btn"
                onClick={handleSave}
                disabled={saving || rows.length === 0}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}

          {previewing ? (
            <PreviewTransferTable rows={rows} />
          ) : (
            <div className="transfer-modal-body">
              <div className="transfer-details">
                <label>
                  Date
                  <br />
                  <input
                    type="date"
                    name="date"
                    value={details.date}
                    onChange={handleDetailChange}
                    disabled={saving}
                  />
                </label>
                <label>
                  Type
                  <br />
                  <select
                    name="type"
                    value={details.type}
                    onChange={handleDetailChange}
                    disabled={saving}
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <br />
                  <select
                    name="location"
                    value={details.location}
                    onChange={handleDetailChange}
                    disabled={saving}
                  >
                    {LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="transfer-search-wrapper">
                <button
                  className="transfer-search-btn"
                  onClick={() => setSearchOpen(true)}
                  disabled={saving}
                >
                  Search
                </button>
              </div>

              <div className="transfer-table-wrapper">
                <table className="transfer-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Dimension</th>
                      <th>Origin</th>
                      <th>Type</th>
                      {/* extra col for FJ */}
                      {details.location === "FJ" && (
                        <th className="target-box-col">Target Box</th>
                      )}
                      <th>Quantity</th>
                      <th>SQM</th>
                      <th>Condition</th>
                      <th>Date Received</th>
                      <th>Item Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={details.location === "FJ" ? 10 : 9}
                          style={{ textAlign: "center", color: "#666" }}
                        >
                          No items added
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              className="transfer-input"
                              value={r.name}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              className="transfer-input"
                              value={getDimensionDisplay(r)}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              className="transfer-input"
                              value={r.origin}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              className="transfer-input"
                              value={r.type}
                              readOnly
                            />
                          </td>

                          {/* FJ target box column */}
                          {details.location === "FJ" && (
                            <td className="target-box-col">
                              <button
                                type="button"
                                className="transfer-box-select-btn"
                                onClick={() => handleOpenBoxPicker(i)}
                                disabled={saving || r.type !== "sheet"}
                              >
                                {r.toBoxLabel ? "Change Box" : "Choose Box"}
                              </button>
                              {r.toBoxLabel && (
                                <div className="transfer-box-label">
                                  {r.toBoxLabel}
                                </div>
                              )}
                            </td>
                          )}

                          <td>
                            <input
                              type="number"
                              className="transfer-input transfer-col-small"
                              value={r.quantity}
                              onChange={(e) =>
                                updateRowField(i, "quantity", e.target.value)
                              }
                              disabled={saving}
                            />
                          </td>
                          <td>
                            <input
                              className="transfer-input"
                              value={r.sqm}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              className="transfer-input"
                              value={r.condition || ""}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              className="transfer-input"
                              value={r.dateReceived || ""}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              className="transfer-input"
                              type="number"
                              value={r.price}
                              onChange={(e) =>
                                updateRowField(i, "price", e.target.value)
                              }
                              disabled={saving}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* main search (batches to transfer FROM) */}
          <TransferSearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelect={handleSelectItems}
            existingKeys={new Set(rows.map((r) => `${r.itemBatchId}`))}
          />

          {/* FJ box picker (which box to transfer TO) */}
          <TransferSearchModal
            isOpen={boxSearchOpen}
            onClose={() => setBoxSearchOpen(false)}
            onSelect={handleSelectBoxForRow}
            existingKeys={new Set()} // allow any
            singleSelect={true}
          />
        </div>
      </div>

      {notif.open && (
        <NotificationModal
          type={notif.type}
          message={notif.message}
          onClose={closeNotif}
        />
      )}
    </>
  );
}
