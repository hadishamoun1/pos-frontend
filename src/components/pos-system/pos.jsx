import React, { useState } from "react";
import "./pos.css";

const POSSystemPage = () => {
  const [tableData, setTableData] = useState([
    {
      origin: "",
      item: "",
      box: "",
      sheet: "",
      quantity: "",
      sqm: "",
      price: "",
    },
  ]);

  // Set the current date as default for the date input
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  const handleInputChange = (index, field, value) => {
    const newData = [...tableData];
    newData[index][field] = value;
    setTableData(newData);
  };

  const addRow = () => {
    setTableData([
      ...tableData,
      {
        origin: "",
        item: "",
        box: "",
        sheet: "",
        quantity: "",
        sqm: "",
        price: "",
      },
    ]);
  };

  const deleteRow = (index) => {
    const newData = tableData.filter((_, i) => i !== index);
    setTableData(newData);
  };

  return (
    <div className="pos-container">
      <div className="pos-left">Left Container</div>

      <div className="pos-center">
        {/* Toolbar section */}
        <div className="toolbar">
          <div className="button-row">
            <button className="toolbar-button blue-button">New</button>
            <button className="toolbar-button blue-button">Request</button>
            <button className="toolbar-button red-button">Issue</button>
            <button className="toolbar-button yellow-button">Offer</button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="date-input"
            />
          </div>
          <div className="input-row">
            <select className="exchange-rate-dropdown">
              <option value="usd">USD Exchange Rate</option>
              <option value="eur">EUR Exchange Rate</option>
            </select>
            <label className="checkbox-container">
              <input type="checkbox" />
              <span className="checkbox-label">Company Name</span>
            </label>
          </div>
        </div>

        <table className="inventory-table">
          <thead>
            <tr>
              <th></th> {/* Empty header for delete button */}
              <th>Origin</th>
              <th>Item</th>
              <th>Box</th>
              <th>Sheet</th>
              <th>Quantity</th>
              <th>SQM</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={index}>
                <td className="delete-cell">
                  <button
                    className="delete-button"
                    onClick={() => deleteRow(index)}
                  >
                    🗑️
                  </button>
                </td>
                <td>
                  <input
                    type="text"
                    value={row.origin}
                    onChange={(e) =>
                      handleInputChange(index, "origin", e.target.value)
                    }
                    placeholder="Enter origin"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.item}
                    onChange={(e) =>
                      handleInputChange(index, "item", e.target.value)
                    }
                    placeholder="Enter item"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.box}
                    onChange={(e) =>
                      handleInputChange(index, "box", e.target.value)
                    }
                    placeholder="Enter box"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.sheet}
                    onChange={(e) =>
                      handleInputChange(index, "sheet", e.target.value)
                    }
                    placeholder="Enter sheet"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.quantity}
                    onChange={(e) =>
                      handleInputChange(index, "quantity", e.target.value)
                    }
                    placeholder="Enter quantity"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.sqm}
                    onChange={(e) =>
                      handleInputChange(index, "sqm", e.target.value)
                    }
                    placeholder="Enter sqm"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.price}
                    onChange={(e) =>
                      handleInputChange(index, "price", e.target.value)
                    }
                    placeholder="Enter price"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="button-container">
          <button onClick={addRow} className="add-row-button">
            Add Row
          </button>
        </div>
      </div>

      <div className="pos-right">Right Container</div>
    </div>
  );
};

export default POSSystemPage;
