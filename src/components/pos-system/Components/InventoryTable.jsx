import React from "react";

const InventoryTable = ({
  tableData,
  handleRowClick,
  handleRightClick,
  selectedRowIndex,
  handleInputChange,
}) => {
  return (
    <table className="pos-page-inventory-table">
      <thead>
        <tr>
          <th>Origin</th>
          <th>Item</th>
          <th>Type</th>
          <th>Length</th>
          <th>Width</th>
          <th>Box</th>
          <th>Sheet</th>
          <th>SQM</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {tableData.map((row, index) => (
          <tr
            key={index}
            onClick={() => handleRowClick(index)}
            onContextMenu={(e) => handleRightClick(e, index)}
            className={index === selectedRowIndex ? "pos-selected-row" : ""}
          >
            <td>
              <input type="text" value={row.origin} readOnly />
            </td>
            <td>
              <input type="text" value={row.item} readOnly />
            </td>
            <td>
              <input type="text" value={row.type} readOnly />
            </td>
            <td>
              <input type="text" value={row.length} readOnly />
            </td>
            <td>
              <input type="text" value={row.width} readOnly />
            </td>
            <td>
              <input
                type="text"
                value={row.box}
                onChange={(e) =>
                  handleInputChange(index, "box", e.target.value)
                }
                disabled={row.type === "sheet"}
              />
            </td>
            <td>
              <input
                type="text"
                value={row.sheet}
                onChange={(e) =>
                  handleInputChange(index, "sheet", e.target.value)
                }
                readOnly={row.type === "box"}
              />
            </td>
            <td>
              <input type="text" value={row.sqm} readOnly />
            </td>
            <td>
              <input
                type="number"
                value={row.price}
                onChange={(e) =>
                  handleInputChange(index, "price", e.target.value)
                }
              />
            </td>
            <td>
              <input type="text" value={row.total} readOnly />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default InventoryTable;
