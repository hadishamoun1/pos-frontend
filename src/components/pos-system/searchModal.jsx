import React, { useEffect, useState } from "react";
import axios from "axios";
import "./searchModal.css";

const SearchModal = ({ isOpen, onClose, onSelectItems }) => {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  const fetchItems = async () => {
    try {
      const response = await axios.get(
        "http://localhost:3000/items/v1/filtered-items"
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
  const handleOk = () => {
    const selectedData = items
      .flatMap((item) =>
        item.thicknesses.flatMap((thickness) =>
          thickness.variants.map((variant) => ({
            origin: variant.origin,
            item: `${parseFloat(thickness.thickness)} ملم ${item.itemName}`,
            type: item.type,
            length: Math.floor(variant.length),
            width: Math.floor(variant.width),
            sheetsPerBox: variant.sheetsPerBox,
            box: item.type === "box" ? 1 : "", // Box is 1 if type is box
            sheet: item.type === "sheet" ? 1 : variant.sheetsPerBox, // Sheet is 1 if type is sheet
            uniqueId: `${item.itemName}-${variant.origin}-${thickness.thickness}-${variant.length}-${variant.width}-${variant.sheetsPerBox}`,
          }))
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
    <div className="search-modal-overlay">
      <div className="search-modal-content">
        {/* Modal Header */}
        <div className="search-modal-header">
          <h2 className="search-modal-title">Search</h2>
          <div className="search-modal-buttons">
            <button className="search-modal-close-button" onClick={onClose}>
              Close
            </button>
            <button className="search-modal-ok-button" onClick={handleOk}>
              OK
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Enter search term"
          className="search-modal-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Results Table */}
        <table className="search-modal-table">
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
                          className="search-modal-select-checkbox"
                          checked={selectedItems.has(uniqueId)}
                          onChange={() => handleSelect(uniqueId)}
                        />
                      </td>
                      <td>{variant.origin}</td>
                      <td style={{ direction: "rtl", textAlign: "right" }}>
                        {`${parseFloat(thickness.thickness)} ملم ${
                          item.itemName
                        }`}
                      </td>
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

export default SearchModal;
