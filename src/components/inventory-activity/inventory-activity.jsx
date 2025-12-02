// src/pages/inventory/InventoryActivityPage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

/** ---------- API URL helper (supports base with optional path prefix) ---------- */
const RAW_API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

const isAbs = (s) => /^https?:\/\//i.test(String(s || ""));

const apiUrl = (path) => {
  const cleanPath = String(path || "").startsWith("/") ? String(path || "") : `/${path || ""}`;

  // no env base => relative to current origin
  if (!RAW_API_BASE) return new URL(cleanPath, window.location.origin);

  // absolute base: may include pathname prefix (/api)
  if (isAbs(RAW_API_BASE)) {
    const base = new URL(RAW_API_BASE);
    const prefix = (base.pathname || "/").replace(/\/+$/, "");
    base.pathname = `${prefix}${cleanPath}`.replace(/\/{2,}/g, "/");
    return base;
  }

  // relative base (ex: "/api")
  const u = new URL(cleanPath, window.location.origin);
  const prefix = RAW_API_BASE.replace(/\/+$/, "");
  u.pathname = `${prefix}${u.pathname}`.replace(/\/{2,}/g, "/");
  return u;
};

/** ---------- Small helpers ---------- */
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

const normalizeDimInput = (s) =>
  String(s || "")
    .trim()
    .replace(/[xX×✕✖︎]/g, "×")
    .replace(/\s+/g, "")
    .replace(/-/g, "-"); // keep '-' for SPB

const normalizeUnit = (u) => {
  const t = String(u || "").toLowerCase().trim();
  if (t === "box") return "box";
  if (t === "sheet") return "sheet";
  if (t === "sqm" || t === "m2") return "sqm";
  // your UI uses Box/Sheet/SQM labels
  if (t === "sq m" || t === "sq") return "sqm";
  return t;
};

const normalizeStatus = (s) => {
  const t = String(s || "").toLowerCase().trim();
  if (t.startsWith("purch")) return "purchase";
  if (t.startsWith("sale")) return "sale";
  if (t.startsWith("count")) return "inventoryCount";
  return t;
};

