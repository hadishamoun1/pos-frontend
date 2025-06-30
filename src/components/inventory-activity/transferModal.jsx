import React, { useState, useRef } from "react";
import axios from "axios";
import TransferSearchModal from "./transferSearchModal";
import PreviewTransferTable from "./previewTransferTable";
import NotificationModal from "../recievables/NotificationModal";
import "./transferModal.css";

const TYPE_OPTIONS = ["G"];
const LOCATION_OPTIONS = [
  "JF",
  "FJ",
  "SL",
  "LS",
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
        if (row.type === "box") {
          row.sqm = (m2 * row.sheetsPerBox * qty).toFixed(2);
        } else if (row.type === "sheet") {
          row.sqm = (m2 * qty).toFixed(2);
        } else if (row.type === "sqm") {
          row.sqm = qty.toFixed(2);
        }
      }

      copy[idx] = row;
      return copy;
    });

  const closeNotif = () => {
    setNotif((n) => ({ ...n, open: false }));
    if (notif.type === "success") onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payloadItems = rows.map((r) => ({
        itemBatchId: r.itemBatchId,
        quantity: Number(r.quantity),
        sqm: Number(r.sqm),
        price: Number(r.price) || 0,
      }));

      await axios.post("http://localhost:3000/transfers", {
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
                          colSpan={9}
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

          <TransferSearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelect={handleSelectItems}
            existingKeys={new Set(rows.map((r) => `${r.itemBatchId}`))}
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
