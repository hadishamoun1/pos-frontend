import React, { useState, useEffect } from "react";
import { FaSearch } from "react-icons/fa";
import "./inventory.css";

const InventoryPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryItems, setInventoryItems] = useState([
    // Sample data; replace with actual API data
    {
      id: 1,
      itemName: "5.5mm Clear",
      origin: "China",
      length: 225,
      width: 321,
      sheetsPerBox: 25,
      unitPrice: 50.0,
      quantityUnopenedBoxes: 10,
      totalSQM: 1800.0,
    },
    {
      id: 2,
      itemName: "6mm Clear",
      origin: "USA",
      length: 200,
      width: 300,
      sheetsPerBox: 30,
      unitPrice: 55.0,
      quantityUnopenedBoxes: 15,
      totalSQM: 2700.0,
    },
  ]);

  const [filteredItems, setFilteredItems] = useState(inventoryItems);

  useEffect(() => {
    setFilteredItems(
      inventoryItems.filter((item) =>
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, inventoryItems]);

  return (
    <div className="inventory-page">
      <div className="header">
        <h2>Inventory Overview</h2>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by item name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="search-button">
            <FaSearch />
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Origin</th>
              <th>Length (cm)</th>
              <th>Width (cm)</th>
              <th>Sheets/Box</th>
              <th>Unit Price ($)</th>
              <th>Unopened Boxes</th>
              <th>Total SQM</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>{item.itemName}</td>
                <td>{item.origin}</td>
                <td>{item.length}</td>
                <td>{item.width}</td>
                <td>{item.sheetsPerBox}</td>
                <td>{item.unitPrice.toFixed(2)}</td>
                <td>{item.quantityUnopenedBoxes}</td>
                <td>{item.totalSQM.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryPage;
