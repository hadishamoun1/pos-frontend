const InventoryTable = ({
  tableData,
  handleRowClick,
  handleRightClick,
  selectedRowIndex,
  handleInputChange,
  isEditable, // This controls whether fields are editable
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
            {/* Origin (Always non-editable) */}
            <td>
              <input type="text" value={row.origin} readOnly={true} />
            </td>

            {/* Item (Always non-editable) */}
            <td>
              <input type="text" value={row.item} readOnly={true} />
            </td>

            {/* Type (Always non-editable) */}
            <td>
              <input type="text" value={row.type} readOnly={true} />
            </td>

            {/* Length (Always non-editable) */}
            <td>
              <input type="text" value={row.length} readOnly={true} />
            </td>

            {/* Width (Always non-editable) */}
            <td>
              <input type="text" value={row.width} readOnly={true} />
            </td>

            {/* Box (Editable when type is "box" and isEditable is true) */}
            <td>
              <input
                type="text"
                value={row.box}
                onChange={(e) =>
                  handleInputChange(index, "box", e.target.value)
                }
                disabled={row.type === "sheet" || !isEditable}
              />
            </td>

            {/* Sheet (Editable when type is "sheet" and isEditable is true) */}
            <td>
              <input
                type="text"
                value={row.sheet}
                onChange={(e) =>
                  handleInputChange(index, "sheet", e.target.value)
                }
                readOnly={!(row.type === "sheet" && isEditable)} // Editable if type is sheet and isEditable is true
              />
            </td>

            {/* SQM (Always non-editable) */}
            <td>
              <input type="text" value={row.sqm} readOnly={true} />
            </td>

            {/* Price (Editable when isEditable is true) */}
            <td>
              <input
                type="number"
                value={row.price}
                onChange={(e) =>
                  handleInputChange(index, "price", e.target.value)
                }
                readOnly={!isEditable} // Editable if isEditable is true
              />
            </td>

            {/* Total (Always non-editable) */}
            <td>
              <input type="text" value={row.total} readOnly={true} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default InventoryTable;
