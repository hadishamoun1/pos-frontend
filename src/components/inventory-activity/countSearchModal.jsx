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
      .then((res) => setItems(res.data))
      .catch(console.error);

    // reset search + selection each time it opens:
    setSearchTerm("");
    setSelectedSet(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (variantKey, info) => {
    if (existingKeys.has(variantKey)) return;

    if (singleSelect) {
      // immediately hand back the one choice:
      onSelect([info]);
      onClose();
    } else {
      const s = new Set(selectedSet);
      s.has(variantKey) ? s.delete(variantKey) : s.add(variantKey);
      setSelectedSet(s);
    }
  };

  // build a flat list of rows & allow lookup by key
  const rows = items.flatMap((item) =>
    item.thicknesses.flatMap((thick) =>
      thick.variants.map((variant) => {
        const key = `${item.id}-${thick.thickness}-${variant.id}`;
        return {
          key,
          itemVariantId: variant.id,
          itemName: item.itemName,
          thickness: thick.thickness,
          type: item.type,
          length: variant.length,
          width: variant.width,
          sheetsPerBox: variant.sheetsPerBox,
        };
      })
    )
  );

  const filtered = rows.filter((r) =>
    r.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOk = () => {
    const chosen = filtered.filter((r) => selectedSet.has(r.key));
    const mapped = chosen.map((r) => ({
      key: r.key,
      itemVariantId: r.itemVariantId,
      item: `${parseFloat(r.thickness)} ملم ${r.itemName}`,
      type: r.type,
      length: r.length,
      width: r.width,
      sheetsPerBox: r.sheetsPerBox,
    }));
    onSelect(mapped);
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
            placeholder="Search by item name…"
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
                        checked={singleSelect ? false : checked}
                        disabled={already}
                        onChange={() =>
                          toggleSelect(r.key, {
                            key: r.key,
                            itemVariantId: r.itemVariantId,
                            item: `${parseFloat(r.thickness)} ملم ${
                              r.itemName
                            }`,
                            type: r.type,
                            length: r.length,
                            width: r.width,
                            sheetsPerBox: r.sheetsPerBox,
                          })
                        }
                      />
                    </td>
                    <td className="rtl">
                      {`${parseFloat(r.thickness)} ملم ${r.itemName}`}
                    </td>
                    <td>{r.type}</td>
                    <td>{Math.floor(r.length)}</td>
                    <td>{Math.floor(r.width)}</td>
                    <td>{r.sheetsPerBox}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* hide the OK footer when in singleSelect mode */}
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
