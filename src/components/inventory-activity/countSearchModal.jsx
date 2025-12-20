import React, { useState, useEffect } from "react";
import "./countSearchModal.css";

// ✅ use your axios client (named export)
import { axiosClient } from "../api/axiosClient"; // <-- adjust path if needed

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

    axiosClient
      .get("/items/v1/filtered-items")
      .then((res) => setItems(res.data || []))
      .catch(console.error);

    setSearchTerm("");
    setSelectedSet(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  const rows = items.flatMap((item) => {
    return (item.thicknesses || []).flatMap((thickness) => {
      return (thickness.variants || []).flatMap((variant) => {
        if (!Array.isArray(variant.batches) || variant.batches.length === 0)
          return [];
        return variant.batches.map((batch) => {
          const key = `${variant.id}-${batch.id}`;
          return {
            key,
            itemId: item.id,
            itemName: item.itemName,
            thickness: thickness.thickness,
            length: variant.length,
            width: variant.width,
            sheetsPerBox: variant.sheetsPerBox,
            origin: variant.origin,
            itemVariantType: item.type, // item.type is 'box' | 'sheet' | 'sqm'
            batchId: batch.id,
            condition: batch.condition,
            dateReceived: batch.dateReceived,
            balance: batch.balance,
            balanceOFR: batch.balanceOFR,
          };
        });
      });
    });
  });

  const filtered = rows.filter(
    (r) =>
      r.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.condition?.toLowerCase().includes(searchTerm.toLowerCase())
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
    onSelect(chosen);
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
            placeholder="Search by item name or condition…"
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
                <th>Length</th>
                <th>Width</th>
                <th>Sheets/Box</th>
                <th>Origin</th>
                <th>Type</th>
                <th>Condition</th>
                <th>Date Received</th>
                <th>Balance OFR</th>
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
                    <td style={{ direction: "rtl", textAlign: "right" }}>
                      {`${r.thickness} ملم ${r.itemName}`}
                    </td>
                    <td>{r.length}</td>
                    <td>{r.width}</td>
                    <td>{r.sheetsPerBox}</td>
                    <td>{r.origin}</td>
                    <td>{r.itemVariantType}</td>
                    <td>{r.condition}</td>
                    <td>{r.dateReceived}</td>
                    <td>{r.balanceOFR}</td>
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
