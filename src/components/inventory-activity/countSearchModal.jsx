import React, { useState, useEffect } from "react";
import axios from "axios";
import "./countSearchModal.css";

const CountSearchModal = ({ isOpen, onClose, onSelect }) => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSet, setSelectedSet] = useState(new Set());

  useEffect(() => {
    if (!isOpen) return;
    axios
      .get("http://localhost:3000/items/v1/filtered-items")
      .then((res) => setItems(res.data))
      .catch(console.error);
    setSelectedSet(new Set());
    setSearchTerm("");
  }, [isOpen]);

  const toggleSelect = (variantKey) => {
    const s = new Set(selectedSet);
    s.has(variantKey) ? s.delete(variantKey) : s.add(variantKey);
    setSelectedSet(s);
  };

  const filtered = items.filter((it) =>
    it.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOk = () => {
    const selected = [];
    filtered.flatMap((item) =>
      item.thicknesses.flatMap((thick) =>
        thick.variants.forEach((variant) => {
          const key = `${item.id}-${thick.thickness}-${variant.id}`;
          if (selectedSet.has(key)) {
            selected.push({
              itemVariantId: variant.id,
              item: `${parseFloat(thick.thickness)} ملم ${item.itemName}`,
              type: item.type,
              length: variant.length,
              width: variant.width,
              sheetsPerBox: variant.sheetsPerBox,
            });
          }
        })
      )
    );
    onSelect(selected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="count-search-modal-overlay" onClick={onClose}>
      <div
        className="count-search-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="count-search-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        {/* Search */}
        <div className="count-search-modal-searchbar">
          <input
            type="text"
            className="count-search-modal-input"
            placeholder="Search by item name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {/* Table */}
        <div className="count-search-modal-table-wrapper">
          <table className="count-search-modal-table">
            <thead>
              <tr>
                <th></th>
                <th>Item Name</th>
                <th>Type</th>
                <th>Length</th>
                <th>Width</th>
                <th>Sheets/Box</th>
              </tr>
            </thead>
            <tbody>
              {filtered.flatMap((item) =>
                item.thicknesses.flatMap((thick) =>
                  thick.variants.map((variant) => {
                    const key = `${item.id}-${thick.thickness}-${variant.id}`;
                    return (
                      <tr key={key}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(key)}
                            onChange={() => toggleSelect(key)}
                          />
                        </td>
                        <td className="rtl">
                          {`${parseFloat(thick.thickness)} ملم ${
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

        {/* OK button */}
        <div className="count-search-modal-footer">
          <button
            className="count-search-modal-ok"
            onClick={handleOk}
            disabled={selectedSet.size === 0}
          >
            OK ({selectedSet.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default CountSearchModal;
