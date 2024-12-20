import React, { useState, useEffect } from "react";
import "./items.css";

const UniqueItemsPage = () => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

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

  const filteredItems = items.filter((item) =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="unique-items-page">
      <h1>Items</h1>
      <div className="unique-search-bar">
        <input
          type="text"
          placeholder="Search by item name"
          value={searchTerm}
          onChange={handleSearchChange}
        />
        <button>Search</button>
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
    </div>
  );
};

export default UniqueItemsPage;
