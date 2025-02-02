import React from "react";
import "./searchModal.css";

const SearchModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay">
      <div className="search-modal-content">
        {/* Modal Header */}
        <div className="search-modal-header">
          <h2 className="search-modal-title">Search</h2>
          <button className="search-modal-close-button" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Enter search term"
          className="search-modal-input"
        />

        {/* Results Table */}
        <table className="search-modal-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Origin</th>
              <th>Item</th>
              <th>Length</th>
              <th>Width</th>
              <th>Type</th>
              <th>Sheets Per Box</th>
            </tr>
          </thead>
          <tbody>
            {/* Example row, replace with dynamic data */}
            <tr>
              <td>
                <input
                  type="checkbox"
                  className="search-modal-select-checkbox"
                />
              </td>
              <td>Lebanon</td>
              <td>5.5mm White</td>
              <td>200</td>
              <td>100</td>
              <td>Box</td>
              <td>50</td>
            </tr>
            <tr>
              <td>
                <input
                  type="checkbox"
                  className="search-modal-select-checkbox"
                />
              </td>
              <td>China</td>
              <td>3.2mm Clear</td>
              <td>300</td>
              <td>150</td>
              <td>Sheet</td>
              <td>40</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SearchModal;
