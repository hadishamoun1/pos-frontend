import React, { useState } from "react";
import "./items.css";

const CreateItemWithDimensions = () => {
  const [items, setItems] = useState([]);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        itemName: "",
        origin: "",
        type: "box",
        length: "",
        width: "",
        sheetsPerBox: 1,
      },
    ]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleDelete = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const saveItems = () => {
    console.log("Items saved:", items);
  };

  return (
    <div className="twoColumnContainer">
      {/* Left Container */}
      <div className="createItemContainer">
        <h2 className="itemFormTitle">Create New Item with Dimensions</h2>

        {items.map((item, index) => (
          <div key={item.id} className="itemRowWrapper">
            <div className="itemFormRow">
              {/* First Row: Item Name, Origin, Type */}
              <div className="inputRow">
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
                  onChange={(e) =>
                    handleItemChange(index, "type", e.target.value)
                  }
                >
                  <option value="box">Box</option>
                  <option value="sheet">Sheet</option>
                </select>
              </div>

              {/* Second Row: Length, Width, Sheets per Box */}
              <div className="inputRow">
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
                  onChange={(e) =>
                    handleItemChange(index, "width", e.target.value)
                  }
                />
                <input
                  type="number"
                  className="itemInput"
                  placeholder="Sheets per Box"
                  value={item.sheetsPerBox}
                  onChange={(e) =>
                    handleItemChange(index, "sheetsPerBox", e.target.value)
                  }
                  disabled={item.type === "sheet"}
                />
              </div>
            </div>
            <button
              className="itemDeleteBtn"
              onClick={() => handleDelete(item.id)}
            >
              🗑️
            </button>
          </div>
        ))}

        <div className="buttonsContainer">
          <button className="itemAddBtn" onClick={addItem}>
            Add Another Item
          </button>
          <button className="itemSaveBtn" onClick={saveItems}>
            Save Items
          </button>
        </div>
      </div>

      {/* Right Container */}
      <div className="additionalInfoContainer">
        <h2 className="itemFormTitle">Additional Information</h2>
        {/* Add additional content here as needed */}
      </div>
    </div>
  );
};

export default CreateItemWithDimensions;
