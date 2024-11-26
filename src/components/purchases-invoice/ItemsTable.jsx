import React, { useState } from "react";
import { FaTrash } from "react-icons/fa";
import UnitPriceModal from "./unitPriceModel";

const ItemsTable = ({ items, setItems, openItemModal }) => {
  const [isModalVisible, setModalVisible] = useState(false); // Modal visibility state
  const [currentItemIndex, setCurrentItemIndex] = useState(null); // Current item being edited

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    const { length, width, quantity, sheetsPerBox, unitPrice, priceOFR } =
      newItems[index];
    const sqm = (length * width * quantity * sheetsPerBox) / 10000;
    const total = sqm * unitPrice;
    const totalOFR = sqm * (priceOFR || 0);
    newItems[index].sqm = sqm;
    newItems[index].total = sqm * unitPrice;
    newItems[index].totalOFR = totalOFR;

    setItems(newItems);
  };

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
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
            <th>Price OFR</th>
            <th>Total</th>
            <th>Total OFR</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>{item.itemName}</td>
              <td>{item.type}</td>
              <td>{item.origin}</td>
              <td>{item.length || 0}</td> {/* Default to 0 if undefined */}
              <td>{item.width || 0}</td> {/* Default to 0 if undefined */}
              <td>
                <input
                  type="number"
                  value={item.quantity || 0} // Default to 0 if undefined
                  onChange={(e) =>
                    handleItemChange(index, "quantity", Number(e.target.value))
                  }
                />
              </td>
              <td>{item.type === "box" ? item.sheetsPerBox || 0 : ""}</td>{" "}
              {/* Default to 0 */}
              <td>{(item.sqm || 0).toFixed(2)}</td>{" "}
              {/* Default to 0 before .toFixed() */}
              <td>
                <input
                  type="number"
                  value={item.unitPrice || 0} // Default to 0 if undefined
                  onChange={(e) =>
                    handleItemChange(index, "unitPrice", Number(e.target.value))
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.priceOFR || 0} // Input for Price OFR
                  onChange={(e) =>
                    handleItemChange(index, "priceOFR", Number(e.target.value))
                  }
                />
              </td>
              <td>{(item.total || 0).toFixed(2)}</td>{" "}
              {/* Default to 0 before .toFixed() */}
              <td>{(item.totalOFR || 0).toFixed(2)}</td>{" "}
              {/* Default to 0 before .toFixed() */}
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
    </div>
  );
};

export default ItemsTable;
