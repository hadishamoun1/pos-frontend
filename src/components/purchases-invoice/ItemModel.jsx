import React from "react";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const rowEquals = (a, b) => {
  // Compare EXACT row identity across all needed fields
  return (
    (a.itemName || "") === (b.itemName || "") &&
    (a.type || "") === (b.type || "") &&
    (a.origin || "") === (b.origin || "") &&
    toNum(a.length) === toNum(b.length) &&
    toNum(a.width) === toNum(b.width) &&
    toNum(a.sheetsPerBox) === toNum(b.sheetsPerBox)
  );
};

const ItemModal = ({
  filteredItems,
  searchQuery,
  setSearchQuery,
  selectedItems,
  handleCheckboxChange,
  closeItemModal,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Select Items and Dimensions</h3>

        <input
          type="text"
          placeholder="Search for items"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="modal-search"
        />

        <div className="modal-items-table-container">
          <table className="modal-items-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Item (with thickness)</th>
                <th>Type</th>
                <th>Origin</th>
                <th>Length (cm)</th>
                <th>Width (cm)</th>
                <th>Sheets/Box</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) =>
                item.thicknesses?.flatMap((thickness) =>
                  thickness.variants?.map((variant) => {
                    // current row signature
                    const currentRow = {
                      itemName: item.itemName,
                      type: item.type,
                      origin: variant.origin,
                      length: variant.length,
                      width: variant.width,
                      sheetsPerBox: variant.sheetsPerBox,
                    };

                    // is this exact row selected?
                    const isChecked = selectedItems.some((sel) =>
                      rowEquals(sel, currentRow)
                    );

                    // "6ملم ابيض"
                    const combinedName = `${parseFloat(
                      thickness.thickness
                    )}ملم ${item.itemName}`;

                    return (
                      <tr key={`${item.id}-${variant.id}`}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            onChange={() =>
                              handleCheckboxChange(item, {
                                ...variant,
                                thickness: thickness.thickness,
                                dimensionId: variant.id, // used for tracking selection
                              })
                            }
                            checked={isChecked}
                          />
                        </td>

                        {/* Combined "thickness + item name" */}
                        <td style={{ direction: "rtl", textAlign: "right" }}>
                          {combinedName}
                        </td>

                        <td>{item.type}</td>
                        <td>{variant.origin}</td>
                        <td>{variant.length}</td>
                        <td>{variant.width}</td>
                        <td>{variant.sheetsPerBox || ""}</td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        <button className="close-modal-button" onClick={closeItemModal}>
          Close
        </button>
      </div>
    </div>
  );
};

export default ItemModal;
