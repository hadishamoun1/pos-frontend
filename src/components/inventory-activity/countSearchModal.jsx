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
  const [items, setItems] = useState([]); // ✅ Initialize as empty array
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSet, setSelectedSet] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Helper function to normalize API response
  const normalizeItemsResponse = (response) => {
    // API returns: { page, limit, hasMore, totalGroups, data: [...] }
    if (response?.data && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    console.warn('Unexpected response structure:', response);
    return [];
  };

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    axiosClient
      .get("/items/v1/filtered-items")
      .then((res) => {
        const normalized = normalizeItemsResponse(res.data);
        console.log('Fetched groups:', normalized.length); // Debug log
        setItems(normalized);
      })
      .catch((err) => {
        console.error('Error fetching items:', err);
        setError('Failed to load items');
        setItems([]); // ✅ Always set to empty array on error
      })
      .finally(() => {
        setLoading(false);
      });

    setSearchTerm("");
    setSelectedSet(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  // ✅ Process API response structure: data[].variants[]
  // Each group has realDescription and variants array
  const rows = (Array.isArray(items) ? items : []).flatMap((group) => {
    const realDesc = group?.realDescription || {};
    const variants = Array.isArray(group?.variants) ? group.variants : [];
    
    return variants.map((variant) => {
      // Each variant has its own itemId, itemName, thickness, etc.
      const key = `${variant?.variantId || ''}`;
      return {
        key,
        variantId: variant?.variantId || null,
        itemId: variant?.itemId || null,
        itemName: variant?.itemName || '',
        thickness: variant?.thickness || 0,
        thicknessId: variant?.thicknessId || null,
        length: variant?.length || 0,
        width: variant?.width || 0,
        sheetsPerBox: variant?.sheetsPerBox || 0,
        origin: variant?.origin || '',
        itemVariantType: variant?.type || '', // 'box' | 'sheet' | 'sqm' | 'unit'
        // ✅ Add balance info
        balance: variant?.balance || 0,
        balanceOFR: variant?.balanceOFR || 0,
        batchCount: variant?.batchCount || 0,
        // Real description info
        categoryName: realDesc?.categoryName || '',
        subCategory: realDesc?.subCategory || '',
        colorName: realDesc?.colorName || '',
        designName: realDesc?.designName || '',
        itemNumber: realDesc?.itemNumber || '',
      };
    });
  });

  // ✅ Safe filtering
  const filtered = rows.filter((r) => {
    const term = (searchTerm || '').toLowerCase();
    const itemName = (r?.itemName || '').toLowerCase();
    const origin = (r?.origin || '').toLowerCase();
    const categoryName = (r?.categoryName || '').toLowerCase();
    const subCategory = (r?.subCategory || '').toLowerCase();
    const colorName = (r?.colorName || '').toLowerCase();
    const itemNumber = (r?.itemNumber || '').toLowerCase();
    
    return (
      itemName.includes(term) ||
      origin.includes(term) ||
      categoryName.includes(term) ||
      subCategory.includes(term) ||
      colorName.includes(term) ||
      itemNumber.includes(term)
    );
  });

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
            placeholder="Search by item name, category, color, origin, or item number…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {/* ✅ Loading state */}
        {loading && (
          <div className="count-search-modal-loading">
            Loading items...
          </div>
        )}

        {/* ✅ Error state */}
        {error && (
          <div className="count-search-modal-error">
            ⚠️ {error}
          </div>
        )}

        {/* ✅ Empty state */}
        {!loading && !error && items.length === 0 && (
          <div className="count-search-modal-empty">
            No items found
          </div>
        )}

        {/* ✅ Table */}
        {!loading && !error && items.length > 0 && (
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
                  <th>Category</th>
                  <th>Color</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>
                      No results found for "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
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
                          {`${r.thickness}ملم ${r.itemName}`}
                        </td>
                        <td>{r.length}</td>
                        <td>{r.width}</td>
                        <td>{r.sheetsPerBox}</td>
                        <td>{r.origin}</td>
                        <td>{r.itemVariantType}</td>
                        <td>{r.categoryName}</td>
                        <td style={{ direction: "rtl", textAlign: "right" }}>
                          {r.colorName}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {Number(r.balanceOFR || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

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