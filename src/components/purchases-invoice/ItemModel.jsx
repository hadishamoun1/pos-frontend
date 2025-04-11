import React from "react";

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
                <th>Item Name</th>
                <th>Type</th>
                <th>Thickness</th>
                <th>Origin</th>
                <th>Length (cm)</th>
                <th>Width (cm)</th>
                <th>Sheets/Box</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) =>
                item.thicknesses?.flatMap((thickness) =>
                  thickness.variants?.map((variant) => (
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
                          checked={selectedItems.some(
                            (selectedItem) =>
                              selectedItem.itemName === item.itemName &&
                              selectedItem.origin === variant.origin &&
                              selectedItem.length === variant.length &&
                              selectedItem.width === variant.width &&
                              selectedItem.type === item.type
                          )}
                        />
                      </td>
                      <td>{item.itemName}</td>
                      <td>{item.type}</td>
                      <td>{thickness.thickness}</td>
                      <td>{variant.origin}</td>
                      <td>{variant.length}</td>
                      <td>{variant.width}</td>
                      <td>{variant.sheetsPerBox || ""}</td>
                    </tr>
                  ))
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
