import React, { useState, useCallback, useRef } from "react";

const InventoryTable = ({
  tableData,
  handleRowClick,
  handleRightClick,
  selectedRowIndex,
  handleInputChange,
  isEditable,
  onReorder,
  allowReorder = true,
  emptyHint = "No items selected. Click “Search” to add item batches.",
  cutMode = false,
  currencyCode = "USD", 
}) => {
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
const currRaw = String(currencyCode ?? "").toUpperCase().trim();
const currNorm = currRaw.replace(/[^A-Z]/g, "");
const isLLCurrency = currNorm === "LL" || currNorm === "LBP";
          


  // Only allow dragging when both flags permit it
  const canReorder = Boolean(allowReorder && isEditable);

  // === Grid navigation setup ===
  // Order of inputs we want to navigate with arrows/enter
  const COLS = ["length", "width", "box", "sheet", "price"];

  // store refs by rowKey + colKey
  const inputRefs = useRef(new Map()); // key => HTMLInputElement | null

  const refKey = (rowKey, colKey) => `${rowKey}::${colKey}`;

  const setRef = (rowKey, colKey) => (el) => {
    inputRefs.current.set(refKey(rowKey, colKey), el);
  };

  const focusCell = (rowIdx, colKey) => {
    const row = tableData?.[rowIdx];
    if (!row) return false;
    const el = inputRefs.current.get(refKey(row.__rowKey, colKey));
    if (!el || el.disabled) return false;
    el.focus();
    // select content so editing is fast
    if (typeof el.select === "function") el.select();
    return true;
  };

  const getType = (row) => String(row?.type ?? "").toLowerCase();

  const canEditField = (row, colKey) => {
    const type = getType(row);
    const isSQM = type === "sqm";

    const allowCutDims = cutMode && (type === "box" || type === "sheet");
    const allowCutSPB = cutMode && type === "box";

    const canEditBox = isEditable && type === "box";
    const canEditSheet =
      isEditable &&
      (type === "sheet" || type === "sqm" || type === "unit" || allowCutSPB);

    const canEditLength = isEditable && (isSQM || allowCutDims);
    const canEditWidth = isEditable && (isSQM || allowCutDims);

    const canEditPrice = Boolean(isEditable);

    switch (colKey) {
      case "length":
        return canEditLength;
      case "width":
        return canEditWidth;
      case "box":
        return canEditBox;
      case "sheet":
        return canEditSheet;
      case "price":
        return canEditPrice;
      default:
        return false;
    }
  };

  const findFocusableInRow = (rowIdx, preferredColIdx) => {
    const row = tableData?.[rowIdx];
    if (!row) return null;

    // try preferred first
    if (preferredColIdx >= 0 && preferredColIdx < COLS.length) {
      const k = COLS[preferredColIdx];
      if (canEditField(row, k)) return { rowIdx, colKey: k };
    }

    // scan right
    for (let c = preferredColIdx + 1; c < COLS.length; c++) {
      const k = COLS[c];
      if (canEditField(row, k)) return { rowIdx, colKey: k };
    }

    // scan left
    for (let c = preferredColIdx - 1; c >= 0; c--) {
      const k = COLS[c];
      if (canEditField(row, k)) return { rowIdx, colKey: k };
    }

    return null;
  };

  const moveFocus = (fromRowIdx, fromColKey, dir) => {
    const len = Array.isArray(tableData) ? tableData.length : 0;
    if (!len) return;

    const fromColIdx = COLS.indexOf(fromColKey);
    if (fromColIdx < 0) return;

    // RIGHT / ENTER: go next col; if end row -> next row start
    if (dir === "right" || dir === "enter") {
      let r = fromRowIdx;
      let c = fromColIdx + 1;

      while (r < len) {
        while (c < COLS.length) {
          const row = tableData[r];
          const k = COLS[c];
          if (canEditField(row, k) && focusCell(r, k)) return;
          c++;
        }
        r++;
        c = 0;
      }
      return;
    }

    // LEFT: go previous col; if start row -> previous row end
    if (dir === "left") {
      let r = fromRowIdx;
      let c = fromColIdx - 1;

      while (r >= 0) {
        while (c >= 0) {
          const row = tableData[r];
          const k = COLS[c];
          if (canEditField(row, k) && focusCell(r, k)) return;
          c--;
        }
        r--;
        c = COLS.length - 1;
      }
      return;
    }

    // DOWN: same col in next row (fallback to nearest enabled in that row)
    if (dir === "down") {
      for (let r = fromRowIdx + 1; r < len; r++) {
        const pick = findFocusableInRow(r, fromColIdx);
        if (pick && focusCell(pick.rowIdx, pick.colKey)) return;
      }
      return;
    }

    // UP: same col in prev row (fallback to nearest enabled in that row)
    if (dir === "up") {
      for (let r = fromRowIdx - 1; r >= 0; r--) {
        const pick = findFocusableInRow(r, fromColIdx);
        if (pick && focusCell(pick.rowIdx, pick.colKey)) return;
      }
      return;
    }
  };

  const handleGridKeyDown = (e, rowIdx, colKey) => {
    // don’t hijack shortcuts
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const k = e.key;

    if (k === "ArrowRight") {
      e.preventDefault();
      moveFocus(rowIdx, colKey, "right");
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      moveFocus(rowIdx, colKey, "left");
    } else if (k === "ArrowDown") {
      e.preventDefault();
      moveFocus(rowIdx, colKey, "down");
    } else if (k === "ArrowUp") {
      e.preventDefault();
      moveFocus(rowIdx, colKey, "up");
    } else if (k === "Enter") {
      e.preventDefault();
      moveFocus(rowIdx, colKey, "enter");
    }
  };

  // ✅ Wheel fix: prevent number stepping + avoid React event null crash
  // Using capture + preventDefault ONLY when focused. It will not crash.
  const handleWheelNoStep = (e) => {
    const el = e.currentTarget;
    if (!el) return;

    if (document.activeElement === el) {
      e.preventDefault(); // stops the value increment/decrement
      el.blur();          // next wheel scroll will work normally
    }
  };

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

  const columns = 10;
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
            const type = String(row.type ?? "").toLowerCase();
            const isSQM = type === "sqm";

            const allowCutDims = cutMode && (type === "box" || type === "sheet");
            const allowCutSPB = cutMode && type === "box";

            const canEditBox = isEditable && type === "box";
            const canEditSheet =
              isEditable && (type === "sheet" || type === "sqm" || type === "unit" || allowCutSPB);

            const canEditLength = isEditable && (isSQM || allowCutDims);
            const canEditWidth = isEditable && (isSQM || allowCutDims);

            const isSelected = index === selectedRowIndex;
            const isDragSource = canReorder && index === dragIndex;
            const isDragOver = canReorder && dragOverIndex === index;

            const originalLen = row.originalLength;
            const originalWid = row.originalWidth;
            const originalSpb = row.originalSheetsPerBox;

            const hasOrigDims =
              originalLen != null &&
              originalWid != null &&
              (Number(row.length) !== Number(originalLen) || Number(row.width) !== Number(originalWid));

            const hasOrigSpb =
              type === "box" && originalSpb != null && Number(row.sheet) !== Number(originalSpb);

            const dimsTooltip = hasOrigDims ? `Original: ${originalLen} × ${originalWid}` : "";
            const spbTooltip = hasOrigSpb ? `sheets/box: ${originalSpb}` : "";

            const unitTotal =
              type === "unit"
                ? ((Number(row.sheet) || 0) * (Number(row.price) || 0)).toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 0,
                  })
                : null;

            return (
              <tr
                key={row.__rowKey}
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
                  hasOrigDims ? "row-has-cut" : "",
                ]
                  .join(" ")
                  .trim()}
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

                {/* LENGTH */}
                <td>
                  <div className={"pos-tooltip-wrapper" + (hasOrigDims ? " has-tooltip" : "")} data-tooltip={dimsTooltip}>
                    <input
                      ref={setRef(row.__rowKey, "length")}
                      type="number"
                      value={row.length ?? ""}
                      onChange={(e) => handleInputChange(index, "length", e.target.value)}
                      disabled={!canEditLength}
                      placeholder={canEditLength ? "Length" : ""}
                      onKeyDown={(e) => handleGridKeyDown(e, index, "length")}
                      onWheelCapture={handleWheelNoStep}
                    />
                  </div>
                </td>

                {/* WIDTH */}
                <td>
                  <div className={"pos-tooltip-wrapper" + (hasOrigDims ? " has-tooltip" : "")} data-tooltip={dimsTooltip}>
                    <input
                      ref={setRef(row.__rowKey, "width")}
                      type="number"
                      value={row.width ?? ""}
                      onChange={(e) => handleInputChange(index, "width", e.target.value)}
                      disabled={!canEditWidth}
                      placeholder={canEditWidth ? "Width" : ""}
                      onKeyDown={(e) => handleGridKeyDown(e, index, "width")}
                      onWheelCapture={handleWheelNoStep}
                    />
                  </div>
                </td>

                {/* BOX */}
                <td>
                  <input
                    ref={setRef(row.__rowKey, "box")}
                    type="number"
                    value={row.box ?? ""}
                    onChange={(e) => handleInputChange(index, "box", e.target.value)}
                    disabled={!canEditBox}
                    placeholder={canEditBox ? "Enter boxes…" : ""}
                    onKeyDown={(e) => handleGridKeyDown(e, index, "box")}
                    onWheelCapture={handleWheelNoStep}
                  />
                </td>

                {/* SHEET */}
                <td>
                  <div className={"pos-tooltip-wrapper" + (hasOrigSpb ? " has-tooltip" : "")} data-tooltip={spbTooltip}>
                    <input
                      ref={setRef(row.__rowKey, "sheet")}
                      type="number"
                      value={row.sheet ?? ""}
                      onChange={(e) => handleInputChange(index, "sheet", e.target.value)}
                      disabled={!canEditSheet}
                      placeholder={
                        canEditSheet
                          ? type === "box"
                            ? "Sheets/box…"
                            : type === "unit"
                            ? "Enter qty…"
                            : "Enter sheets…"
                          : ""
                      }
                      onKeyDown={(e) => handleGridKeyDown(e, index, "sheet")}
                      onWheelCapture={handleWheelNoStep}
                    />
                  </div>
                </td>

                {/* PRICE */}
                <td>
                  <input
                    ref={setRef(row.__rowKey, "price")}
                    type="number"
                    value={row.price ?? ""}
                    onChange={(e) => handleInputChange(index, "price", e.target.value)}
                    disabled={!isEditable}
                    step="0.01"
                    onKeyDown={(e) => handleGridKeyDown(e, index, "price")}
                    onWheelCapture={handleWheelNoStep}
                  />
                </td>

            {/* SQM */}
<td>
  <input
    type="number"
    value={row.sqm ?? ""}
    readOnly={!(isEditable && isLLCurrency) || String(row.type ?? "").toLowerCase() === "unit"}
    disabled={!(isEditable && isLLCurrency) || String(row.type ?? "").toLowerCase() === "unit"}
    onChange={(e) => handleInputChange(index, "sqm", e.target.value)}
    onWheelCapture={handleWheelNoStep}
  />
</td>


                {/* TOTAL */}
                <td>
                  <input type="text" value={type === "unit" ? unitTotal ?? "" : row.total ?? ""} readOnly />
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
