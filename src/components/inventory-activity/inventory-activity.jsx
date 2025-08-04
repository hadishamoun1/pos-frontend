import React, { useState, useEffect, useMemo } from "react";
import { useTable, useColumnOrder } from "react-table";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CountModal from "./countModal";
import TransferModal from "./transferModal";
import "./inventory-activity.css";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const DraggableColumnHeader = ({ column, onContextMenu }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 0ms ease",
    cursor: "grab",
    zIndex: isDragging ? 10 : undefined,
    backgroundColor: isDragging ? "#f0f8ff" : undefined,
    willChange: "transform",
    overflow: "visible",
  };

  return (
    <th
      ref={setNodeRef}
      className={`draggable-header ${column.id}-column`}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={onContextMenu}
    >
      {column.render("Header")}
    </th>
  );
};

const InventoryActivityPage = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({
    totalQuantity: 0,
    totalQuantityOFR: 0,
    totalSQM: 0,
    totalSQMOFR: 0,
  });
  const [showCountModal, setShowCountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [columnOrder, setColumnOrder] = useState([]);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    column: null,
    value: "",
    record: null,
  });
  const [activeFilters, setActiveFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 30;
  const [totalRecords, setTotalRecords] = useState(0);

  // for sorting via right-click menu
  const [sortConfig, setSortConfig] = useState({
    column: null,
    direction: null,
  });
  const [sortMenu, setSortMenu] = useState({ visible: false, x: 0, y: 0 });

  const defaultColumns = useMemo(
    () => [
      // ← NEW: four description columns at the very beginning
      { Header: "Category", accessor: "category" },
      { Header: "Subcategory", accessor: "subCategory" },

      // existing columns follow
      { Header: "Item Name", accessor: "name" },
      { Header: "Condition", accessor: "condition" },
      { Header: "Batch Date", accessor: "batchDate" },
      { Header: "Dimensions", accessor: "dimension" },
      { Header: "Brand", accessor: "origin" },
      { Header: "Quantity", accessor: "quantity" },
      { Header: "Qty OFR", accessor: "quantityofr" },
      { Header: "SQM", accessor: "sqm" },
      { Header: "SQM OFR", accessor: "sqmofr" },
      { Header: "Final Cost", accessor: "finalcost" },
      { Header: "Final Cost OFR", accessor: "finalcostofr" },
      { Header: "Unit", accessor: "unit" },
      { Header: "Status", accessor: "status" },
      { Header: "Date", accessor: "date", id: "date" },
      { Header: "Invoice #", accessor: "invoiceNo" },
    ],
    []
  );

  // build URL with pagination, filters, and (optional) sort
  const buildUrl = (pg, filters) => {
    const params = new URLSearchParams();
    params.set("page", pg);
    params.set("pageSize", pageSize);
    filters.forEach((f) => params.append(f.key, f.value));
    if (sortConfig.column) {
      params.set("sortBy", sortConfig.column);
      params.set("sortDir", sortConfig.direction);
    }
    const base =
      filters.length > 0 || sortConfig.column
        ? "/inventory-transactions/activity/v1/filtered"
        : "/inventory-transactions/activity";
    return `http://localhost:3000${base}?${params.toString()}`;
  };

  const fetchData = (url, append = false) => {
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.data)) {
          setRows((prev) => (append ? [...prev, ...data.data] : data.data));
          if (data.totals) {
            setTotals({
              totalQuantity: Number(data.totals.totalQuantity) || 0,
              totalQuantityOFR: Number(data.totals.totalQuantityOFR) || 0,
              totalSQM: Number(data.totals.totalSQM) || 0,
              totalSQMOFR: Number(data.totals.totalSQMOFR) || 0,
            });
          }
          setTotalRecords(data.totalRecords ?? 0);
          setColumnOrder(defaultColumns.map((col) => col.accessor));
          const shown = append
            ? rows.length + data.data.length
            : data.data.length;
          setHasMore(data.totalRecords > shown);
        } else {
          setHasMore(false);
        }
      })
      .catch(console.error);
  };

  // update socket listener to coerce totals
  useEffect(() => {
    socket.on("inventoryActivityUpdate", (data) => {
      if (Array.isArray(data.data)) {
        setRows(data.data);
        if (data.totals) {
          setTotals({
            totalQuantity: Number(data.totals.totalQuantity) || 0,
            totalQuantityOFR: Number(data.totals.totalQuantityOFR) || 0,
            totalSQM: Number(data.totals.totalSQM) || 0,
            totalSQMOFR: Number(data.totals.totalSQMOFR) || 0,
          });
        }
      }
    });
    return () => socket.off("inventoryActivityUpdate");
  }, []);

  // merge server + client sort,
  // but let the server handle the "date" column entirely
  const sortedRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    if (!sortConfig.column) return rows;
    if (sortConfig.column === "date") {
      return rows;
    }
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const key = sortConfig.column;
      const na = Number(a[key]);
      const nb = Number(b[key]);
      if (!isNaN(na) && !isNaN(nb)) {
        return dir * (na - nb);
      }
      return dir * String(a[key] ?? "").localeCompare(String(b[key] ?? ""));
    });
  }, [rows, sortConfig]);

  // initial fetch & on page/filters/sort change
  useEffect(() => {
    const url = buildUrl(page, activeFilters);
    fetchData(url, page > 1);
  }, [page, activeFilters, sortConfig]);

  const applyFilters = () => setPage(1);
  const cancelFilters = () => {
    setActiveFilters([]);
    setSortConfig({ column: null, direction: null });
    setPage(1);
  };
  const loadMore = () => {
    const remaining = totalRecords - rows.length;
    if (remaining <= 0) {
      setHasMore(false);
      return;
    }
    setPage((p) => p + 1);
  };

  const data = useMemo(
    () =>
      sortedRows.map((r) => {
        // pick category/subCategory from flat fields if present,
        // otherwise fall back to nested description.*
        const category = r.category ?? r.description?.categoryName ?? "—";
        const subCategory = r.subCategory ?? r.description?.subCategory ?? "—";
        const color = r.color ?? r.description?.colorName ?? "—";
        const design = r.design ?? r.description?.designName ?? "—";

        return {
          category,
          subCategory,
          color,
          design,

          name: `${r.thickness} ملم ${r.itemName}`,
          condition: r.itemBatch?.condition || "—",
          batchDate: r.itemBatch?.dateReceived || "—",
          dimension:
            r.itemType === "box" && r.sheetsPerBox
              ? `${r.length}×${r.width}-0${r.sheetsPerBox}`
              : `${r.length}×${r.width}`,
          origin: r.origin,
          quantity: r.quantity,
          quantityofr: r.quantityofr,
          sqm: typeof r.sqm === "number" ? r.sqm.toFixed(2) : r.sqm,
          sqmofr: typeof r.sqmofr === "number" ? r.sqmofr.toFixed(2) : r.sqmofr,
          finalcost: r.finalcost != null ? Number(r.finalcost).toFixed(2) : "—",
          finalcostofr:
            r.finalcostofr != null ? Number(r.finalcostofr).toFixed(2) : "—",
          unit:
            r.itemType === "box"
              ? "Box"
              : r.itemType === "sheet"
              ? "Sheet"
              : "SQM",
          status:
            r.transactionType === "purchase"
              ? "Purchase"
              : r.transactionType === "sale"
              ? "Sales"
              : r.transactionType || "-",
          date: r.invoiceDate || "—",
          invoiceNo: r.invoiceNumber || "—",
          itemVariantId: r.itemVariantId,
          itemBatch: r.itemBatch,
        };
      }),
    [sortedRows]
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows: tableRows,
    prepareRow,
    setColumnOrder: updateColumnOrder,
  } = useTable({ columns: defaultColumns, data }, useColumnOrder);

  const sensors = useSensors(useSensor(PointerSensor));
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = columnOrder.indexOf(active.id);
      const newIndex = columnOrder.indexOf(over.id);
      const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
      setColumnOrder(newOrder);
      updateColumnOrder(newOrder);
    }
  };

  // close menus on outside click
  useEffect(() => {
    const closeMenus = () => {
      if (contextMenu.visible)
        setContextMenu({ ...contextMenu, visible: false });
      if (sortMenu.visible) setSortMenu({ ...sortMenu, visible: false });
    };
    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, [contextMenu, sortMenu]);

  const addFilter = (column, value, record, op = "eq") => {
    let key;
    let val;

    // 1) Category column
    if (column === "category") {
      key = "category";
      val = record.category;

      // 2) Subcategory column
    } else if (column === "subCategory") {
      key = "subCategory";
      val = record.subCategory;

      // 3) Special name-column = itemNameWithThickness
    } else if (column === "name") {
      key = "itemNameWithThickness";
      // record.name is like "8 ملم laminated clear"
      const [thStr, itemStr] = record.name.split(" ملم ");
      val = `${thStr}|${itemStr}`;

      // 4) All other columns: either eq or Gt/Lt
    } else {
      key = op === "eq" ? column : `${column}${op}`;
      val = String(value);
    }

    const filter = { key, value: val };

    // Avoid duplicate filters
    if (!activeFilters.some((f) => f.key === key && f.value === val)) {
      setActiveFilters((prev) => [...prev, filter]);
    }
  };
  return (
    <div className="inventory-activity-page">
      <div className="inventory-activity-header-bar">
        <h1 className="inventory-activity-title">Inventory Activity</h1>
        <div className="inventory-activity-btn-group">
          <button
            className="inventory-activity-btn-count"
            onClick={() => setShowCountModal(true)}
          >
            Count
          </button>
          <button
            className="inventory-activity-btn-transfers"
            onClick={() => setShowTransferModal(true)}
          >
            Transfers
          </button>
        </div>
      </div>

      {/* ▶️ Sort menu */}
      {sortMenu.visible && (
        <div
          style={{
            position: "fixed",
            top: sortMenu.y,
            left: sortMenu.x,
            background: "#fff",
            border: "1px solid #ccc",
            zIndex: 2000,
            padding: "5px",
          }}
        >
          <div
            style={{ padding: "4px", cursor: "pointer" }}
            onClick={() => {
              setSortConfig({ column: "date", direction: "asc" });
              setSortMenu((v) => ({ ...v, visible: false }));
              setPage(1);
            }}
          >
            Sort A → Z
          </div>
          <div
            style={{ padding: "4px", cursor: "pointer" }}
            onClick={() => {
              setSortConfig({ column: "date", direction: "desc" });
              setSortMenu((v) => ({ ...v, visible: false }));
              setPage(1);
            }}
          >
            Sort Z → A
          </div>
        </div>
      )}

      {/* FILTER MENU */}
      {contextMenu.visible && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#fff",
            border: "1px solid #ccc",
            zIndex: 1000,
            padding: "5px",
            cursor: "pointer",
          }}
        >
          <div
            style={{ padding: "4px", cursor: "pointer" }}
            onClick={() => {
              addFilter(
                contextMenu.column,
                contextMenu.value,
                contextMenu.record
              );
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            Add "{contextMenu.value}" to Filters
          </div>

          {contextMenu.column === "date" ? (
            // only for the Date column: show Before / After
            <>
              <div
                style={{ padding: "4px" }}
                onClick={() => {
                  addFilter(
                    "date", // base column
                    contextMenu.value, // e.g. "2025-07-21"
                    contextMenu.record,
                    "Lt" // will produce key: "dateLt"
                  );
                  setContextMenu({ ...contextMenu, visible: false });
                }}
              >
                Before {contextMenu.value}
              </div>
              <div
                style={{ padding: "4px" }}
                onClick={() => {
                  addFilter(
                    "date",
                    contextMenu.value,
                    contextMenu.record,
                    "Gt" // will produce key: "dateGt"
                  );
                  setContextMenu({ ...contextMenu, visible: false });
                }}
              >
                After {contextMenu.value}
              </div>
            </>
          ) : !isNaN(Number(contextMenu.value)) ? (
            <>
              <div
                style={{ padding: "4px", cursor: "pointer" }}
                onClick={() => {
                  addFilter(
                    contextMenu.column,
                    contextMenu.value,
                    contextMenu.record,
                    "Gt"
                  );
                  setContextMenu({ ...contextMenu, visible: false });
                }}
              >
                {contextMenu.column} &gt; {contextMenu.value}
              </div>
              <div
                style={{ padding: "4px", cursor: "pointer" }}
                onClick={() => {
                  addFilter(
                    contextMenu.column,
                    contextMenu.value,
                    contextMenu.record,
                    "Lt"
                  );
                  setContextMenu({ ...contextMenu, visible: false });
                }}
              >
                {contextMenu.column} &lt; {contextMenu.value}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ACTIVE FILTERS */}
      {activeFilters.length > 0 && (
        <div className="active-filters-bar">
          <strong>Active Filters:</strong>
          {activeFilters.map((f, idx) => (
            <span key={idx} className="active-filters-tag">
              {f.key}: {f.value}
              <button
                onClick={() =>
                  setActiveFilters(activeFilters.filter((_, i) => i !== idx))
                }
              >
                ×
              </button>
            </span>
          ))}
          <div className="filters-action-buttons">
            <button onClick={applyFilters}>Apply Filters</button>
            <button onClick={cancelFilters}>Cancel Filters</button>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="inventory-activity-container">
        <div className="inventory-activity-table-wrapper">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columnOrder}
              strategy={horizontalListSortingStrategy}
            >
              <table className="inventory-activity-table" {...getTableProps()}>
                <thead>
                  {headerGroups.map((hg) => (
                    <tr {...hg.getHeaderGroupProps()}>
                      {hg.headers.map((col) => {
                        // right‑click Date header to sort
                        if (col.id === "date") {
                          return (
                            <DraggableColumnHeader
                              key={col.id}
                              column={col}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setSortMenu({
                                  visible: true,
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }}
                            />
                          );
                        }
                        return (
                          <DraggableColumnHeader key={col.id} column={col} />
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody {...getTableBodyProps()}>
                  {tableRows.map((row) => {
                    prepareRow(row);
                    return (
                      <tr {...row.getRowProps()}>
                        {row.cells.map((cell) => (
                          <td
                            {...cell.getCellProps()}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({
                                visible: true,
                                x: e.clientX,
                                y: e.clientY,
                                column: cell.column.id,
                                value: cell.value,
                                record: row.original,
                              });
                            }}
                          >
                            {cell.render("Cell")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: "bold" }}>Totals</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>
                      {totals.totalQuantity.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>
                      {totals.totalQuantityOFR.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>
                      {totals.totalSQM.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>
                      {totals.totalSQMOFR.toFixed(2)}
                    </td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </SortableContext>
          </DndContext>
          {hasMore && (
            <div className="load-more-container">
              <button className="load-more-btn" onClick={loadMore}>
                Load More
              </button>
            </div>
          )}
        </div>
      </div>

      <CountModal
        isOpen={showCountModal}
        onClose={() => setShowCountModal(false)}
      />
      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
      />
    </div>
  );
};

export default InventoryActivityPage;
