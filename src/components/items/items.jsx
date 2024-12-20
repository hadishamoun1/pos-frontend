import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaTrash, FaPlus } from "react-icons/fa";
import "./items.css";

const CreateItemWithDimensions = () => {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({
    itemName: "",
    type: "box",
    thickness: "",
    length: "",
    width: "",
    sheetsPerBox: "",
    origin: "",
  });

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await axios.get(
          "http://localhost:3000/items/v1/filtered-items"
        );
        setItems(response.data);
      } catch (error) {
        console.error("Error fetching items:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const handleRowClick = (item) => {
    setSelectedItem(item);
  };

  const handleAddItemChange = (field, value) => {
    setNewItem({ ...newItem, [field]: value });
  };

  const handleAddItemSubmit = () => {
    // Placeholder for API integration to add a new item
    console.log("New item data:", newItem);
    setShowAddItemModal(false);
    setNewItem({
      itemName: "",
      type: "box",
      thickness: "",
      length: "",
      width: "",
      sheetsPerBox: "",
      origin: "",
    });
    alert("New item added successfully!");
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const filteredItems = items.filter((item) => {
    const dimensions = item.thicknesses.flatMap((thick) => thick.variants);
    return dimensions.some(
      (dimension) =>
        item.itemName.toLowerCase().includes(searchQuery) ||
        dimension.origin.toLowerCase().includes(searchQuery) ||
        dimension.length.toString().includes(searchQuery) ||
        dimension.width.toString().includes(searchQuery) ||
        dimension.sheetsPerBox?.toString().includes(searchQuery)
    );
  });

  return (
    <div className="itemPageContainer">
      <div className="itemHeader">
        <h2 className="itemFormTitle">Items and Dimensions</h2>
        <button
          className="addNewItemButton"
          onClick={() => setShowAddItemModal(true)}
        >
          <FaPlus /> Add New Item
        </button>
      </div>

      <input
        type="text"
        className="searchInput"
        placeholder="Search items by name, origin, length, width..."
        value={searchQuery}
        onChange={handleSearch}
      />

      {loading ? (
        <p>Loading items...</p>
      ) : (
        <table className="itemsTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Item Name</th>
              <th>Type</th>
              <th>Thickness</th>
              <th>Length</th>
              <th>Width</th>
              <th>Sheets per Box</th>
              <th>Origin</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) =>
              item.thicknesses.flatMap((thickness) =>
                thickness.variants.map((variant, index) => (
                  <tr
                    key={`${item.id}-${thickness.id}-${index}`}
                    onClick={() => handleRowClick(item)}
                    className={
                      selectedItem?.id === item.id ? "selectedRow" : ""
                    }
                  >
                    <td>{item.id}</td>
                    <td>{item.itemName}</td>
                    <td>{item.type}</td>
                    <td>{thickness.thickness}</td>
                    <td>{variant.length}</td>
                    <td>{variant.width}</td>
                    <td>
                      {item.type === "box" ? variant.sheetsPerBox : ""}
                    </td>
                    <td>{variant.origin}</td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      )}

      {showAddItemModal && (
        <div className="modalOverlay">
          <div className="modalContent">
            <h3>Add New Item</h3>
            <form>
              <input
                type="text"
                placeholder="Item Name"
                value={newItem.itemName}
                onChange={(e) => handleAddItemChange("itemName", e.target.value)}
              />
              <select
                value={newItem.type}
                onChange={(e) => handleAddItemChange("type", e.target.value)}
              >
                <option value="box">Box</option>
                <option value="sheet">Sheet</option>
              </select>
              <input
                type="number"
                placeholder="Thickness"
                value={newItem.thickness}
                onChange={(e) =>
                  handleAddItemChange("thickness", e.target.value)
                }
              />
              <input
                type="number"
                placeholder="Length"
                value={newItem.length}
                onChange={(e) => handleAddItemChange("length", e.target.value)}
              />
              <input
                type="number"
                placeholder="Width"
                value={newItem.width}
                onChange={(e) => handleAddItemChange("width", e.target.value)}
              />
              <input
                type="number"
                placeholder="Sheets per Box"
                value={newItem.sheetsPerBox}
                onChange={(e) =>
                  handleAddItemChange("sheetsPerBox", e.target.value)
                }
                disabled={newItem.type === "sheet"}
              />
              <input
                type="text"
                placeholder="Origin"
                value={newItem.origin}
                onChange={(e) => handleAddItemChange("origin", e.target.value)}
              />
            </form>
            <div className="modalButtons">
              <button className="confirmButton" onClick={handleAddItemSubmit}>
                Save
              </button>
              <button
                className="cancelButton"
                onClick={() => setShowAddItemModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateItemWithDimensions;
