import React, { useState, useEffect } from "react";
import "./items.css";

const UniqueItemsPage = () => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newItemData, setNewItemData] = useState({
    itemName: "",
    type: "box",
    thicknesses: [
      {
        thickness: "",
        variants: [
          {
            length: "",
            width: "",
            sheetsPerBox: "",
            origin: "",
            fixBox: true,
            fixLength: true,
            fixWidth: true,
          },
        ],
      },
    ],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/items/v1/filtered-items"
        );
        const data = await response.json();
        setItems(data);
      } catch (error) {
        console.error("Error fetching items:", error);
      }
    };

    fetchData();
  }, []);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleModalToggle = () => {
    setShowModal(!showModal);
  };

  const handleInputChange = (e, index = 0) => {
    const { name, value, checked, type } = e.target;

    if (type === "checkbox") {
      setNewItemData((prevState) => {
        const updated = { ...prevState };
        updated.thicknesses[0].variants[0][name] = checked;
        return updated;
      });
    } else if (name in newItemData) {
      setNewItemData((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    } else {
      setNewItemData((prevState) => {
        const updated = { ...prevState };
        updated.thicknesses[0].variants[0][name] = value;
        return updated;
      });
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        "http://localhost:3000/items/v1/create-complete-item",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newItemData),
        }
      );

      if (response.ok) {
        const newItem = await response.json();
        setItems((prevState) => [...prevState, newItem]);
        handleModalToggle();
      } else {
        console.error("Error creating new item");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const filteredItems = items.filter((item) =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="unique-items-page">
      <h1>Items</h1>
      <div className="search-bar-wrapper">
        <div className="unique-search-bar">
          <input
            type="text"
            placeholder="Search by item name"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button>Search</button>
        </div>
        <button className="new-item-button" onClick={handleModalToggle}>
          New Item
        </button>
      </div>
      <table className="unique-items-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Type</th>
            <th>Length</th>
            <th>Width</th>
            <th>Sheets per Box</th>
            <th>Origin</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) => (
            <React.Fragment key={item.id}>
              {item.thicknesses.map((thickness) => (
                <React.Fragment key={thickness.thickness}>
                  {thickness.variants.map((variant) => (
                    <tr
                      key={`${thickness.thickness}-${variant.length}-${variant.width}`}
                    >
                      <td>{`${parseFloat(thickness.thickness)}mm ${
                        item.itemName
                      }`}</td>
                      <td>{item.type}</td>
                      <td>{variant.length}</td>
                      <td>{variant.width}</td>
                      <td>{variant.sheetsPerBox}</td>
                      <td>{variant.origin}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Create New Item</h2>
            <form onSubmit={handleFormSubmit}>
              <label>
                Item Name:
                <input
                  type="text"
                  name="itemName"
                  value={newItemData.itemName}
                  onChange={handleInputChange}
                  required
                />
              </label>
              <label>
                Type:
                <select
                  name="type"
                  value={newItemData.type}
                  onChange={handleInputChange}
                >
                  <option value="box">Box</option>
                  <option value="sheet">Sheet</option>
                </select>
              </label>
              <label>
                Thickness:
                <input
                  type="number"
                  name="thickness"
                  value={newItemData.thicknesses[0].thickness}
                  onChange={(e) => handleInputChange(e)}
                  required
                />
              </label>
              <label>
                Length:
                <input
                  type="number"
                  name="length"
                  value={newItemData.thicknesses[0].variants[0].length}
                  onChange={(e) => handleInputChange(e)}
                  required
                />
              </label>
              <label>
                Width:
                <input
                  type="number"
                  name="width"
                  value={newItemData.thicknesses[0].variants[0].width}
                  onChange={(e) => handleInputChange(e)}
                  required
                />
              </label>
              <label>
                Sheets Per Box:
                <input
                  type="number"
                  name="sheetsPerBox"
                  value={newItemData.thicknesses[0].variants[0].sheetsPerBox}
                  onChange={(e) => handleInputChange(e)}
                  required
                />
              </label>
              <label>
                Origin:
                <input
                  type="text"
                  name="origin"
                  value={newItemData.thicknesses[0].variants[0].origin}
                  onChange={(e) => handleInputChange(e)}
                  required
                />
              </label>
              <div className="checkboxes">
                <label>
                  Fix Box:
                  <input
                    type="checkbox"
                    name="fixBox"
                    checked={newItemData.thicknesses[0].variants[0].fixBox}
                    onChange={(e) => handleInputChange(e)}
                  />
                </label>
                <label>
                  Fix Length:
                  <input
                    type="checkbox"
                    name="fixLength"
                    checked={newItemData.thicknesses[0].variants[0].fixLength}
                    onChange={(e) => handleInputChange(e)}
                  />
                </label>
                <label>
                  Fix Width:
                  <input
                    type="checkbox"
                    name="fixWidth"
                    checked={newItemData.thicknesses[0].variants[0].fixWidth}
                    onChange={(e) => handleInputChange(e)}
                  />
                </label>
              </div>
              <button type="submit">Create Item</button>
              <button type="button" onClick={handleModalToggle}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniqueItemsPage;
