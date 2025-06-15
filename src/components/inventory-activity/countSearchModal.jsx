// CountSearchModal.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./countSearchModal.css";

const CountSearchModal = ({
  isOpen,
  onClose,
  onSelect,
  existingKeys,
  singleSelect = false,
}) => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSet, setSelectedSet] = useState(new Set());

  useEffect(() => {
    if (!isOpen) return;
    axios
      .get("http://localhost:3000/items/v1/filtered-items")
      .then((res) => setItems(res.data || []))
      .catch(console.error);

    setSearchTerm("");
    setSelectedSet(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  // Safely flatten, defaulting to [] whenever a level is missing
  const rows = items.flatMap((item) => {
    const thicknesses = item.thicknesses || [];
    return thicknesses.flatMap((thick) => {
      const variants = thick.variants || [];
      return variants.flatMap((variant) => {
        const batches = variant.batches || [];
        return batches.map((batch) => {
          const key = `${item.id}-${thick.thickness}-${variant.id}-${batch.id}`;
          return {
            key,
            batchId: batch.id,
            itemVariantId: variant.id,
            itemName: item.itemName,
            thickness: thick.thickness,
            type: item.type,
            length: variant.length,
            width: variant.width,
            sheetsPerBox: variant.sheetsPerBox,
            condition: batch.condition,
            dateReceived: batch.dateReceived,
          };
        });
      });
    });
  });

  const filtered = rows.filter(
    (r) =>
      r.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.condition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (row) => {
    if (existingKeys.has(row.key)) return;
    if (singleSelect) {
      onSelect([row]);
      onClose();
    } else {
      const s = new Set(selectedSet);
      s.has(row.key) ? s.delete(row.key) : s.add(row.key);
      setSelectedSet(s);
    }
  };

  const handleOk = () => {
    const chosen = filtered.filter((r) => selectedSet.has(r.key));
    onSelect(
      chosen.map((r) => ({
        key: r.key,
        batchId: r.batchId,
        itemVariantId: r.itemVariantId,
        item: `${parseFloat(r.thickness)} ملم ${r.itemName}`,
        type: r.type,
        length: r.length,
        width: r.width,
        sheetsPerBox: r.sheetsPerBox,
        condition: r.condition,
        dateReceived: r.dateReceived,
      }))
    );
    onClose();
  };

  return (
    <div className="count-search-modal-overlay" onClick={onClose}>
      <div
        className="count-search-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="count-search-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="count-search-modal-searchbar">
          <input
            type="text"
            className="count-search-modal-input"
            placeholder="Search by item or condition…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

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
                <th>Condition</th>
                <th>Date Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const already = existingKeys.has(r.key);
                const checked = singleSelect
                  ? false
                  : already || selectedSet.has(r.key);

                return (
                  <tr key={r.key}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={already}
                        onChange={() => toggleSelect(r)}
                      />
                    </td>
                    <td className="rtl">
                      {`${parseFloat(r.thickness)} ملم ${r.itemName}`}
                    </td>
                    <td>{r.type}</td>
                    <td>{Math.floor(r.length)}</td>
                    <td>{Math.floor(r.width)}</td>
                    <td>{r.sheetsPerBox}</td>
                    <td>{r.condition}</td>
                    <td>{r.dateReceived}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!singleSelect && (
          <div className="count-search-modal-footer">
            <button
              className="count-search-modal-ok"
              onClick={handleOk}
              disabled={selectedSet.size === 0}
            >
              OK ({selectedSet.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountSearchModal;
