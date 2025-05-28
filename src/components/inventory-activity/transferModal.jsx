// TransferModal.jsx
import React, { useState, useRef } from "react";
import PreviewTransferTable from "./previewTransferTable";
import "./transferModal.css";

const TYPE_OPTIONS = ["Internal", "External", "Return"];
const LOCATION_OPTIONS = ["Warehouse A", "Warehouse B", "Store Front"];

const TransferModal = ({ isOpen, onClose }) => {
  const [previewing, setPreviewing] = useState(false);
  const [details, setDetails] = useState({
    transferNumber: "",
    date: new Date().toISOString().slice(0, 10),
    type: "",
    location: "",
  });
  const [rows, setRows] = useState([]);
  const wrapperRef = useRef();

  if (!isOpen) return null;

  const handleDetailChange = (e) => {
    setDetails({ ...details, [e.target.name]: e.target.value });
  };

  const handleSearch = () => {
    // TODO: wire up your search logic here
    console.log("Search clicked with details:", details);
  };

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
            {/* transfer details */}
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
                  <option value="">Select Type</option>
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
                  <option value="">Select Location</option>
                  {LOCATION_OPTIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Search button, right-aligned */}
            <div className="transfer-search-wrapper">
              <button className="transfer-search-btn" onClick={handleSearch}>
                Search
              </button>
            </div>

            {/* table */}
            <div className="transfer-table-wrapper">
              <table className="transfer-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Origin</th>
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
                        colSpan="8"
                        style={{ textAlign: "center", color: "#666" }}
                      >
                        No items added
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.origin}</td>
                      <td>{r.boxCount}</td>
                      <td>{r.sheetCount}</td>
                      <td>{r.length}</td>
                      <td>{r.width}</td>
                      <td>{r.sqm}</td>
                      <td>{r.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferModal;
