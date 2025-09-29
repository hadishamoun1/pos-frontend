import React, { useEffect, useState } from "react";
import axios from "axios";
import "./searchModal.css";

const SearchModal = ({ isOpen, onClose, onSelectItems }) => {
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
      setItems(response.data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const handleSelect = (uniqueId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(uniqueId)) {
      newSelected.delete(uniqueId);
    } else {
      newSelected.add(uniqueId);
    }
    setSelectedItems(newSelected);
  };

  const handleOk = () => {
    const selectedData = [];

    items.forEach((item) => {
      item.thicknesses.forEach((thickness) => {
        thickness.variants.forEach((variant) => {
          if (!variant.batches || variant.batches.length === 0) return;

          variant.batches.forEach((batch) => {
            const uniqueId = `${variant.id}-${batch.id}`;
            if (selectedItems.has(uniqueId)) {
              selectedData.push({
                itemVariantId: variant.id,
                itemName: item.itemName,
                type: item.type,
                thickness: thickness.thickness,
                length: parseFloat(variant.length),
                width: parseFloat(variant.width),
                sheetsPerBox: variant.sheetsPerBox,
                origin: variant.origin,
                condition: batch.condition,
                dateReceived: batch.dateReceived,
                balanceOFR: batch.balanceOFR,
                batchId: batch.id,
              });
            }
          });
        });
      });
    });

    onSelectItems(selectedData);
    onClose();
  };

  const filteredRows = items
    .flatMap((item) =>
      item.thicknesses.flatMap((thickness) =>
        thickness.variants.flatMap((variant) => {
          if (!variant.batches || variant.batches.length === 0) return [];
          return variant.batches.map((batch) => {
            const uniqueId = `${variant.id}-${batch.id}`;
            return {
              uniqueId,
              itemName: item.itemName,
              type: item.type,
              thickness: thickness.thickness,
              length: Math.floor(variant.length),
              width: Math.floor(variant.width),
              sheetsPerBox: variant.sheetsPerBox,
              origin: variant.origin,
              condition: batch.condition,
              dateReceived: batch.dateReceived,
              balanceOFR: batch.balanceOFR,
            };
          });
        })
      )
    )
    .filter(
      (r) =>
        r.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.condition &&
          r.condition.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div
        className="search-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-modal-header">
          <h2 className="search-modal-title">Search</h2>
          <div className="search-modal-buttons">
            <button className="search-modal-close-button" onClick={onClose}>
              Close
            </button>
            <button
              className="search-modal-ok-button"
              onClick={handleOk}
              disabled={selectedItems.size === 0}
            >
              OK ({selectedItems.size})
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search by item name or condition"
          className="search-modal-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />

        <table className="search-modal-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Item</th>
              <th>Type</th>
              <th>Thickness</th>
              <th>Length</th>
              <th>Width</th>
              <th>Sheets/Box</th>
              <th>Origin</th>
              <th>Condition</th>
              <th>Date Received</th>
              <th>Balance OFR</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.uniqueId}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedItems.has(r.uniqueId)}
                    onChange={() => handleSelect(r.uniqueId)}
                  />
                </td>
                <td style={{ direction: "rtl", textAlign: "right" }}>
                  {`${parseFloat(r.thickness)} ملم ${r.itemName}`}
                </td>
                <td>{r.type}</td>
                <td>{r.thickness}</td>
                <td>{r.length}</td>
                <td>{r.width}</td>
                <td>{r.sheetsPerBox}</td>
                <td>{r.origin}</td>
                <td>{r.condition}</td>
                <td>{r.dateReceived}</td>
                <td>{r.balanceOFR}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SearchModal;
