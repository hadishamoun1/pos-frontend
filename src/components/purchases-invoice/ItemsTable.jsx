import React, { useState } from "react";
import { FaTrash } from "react-icons/fa";
import UnitPriceModal from "./unitPriceModel";

const ItemsTable = ({
  items,
  setItems,
  openItemModal,
  currency,
  exchangeRate,
}) => {
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    const { length, width, quantity, sheetsPerBox, euroPrice, euroOfferPrice } =
      newItems[index];

    const sqm = (length * width * quantity * sheetsPerBox) / 10000;

    // Calculate values based on the currency
    if (currency === "EURO") {
      newItems[index].unitPrice = euroPrice ? euroPrice / exchangeRate : null;
      newItems[index].priceOFR = euroOfferPrice
        ? euroOfferPrice / exchangeRate
        : null;
    }

    const total = sqm * (newItems[index].unitPrice || 0);
    const totalOFR = sqm * (newItems[index].priceOFR || 0);

    newItems[index].sqm = sqm;
    newItems[index].total = total;
    newItems[index].totalOFR = totalOFR;

    setItems(newItems);
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
            {currency === "EURO" && <th>Euro Price</th>}
            <th>Unit Price</th>
            {currency === "EURO" && <th>Euro Offer Price</th>}
            <th>Price OFR</th>
            <th>Total</th>
            <th>Total OFR</th>
            <th>Number of Containers</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>{item.itemName}</td>
              <td>{item.type}</td>
              <td>{item.origin}</td>
              <td>{item.length || 0}</td>
              <td>{item.width || 0}</td>
              <td>
                <input
                  type="number"
                  value={item.quantity || 0}
                  onChange={(e) =>
                    handleItemChange(index, "quantity", Number(e.target.value))
                  }
                />
              </td>
              <td>{item.type === "box" ? item.sheetsPerBox || 0 : ""}</td>
              <td>{(item.sqm || 0).toFixed(2)}</td>
              {currency === "EURO" && (
                <td>
                  <input
                    type="number"
                    value={item.euroPrice || 0}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "euroPrice",
                        Number(e.target.value)
                      )
                    }
                  />
                </td>
              )}
              <td>
                {currency === "EURO" ? (
                  (item.unitPrice || 0).toFixed(2)
                ) : (
                  <input
                    type="number"
                    value={item.unitPrice || 0}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "unitPrice",
                        Number(e.target.value)
                      )
                    }
                  />
                )}
              </td>
              {currency === "EURO" && (
                <td>
                  <input
                    type="number"
                    value={item.euroOfferPrice || 0}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "euroOfferPrice",
                        Number(e.target.value)
                      )
                    }
                  />
                </td>
              )}
              <td>
                {currency === "EURO" ? (
                  (item.priceOFR || 0).toFixed(2)
                ) : (
                  <input
                    type="number"
                    value={item.priceOFR || 0}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "priceOFR",
                        Number(e.target.value)
                      )
                    }
                  />
                )}
              </td>
              <td>{(item.total || 0).toFixed(2)}</td>
              <td>{(item.totalOFR || 0).toFixed(2)}</td>
              <td>
                <input
                  type="number"
                  value={item.numberOfContainers || 0}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      "numberOfContainers",
                      Number(e.target.value)
                    )
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ItemsTable;
