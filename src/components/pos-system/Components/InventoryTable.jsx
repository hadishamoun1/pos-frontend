import React, { useState, useCallback } from "react";

const InventoryTable = ({
  tableData,
  handleRowClick,
  handleRightClick,
  selectedRowIndex,
  handleInputChange,
  isEditable,            // controls editability of inputs
  onReorder,             // (optional) parent callback: (newRows: any[]) => void
  allowReorder = true,   // extra guard to explicitly disable drag even if isEditable=true
  emptyHint = "No items selected. Click “Search” to add item batches.", // customizable
}) => {
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Only allow dragging when both flags permit it
  const canReorder = Boolean(allowReorder && isEditable);

  const reorder = useCallback((list, startIndex, endIndex) => {
    const result = [...list];
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  }, []);

  const handleDragStart = (e, index) => {
    if (!canReorder) return;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    if (e.dataTransfer.setDragImage) {
      const ghost = document.createElement("div");
      ghost.style.position = "absolute";
      ghost.style.top = "-99999px";
      ghost.style.left = "-99999px";
      ghost.style.padding = "8px 12px";
      ghost.style.background = "#e2e8f0";
      ghost.style.borderRadius = "6px";
      ghost.style.font = "14px system-ui, sans-serif";
      ghost.textContent = "Move row";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
  };

  const handleDragOver = (e, index) => {
    if (!canReorder) return;
    e.preventDefault();
    if (index !== dragOverIndex) setDragOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, index) => {
    if (!canReorder) return;
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = reorder(tableData, dragIndex, index);
    if (onReorder) onReorder(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    if (!canReorder) return;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const columns = 10; // keep this in sync with the header/inputs

  const isEmpty = !Array.isArray(tableData) || tableData.length === 0;

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

      {isEmpty ? (
        <tbody>
          <tr className="pos-empty-row">
            <td colSpan={columns} style={{ textAlign: "center", padding: "16px", opacity: 0.7 }}>
              {emptyHint}
            </td>
          </tr>
        </tbody>
      ) : (
        <tbody>
          {tableData.map((row, index) => {
            const canEditBox = isEditable && row.type === "box";
            const canEditSheet = isEditable && row.type === "sheet";
            const canEditSQM = isEditable && row.type === "sqm";

            const isSelected = index === selectedRowIndex;
            const isDragSource = canReorder && index === dragIndex;
            const isDragOver = canReorder && dragOverIndex === index;

            return (
              <tr
                key={index}
                onClick={() => handleRowClick(index)}
                onContextMenu={(e) => handleRightClick(e, index)}
                draggable={canReorder}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={[
                  isSelected ? "pos-selected-row" : "",
                  isDragSource ? "row-dragging" : "",
                  isDragOver ? "row-dragover" : "",
                  !canReorder ? "drag-disabled" : "",
                ]
                  .join(" ")
                  .trim()}
                aria-grabbed={isDragSource || undefined}
                aria-disabled={!canReorder || undefined}
                data-row-index={index}
                title={!canReorder ? "Reordering disabled" : undefined}
              >
                <td>
                  <input type="text" value={row.origin ?? ""} readOnly />
                </td>
                <td>
                  <input type="text" value={row.item ?? ""} readOnly />
                </td>
                <td>
                  <input type="text" value={row.type ?? ""} readOnly />
                </td>
                <td>
                  <input type="text" value={row.length ?? ""} readOnly />
                </td>
                <td>
                  <input type="text" value={row.width ?? ""} readOnly />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.box ?? ""}
                    onChange={(e) => handleInputChange(index, "box", e.target.value)}
                    disabled={!canEditBox}
                    placeholder={canEditBox ? "Enter boxes…" : ""}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.sheet ?? ""}
                    onChange={(e) => handleInputChange(index, "sheet", e.target.value)}
                    disabled={!canEditSheet}
                    placeholder={canEditSheet ? "Enter sheets…" : ""}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.price ?? ""}
                    onChange={(e) => handleInputChange(index, "price", e.target.value)}
                    disabled={!isEditable}
                    step="0.01"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.sqm ?? ""}
                    onChange={(e) => handleInputChange(index, "sqm", e.target.value)}
                    disabled={!canEditSQM}
                    placeholder={canEditSQM ? " " : ""}
                  />
                </td>
                <td>
                  <input type="text" value={row.total ?? ""} readOnly />
                </td>
              </tr>
            );
          })}
        </tbody>
      )}
    </table>
  );
};

export default InventoryTable;
