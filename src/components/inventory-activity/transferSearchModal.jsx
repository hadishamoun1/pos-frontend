import React, { useState, useEffect } from "react";
import axios from "axios";
import "./transferSearchModal.css";

const TransferSearchModal = ({
  isOpen,
  onClose,
  onSelect,
  existingKeys,
  singleSelect = false,
}) => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSet, setSelectedSet] = useState(new Set());
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    if (!isOpen) return;

    axios
      .get(`${baseUrl}/items/v2/filtered-items`)
      .then((res) => {
        // v2 shape: { page, limit, totalRows, totalPages, hasMore, data: [...] }
        setItems(res.data?.data || []);
      })
      .catch(console.error);

    setSearchTerm("");
    setSelectedSet(new Set());
  }, [isOpen, baseUrl]);

  if (!isOpen) return null;

  // v2: each entry in `items` is already a row with variant + batch + realDescription
  const rows = (items || []).map((item) => {
    const realDesc = item.realDescription || {};

    const key = `${item.variantId}-${item.batchId}`;

    return {
      key,
      // item / variant info
      itemId: item.itemId,
      itemName: item.itemName,
      thickness: item.thickness,
      length: item.length,
      width: item.width,
      sheetsPerBox: item.sheetsPerBox,
      origin: item.origin,
      itemVariantType: item.type,
      itemVariantId: item.variantId,

      // real description info
      itemNameDescriptionId: realDesc.id,
      itemNameDescription: realDesc,
      categoryName: realDesc.categoryName,
      subCategory: realDesc.subCategory,

      // batch info
      batchId: item.batchId,
      condition: item.condition,
      dateReceived: item.dateReceived,
      balance: item.balance ?? null,
      balanceOFR: item.balanceOFR,
    };
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
    <div className="transfer-search-modal-overlay" onClick={onClose}>
      <div
        className="transfer-search-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="transfer-search-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="transfer-search-modal-searchbar">
          <input
            type="text"
            className="transfer-search-modal-input"
            placeholder="Search by item name or condition…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="transfer-search-modal-table-wrapper">
          <table className="transfer-search-modal-table">
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
          <div className="transfer-search-modal-footer">
            <button
              className="transfer-search-modal-ok"
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

export default TransferSearchModal;
