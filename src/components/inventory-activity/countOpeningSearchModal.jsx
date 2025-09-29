// src/recievables/CountOpeningSearchModal.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import "./countOpeningSearchModal.css";

const CountOpeningSearchModal = ({ isOpen, onClose, onSelectItems }) => {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedItems(new Set());
      fetchItems();
    }
  }, [isOpen]);

  const fetchItems = async () => {
    try {
      const response = await axios.get(
        `${baseUrl}/items/v1/filtered-items`
      );
      setItems(response.data);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const handleSelect = (uniqueId) => {
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(uniqueId)) {
      newSelectedItems.delete(uniqueId);
    } else {
      newSelectedItems.add(uniqueId);
    }
    setSelectedItems(newSelectedItems);
  };

  const calculateSQM = (length, width, type, box, sheet) => {
    if (!length || !width || !sheet) return "";
    const lengthInMeters = length / 100;
    const widthInMeters = width / 100;
    if (type === "box")
      return (lengthInMeters * widthInMeters * box * sheet).toFixed(2);
    else if (type === "sheet")
      return (lengthInMeters * widthInMeters * sheet).toFixed(2);
    return "";
  };

  const handleOk = () => {
    const selectedData = items
      .flatMap((item) =>
        item.thicknesses.flatMap((thickness) =>
          thickness.variants.map((variant) => {
            const box = item.type === "box" ? 1 : "";
            const sheet = item.type === "sheet" ? 1 : variant.sheetsPerBox;
            return {
              itemVariantId: variant.id,
              origin: variant.origin,
              item: `${parseFloat(thickness.thickness)} ملم ${item.itemName}`,
              type: item.type,
              length: Math.floor(variant.length),
              width: Math.floor(variant.width),
              sheetsPerBox: variant.sheetsPerBox,
              box: box,
              sheet: sheet,
              sqm: calculateSQM(
                variant.length,
                variant.width,
                item.type,
                box,
                sheet
              ),
              uniqueId: `${item.itemName}-${variant.origin}-${thickness.thickness}-${variant.length}-${variant.width}-${variant.sheetsPerBox}`,
            };
          })
        )
      )
      .filter((row) => selectedItems.has(row.uniqueId));

    onSelectItems(selectedData);
    onClose();
  };

  const filteredItems = items.filter((item) =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="count-opening-search-modal-overlay">
      <div className="count-opening-search-modal-content">
        <div className="count-opening-search-modal-header">
          <h2 className="count-opening-search-modal-title">Search</h2>
          <div className="count-opening-search-modal-buttons">
            <button
              className="count-opening-search-modal-close-button"
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="count-opening-search-modal-ok-button"
              onClick={handleOk}
            >
              OK
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Enter search term"
          className="count-opening-search-modal-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <table className="count-opening-search-modal-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Origin</th>
              <th>Item</th>
              <th>Type</th>
              <th>Length</th>
              <th>Width</th>
              <th>Sheets/Box</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.flatMap((item) =>
              item.thicknesses.flatMap((thickness) =>
                thickness.variants.map((variant, index) => {
                  const uniqueId = `${item.itemName}-${variant.origin}-${thickness.thickness}-${variant.length}-${variant.width}-${variant.sheetsPerBox}`;
                  return (
                    <tr key={`${item.id}-${index}`}>
                      <td>
                        <input
                          type="checkbox"
                          className="count-opening-search-modal-select-checkbox"
                          checked={selectedItems.has(uniqueId)}
                          onChange={() => handleSelect(uniqueId)}
                        />
                      </td>
                      <td>{variant.origin}</td>
                      <td
                        style={{ direction: "rtl", textAlign: "right" }}
                      >{`${parseFloat(thickness.thickness)} ملم ${
                        item.itemName
                      }`}</td>
                      <td>{item.type}</td>
                      <td>{Math.floor(variant.length)}</td>
                      <td>{Math.floor(variant.width)}</td>
                      <td>{variant.sheetsPerBox}</td>
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CountOpeningSearchModal;
