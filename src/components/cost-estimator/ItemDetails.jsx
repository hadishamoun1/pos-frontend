import React, { useState } from "react";
import ItemModal from "./itemsModel";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/free-solid-svg-icons";

const ItemDetails = ({
  selectedItems,
  setSelectedItems,
  deleteRow,
  selectedRowIndex,
  setSelectedRowIndex,
  setShowItemModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]); // To filter items in the modal

  const handleItemSelection = (item, dimension) => {
    const updatedItems = [...selectedItems];
    if (selectedRowIndex !== null) {
      updatedItems[selectedRowIndex] = {
        ...updatedItems[selectedRowIndex],
        itemName: item.itemName,
        length: dimension.length,
        width: dimension.width,
        origin: dimension.origin,
        type: item.type,
      };
    }
    setSelectedItems(updatedItems);
    setShowModal(false); // Close modal after selection
  };

  return (
    <div className="section">
      <div className="section-title">Item Details</div>
      {selectedItems.map((item, index) => (
        <div className="item-details-row" key={index}>
          <button
            className="delete-row"
            onClick={() => deleteRow(index)}
            aria-label="Delete Row"
          >
            <FontAwesomeIcon icon={faTrashAlt} />
          </button>
          <div className="field">
            <label>Item Name</label>
            <input
              type="text"
              value={item.itemName}
              placeholder="Select item"
              readOnly
              onClick={() => {
                setSelectedRowIndex(index);
                setShowModal(true);
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
            <input
              type="text"
              value={item.fobPrice}
              onChange={(e) =>
                setSelectedItems((prev) => {
                  const updated = [...prev];
                  updated[index].fobPrice = e.target.value;
                  return updated;
                })
              }
              placeholder="Enter FOB Price"
            />
          </div>
          <div className="field">
            <label>Nb of Containers</label>
            <input
              type="text"
              value={item.numContainers}
              onChange={(e) =>
                setSelectedItems((prev) => {
                  const updated = [...prev];
                  updated[index].numContainers = e.target.value;
                  return updated;
                })
              }
              placeholder="Enter nb of containers"
            />
          </div>
        </div>
      ))}
      <button
        className="load-items-button"
        onClick={() =>
          setSelectedItems((prev) => [
            ...prev,
            {
              itemName: "",
              length: "",
              width: "",
              fobPrice: "",
              numContainers: "",
            },
          ])
        }
      >
        Add Item
      </button>

      {/* Item Modal */}
      {showModal && (
        <ItemModal
          filteredItems={filteredItems}
          searchQuery={searchQuery}
          selectedItems={selectedItems}
          setSearchQuery={setSearchQuery}
          handleItemSelection={handleItemSelection}
          closeModal={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default ItemDetails;
