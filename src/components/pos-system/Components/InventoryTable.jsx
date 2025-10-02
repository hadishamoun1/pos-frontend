const InventoryTable = ({
  tableData,
  handleRowClick,
  handleRightClick,
  selectedRowIndex,
  handleInputChange,
  isEditable, // controls whether editable fields are enabled
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
          <th>Price</th>
          <th>SQM</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {tableData.map((row, index) => {
          const canEditBox = isEditable && row.type === "box";
          const canEditSheet = isEditable && row.type === "sheet";
          const canEditSQM = isEditable && row.type === "sqm";

          return (
            <tr
              key={index}
              onClick={() => handleRowClick(index)}
              onContextMenu={(e) => handleRightClick(e, index)}
              className={index === selectedRowIndex ? "pos-selected-row" : ""}
            >
              {/* Origin (read-only) */}
              <td>
                <input type="text" value={row.origin} readOnly />
              </td>

              {/* Item (read-only) */}
              <td>
                <input type="text" value={row.item} readOnly />
              </td>

              {/* Type (read-only) */}
              <td>
                <input type="text" value={row.type} readOnly />
              </td>

              {/* Length (read-only) */}
              <td>
                <input type="text" value={row.length} readOnly />
              </td>

              {/* Width (read-only) */}
              <td>
                <input type="text" value={row.width} readOnly />
              </td>

              {/* Box (editable only when type is "box") */}
              <td>
                <input
                  type="number"
                  value={row.box ?? ""}
                  onChange={(e) => handleInputChange(index, "box", e.target.value)}
                  disabled={!canEditBox}
                  placeholder={canEditBox ? "Enter boxes…" : ""}
                />
              </td>

              {/* Sheet (editable only when type is "sheet") */}
              <td>
                <input
                  type="number"
                  value={row.sheet ?? ""}
                  onChange={(e) => handleInputChange(index, "sheet", e.target.value)}
                  disabled={!canEditSheet}
                  placeholder={canEditSheet ? "Enter sheets…" : ""}
                />
              </td>


                       {/* Price (editable when isEditable) */}
              <td>
                <input
                  type="number"
                  value={row.price ?? ""}
                  onChange={(e) => handleInputChange(index, "price", e.target.value)}
                  disabled={!isEditable}
                  step="0.01"
                  placeholder={isEditable ? "" : ""}
                />
              </td>

              {/* SQM (editable only when type is "sqm") */}
              <td>
                <input
                  type="number"
                  value={row.sqm ?? ""}
                  onChange={(e) => handleInputChange(index, "sqm", e.target.value)}
                  disabled={!canEditSQM}
                  placeholder={canEditSQM ? " " : ""}
                />
              </td>

     

              {/* Total (read-only) */}
              <td>
                <input type="text" value={row.total ?? ""} readOnly />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default InventoryTable;
