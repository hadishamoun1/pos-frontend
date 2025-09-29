import React, { useEffect, useState } from "react";

const ItemModal = ({
  filteredItems,
  searchQuery,
  setSearchQuery,
  selectedItems,
  handleItemSelection,
  closeModal,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
const baseUrl = process.env.REACT_APP_API_BASE_URL;
  // Fetch items from the API
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch(`${baseUrl}/items`);
        const data = await response.json();

        if (Array.isArray(data)) {
          setItems(data);
        } else {
          console.error("Unexpected data format:", data);
          setError("Invalid response format from API");
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching items:", err);
        setError("Failed to load items. Please try again later.");
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  // Filter items based on the search query and type
  const filteredItemsList = items.filter(
    (item) =>
      item.type === "box" && 
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>Loading Items...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>Error</h3>
          <p>{error}</p>
          <button className="close-modal-button" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    );
  }

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
              {filteredItemsList.map((item) =>
                item.dimensions.map((dimension) => (
                  <tr key={`${item.itemId}-${dimension.dimensionId}`}>
                    <td>
                      <input
                        type="checkbox"
                        onChange={() => handleItemSelection(item, dimension)}
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
