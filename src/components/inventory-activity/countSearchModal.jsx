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
      .get("http://localhost:3000/inventory-count/filtered-with-balance")
      .then((res) => setItems(res.data || []))
      .catch(console.error);

    setSearchTerm("");
    setSelectedSet(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  const rows = items.flatMap((item) => {
    return item.itemBatches.map((batch) => {
      const key = `${item.id}-${batch.id}`;
      return {
        key,
        id: item.id,
        name: `${item.itemVariantName} `,
        thickness: item.thickness,
        length: item.length,
        width: item.width,
        sheetsPerBox: item.sheetsPerBox,
        origin: item.origin,
        itemVariantType: item.itemVariantType,
        date: item.date,
        count: item.count,
        sqm: item.sqm,
        type: item.type,

        batchId: batch.id,
        condition: batch.condition,
        dateReceived: batch.dateReceived,
        start: batch.start,
        startOFR: batch.startOFR,
        balance: batch.balance,
        balanceOFR: batch.balanceOFR,
      };
    });
  });

  const filtered = rows.filter(
    (r) =>
      r.itemVariantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

                <th>Length</th>
                <th>Width</th>
                <th>Sheets/Box</th>
                <th>Origin</th>
                <th>Type</th>
                <th>Date</th>

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
                      {`${r.thickness} ملم ${r.name}`}
                    </td>

                    <td>{r.length}</td>
                    <td>{r.width}</td>
                    <td>{r.sheetsPerBox}</td>
                    <td>{r.origin}</td>
                    <td>{r.itemVariantType}</td>
                    <td>{r.date}</td>

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
