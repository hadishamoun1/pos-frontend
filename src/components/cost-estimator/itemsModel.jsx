import React from "react";

const ItemModal = ({
  filteredItems,
  searchQuery,
  setSearchQuery,
  selectedItems,
  handleCheckboxChange,
  closeModal,
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
                <th>Origin</th>
                <th>Length (cm)</th>
                <th>Width (cm)</th>
                <th>Sheets/Box</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) =>
                item.dimensions.map((dimension) => (
                  <tr key={`${item.id}-${dimension.dimensionId}`}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        onChange={() => handleCheckboxChange(item, dimension)}
                        checked={selectedItems.some(
                          (selectedItem) =>
                            selectedItem.itemName === item.itemName &&
                            selectedItem.origin === dimension.origin &&
                            selectedItem.length === dimension.length &&
                            selectedItem.width === dimension.width &&
                            selectedItem.type === item.type
                        )}
                      />
                    </td>
                    <td>{item.itemName}</td>
                    <td>{item.type}</td>
                    <td>{dimension.origin}</td>
                    <td>{dimension.length}</td>
                    <td>{dimension.width}</td>
                    <td>{dimension.sheetsPerBox || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <button className="close-modal-button" onClick={closeModal}>
          Close
        </button>
      </div>
    </div>
  );
};

export default ItemModal;
