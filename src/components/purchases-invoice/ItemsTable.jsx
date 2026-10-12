import React, { useEffect, useMemo, useState, useRef } from "react";
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
function SortableRow({ id, children, onContextMenu, isEditable, hidden }) {
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

  // `hidden` only hides the row visually (filters) — it stays a real
  // sortable child so drag-and-drop indices and item order never drift
  // from what's actually in the `items` array.
  return (
    <tr
      ref={setNodeRef}
      style={style}
      onContextMenu={onContextMenu}
      className={`${isDragging ? "is-dragging" : ""} ${hidden ? "row-filtered-out" : ""}`.trim()}
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

  // --- Filters (visual only — never touches `items`, so indices/order
  // used by editing, drag-and-drop, and delete all stay correct) ---
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [onlyMissingPrice, setOnlyMissingPrice] = useState(false);

  const typeOptions = useMemo(
    () => Array.from(new Set(items.map((it) => it.type).filter(Boolean))).sort(),
    [items]
  );
  const originOptions = useMemo(
    () => Array.from(new Set(items.map((it) => it.origin).filter(Boolean))).sort(),
    [items]
  );

  // --- Per-column right-click filters (greater than / less than / contains / …) ---
  const COLUMN_DEFS = {
    itemName: { label: "Item Name", type: "text", getValue: (it) => displayItemName(it) },
    type: { label: "Type", type: "text", getValue: (it) => it.type || "" },
    origin: { label: "Origin", type: "text", getValue: (it) => it.origin || "" },
    length: { label: "Length", type: "number", getValue: (it) => num(it.length, 0) },
    width: { label: "Width", type: "number", getValue: (it) => num(it.width, 0) },
    quantity: { label: "Quantity", type: "number", getValue: (it) => num(it.quantity, 0) },
    sheetsPerBox: { label: "Sheets/Box", type: "number", getValue: (it) => num(it.sheetsPerBox, 0) },
    sqm: { label: "SQM", type: "number", getValue: (it) => num(it.sqm, 0) },
    sqmOfr: { label: "SQM OFR", type: "number", getValue: (it) => num(it.sqmOfr, 0) },
    euroPrice: { label: "Euro Price", type: "number", getValue: (it) => num(it.euroPrice, 0) },
    unitPrice: { label: "Unit Price", type: "number", getValue: (it) => num(it.unitPrice, 0) },
    euroOfferPrice: { label: "Euro Offer Price", type: "number", getValue: (it) => num(it.euroOfferPrice, 0) },
    priceOFR: { label: "Price OFR", type: "number", getValue: (it) => num(it.priceOFR, 0) },
    total: { label: "Total", type: "number", getValue: (it) => num(it.total, 0) },
    totalOFR: { label: "Total OFR", type: "number", getValue: (it) => num(it.totalOFR, 0) },
    numberOfContainers: { label: "Nb of Containers", type: "number", getValue: (it) => num(it.numberOfContainers, 0) },
  };

  const NUMBER_OPERATORS = [
    { value: "gt", label: "Greater than" },
    { value: "gte", label: "Greater than or equal" },
    { value: "lt", label: "Less than" },
    { value: "lte", label: "Less than or equal" },
    { value: "eq", label: "Equal to" },
    { value: "neq", label: "Not equal to" },
    { value: "between", label: "Between" },
  ];
  const TEXT_OPERATORS = [
    { value: "contains", label: "Contains" },
    { value: "notContains", label: "Does not contain" },
    { value: "equals", label: "Equals" },
    { value: "startsWith", label: "Starts with" },
  ];

  // The exact left-to-right column order actually rendered below (drag
  // handle first, `null` since it has no filterable column) — used to
  // resolve which column a right-clicked <td> belongs to via its native
  // `cellIndex`, so every data cell (not just headers) can open the
  // filter for its column.
  const visibleColumnKeys = [
    null,
    "itemName", "type", "origin", "length", "width", "quantity", "sheetsPerBox",
    ...(showSqm ? ["sqm"] : []),
    ...(showSqmOfr ? ["sqmOfr"] : []),
    ...(currency === "EURO" ? ["euroPrice"] : []),
    ...(invoiceType !== "G" ? ["unitPrice"] : []),
    ...(currency === "EURO" ? ["euroOfferPrice"] : []),
    ...(invoiceType !== "S" && invoiceType !== "RVR" ? ["priceOFR"] : []),
    "total", "totalOFR", "numberOfContainers",
  ];

  const [columnFilters, setColumnFilters] = useState({}); // { [columnKey]: { operator, val, val2 } }
  const [colFilterMenu, setColFilterMenu] = useState({
    visible: false, x: 0, y: 0, columnKey: null, rowIndex: null,
  });
  const [draftOperator, setDraftOperator] = useState("gt");
  const [draftValue, setDraftValue] = useState("");
  const [draftValue2, setDraftValue2] = useState("");

  // Unified right-click menu: filter options for the clicked column (if
  // any) plus a Delete Row action (if a row was clicked). Works from a
  // header (columnKey only), from any cell (both), or the drag handle
  // (rowIndex only).
  const openCellContextMenu = (e, columnKey, rowIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (columnKey) {
      const def = COLUMN_DEFS[columnKey];
      const existing = columnFilters[columnKey];
      setDraftOperator(existing?.operator || (def.type === "number" ? "gt" : "contains"));
      setDraftValue(existing?.val ?? "");
      setDraftValue2(existing?.val2 ?? "");
    }
    setColFilterMenu({ visible: true, x: e.clientX, y: e.clientY, columnKey: columnKey || null, rowIndex: rowIndex ?? null });
  };

  const handleCellContextMenu = (e, rowIndex) => {
    // Filtering works regardless of edit mode; only the Delete Row action
    // (rendered conditionally below) is gated on isEditable.
    const td = e.target.closest("td");
    const cellIndex = td ? td.cellIndex : -1;
    const columnKey = cellIndex >= 0 ? visibleColumnKeys[cellIndex] : null;
    openCellContextMenu(e, columnKey, rowIndex);
  };

  const closeColumnFilterMenu = () =>
    setColFilterMenu({ visible: false, x: 0, y: 0, columnKey: null, rowIndex: null });

  const applyColumnFilter = () => {
    const key = colFilterMenu.columnKey;
    if (!key) return;
    if (draftValue === "" || draftValue == null) {
      setColumnFilters((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setColumnFilters((prev) => ({
        ...prev,
        [key]: { operator: draftOperator, val: draftValue, val2: draftValue2 },
      }));
    }
    closeColumnFilterMenu();
  };

  const clearColumnFilter = (key) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    closeColumnFilterMenu();
  };

  const matchesColumnValue = (value, filter, type) => {
    const { operator, val, val2 } = filter;
    if (type === "number") {
      const n = Number(value);
      const a = Number(val);
      if (!Number.isFinite(a)) return true; // nothing usable typed yet
      switch (operator) {
        case "gt": return n > a;
        case "gte": return n >= a;
        case "lt": return n < a;
        case "lte": return n <= a;
        case "eq": return n === a;
        case "neq": return n !== a;
        case "between": {
          const b = val2 === "" || val2 == null ? NaN : Number(val2);
          if (!Number.isFinite(b)) return n >= a;
          const lo = Math.min(a, b), hi = Math.max(a, b);
          return n >= lo && n <= hi;
        }
        default: return true;
      }
    }
    const s = String(value ?? "").toLowerCase();
    const a = String(val ?? "").toLowerCase();
    switch (operator) {
      case "contains": return s.includes(a);
      case "notContains": return !s.includes(a);
      case "equals": return s === a;
      case "startsWith": return s.startsWith(a);
      default: return true;
    }
  };

  const searchLower = searchText.trim().toLowerCase();
  const matchesFilters = (item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (originFilter !== "all" && item.origin !== originFilter) return false;
    if (onlyMissingPrice && num(item.unitPrice, 0) > 0) return false;
    if (searchLower) {
      const haystack = [displayItemName(item), item.type, item.origin]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    for (const [key, filter] of Object.entries(columnFilters)) {
      const def = COLUMN_DEFS[key];
      if (!def) continue;
      if (!matchesColumnValue(def.getValue(item), filter, def.type)) return false;
    }
    return true;
  };

  const visibleCount = items.reduce((n, it) => (matchesFilters(it) ? n + 1 : n), 0);
  const columnFilterEntries = Object.entries(columnFilters);
  const filtersActive =
    Boolean(searchLower) ||
    typeFilter !== "all" ||
    originFilter !== "all" ||
    onlyMissingPrice ||
    columnFilterEntries.length > 0;

  const clearFilters = () => {
    setSearchText("");
    setTypeFilter("all");
    setOriginFilter("all");
    setOnlyMissingPrice(false);
    setColumnFilters({});
  };

  const thFilterProps = (key) => ({
    onContextMenu: (e) => openCellContextMenu(e, key, null),
    className: columnFilters[key] ? "th-filtered" : "",
    title: "Right-click to filter this column",
  });

  return (
    <div className="items-table" onClick={closeColumnFilterMenu}>
      <div className="separator">
        <h3>Items</h3>
        <div className="items-table-toolbar-actions">
          <button
            type="button"
            className={`items-filter-toggle${filtersActive ? " active" : ""}`}
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
          >
            Filter{filtersActive ? ` (${visibleCount}/${items.length})` : ""}
          </button>
          <button className="select-item-button" onClick={openItemModal} disabled={!isEditable}>
            Select Item
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className="items-table-filters">
          <input
            type="text"
            className="items-filter-search"
            placeholder="Search item name…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <label className="items-filter-field">
            Type
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="items-filter-field">
            Origin
            <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}>
              <option value="all">All origins</option>
              {originOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>

          <label className="items-filter-checkbox">
            <input
              type="checkbox"
              checked={onlyMissingPrice}
              onChange={(e) => setOnlyMissingPrice(e.target.checked)}
            />
            Missing unit price
          </label>

          {filtersActive && (
            <button type="button" className="items-filter-clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}

          {columnFilterEntries.length > 0 && (
            <div className="items-filter-chips">
              {columnFilterEntries.map(([key, filter]) => {
                const def = COLUMN_DEFS[key];
                if (!def) return null;
                const opLabel =
                  (def.type === "number" ? NUMBER_OPERATORS : TEXT_OPERATORS).find(
                    (o) => o.value === filter.operator
                  )?.label || filter.operator;
                const valueLabel =
                  filter.operator === "between" ? `${filter.val} – ${filter.val2}` : filter.val;
                return (
                  <span className="items-filter-chip" key={key}>
                    {def.label} {opLabel.toLowerCase()} <strong>{valueLabel}</strong>
                    <button
                      type="button"
                      onClick={() => clearColumnFilter(key)}
                      aria-label={`Remove ${def.label} filter`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <span className="items-filter-hint">Tip: right-click any cell (or a column header) to filter that column.</span>
        </div>
      )}

      {colFilterMenu.visible && (() => {
        const def = colFilterMenu.columnKey ? COLUMN_DEFS[colFilterMenu.columnKey] : null;
        const canDelete = colFilterMenu.rowIndex != null && isEditable;
        if (!def && !canDelete) return null;
        const operators = def ? (def.type === "number" ? NUMBER_OPERATORS : TEXT_OPERATORS) : [];
        return (
          <div
            className="column-filter-menu"
            style={{ top: colFilterMenu.y, left: colFilterMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {def && (
              <>
                <div className="column-filter-menu-title">Filter: {def.label}</div>
                <select value={draftOperator} onChange={(e) => setDraftOperator(e.target.value)} autoFocus>
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <input
                  type={def.type === "number" ? "number" : "text"}
                  value={draftValue}
                  placeholder="Value…"
                  onChange={(e) => setDraftValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyColumnFilter(); }}
                />
                {draftOperator === "between" && (
                  <input
                    type="number"
                    value={draftValue2}
                    placeholder="and…"
                    onChange={(e) => setDraftValue2(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyColumnFilter(); }}
                  />
                )}
                <div className="column-filter-menu-actions">
                  {columnFilters[colFilterMenu.columnKey] && (
                    <button
                      type="button"
                      className="column-filter-clear-btn"
                      onClick={() => clearColumnFilter(colFilterMenu.columnKey)}
                    >
                      Clear
                    </button>
                  )}
                  <button type="button" className="column-filter-apply-btn" onClick={applyColumnFilter}>
                    Apply
                  </button>
                </div>
              </>
            )}

            {canDelete && (
              <>
                {def && <div className="column-filter-menu-divider" />}
                <button
                  type="button"
                  className="column-filter-delete-btn"
                  onClick={() => {
                    setItems(items.filter((_, i) => i !== colFilterMenu.rowIndex));
                    closeColumnFilterMenu();
                  }}
                >
                  Delete Row
                </button>
              </>
            )}
          </div>
        );
      })()}

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
              <th {...thFilterProps("itemName")}>Item Name</th>
              <th {...thFilterProps("type")}>Type</th>
              <th {...thFilterProps("origin")}>Origin</th>
              <th {...thFilterProps("length")}>Length</th>
              <th {...thFilterProps("width")}>Width</th>
              <th {...thFilterProps("quantity")}>Quantity</th>
              <th {...thFilterProps("sheetsPerBox")}>Sheets/Box</th>
              {showSqm && <th {...thFilterProps("sqm")}>SQM</th>}
              {showSqmOfr && <th {...thFilterProps("sqmOfr")}>SQM OFR</th>}
              {currency === "EURO" && <th {...thFilterProps("euroPrice")}>Euro Price</th>}
              {invoiceType !== "G" && <th {...thFilterProps("unitPrice")}>Unit Price</th>}
              {currency === "EURO" && <th {...thFilterProps("euroOfferPrice")}>Euro Offer Price</th>}
              {invoiceType !== "S" && invoiceType !== "RVR" && <th {...thFilterProps("priceOFR")}>Price OFR</th>}
              <th {...thFilterProps("total")}>Total</th>
              <th {...thFilterProps("totalOFR")}>Total OFR</th>
              <th {...thFilterProps("numberOfContainers")}>Nb of Cont</th>
            </tr>
          </thead>

          <SortableContext items={items.map((it) => it.id || it._tempId)} strategy={verticalListSortingStrategy}>
            <tbody>
              {items.map((item, index) => (
                <SortableRow
                  key={item.id || item._tempId}
                  id={item.id || item._tempId}
                  isEditable={isEditable}
                  hidden={!matchesFilters(item)}
                  onContextMenu={(e) => handleCellContextMenu(e, index)}
                >
                  <td style={{ direction: "rtl", textAlign: "right" }}>{displayItemName(item)}</td>
                  <td>{item.type}</td>
                  <td>{item.origin}</td>
                  <td>
                    {isEditable && item.type === "sqm" ? (
                      <input
                        type="number"
                        value={formatVal(item.length)}
                        onChange={(e) => handleItemChange(index, "length", e.target.value)}
                        onKeyDown={handleKeyDown}
                        onWheel={handleWheel}
                      />
                    ) : (item.length || 0)}
                  </td>
                  <td>
                    {isEditable && item.type === "sqm" ? (
                      <input
                        type="number"
                        value={formatVal(item.width)}
                        onChange={(e) => handleItemChange(index, "width", e.target.value)}
                        onKeyDown={handleKeyDown}
                        onWheel={handleWheel}
                      />
                    ) : (item.width || 0)}
                  </td>
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
                  <td>
                    {isEditable && item.type === "sqm" ? (
                      <input
                        type="number"
                        value={formatVal(item.sheetsPerBox)}
                        onChange={(e) => handleItemChange(index, "sheetsPerBox", e.target.value)}
                        onKeyDown={handleKeyDown}
                        onWheel={handleWheel}
                      />
                    ) : item.type === "box" ? (item.sheetsPerBox || 0) : ""}
                  </td>
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
              {items.length > 0 && visibleCount === 0 && (
                <tr className="items-table-empty-row">
                  <td colSpan={20}>
                    No items match your filters.{" "}
                    <button type="button" className="items-filter-clear-inline" onClick={clearFilters}>
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  );
}