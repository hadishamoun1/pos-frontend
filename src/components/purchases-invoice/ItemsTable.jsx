import React, { useEffect, useState, useRef } from "react";
// --- DND KIT IMPORTS ---
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- SORTABLE ROW WRAPPER ---
function SortableRow({ id, children, onContextMenu, isEditable }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      onContextMenu={onContextMenu}
      className={isDragging ? "is-dragging" : ""}
    >
      <td className="drag-handle-cell">
        {isEditable && (
          <button
            {...attributes}
            {...listeners}
            className="drag-handle-btn"
            type="button"
            tabIndex={-1}
          >
            ⋮⋮
          </button>
        )}
      </td>
      {children}
    </tr>
  );
}

export default function ItemsTable({
  items,
  setItems,
  openItemModal,
  currency,
  exchangeRate,
  isEditable,
  invoiceType,
}) {
  const tableRef = useRef(null);

  // --- Logic Helpers ---
  const num = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };

  const round2 = (v) => Number(num(v, 0).toFixed(2));

  const formatVal = (val) => (val === 0 || val === "0" || !val ? "" : val);

  const calcSqmFromDims = (row) => {
    const length = num(row.length, 0);
    const width = num(row.width, 0);
    const quantity = num(row.quantity, 0);
    const sheetsPerBox = num(row.sheetsPerBox, 1);
    return (length * width * quantity * sheetsPerBox) / 10000;
  };

  const applyTypeRules = (row) => {
    const sqm = num(row.sqm, 0);
    const sqmOfr = num(row.sqmOfr, 0);

    if (invoiceType === "S") {
      row.sqmOfr = sqmOfr > 0 ? sqmOfr : round2(calcSqmFromDims(row));
      row.sqm = row.sqmOfr;
      return;
    }
    if (invoiceType === "G") {
      row.sqmOfr = sqmOfr > 0 ? sqmOfr : round2(calcSqmFromDims(row));
      row.sqm = 0;
      row.unitPrice = 0;
      return;
    }
    if (invoiceType === "SR") {
      if (!(sqm > 0)) row.sqm = round2(calcSqmFromDims(row));
      if (!(sqmOfr > 0)) row.sqmOfr = row.sqm;
      return;
    }
    if (invoiceType === "RVR") {
      row.sqm = sqm > 0 ? sqm : round2(calcSqmFromDims(row));
      row.sqmOfr = 0;
      return;
    }
    row.sqm = round2(calcSqmFromDims(row));
    row.sqmOfr = num(row.sqmOfr, 0) || row.sqm;
  };

  const applyPrices = (row) => {
    if (currency === "EURO") {
      row.unitPrice = row.euroPrice ? num(row.euroPrice, 0) / num(exchangeRate, 1) : 0;
      row.priceOFR = row.euroOfferPrice ? num(row.euroOfferPrice, 0) / num(exchangeRate, 1) : 0;
    }
    if (invoiceType === "G") {
      row.unitPrice = 0;
    } else if (invoiceType === "S") {
      row.priceOFR = num(row.unitPrice, 0);
    }
  };

  const applyTotals = (row) => {
    const isUnit =
      String(row.type || "").toLowerCase() === "unit" ||
      String(row.stockMode || "").toLowerCase() === "qty";
    if (isUnit) {
      row.total    = round2(num(row.quantity, 0) * num(row.unitPrice, 0));
      row.totalOFR = round2(num(row.quantity, 0) * num(row.priceOFR, 0));
    } else {
      row.total    = round2(num(row.sqm, 0) * num(row.unitPrice, 0));
      row.totalOFR = round2(num(row.sqmOfr, 0) * num(row.priceOFR, 0));
    }
  };

  const handleItemChange = (index, field, value) => {
    if (!isEditable) return;
    const newItems = [...items];
    const cleanValue = value === "" ? 0 : Number(value);
    const row = { ...newItems[index], [field]: cleanValue };
    
    const dimFields = new Set(["length", "width", "quantity", "sheetsPerBox"]);
    const isDimChange = dimFields.has(field);

    if (field === "sqm") { row.sqm = cleanValue; row._sqmManual = true; }
    if (field === "sqmOfr") { row.sqmOfr = cleanValue; row._sqmOfrManual = true; }

    if (isDimChange) {
      const base = round2(calcSqmFromDims(row));
      if (invoiceType === "S") { row.sqmOfr = base; row.sqm = base; }
      else if (invoiceType === "G") { row.sqmOfr = base; row.sqm = 0; row.unitPrice = 0; }
      else if (invoiceType === "RVR") { row.sqm = base; row.sqmOfr = 0; }
      else if (invoiceType === "SR") {
        if (!row._sqmManual) row.sqm = base;
        if (!row._sqmOfrManual) row.sqmOfr = base;
      } else {
        row.sqm = base;
        if (!row._sqmOfrManual) row.sqmOfr = base;
      }
    } else {
      applyTypeRules(row);
    }

    applyPrices(row);
    applyTotals(row);
    newItems[index] = row;
    setItems(newItems);
  };

  const handleWheel = (e) => e.target.blur();

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const allInputs = Array.from(tableRef.current.querySelectorAll("input:not([disabled])"));
      const index = allInputs.indexOf(e.target);
      if (index > -1 && index < allInputs.length - 1) {
        allInputs[index + 1].focus();
      }
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = items.findIndex((it) => (it.id || it._tempId) === active.id);
      const newIndex = items.findIndex((it) => (it.id || it._tempId) === over.id);
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  useEffect(() => {
    const needsPatch = items.some((it) => !it.id && !it._tempId);
    if (needsPatch) {
      setItems(items.map((it) => it.id || it._tempId ? it : { ...it, _tempId: Math.random().toString(36).substr(2, 9) }));
    }
  }, [items, setItems]);

  const [deleteMenu, setDeleteMenu] = useState({ visible: false, x: 0, y: 0, rowIndex: null });
  const closeDeleteMenu = () => setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });

  const handleRowContext = (e, index) => {
    e.preventDefault();
    if (!isEditable) return;
    setDeleteMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex: index });
  };

  const displayItemName = (item) => {
    const name = item?.itemName || "";
    const th = [item?.thickness, item?.payloadVariant?.thickness, item?.variant?.thickness, item?.dimension?.thickness]
      .map(v => v == null ? v : Number(v))
      .find(n => Number.isFinite(n) && n > 0);
    return th != null ? `${th} ملم ${name}` : name;
  };

  const showSqm = invoiceType !== "G" && invoiceType !== "S";
  const showSqmOfr = invoiceType !== "RVR";
  const sqmEditable = isEditable && invoiceType === "SR";
  const sqmOfrEditable = isEditable && invoiceType === "SR";

  return (
    <div className="items-table" onClick={closeDeleteMenu}>
      <div className="separator">
        <h3>Items</h3>
        <button className="select-item-button" onClick={openItemModal} disabled={!isEditable}>
          Select Item
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table ref={tableRef}>
          <colgroup>
            <col className="col-drag" />
            <col className="col-itemname" />
            <col className="col-type" />
            <col className="col-origin" />
            <col className="col-length" />
            <col className="col-width" />
            <col className="col-qty" />
            <col className="col-spb" />
            {showSqm && <col className="col-sqm" />}
            {showSqmOfr && <col className="col-sqmofr" />}
            {currency === "EURO" && <col className="col-euro" />}
            {invoiceType !== "G" && <col className="col-unit" />}
            {currency === "EURO" && <col className="col-euro-ofr" />}
            {invoiceType !== "S" && invoiceType !== "RVR" && <col className="col-ofr" />}
            <col className="col-total" />
            <col className="col-total-ofr" />
            <col className="col-containers" />
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th>Item Name</th>
              <th>Type</th>
              <th>Origin</th>
              <th>Length</th>
              <th>Width</th>
              <th>Quantity</th>
              <th>Sheets/Box</th>
              {showSqm && <th>SQM</th>}
              {showSqmOfr && <th>SQM OFR</th>}
              {currency === "EURO" && <th>Euro Price</th>}
              {invoiceType !== "G" && <th>Unit Price</th>}
              {currency === "EURO" && <th>Euro Offer Price</th>}
              {invoiceType !== "S" && invoiceType !== "RVR" && <th>Price OFR</th>}
              <th>Total</th>
              <th>Total OFR</th>
              <th>Nb of Cont</th>
            </tr>
          </thead>

          <SortableContext items={items.map((it) => it.id || it._tempId)} strategy={verticalListSortingStrategy}>
            <tbody>
              {items.map((item, index) => (
                <SortableRow 
                  key={item.id || item._tempId} 
                  id={item.id || item._tempId} 
                  isEditable={isEditable}
                  onContextMenu={(e) => handleRowContext(e, index)}
                >
                  <td style={{ direction: "rtl", textAlign: "right" }}>{displayItemName(item)}</td>
                  <td>{item.type}</td>
                  <td>{item.origin}</td>
                  <td>{item.length || 0}</td>
                  <td>{item.width || 0}</td>
                  <td>
                    <input
                      type="number"
                      value={formatVal(item.quantity)}
                      onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                      onKeyDown={handleKeyDown}
                      onWheel={handleWheel}
                      disabled={!isEditable}
                    />
                  </td>
                  <td>{item.type === "box" ? item.sheetsPerBox || 0 : ""}</td>
                  {showSqm && (
                    <td>
                      {invoiceType === "SR" ? (
                        <input
                          type="number"
                          value={formatVal(item.sqm)}
                          onChange={(e) => handleItemChange(index, "sqm", e.target.value)}
                          onKeyDown={handleKeyDown}
                          onWheel={handleWheel}
                          disabled={!sqmEditable}
                        />
                      ) : num(item.sqm, 0).toFixed(2)}
                    </td>
                  )}
                  {showSqmOfr && (
                    <td>
                      {invoiceType === "SR" ? (
                        <input
                          type="number"
                          value={formatVal(item.sqmOfr)}
                          onChange={(e) => handleItemChange(index, "sqmOfr", e.target.value)}
                          onKeyDown={handleKeyDown}
                          onWheel={handleWheel}
                          disabled={!sqmOfrEditable}
                        />
                      ) : num(item.sqmOfr, 0).toFixed(2)}
                    </td>
                  )}
                  {currency === "EURO" && (
                    <td>
                      <input
                        type="number"
                        value={formatVal(item.euroPrice)}
                        onChange={(e) => handleItemChange(index, "euroPrice", e.target.value)}
                        onKeyDown={handleKeyDown}
                        onWheel={handleWheel}
                        disabled={!isEditable}
                      />
                    </td>
                  )}
                  {invoiceType !== "G" && (
                    <td>
                      <input
                        type="number"
                        value={formatVal(item.unitPrice)}
                        onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                        onKeyDown={handleKeyDown}
                        onWheel={handleWheel}
                        disabled={!isEditable}
                      />
                    </td>
                  )}
                  {currency === "EURO" && (
                    <td>
                      <input
                        type="number"
                        value={formatVal(item.euroOfferPrice)}
                        onChange={(e) => handleItemChange(index, "euroOfferPrice", e.target.value)}
                        onKeyDown={handleKeyDown}
                        onWheel={handleWheel}
                        disabled={!isEditable}
                      />
                    </td>
                  )}
                  {invoiceType !== "S" && invoiceType !== "RVR" && (
                    <td>
                      <input
                        type="number"
                        value={formatVal(item.priceOFR)}
                        onChange={(e) => handleItemChange(index, "priceOFR", e.target.value)}
                        onKeyDown={handleKeyDown}
                        onWheel={handleWheel}
                        disabled={!isEditable}
                      />
                    </td>
                  )}
                  <td>{round2(item.total || 0).toFixed(2)}</td>
                  <td>{round2(item.totalOFR || 0).toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      value={formatVal(item.numberOfContainers)}
                      onChange={(e) => handleItemChange(index, "numberOfContainers", e.target.value)}
                      onKeyDown={handleKeyDown}
                      onWheel={handleWheel}
                      disabled={!isEditable}
                    />
                  </td>
                </SortableRow>
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>

      {deleteMenu.visible && (
        <div
          className="context-menu-purchases"
          style={{ top: deleteMenu.y, left: deleteMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { setItems(items.filter((_, i) => i !== deleteMenu.rowIndex)); closeDeleteMenu(); }}>Delete Row</button>
        </div>
      )}
    </div>
  );
}