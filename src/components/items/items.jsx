import React, { useState } from "react";
import { FaPlusCircle, FaTrash } from "react-icons/fa";
import "./items.css";

const NewItem = () => {
  const [item, setItem] = useState({
    itemName: "",
    type: "box",
    origin: "",
    dimensions: [{ length: "", width: "", sheetsPerBox: "" }],
  });

  const handleItemChange = (e) => {
    setItem({ ...item, [e.target.name]: e.target.value });
  };

  const handleDimensionChange = (index, field, value) => {
    const updatedDimensions = [...item.dimensions];
    updatedDimensions[index][field] = value;
    setItem({ ...item, dimensions: updatedDimensions });
  };

  const addDimension = () => {
    setItem({
      ...item,
      dimensions: [
        ...item.dimensions,
        { length: "", width: "", sheetsPerBox: "" },
      ],
    });
  };

  const deleteDimension = (index) => {
    const updatedDimensions = item.dimensions.filter((_, i) => i !== index);
    setItem({ ...item, dimensions: updatedDimensions });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Item created:", item);
  };

  return (
    <div className="new-item-container">
      <h2>Create New Item</h2>
      <form onSubmit={handleSubmit} className="item-form">
        <label>
          Item Name
          <input
            type="text"
            name="itemName"
            value={item.itemName}
            onChange={handleItemChange}
            placeholder="Enter item name"
            required
          />
        </label>
        <label>
          Type
          <select name="type" value={item.type} onChange={handleItemChange}>
            <option value="box">Box</option>
            <option value="sheet">Sheet</option>
          </select>
        </label>
        <label>
          Origin
          <input
            type="text"
            name="origin"
            value={item.origin}
            onChange={handleItemChange}
            placeholder="Enter origin"
            required
          />
        </label>

        <h3>Dimensions</h3>
        {item.dimensions.map((dim, index) => (
          <div key={index} className="dimension-card">
            <div className="dimension-fields">
              <label>
                Length (cm)
                <input
                  type="number"
                  value={dim.length}
                  onChange={(e) =>
                    handleDimensionChange(index, "length", e.target.value)
                  }
                  placeholder="Length"
                  required
                />
              </label>
              <label>
                Width (cm)
                <input
                  type="number"
                  value={dim.width}
                  onChange={(e) =>
                    handleDimensionChange(index, "width", e.target.value)
                  }
                  placeholder="Width"
                  required
                />
              </label>
              <label className="sheets-box-label">
                Sheets per Box
                <input
                  type="number"
                  value={dim.sheetsPerBox}
                  onChange={(e) =>
                    handleDimensionChange(index, "sheetsPerBox", e.target.value)
                  }
                  placeholder="Sheets per Box"
                  disabled={item.type === "sheet"} // Disable if item type is "sheet"
                />
              </label>
              <button
                type="button"
                className="delete-dimension"
                onClick={() => deleteDimension(index)}
              >
                <FaTrash /> Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addDimension}
          className="add-dimension-button"
        >
          <FaPlusCircle /> Add Another Dimension
        </button>

        <button type="submit" className="save-button">
          Save Item
        </button>
      </form>
    </div>
  );
};

export default NewItem;
