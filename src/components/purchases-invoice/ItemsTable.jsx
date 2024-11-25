import React, { useState } from "react";
import { FaTrash } from "react-icons/fa";
import UnitPriceModal from "./unitPriceModel";

const ItemsTable = ({ items, setItems, openItemModal }) => {
  const [isModalVisible, setModalVisible] = useState(false); // Modal visibility state
  const [currentItemIndex, setCurrentItemIndex] = useState(null); // Current item being edited

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    const { length, width, quantity, sheetsPerBox, unitPrice } =
      newItems[index];
    const sqm = (length * width * quantity * sheetsPerBox) / 10000;
    newItems[index].sqm = sqm;
    newItems[index].total = sqm * unitPrice;

    setItems(newItems);
  };

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const openModal = (index) => {
    setCurrentItemIndex(index);
    setModalVisible(true);
  };

  return (
    <div className="items-table">
      <div className="separator">
        <h3>Items</h3>
        <button className="select-item-button" onClick={openItemModal}>
          Select Item
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Type</th>
            <th>Origin</th>
            <th>Length (cm)</th>
            <th>Width (cm)</th>
            <th>Quantity</th>
            <th>Sheets/Box</th>
            <th>SQM</th>
            <th>Unit Price</th>
            <th>Total</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>{item.itemName}</td>
              <td>{item.type}</td>
              <td>{item.origin}</td>
              <td>{item.length}</td>
              <td>{item.width}</td>
              <td>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    handleItemChange(index, "quantity", Number(e.target.value))
                  }
                />
              </td>
              <td>{item.type === "box" ? item.sheetsPerBox : ""}</td>
              <td>{item.sqm.toFixed(2)}</td>
              <td>
                <input
                  type="number"
                  value={item.unitPrice}
                  onClick={() => openModal(index)} // Open modal on click
                  readOnly // Prevent direct input to the field
                />
              </td>
              <td>{item.total.toFixed(2)}</td>
              <td>
                <button
                  className="delete-button"
                  onClick={() => deleteItem(item.id)}
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Unit Price Modal */}
      <UnitPriceModal
        isVisible={isModalVisible}
        onClose={() => setModalVisible(false)}
        item={currentItemIndex !== null ? items[currentItemIndex] : null} // Pass current item
        onSave={(unitPrice) => {
          if (currentItemIndex !== null) {
            handleItemChange(currentItemIndex, "unitPrice", unitPrice);
          }
          setModalVisible(false);
        }}
      />
    </div>
  );
};

export default ItemsTable;
