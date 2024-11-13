import React, { useState } from "react";
import { FaTrash } from "react-icons/fa";
import "./items.css";

const ItemFormPage = () => {
  const [items, setItems] = useState([
    {
      id: Date.now(),
      itemName: "",
      origin: "",
      type: "Box",
      length: "",
      width: "",
      sheetsPerBox: "",
      disabledSheets: false,
    },
  ]);

  // Add new item row
  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        itemName: "",
        origin: "",
        type: "Box",
        length: "",
        width: "",
        sheetsPerBox: "",
        disabledSheets: false,
      },
    ]);
  };

  // Handle item field changes
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // Disable sheetsPerBox if type is "Sheet"
    if (field === "type") {
      newItems[index].disabledSheets = value === "Sheet";
      if (value === "Sheet") {
        newItems[index].sheetsPerBox = "";
      }
    }
    setItems(newItems);
  };

  // Delete an item row
  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  return (
    <div className="twoColumnContainer">
      <div className="createItemContainer">
        <h2 className="itemFormTitle">Create New Item with Dimensions</h2>
        {items.map((item, index) => (
          <div className="itemFormRow" key={item.id}>
            <input
              type="text"
              className="itemInput"
              placeholder="Item Name"
              value={item.itemName}
              onChange={(e) =>
                handleItemChange(index, "itemName", e.target.value)
              }
            />
            <input
              type="text"
              className="itemInput"
              placeholder="Origin"
              value={item.origin}
              onChange={(e) =>
                handleItemChange(index, "origin", e.target.value)
              }
            />
            <select
              className="itemInput"
              value={item.type}
              onChange={(e) => handleItemChange(index, "type", e.target.value)}
            >
              <option value="Box">Box</option>
              <option value="Sheet">Sheet</option>
            </select>
            <input
              type="number"
              className="itemInput"
              placeholder="Length"
              value={item.length}
              onChange={(e) =>
                handleItemChange(index, "length", e.target.value)
              }
            />
            <input
              type="number"
              className="itemInput"
              placeholder="Width"
              value={item.width}
              onChange={(e) => handleItemChange(index, "width", e.target.value)}
            />
            <input
              type="number"
              className="itemInput"
              placeholder="Sheets per Box"
              value={item.sheetsPerBox}
              onChange={(e) =>
                handleItemChange(index, "sheetsPerBox", e.target.value)
              }
              disabled={item.disabledSheets}
            />
            <button
              className="itemDeleteBtn"
              onClick={() => deleteItem(item.id)}
            >
              <FaTrash />
            </button>
          </div>
        ))}
        <div className="buttonRow">
          <button className="itemAddBtn" onClick={addItem}>
            Add Another Item
          </button>
          <button className="itemSaveBtn">Save Items</button>
        </div>
      </div>

      <div className="additionalInfoContainer">
        <h3>Additional Information</h3>
        <p>
          This container can display newly created items, guidelines, or notes.
        </p>
      </div>
    </div>
  );
};

export default ItemFormPage;
