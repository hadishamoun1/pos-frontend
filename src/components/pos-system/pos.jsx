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
