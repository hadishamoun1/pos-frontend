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

const DraggableColumnHeader = ({ column }) => {
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
  };

  return (
    <th
      ref={setNodeRef}
      className={`draggable-header ${column.id}-column`}
      style={style}
      {...attributes}
      {...listeners}
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

  const defaultColumns = useMemo(
    () => [
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
      { Header: "Date", accessor: "date" },
      { Header: "Invoice #", accessor: "invoiceNo" },
    ],
    []
  );

  const fetchData = (url, append = false) => {
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.data)) {
          setRows((prev) => (append ? [...prev, ...data.data] : data.data));
          setTotals(data.totals || totals);
          setTotalRecords(data.totalRecords || 0);

          setColumnOrder(defaultColumns.map((col) => col.accessor));

          const shown = append
            ? rows.length + data.data.length
            : data.data.length;
          console.log("Total Records from API:", data.totalRecords);
          console.log("Rows currently shown:", shown);
          console.log("Remaining Records:", data.totalRecords - shown);

          setHasMore(data.totalRecords > shown);
        } else {
          setHasMore(false);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchData(
      `http://localhost:3000/inventory-transactions/activity?page=${page}&pageSize=${pageSize}`
    );
    socket.on("inventoryActivityUpdate", (data) => {
      if (Array.isArray(data.data)) {
        setRows(data.data);
        setTotals(data.totals || totals);
      }
    });
    return () => socket.off("inventoryActivityUpdate");
  }, [defaultColumns]);

  const applyFilters = () => {
    const query = activeFilters
      .map((f) => `${f.key}=${encodeURIComponent(f.value)}`)
      .join("&");
    setPage(1);
    fetchData(
      `http://localhost:3000/inventory-transactions/activity/v1/filtered?${query}&page=1&pageSize=${pageSize}`
    );
  };

  const cancelFilters = () => {
    setActiveFilters([]);
    setPage(1);
    fetchData(
      `http://localhost:3000/inventory-transactions/activity?page=1&pageSize=${pageSize}`
    );
  };

  const loadMore = () => {
    const remaining = totalRecords - rows.length;
    if (remaining <= 0) {
      console.log("✅ All records loaded, stopping loadMore");
      setHasMore(false);
      return;
    }

    const nextPage = page + 1;
    const nextPageSize = Math.min(pageSize, remaining);
    console.log(`🔵 Loading page ${nextPage} with pageSize ${nextPageSize}`);

    const query = activeFilters
      .map((f) => `${f.key}=${encodeURIComponent(f.value)}`)
      .join("&");

    const url =
      activeFilters.length > 0
        ? `http://localhost:3000/inventory-transactions/activity/v1/filtered?${query}&page=${nextPage}&pageSize=${nextPageSize}`
        : `http://localhost:3000/inventory-transactions/activity?page=${nextPage}&pageSize=${nextPageSize}`;

    console.log(`🟡 Fetching URL: ${url}`);

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        console.log(`🟢 Fetched ${data.data.length} records from API`);
        console.log(`📝 Total Records Reported by API: ${data.totalRecords}`);
        setTotalRecords(data.totalRecords || 0);
        if (Array.isArray(data.data) && data.data.length > 0) {
          setRows((prev) => {
            const updatedRows = [...prev, ...data.data];

            if (updatedRows.length >= data.totalRecords) {
              setHasMore(false);
            }
            return updatedRows;
          });
          setTotals(data.totals || totals);
          setPage(nextPage);
        } else {
          console.log("🚫 No records fetched, disabling Load More");
          setHasMore(false);
        }
      })
      .catch((err) => {
        console.error("❌ Error while fetching data:", err);
      });
  };

  const data = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      name: `${r.thickness} ملم ${r.itemName}`,
      condition: r.itemBatch?.condition || "—",
      batchDate: r.itemBatch?.dateReceived || "—",
      thickness: r.thickness,
      itemName: r.itemName,
      dimension:
        r.itemType === "box" && r.sheetsPerBox
          ? `${r.length}×${r.width}-0${r.sheetsPerBox}`
          : `${r.length}×${r.width}`,
      origin: r.origin,
      quantity: r.quantity,
      quantityofr: r.quantityofr,
      sqm: r.sqm.toFixed(2),
      sqmofr: r.sqmofr.toFixed(2),
      finalcost: r.finalcost != null ? Number(r.finalcost).toFixed(2) : "—",
      finalcostofr:
        r.finalcostofr != null ? Number(r.finalcostofr).toFixed(2) : "—",
      unit:
        r.itemType === "box" ? "Box" : r.itemType === "sheet" ? "Sheet" : "SQM",
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
    }));
  }, [rows]);

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

  useEffect(() => {
    const closeMenu = () => {
      if (contextMenu.visible)
        setContextMenu({ ...contextMenu, visible: false });
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [contextMenu]);

  const addFilter = (column, value, record) => {
    let filter = {};
    if (column === "name" && record.thickness && record.itemName) {
      filter = {
        key: "itemNameWithThickness",
        value: `${record.thickness}|${record.itemName}`,
      };
    } else if (column === "condition" && record.itemBatch?.id) {
      filter = { key: "condition", value: record.itemBatch.condition };
    } else {
      filter = { key: column, value: value };
    }

    console.log("Applied filter:", filter); // ✅ Add here
    if (
      !activeFilters.find(
        (f) => f.key === filter.key && f.value === filter.value
      )
    ) {
      setActiveFilters([...activeFilters, filter]);
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
      )}

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
                  {headerGroups.map((headerGroup) => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                      {headerGroup.headers.map((column) => (
                        <DraggableColumnHeader
                          key={column.id}
                          column={column}
                        />
                      ))}
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
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>
                      {Number(totals.totalQuantity).toFixed(2)}
                    </td>
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>
                      {Number(totals.totalQuantityOFR).toFixed(2)}
                    </td>
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>
                      {Number(totals.totalSQM).toFixed(2)}
                    </td>
                    <td style={{ fontWeight: "bold", textAlign: "center" }}>
                      {Number(totals.totalSQMOFR).toFixed(2)}
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
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
