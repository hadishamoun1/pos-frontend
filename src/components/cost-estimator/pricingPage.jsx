import React, { useState } from "react";
import ItemModal from "./itemsModel"; // Import the ItemModal
import "./pricingPage.css";

// Sample items with dimensions
const itemsList = [
  {
    id: 1,
    itemName: "Item 1",
    type: "Type A",
    dimensions: [
      {
        dimensionId: 1,
        origin: "Origin A",
        length: 100,
        width: 50,
        sheetsPerBox: 10,
      },
    ],
  },
  {
    id: 2,
    itemName: "Item 2",
    type: "Type B",
    dimensions: [
      {
        dimensionId: 2,
        origin: "Origin B",
        length: 200,
        width: 100,
        sheetsPerBox: 20,
      },
    ],
  },
];

const PricingPage = () => {
  const [selectedItems, setSelectedItems] = useState([
    { itemName: "", length: "", width: "", fobPrice: 0, numContainers: 0 },
  ]); // Initial empty row
  const [showItemModal, setShowItemModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowIndex, setSelectedRowIndex] = useState(null); // Track the selected row index

  // Filter items based on search query
  const filteredItems = itemsList.filter((item) =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle checkbox selection
  const handleCheckboxChange = (item, dimension) => {
    const updatedItems = [...selectedItems];
    if (selectedRowIndex !== null) {
      updatedItems[selectedRowIndex] = {
        itemName: item.itemName,
        origin: dimension.origin,
        length: dimension.length,
        width: dimension.width,
        type: item.type,
        fobPrice: updatedItems[selectedRowIndex].fobPrice, // Retain existing values
        numContainers: updatedItems[selectedRowIndex].numContainers, // Retain existing values
      };
    }
    setSelectedItems(updatedItems);
    setShowItemModal(false); // Close the modal after selection
  };

  // Add new empty row
  const addEmptyRow = () => {
    setSelectedItems((prev) => [
      ...prev,
      { itemName: "", length: "", width: "", fobPrice: 0, numContainers: 0 },
    ]);
  };

  // Close the item modal
  const closeItemModal = () => {
    setShowItemModal(false);
  };

  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <button className="cancel-button">Cancel</button>
        <h1 className="underlined-title">Pricing Details</h1>
        <button className="save-button">Save</button>
      </header>

      <div className="pricing-container">
        {/* Item Details Section */}
        <div className="section">
          <div className="section-title">Item Details</div>
          {selectedItems.map((item, index) => (
            <div className="item-details-row" key={index}>
              <div className="field">
                <label>Item Name</label>
                <input
                  type="text"
                  value={item.itemName}
                  placeholder="Select item"
                  readOnly
                  onClick={() => {
                    setSelectedRowIndex(index); // Set the index of the row being edited
                    setShowItemModal(true); // Open modal on click
                  }}
                />
              </div>
              <div className="field">
                <label>Length (cm)</label>
                <input
                  type="number"
                  value={item.length}
                  placeholder="Auto-filled"
                  readOnly
                />
              </div>
              <div className="field">
                <label>Width (cm)</label>
                <input
                  type="number"
                  value={item.width}
                  placeholder="Auto-filled"
                  readOnly
                />
              </div>
              <div className="field">
                <label>FOB Price</label>
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input
                    type="text"
                    value={item.fobPrice}
                    onChange={(e) =>
                      setSelectedItems((prev) => {
                        const updated = [...prev];
                        updated[index].fobPrice = Number(e.target.value);
                        return updated;
                      })
                    }
                    placeholder="Enter FOB Price"
                  />
                </div>
              </div>
              <div className="field">
                <label>Number of Containers</label>
                <input
                  type="text"
                  value={item.numContainers}
                  onChange={(e) =>
                    setSelectedItems((prev) => {
                      const updated = [...prev];
                      updated[index].numContainers = Number(e.target.value);
                      return updated;
                    })
                  }
                  placeholder="Enter number of containers"
                />
              </div>
            </div>
          ))}
          <button className="load-items-button" onClick={addEmptyRow}>
            Add Item
          </button>
        </div>

        {/* Item Modal */}
        {showItemModal && (
          <ItemModal
            filteredItems={filteredItems}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedItems={selectedItems}
            handleCheckboxChange={handleCheckboxChange}
            closeItemModal={closeItemModal}
          />
        )}
      </div>
    </div>
  );
};

export default PricingPage;
