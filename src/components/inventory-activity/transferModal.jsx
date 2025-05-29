// TransferModal.jsx
import React, { useState, useRef } from "react";
import SearchModal from "../pos-system/searchModal";
import PreviewTransferTable from "./previewTransferTable";
import "./transferModal.css";

const TYPE_OPTIONS = ["G"];
const LOCATION_OPTIONS = [
  "JF",
  "FJ",
  "JL",
  "LJ",
  "FL",
  "LF",
  "Breakage",
  "Adjustment +",
  "Adjustment -",
  "Defects",
];

const TransferModal = ({ isOpen, onClose }) => {
  const [previewing, setPreviewing] = useState(false);
  const [details, setDetails] = useState({
    transferNumber: "",
    date: new Date().toISOString().slice(0, 10),
    type: TYPE_OPTIONS[0],
    location: LOCATION_OPTIONS[0],
  });
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const wrapperRef = useRef();

  if (!isOpen) return null;

  const handleDetailChange = (e) => {
    setDetails({ ...details, [e.target.name]: e.target.value });
  };

  const handleSelectItems = (items) => {
    const mapped = items.map((i) => ({
      name: i.item,
      origin: i.origin,
      type: i.type,
      boxCount: i.box,
      sheetCount: i.sheet,
      length: i.length,
      width: i.width,
      sqm: i.sqm,
      price: "",
    }));
    setRows((prev) => [...prev, ...mapped]);
    setSearchOpen(false);
  };

  const updateRowField = (idx, field, value) =>
    setRows((rs) => {
      const copy = [...rs];
      // coerce to number or keep blank
      const row = { ...copy[idx], [field]: value };
      // parse floats
      const len = parseFloat(row.length) || 0;
      const wid = parseFloat(row.width) || 0;
      const box = parseFloat(row.boxCount) || 0;
      const sheet = parseFloat(row.sheetCount) || 0;
      let newSqm = "";
      // convert cm→m, then calculate
      const m2 = (len / 100) * (wid / 100);
      if (row.type === "box") {
        newSqm = (m2 * box * sheet).toFixed(2);
      } else if (row.type === "sheet") {
        newSqm = (m2 * sheet).toFixed(2);
      }
      row.sqm = newSqm;
      copy[idx] = row;
      return copy;
    });

  return (
    <div className="transfer-modal-overlay" onClick={onClose} ref={wrapperRef}>
      <div
        className="transfer-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="transfer-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="transfer-modal-header">
          <h2>Transfer Inventory</h2>
          <div className="action-buttons">
            <button
              className={`btn action-btn ${!previewing ? "active" : ""}`}
              onClick={() => setPreviewing(false)}
            >
              Create Transfer
            </button>
            <button
              className={`btn action-btn ${previewing ? "active" : ""}`}
              onClick={() => setPreviewing(true)}
            >
              Preview
            </button>
          </div>
        </div>

        {previewing ? (
          <PreviewTransferTable rows={rows} />
        ) : (
          <div className="transfer-modal-body">
            <div className="transfer-details">
              <label>
                Transfer #<br />
                <input
                  type="text"
                  name="transferNumber"
                  value={details.transferNumber}
                  onChange={handleDetailChange}
                />
              </label>
              <label>
                Date
                <br />
                <input
                  type="date"
                  name="date"
                  value={details.date}
                  onChange={handleDetailChange}
                />
              </label>
              <label>
                Type
                <br />
                <select
                  name="type"
                  value={details.type}
                  onChange={handleDetailChange}
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
              >
                Search
              </button>
            </div>

            <div className="transfer-table-wrapper">
              <table className="transfer-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Origin</th>
                    <th>Type</th>
                    <th>Box</th>
                    <th>Sheet</th>
                    <th>Length</th>
                    <th>Width</th>
                    <th>SQM</th>
                    <th>Item Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan="9"
                        style={{ textAlign: "center", color: "#666" }}
                      >
                        No items added
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => (
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
                          className="transfer-input"
                          value={r.boxCount}
                          onChange={(e) =>
                            updateRowField(i, "boxCount", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="transfer-input"
                          value={r.sheetCount}
                          onChange={(e) =>
                            updateRowField(i, "sheetCount", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="transfer-input"
                          value={r.length}
                          onChange={(e) =>
                            updateRowField(i, "length", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="transfer-input"
                          value={r.width}
                          onChange={(e) =>
                            updateRowField(i, "width", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="transfer-input"
                          value={r.sqm}
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="transfer-input"
                          value={r.price}
                          onChange={(e) =>
                            updateRowField(i, "price", e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <SearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelectItems={handleSelectItems}
        />
      </div>
    </div>
  );
};

export default TransferModal;
