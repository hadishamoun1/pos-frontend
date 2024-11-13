import React, { useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import "./item-creation.css";

const ItemCreationPage = () => {
  const [itemName, setItemName] = useState("");
  const [itemType, setItemType] = useState("box");
  const [itemOrigin, setItemOrigin] = useState("");
  const [dimensions, setDimensions] = useState([]);
  const [dimensionForm, setDimensionForm] = useState({
    length: "",
    width: "",
    sheetsPerBox: "",
    quantityUnopenedBoxes: "",
    origin: "",
  });

  // Add new dimension to the dimensions array
  const addDimension = () => {
    setDimensions([...dimensions, { ...dimensionForm, id: Date.now() }]);
    setDimensionForm({
      length: "",
      width: "",
      sheetsPerBox: "",
      quantityUnopenedBoxes: "",
      origin: "",
    });
  };

  // Delete a dimension
  const deleteDimension = (id) => {
    setDimensions(dimensions.filter((dim) => dim.id !== id));
  };

  // Handle dimension form input changes
  const handleDimensionChange = (field, value) => {
    setDimensionForm({ ...dimensionForm, [field]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newItem = {
      itemName,
      itemType,
      itemOrigin,
      dimensions,
    };
    console.log("New Item Created:", newItem);
    // Reset form
    setItemName("");
    setItemType("box");
    setItemOrigin("");
    setDimensions([]);
  };

  return (
    <div className="item-creation-container">
      <h2>Create New Item</h2>
      <form onSubmit={handleSubmit} className="item-form">
        <div className="item-details">
          <label>
            Item Name
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
              placeholder="Enter item name"
            />
          </label>
          <label>
            Item Type
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
            >
              <option value="box">Box</option>
              <option value="sheet">Sheet</option>
            </select>
          </label>
          <label>
            Origin
            <input
              type="text"
              value={itemOrigin}
              onChange={(e) => setItemOrigin(e.target.value)}
              placeholder="Enter origin"
            />
          </label>
        </div>

        <div className="dimensions-section">
          <h3>Dimensions</h3>
          <div className="dimension-form">
            <label>
              Length (cm)
              <input
                type="number"
                value={dimensionForm.length}
                onChange={(e) =>
                  handleDimensionChange("length", e.target.value)
                }
              />
            </label>
            <label>
              Width (cm)
              <input
                type="number"
                value={dimensionForm.width}
                onChange={(e) => handleDimensionChange("width", e.target.value)}
              />
            </label>
            <label>
              Sheets Per Box
              <input
                type="number"
                value={dimensionForm.sheetsPerBox}
                onChange={(e) =>
                  handleDimensionChange("sheetsPerBox", e.target.value)
                }
              />
            </label>
            <label>
              Quantity Unopened Boxes
              <input
                type="number"
                value={dimensionForm.quantityUnopenedBoxes}
                onChange={(e) =>
                  handleDimensionChange("quantityUnopenedBoxes", e.target.value)
                }
              />
            </label>
            <label>
              Origin
              <input
                type="text"
                value={dimensionForm.origin}
                onChange={(e) =>
                  handleDimensionChange("origin", e.target.value)
                }
              />
            </label>
            <button
              type="button"
              onClick={addDimension}
              className="add-dimension-button"
            >
              <FaPlus /> Add Dimension
            </button>
          </div>

          <div className="dimensions-list">
            {dimensions.map((dimension) => (
              <div key={dimension.id} className="dimension-entry">
                <span>
                  {dimension.length} x {dimension.width} cm,{" "}
                  {dimension.sheetsPerBox} sheets/box,{" "}
                  {dimension.quantityUnopenedBoxes} unopened boxes,{" "}
                  {dimension.origin}
                </span>
                <button
                  onClick={() => deleteDimension(dimension.id)}
                  className="delete-button"
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="save-button">
          Save Item
        </button>
      </form>
    </div>
  );
};

export default ItemCreationPage;
