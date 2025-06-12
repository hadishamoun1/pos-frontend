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
  const [showCountModal, setShowCountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [columnOrder, setColumnOrder] = useState([]);

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

  useEffect(() => {
    fetch("http://localhost:3000/inventory-transactions/activity")
      .then((res) => res.json())
      .then((data) => {
        setRows(data);
        setColumnOrder(defaultColumns.map((col) => col.accessor));
      })
      .catch(console.error);

    socket.on("inventoryActivityUpdate", (data) => {
      setRows(data);
    });

    return () => {
      socket.off("inventoryActivityUpdate");
    };
  }, [defaultColumns]);

  const data = useMemo(() => {
    return rows.map((r) => {
      return {
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
        sqm: r.sqm.toFixed(2),
        sqmofr: r.sqmofr.toFixed(2),
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
        date: new Date(r.invoiceDate).toLocaleDateString(),
        invoiceNo: r.invoiceNumber || "—",
      };
    });
  }, [rows]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows: tableRows,
    prepareRow,
    setColumnOrder: updateColumnOrder,
  } = useTable(
    {
      columns: defaultColumns,
      data,
    },
    useColumnOrder
  );

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
                          <td {...cell.getCellProps()}>
                            {cell.render("Cell")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
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