/** ---------- Draggable header cell ---------- */
const DraggableColumnHeader = ({ column, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 0ms ease",
    cursor: "grab",
    zIndex: isDragging ? 10 : undefined,
    backgroundColor: isDragging ? "#f0f8ff" : undefined,
    willChange: "transform",
    overflow: "visible",
    userSelect: "none",
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

export default function InventoryActivityPage() {
  /** ---------- UI state ---------- */
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

  const [activeFilters, setActiveFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 30;
  const [totalRecords, setTotalRecords] = useState(0);

  const [sortConfig, setSortConfig] = useState({ column: null, direction: null });

  /** Cell right-click menu (kept, for quick “Add this exact value”) */
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    column: null,
    value: "",
    record: null,
  });

  /** Header right-click menu (NEW, includes Contain...) */
  const [colMenu, setColMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    columnId: null,
  });

  /** Prompt modal for header operations (Contain / Equals / > / < / Before / After) */
  const [promptBox, setPromptBox] = useState({
    open: false,
    columnId: null,
    op: "contains", // contains|eq|gt|lt|before|after
    label: "",
    placeholder: "",
    value: "",
  });

  /** ---------- Columns ---------- */
  const defaultColumns = useMemo(
    () => [
      { Header: "Category", accessor: "category" },
      { Header: "Subcategory", accessor: "subCategory" },

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

      { Header: "Prev Qty", accessor: "previousQuantity" },
      { Header: "Prev Qty C", accessor: "previousQuantityC" },
      { Header: "Prev Qty VM", accessor: "previousQuantityVM" },
      { Header: "Prev Avg Cost", accessor: "previousAverageCost" },
      { Header: "Prev Avg Cost C", accessor: "previousAverageCostC" },
      { Header: "Prev Avg Cost VM", accessor: "previousAverageCostVM" },
      { Header: "Prev Avg Cost CVM", accessor: "previousAverageCostCVM" },
      { Header: "Avg Cost", accessor: "averageCost" },
      { Header: "Avg Cost C", accessor: "averageCostC" },
      { Header: "Avg Cost CVM", accessor: "averageCostCVM" },
      { Header: "Avg Cost VM", accessor: "averageCostVM" },

      { Header: "Status", accessor: "status" },
      { Header: "Date", accessor: "date", id: "date" },
      { Header: "Invoice #", accessor: "invoiceNo" },
    ],
    []
  );

  /** ---------- react-table setup ---------- */
  const data = useMemo(() => {
    return (rows || []).map((r) => {
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
            ? `${r.length}×${r.width}-${String(r.sheetsPerBox).padStart(3, "0")}`
            : `${r.length}×${r.width}`,
        origin: r.origin || "—",
        quantity: r.quantity,
        quantityofr: r.quantityofr,
        sqm: typeof r.sqm === "number" ? r.sqm.toFixed(2) : r.sqm,
        sqmofr: typeof r.sqmofr === "number" ? r.sqmofr.toFixed(2) : r.sqmofr,
        finalcost: r.finalcost != null ? Number(r.finalcost).toFixed(2) : "—",
        finalcostofr: r.finalcostofr != null ? Number(r.finalcostofr).toFixed(2) : "—",
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

        previousQuantity: r.previousQuantity != null ? Number(r.previousQuantity).toFixed(2) : "—",
        previousQuantityC: r.previousQuantityC != null ? Number(r.previousQuantityC).toFixed(2) : "—",
        previousQuantityVM: r.previousQuantityVM != null ? Number(r.previousQuantityVM).toFixed(2) : "—",

        previousAverageCost: r.previousAverageCost != null ? Number(r.previousAverageCost).toFixed(2) : "—",
        previousAverageCostC: r.previousAverageCostC != null ? Number(r.previousAverageCostC).toFixed(2) : "—",
        previousAverageCostVM: r.previousAverageCostVM != null ? Number(r.previousAverageCostVM).toFixed(2) : "—",
        previousAverageCostCVM: r.previousAverageCostCVM != null ? Number(r.previousAverageCostCVM).toFixed(2) : "—",

        averageCost: r.averageCost != null ? Number(r.averageCost).toFixed(2) : "—",
        averageCostC: r.averageCostC != null ? Number(r.averageCostC).toFixed(2) : "—",
        averageCostCVM: r.averageCostCVM != null ? Number(r.averageCostCVM).toFixed(2) : "—",
        averageCostVM: r.averageCostVM != null ? Number(r.averageCostVM).toFixed(2) : "—",

        itemVariantId: r.itemVariantId,
        itemBatch: r.itemBatch,
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
  } = useTable({ columns: defaultColumns, data }, useColumnOrder);

  /** init column order only once */
  useEffect(() => {
    if (columnOrder.length === 0) {
      const initial = defaultColumns.map((c) => c.accessor);
      setColumnOrder(initial);
      updateColumnOrder(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultColumns]);

  /** ---------- DnD for columns ---------- */
  const sensors = useSensors(useSensor(PointerSensor));
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id);
      const newIndex = columnOrder.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
      setColumnOrder(newOrder);
      updateColumnOrder(newOrder);
    }
  };

  /** ---------- Filters helpers ---------- */
  const upsertFilter = useCallback((key, value) => {
    const v = String(value ?? "").trim();
    if (!v) return;

    setActiveFilters((prev) => {
      const next = prev.filter((f) => f.key !== key);
      next.push({ key, value: v });
      return next;
    });
    setPage(1);
  }, []);

  const removeFilterKey = useCallback((key) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
    setPage(1);
  }, []);

  const clearAll = useCallback(() => {
    setActiveFilters([]);
    setSortConfig({ column: null, direction: null });
    setPage(1);
  }, []);

  /** Column meta -> maps UI column to API query key + how to treat it */
  const COL_META = useMemo(
    () => ({
      category: { type: "textLike", api: "category" }, // already LIKE in API
      subCategory: { type: "textLike", api: "subCategory" }, // already LIKE in API
      name: { type: "nameContains", api: "nameContains" }, // YOU must add in API
      condition: { type: "textLike", api: "condition" }, // LIKE
      batchDate: { type: "date", api: "batchDate" }, // equals not implemented in your API for dateReceived, but you have batchDate exact in code
      dimension: { type: "dimension", api: "dimension" }, // exact parse in API
      origin: { type: "textLike", api: "origin" }, // LIKE
      quantity: { type: "number", api: "quantity" },
      quantityofr: { type: "number", api: "quantityofr" },
      sqm: { type: "number", api: "sqm" },
      sqmofr: { type: "number", api: "sqmofr" },
      finalcost: { type: "number", api: "finalcost" },
      finalcostofr: { type: "number", api: "finalcostofr" },
      unit: { type: "unit", api: "unit" },
      status: { type: "status", api: "status" },
      date: { type: "dateInvoice", api: "date" }, // API uses query.date, dateGt, dateLt on effective COALESCE
      invoiceNo: { type: "textLike", api: "invoiceNumber" }, // LIKE in API

      // PII numeric (already supported by your piiFields loop)
      previousQuantity: { type: "number", api: "previousQuantity" },
      previousQuantityC: { type: "number", api: "previousQuantityC" },
      previousQuantityVM: { type: "number", api: "previousQuantityVM" },
      previousAverageCost: { type: "number", api: "previousAverageCost" },
      previousAverageCostC: { type: "number", api: "previousAverageCostC" },
      previousAverageCostVM: { type: "number", api: "previousAverageCostVM" },
      previousAverageCostCVM: { type: "number", api: "previousAverageCostCVM" },
      averageCost: { type: "number", api: "averageCost" },
      averageCostC: { type: "number", api: "averageCostC" },
      averageCostCVM: { type: "number", api: "averageCostCVM" },
      averageCostVM: { type: "number", api: "averageCostVM" },
    }),
    []
  );

  /** Apply prompt result to filters depending on column + op */
  const applyPrompt = useCallback(
    (columnId, op, rawValue) => {
      const meta = COL_META[columnId];
      if (!meta) return;

      const val = String(rawValue ?? "").trim();
      if (!val) return;

      // Special cases
      if (meta.type === "dimension") {
        // Treat "contain" as exact dimension input (normalize x -> ×)
        upsertFilter("dimension", normalizeDimInput(val));
        return;
      }

      if (meta.type === "unit") {
        // treat contain as equals for unit
        upsertFilter("unit", normalizeUnit(val));
        return;
      }

      if (meta.type === "status") {
        upsertFilter("status", normalizeStatus(val));
        return;
      }

      if (meta.type === "dateInvoice") {
        if (op === "before") return upsertFilter("dateLt", val);
        if (op === "after") return upsertFilter("dateGt", val);
        return upsertFilter("date", val);
      }

      if (meta.type === "date") {
        // your API uses batchDate as equals; (if you later add batchDateGt/Lt you can expand)
        upsertFilter("batchDate", val);
        return;
      }

      if (meta.type === "number") {
        const n = toNum(val);
        if (n == null) return;

        if (op === "gt") return upsertFilter(`${meta.api}Gt`, n);
        if (op === "lt") return upsertFilter(`${meta.api}Lt`, n);
        return upsertFilter(meta.api, n);
      }

      if (meta.type === "textLike") {
        // your API already uses LIKE for these keys
        return upsertFilter(meta.api, val);
      }

      if (meta.type === "nameContains") {
        // needs API support (example: qb.andWhere('(item.itemName LIKE ... OR thickness.thickness LIKE ...)', ...))
        return upsertFilter(meta.api, val);
      }

      // fallback
      upsertFilter(meta.api, val);
    },
    [COL_META, upsertFilter]
  );

  /** ---------- Fetching ---------- */
  const fetchData = useCallback(
    async (append = false) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      activeFilters.forEach((f) => params.append(f.key, f.value));

      if (sortConfig.column) {
        params.set("sortBy", sortConfig.column);
        params.set("sortDir", sortConfig.direction);
      }

      const basePath =
        activeFilters.length > 0 || sortConfig.column
          ? "/inventory-transactions/activity/v1/filtered"
          : "/inventory-transactions/activity";

      const u = apiUrl(basePath);
      u.search = params.toString();

      const res = await fetch(u.toString());
      const js = await res.json();

      if (Array.isArray(js?.data)) {
        setRows((prev) => (append ? [...prev, ...js.data] : js.data));
        if (js.totals) {
          setTotals({
            totalQuantity: Number(js.totals.totalQuantity) || 0,
            totalQuantityOFR: Number(js.totals.totalQuantityOFR) || 0,
            totalSQM: Number(js.totals.totalSQM) || 0,
            totalSQMOFR: Number(js.totals.totalSQMOFR) || 0,
          });
        }
        setTotalRecords(js.totalRecords ?? 0);

        const shown = append ? rows.length + js.data.length : js.data.length;
        setHasMore((js.totalRecords ?? 0) > shown);
      } else {
        if (!append) setRows([]);
        setHasMore(false);
      }
    },
    [activeFilters, page, pageSize, rows.length, sortConfig]
  );

  useEffect(() => {
    fetchData(page > 1).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeFilters, sortConfig]);

  const loadMore = () => {
    const remaining = totalRecords - rows.length;
    if (remaining <= 0) return setHasMore(false);
    setPage((p) => p + 1);
  };

  /** ---------- Socket updates ---------- */
  useEffect(() => {
    const socketBase = (() => {
      if (isAbs(RAW_API_BASE)) return new URL(RAW_API_BASE).origin;
      return window.location.origin;
    })();

    const socket = io(socketBase);

    socket.on("inventoryActivityUpdate", (payload) => {
      if (Array.isArray(payload?.data)) {
        setRows(payload.data);
        if (payload.totals) {
          setTotals({
            totalQuantity: Number(payload.totals.totalQuantity) || 0,
            totalQuantityOFR: Number(payload.totals.totalQuantityOFR) || 0,
            totalSQM: Number(payload.totals.totalSQM) || 0,
            totalSQMOFR: Number(payload.totals.totalSQMOFR) || 0,
          });
        }
      }
    });

    return () => {
      socket.off("inventoryActivityUpdate");
      socket.disconnect();
    };
  }, []);

  /** ---------- Close menus on outside click ---------- */
  useEffect(() => {
    const closeMenus = () => {
      if (contextMenu.visible) setContextMenu((p) => ({ ...p, visible: false }));
      if (colMenu.visible) setColMenu((p) => ({ ...p, visible: false }));
    };
    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, [contextMenu.visible, colMenu.visible]);

  /** ---------- Cell right-click: quick “Add this value” ---------- */
  const addFilterFromCell = (column, value, record, op = "eq") => {
    // ignore blank placeholder
    if (value === "—" || value == null) return;

    // special mapping for some UI columns
    if (column === "name") {
      // keep your existing EXACT mechanism for cell-click filters:
      // record.name = "<th> ملم <item>"
      const [thStr, itemStr] = String(record.name || "").split(" ملم ");
      if (thStr && itemStr) {
        return upsertFilter("itemNameWithThickness", `${thStr}|${itemStr}`);
      }
      return;
    }

    if (column === "unit") return upsertFilter("unit", normalizeUnit(value));
    if (column === "status") return upsertFilter("status", normalizeStatus(value));

    if (column === "date") {
      if (op === "Lt") return upsertFilter("dateLt", value);
      if (op === "Gt") return upsertFilter("dateGt", value);
      return upsertFilter("date", value);
    }

    // numeric columns: support gt/lt
    const n = toNum(value);
    if (n != null) {
      if (op === "Gt") return upsertFilter(`${column}Gt`, n);
      if (op === "Lt") return upsertFilter(`${column}Lt`, n);
      return upsertFilter(column, n);
    }

    // text columns: your API uses LIKE for these keys, so same key works
    return upsertFilter(column === "invoiceNo" ? "invoiceNumber" : column, String(value));
  };

  /** ---------- Header right-click menu actions ---------- */
  const openHeaderMenu = (e, columnId) => {
    e.preventDefault();
    setColMenu({ visible: true, x: e.clientX, y: e.clientY, columnId });
  };

  const openPrompt = (columnId, op) => {
    const label = columnId;
    const placeholder =
      op === "contains"
        ? "Type text to contain…"
        : op === "eq"
        ? "Type exact value…"
        : op === "gt"
        ? "Type number…"
        : op === "lt"
        ? "Type number…"
        : op === "before"
        ? "YYYY-MM-DD"
        : op === "after"
        ? "YYYY-MM-DD"
        : "Type…";

    setPromptBox({
      open: true,
      columnId,
      op,
      label,
      placeholder,
      value: "",
    });
  };

  /** ---------- Render ---------- */
  return (
    <div className="inventory-activity-page">
      <div className="inventory-activity-header-bar">
        <h1 className="inventory-activity-title">Inventory Activity</h1>
        <div className="inventory-activity-btn-group">
          <button className="inventory-activity-btn-count" onClick={() => setShowCountModal(true)}>
            Count
          </button>
          <button className="inventory-activity-btn-transfers" onClick={() => setShowTransferModal(true)}>
            Transfers
          </button>
          <button className="inventory-activity-btn-transfers" onClick={clearAll}>
            Clear All
          </button>
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="active-filters-bar">
          <strong>Active Filters:</strong>
          {activeFilters.map((f, idx) => (
            <span key={idx} className="active-filters-tag">
              {f.key}: {f.value}
              <button onClick={() => setActiveFilters(activeFilters.filter((_, i) => i !== idx))}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* HEADER RIGHT-CLICK MENU (contains) */}
      {colMenu.visible && (
        <div
          style={{
            position: "fixed",
            top: colMenu.y,
            left: colMenu.x,
            background: "#fff",
            border: "1px solid #ccc",
            zIndex: 5000,
            padding: "6px",
            minWidth: 180,
          }}
        >
          <div
            style={{ padding: "6px", cursor: "pointer" }}
            onClick={() => {
              openPrompt(colMenu.columnId, "contains");
              setColMenu((v) => ({ ...v, visible: false }));
            }}
          >
            Contain…
          </div>

          <div
            style={{ padding: "6px", cursor: "pointer" }}
            onClick={() => {
              openPrompt(colMenu.columnId, "eq");
              setColMenu((v) => ({ ...v, visible: false }));
            }}
          >
            Equals…
          </div>

          <div style={{ borderTop: "1px solid #eee", margin: "6px 0" }} />

          <div
            style={{ padding: "6px", cursor: "pointer" }}
            onClick={() => {
              openPrompt(colMenu.columnId, "gt");
              setColMenu((v) => ({ ...v, visible: false }));
            }}
          >
            Greater than…
          </div>
          <div
            style={{ padding: "6px", cursor: "pointer" }}
            onClick={() => {
              openPrompt(colMenu.columnId, "lt");
              setColMenu((v) => ({ ...v, visible: false }));
            }}
          >
            Less than…
          </div>

          <div style={{ borderTop: "1px solid #eee", margin: "6px 0" }} />

          <div
            style={{ padding: "6px", cursor: "pointer" }}
            onClick={() => {
              // Date sorting shortcut (only meaningful if you later change to sort chosen column)
              setSortConfig({ column: "date", direction: "asc" });
              setColMenu((v) => ({ ...v, visible: false }));
              setPage(1);
            }}
          >
            Sort Date ↑
          </div>
          <div
            style={{ padding: "6px", cursor: "pointer" }}
            onClick={() => {
              setSortConfig({ column: "date", direction: "desc" });
              setColMenu((v) => ({ ...v, visible: false }));
              setPage(1);
            }}
          >
            Sort Date ↓
          </div>

          <div style={{ borderTop: "1px solid #eee", margin: "6px 0" }} />

          <div
            style={{ padding: "6px", cursor: "pointer", color: "#b00020" }}
            onClick={() => {
              const colId = colMenu.columnId;
              const meta = COL_META[colId];
              if (meta) removeFilterKey(meta.api === "invoiceNumber" ? "invoiceNumber" : meta.api);
              setColMenu((v) => ({ ...v, visible: false }));
            }}
          >
            Clear this column filter
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptBox.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            zIndex: 6000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPromptBox((p) => ({ ...p, open: false }))}
        >
          <div
            style={{
              width: 440,
              maxWidth: "100%",
              background: "#fff",
              borderRadius: 10,
              padding: 14,
              border: "1px solid #ddd",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              {promptBox.op === "contains"
                ? "Contain"
                : promptBox.op === "eq"
                ? "Equals"
                : promptBox.op === "gt"
                ? "Greater than"
                : promptBox.op === "lt"
                ? "Less than"
                : promptBox.op === "before"
                ? "Before"
                : promptBox.op === "after"
                ? "After"
                : "Filter"}{" "}
              — column: {promptBox.label}
            </div>

            <input
              autoFocus
              value={promptBox.value}
              placeholder={promptBox.placeholder}
              onChange={(e) => setPromptBox((p) => ({ ...p, value: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setPromptBox((p) => ({ ...p, open: false }));
                if (e.key === "Enter") {
                  applyPrompt(promptBox.columnId, promptBox.op, promptBox.value);
                  setPromptBox((p) => ({ ...p, open: false }));
                }
              }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              <button className="inventory-activity-btn-transfers" onClick={() => setPromptBox((p) => ({ ...p, open: false }))}>
                Cancel
              </button>
              <button
                className="inventory-activity-btn-count"
                onClick={() => {
                  applyPrompt(promptBox.columnId, promptBox.op, promptBox.value);
                  setPromptBox((p) => ({ ...p, open: false }));
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cell right-click menu (quick add) */}
      {contextMenu.visible && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#fff",
            border: "1px solid #ccc",
            zIndex: 4500,
            padding: "6px",
            cursor: "pointer",
          }}
        >
          <div
            style={{ padding: "6px", cursor: "pointer" }}
            onClick={() => {
              addFilterFromCell(contextMenu.column, contextMenu.value, contextMenu.record);
              setContextMenu((p) => ({ ...p, visible: false }));
            }}
          >
            Add "{String(contextMenu.value)}" to Filters
          </div>

          {contextMenu.column === "date" ? (
            <>
              <div
                style={{ padding: "6px" }}
                onClick={() => {
                  addFilterFromCell("date", contextMenu.value, contextMenu.record, "Lt");
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
              >
                Before {contextMenu.value}
              </div>
              <div
                style={{ padding: "6px" }}
                onClick={() => {
                  addFilterFromCell("date", contextMenu.value, contextMenu.record, "Gt");
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
              >
                After {contextMenu.value}
              </div>
            </>
          ) : toNum(contextMenu.value) != null ? (
            <>
              <div
                style={{ padding: "6px" }}
                onClick={() => {
                  addFilterFromCell(contextMenu.column, contextMenu.value, contextMenu.record, "Gt");
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
              >
                {contextMenu.column} &gt; {contextMenu.value}
              </div>
              <div
                style={{ padding: "6px" }}
                onClick={() => {
                  addFilterFromCell(contextMenu.column, contextMenu.value, contextMenu.record, "Lt");
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
              >
                {contextMenu.column} &lt; {contextMenu.value}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Table */}
      <div className="inventory-activity-container">
        <div className="inventory-activity-table-wrapper">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
              <table className="inventory-activity-table" {...getTableProps()}>
                <thead>
                  {headerGroups.map((hg) => (
                    <tr key={hg.id} {...hg.getHeaderGroupProps()}>
                      {hg.headers.map((col) => (
                        <DraggableColumnHeader
                          key={col.id}
                          column={col}
                          onContextMenu={(e) => openHeaderMenu(e, col.id)}
                        />
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody {...getTableBodyProps()}>
                  {tableRows.map((row) => {
                    prepareRow(row);
                    return (
                      <tr key={row.id} {...row.getRowProps()}>
                        {row.cells.map((cell) => (
                          <td
                            key={cell.column.id}
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

                {/* Totals aligned dynamically */}
                <tfoot>
                  <tr>
                    {headerGroups?.[0]?.headers?.map((col, idx) => {
                      const id = col.id;
                      if (idx === 0) {
                        return (
                          <td key={id} style={{ fontWeight: "bold" }}>
                            Totals
                          </td>
                        );
                      }
                      if (id === "quantity") {
                        return (
                          <td key={id} style={{ fontWeight: "bold", textAlign: "center" }}>
                            {totals.totalQuantity.toFixed(2)}
                          </td>
                        );
                      }
                      if (id === "quantityofr") {
                        return (
                          <td key={id} style={{ fontWeight: "bold", textAlign: "center" }}>
                            {totals.totalQuantityOFR.toFixed(2)}
                          </td>
                        );
                      }
                      if (id === "sqm") {
                        return (
                          <td key={id} style={{ fontWeight: "bold", textAlign: "center" }}>
                            {totals.totalSQM.toFixed(2)}
                          </td>
                        );
                      }
                      if (id === "sqmofr") {
                        return (
                          <td key={id} style={{ fontWeight: "bold", textAlign: "center" }}>
                            {totals.totalSQMOFR.toFixed(2)}
                          </td>
                        );
                      }
                      return <td key={id} />;
                    })}
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

      <CountModal isOpen={showCountModal} onClose={() => setShowCountModal(false)} />
      <TransferModal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} />
    </div>
  );
}
