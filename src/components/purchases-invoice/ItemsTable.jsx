import React from "react";

export default function ItemsTable({
  items,
  setItems,
  openItemModal,
  currency,
  exchangeRate,
  isEditable,
  invoiceType,
}) {
  const handleItemChange = (index, field, value) => {
    if (!isEditable) return;
    const newItems = [...items];
    newItems[index][field] = value;

    const { length, width, quantity, sheetsPerBox, euroPrice, euroOfferPrice } =
      newItems[index];

    // calculate sqm
    const sqm = (length * width * quantity * sheetsPerBox) / 10000;
    newItems[index].sqm = sqm;

    // if viewing in EURO, convert euroPrice→unitPrice and euroOfferPrice→priceOFR
    if (currency === "EURO") {
      newItems[index].unitPrice = euroPrice ? euroPrice / exchangeRate : 0;
      newItems[index].priceOFR = euroOfferPrice
        ? euroOfferPrice / exchangeRate
        : 0;
    }

    // enforce invoiceType rules
    if (invoiceType === "G") {
      // Goods only: no unit price
      newItems[index].unitPrice = 0;
    } else if (invoiceType === "S") {
      // Services only: mirror unitPrice into priceOFR
      newItems[index].priceOFR = newItems[index].unitPrice;
    }
    // SR: both are user-editable, so no override

    // recalc totals
    newItems[index].total = sqm * (newItems[index].unitPrice || 0);
    newItems[index].totalOFR = sqm * (newItems[index].priceOFR || 0);

    setItems(newItems);
  };

  return (
    <div className="items-table">
      <div className="separator">
        <h3>Items</h3>
        <button
          className="select-item-button"
          onClick={openItemModal}
          disabled={!isEditable}
        >
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
            {invoiceType !== "G" && <th>Unit Price</th>}
            {currency === "EURO" && <th>Euro Offer Price</th>}
            {invoiceType !== "S" && <th>Price OFR</th>}
            <th>Total</th>
            <th>Total OFR</th>
            <th>Number of Containers</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id || index}>
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
                  disabled={!isEditable}
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
                    disabled={!isEditable}
                  />
                </td>
              )}

              {invoiceType !== "G" && (
                <td>
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
                    disabled={!isEditable}
                  />
                </td>
              )}

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
                    disabled={!isEditable}
                  />
                </td>
              )}

              {invoiceType !== "S" && (
                <td>
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
                    disabled={!isEditable}
                  />
                </td>
              )}

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
                  disabled={!isEditable}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
