import React, { useState, useEffect, useRef } from "react";
import NotificationModal from "../recievables/NotificationModal";
import "./openingCountModal.css";
import CountOpeningSearchModal from "./countOpeningSearchModal";

const TYPE_OPTIONS = ["S", "G", "SR", "RVR"];
const baseUrl = process.env.REACT_APP_API_BASE_URL;

// ✅ Defaults
const DEFAULT_TYPE = "G";
const DEFAULT_DATE_ISO = "2025-10-31"; // input[type=date] needs YYYY-MM-DD

const OpeningCountModal = ({ isOpen, onClose, rows, setRows }) => {
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });
  const [searchOpen, setSearchOpen] = useState(false);

  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const tableWrapperRef = useRef();

  const closeDeleteMenu = () =>
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });

  useEffect(() => {
    const onClick = () => closeDeleteMenu();
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  // ✅ On open, backfill any missing date/type with defaults
  useEffect(() => {
    if (!isOpen) return;
    setRows((prev) =>
      (prev || []).map((r) => ({
        ...r,
        type: r.type || DEFAULT_TYPE,
        date: r.date || DEFAULT_DATE_ISO,
      }))
    );
  }, [isOpen, setRows]);

  const resetAll = () => setRows([]);

  const updateCell = (idx, field, value) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === "type") {
        copy[idx].count = "";
        copy[idx].countOFR = "";
        copy[idx].finalCost = "";
        copy[idx].finalCostOfr = "";
      }
      return copy;
    });
  };

  const onRowContextMenu = (e, i) => {
    e.preventDefault();
    const rect = tableWrapperRef.current.getBoundingClientRect();
    setDeleteMenu({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      rowIndex: i,
    });
  };

  const handleDeleteSingle = () => {
    const { rowIndex } = deleteMenu;
    if (rowIndex == null) return;
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
    closeDeleteMenu();
  };

  const handleSelectItems = (selected) => {
    const enriched = selected.map((item, index) => ({
      key: `${item.itemVariantId}-${index}`,
      itemVariantId: item.itemVariantId,
      name: item.item,
      dimension: `${item.length}x${item.width}`,
      unit: item.type,
      // ✅ Defaults here:
      date: DEFAULT_DATE_ISO,
      type: DEFAULT_TYPE,

      count: "",
      countOFR: "",
      finalCost: "",
      finalCostOfr: "",
      dateReceived: "",
      condition: "Clean",
      sheetsPerBox: item.sheetsPerBox ?? "",
    }));
    setRows((prev) => [...prev, ...enriched]);
    setSearchOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        const payload = {
          itemVariantId: row.itemVariantId,
          date: row.date || DEFAULT_DATE_ISO, // fallback just in case
          count: parseFloat(row.count || 0),
          countOFR: parseFloat(row.countOFR || 0),
          type: row.type || DEFAULT_TYPE, // fallback just in case
          unit: row.unit,
          finalCost: parseFloat(row.finalCost || 0),
          finalCostOfr: parseFloat(row.finalCostOfr || 0),
          dateReceived: row.dateReceived,
          condition: row.condition,
        };

        console.log("Sending payload:", payload);

        await fetch(`${baseUrl}/inventory-count/v1/opening`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      setNotif({
        open: true,
        type: "success",
        message: "Opening counts saved successfully",
      });
      setRows([]);
    } catch (error) {
      console.error("Error saving opening counts:", error);
      setNotif({
        open: true,
        type: "error",
        message: "Failed to save opening counts",
      });
    } finally {
      setSaving(false);
    }
  };

  const showCountOfr = rows.some((r) => r.type === "SR");
  const showFinalCost = rows.some((r) => ["S", "SR", "RVR"].includes(r.type));
  const showFinalCostOfr = rows.some((r) => ["G", "SR"].includes(r.type));

  // ===== input locking helpers (no wheel, no ArrowUp/Down) + decimal sanitizer =====
  const normalizeDecimal = (val) => {
    const s = String(val ?? "");
    const cleaned = s.replace(/[^\d.]/g, "");
    const [head, ...rest] = cleaned.split(".");
    return rest.length ? `${head}.${rest.join("").replace(/\./g, "")}` : head;
  };
  const blockWheel = (e) => e.preventDefault();
  const blockArrowInc = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };

  // =========================
  // Keyboard Navigation (NEW)
  // =========================
  // Stable order of possible fields in one row (superset; some are hidden per row)
  const ALL_FIELDS = [
    "date",
    "count",
    "type",
    "countOFR",
    "finalCost",
    "finalCostOfr",
    "dateReceivedInput",
    "condition",
  ];

  // Matrix of refs: cellRefs.current[rowIndex][field] = ref
  const cellRefs = useRef([]);

  const ensureRef = (rowIndex, field) => {
    if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {};
    if (!cellRefs.current[rowIndex][field]) cellRefs.current[rowIndex][field] = React.createRef();
    return cellRefs.current[rowIndex][field];
  };

  const focusFieldsForRow = (row) => {
    if (!row) return [];
    const fields = ["date", "count", "type"];
    if (row.type === "SR") fields.push("countOFR");
    if (["S", "SR", "RVR"].includes(row.type)) fields.push("finalCost");
    if (["G", "SR"].includes(row.type || DEFAULT_TYPE)) fields.push("finalCostOfr");
    fields.push("dateReceivedInput", "condition");
    return fields;
    };

  const focusCell = (rowIndex, field) => {
    const ref = cellRefs.current?.[rowIndex]?.[field];
    if (ref && ref.current) {
      ref.current.focus();
      if (ref.current.select) {
        try { ref.current.select(); } catch {}
      }
    }
  };

  const moveHorizontal = (rowIndex, field, dir) => {
    // dir: +1 next, -1 previous
    const fields = focusFieldsForRow(rows[rowIndex]);
    const idx = fields.indexOf(field);
    if (idx === -1) return;

    let targetRow = rowIndex;
    let targetFieldIndex = idx + dir;

    if (targetFieldIndex < 0) {
      // go to previous row last field
      targetRow = Math.max(0, rowIndex - 1);
      if (targetRow !== rowIndex) {
        const f2 = focusFieldsForRow(rows[targetRow]);
        return focusCell(targetRow, f2[f2.length - 1]);
      }
      targetFieldIndex = 0;
    } else if (targetFieldIndex >= fields.length) {
      // go to next row first field
      targetRow = Math.min(rows.length - 1, rowIndex + 1);
      if (targetRow !== rowIndex) {
        const f2 = focusFieldsForRow(rows[targetRow]);
        return focusCell(targetRow, f2[0]);
      }
      targetFieldIndex = fields.length - 1;
    }

    focusCell(targetRow, fields[targetFieldIndex]);
  };

  const moveVertical = (rowIndex, field, dir) => {
    // dir: +1 down, -1 up
    const targetRow = rowIndex + dir;
    if (targetRow < 0 || targetRow >= rows.length) return;

    // if field is hidden in target row, pick nearest available to it
    const fieldsTarget = focusFieldsForRow(rows[targetRow]);
    if (fieldsTarget.includes(field)) return focusCell(targetRow, field);

    const prefIdx = ALL_FIELDS.indexOf(field);
    for (let radius = 1; radius <= ALL_FIELDS.length; radius++) {
      const left = ALL_FIELDS[prefIdx - radius];
      const right = ALL_FIELDS[prefIdx + radius];
      if (left && fieldsTarget.includes(left)) return focusCell(targetRow, left);
      if (right && fieldsTarget.includes(right)) return focusCell(targetRow, right);
    }
    // fallback to first
    focusCell(targetRow, fieldsTarget[0]);
  };

  const onCellKeyDown = (e, rowIndex, field) => {
    const key = e.key;

    if (key === "Enter") {
      e.preventDefault();
      return moveHorizontal(rowIndex, field, +1);
    }

    if (key === "ArrowUp") {
      e.preventDefault();
      return moveVertical(rowIndex, field, -1);
    }
    if (key === "ArrowDown") {
      e.preventDefault();
      return moveVertical(rowIndex, field, +1);
    }

    // Left/Right only when caret at start/end
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const el = e.currentTarget;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const len = String(el.value ?? "").length;

      if (key === "ArrowLeft" && start === end && start === 0) {
        e.preventDefault();
        return moveHorizontal(rowIndex, field, -1);
      }
      if (key === "ArrowRight" && start === end && start === len) {
        e.preventDefault();
        return moveHorizontal(rowIndex, field, +1);
      }
    }
  };
  // =========================
  // /Keyboard Navigation
  // =========================

  return (
    <>
      <div className="opening-count-inner">
        <div className="opening-count-modal-header">
          <div className="header-buttons">
            <button
              className="opening-count-modal-btn reset-btn"
              onClick={resetAll}
              disabled={saving}
            >
              Reset
            </button>
            <button
              className="opening-count-modal-btn save-btn"
              onClick={handleSave}
              disabled={saving || rows.length === 0}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <div className="opening-count-body-container">
          <div
            className="opening-count-modal-table-wrapper"
            ref={tableWrapperRef}
          >
            <table className="opening-count-modal-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Dimension</th>
                  <th>Unit</th>
                  <th>Date</th>
                  <th className="count-col">Count</th>
                  <th>Type</th>
                  {showCountOfr && <th>Count OFR</th>}
                  {showFinalCost && <th>Final Cost</th>}
                  {showFinalCostOfr && <th>Final Cost OFR</th>}
                  <th>Date Received</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center" }}>
                      No items added
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => {
                    // per-row conditional visibility (keeps your header logic untouched)
                    const rowShowCountOfr = r.type === "SR";
                    const rowShowFinalCost = ["S", "SR", "RVR"].includes(r.type);
                    const rowShowFinalCostOfr = ["G", "SR"].includes(r.type || DEFAULT_TYPE);

                    // refs per editable cell
                    const refDate = ensureRef(i, "date");
                    const refCount = ensureRef(i, "count");
                    const refType = ensureRef(i, "type");
                    const refCountOFR = rowShowCountOfr ? ensureRef(i, "countOFR") : null;
                    const refFinalCost = rowShowFinalCost ? ensureRef(i, "finalCost") : null;
                    const refFinalCostOfr = rowShowFinalCostOfr ? ensureRef(i, "finalCostOfr") : null;
                    const refDateReceived = ensureRef(i, "dateReceivedInput");
                    const refCondition = ensureRef(i, "condition");

                    return (
                      <tr
                        key={r.key}
                        onContextMenu={(e) => onRowContextMenu(e, i)}
                      >
                        <td>
                          <input
                            type="text"
                            className="opening-count-input-name"
                            value={r.name}
                            readOnly
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="opening-count-input"
                            value={
                              r.unit === "box"
                                ? `${r.dimension}${
                                    r.sheetsPerBox ? `-0${r.sheetsPerBox}` : ""
                                  }`
                                : r.dimension
                            }
                            readOnly
                          />
                        </td>

                        <td>
                          <select
                            className="opening-count-input"
                            value={r.unit}
                            disabled
                          >
                            <option value="">Unit</option>
                            <option value="box">Box</option>
                            <option value="sheet">Sheet</option>
                            <option value="sqm">SQM</option>
                          </select>
                        </td>

                        {/* Date */}
                        <td>
                          <input
                            ref={refDate}
                            type="date"
                            className="opening-count-input"
                            value={r.date || DEFAULT_DATE_ISO}
                            onChange={(e) =>
                              updateCell(i, "date", e.target.value)
                            }
                            onKeyDown={(e) => onCellKeyDown(e, i, "date")}
                            onWheel={blockWheel}
                            disabled={saving}
                          />
                        </td>

                        {/* Count (no arrows/wheel) */}
                        <td className="count-col">
                          <input
                            ref={refCount}
                            type="text"
                            inputMode="decimal"
                            className="opening-count-input"
                            value={r.count}
                            onChange={(e) =>
                              updateCell(i, "count", normalizeDecimal(e.target.value))
                            }
                            onKeyDown={(e) => onCellKeyDown(e, i, "count")}
                            onWheel={blockWheel}
                            placeholder="0"
                            disabled={saving}
                          />
                        </td>

                        {/* Type */}
                        <td>
                          <select
                            ref={refType}
                            className="opening-count-input"
                            value={r.type || DEFAULT_TYPE}
                            onChange={(e) =>
                              updateCell(i, "type", e.target.value)
                            }
                            onKeyDown={(e) => onCellKeyDown(e, i, "type")}
                            disabled={saving}
                          >
                            {TYPE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Count OFR */}
                        {showCountOfr && (
                          <td>
                            {rowShowCountOfr ? (
                              <input
                                ref={refCountOFR}
                                type="text"
                                inputMode="decimal"
                                className="opening-count-input"
                                value={r.countOFR}
                                onChange={(e) =>
                                  updateCell(
                                    i,
                                    "countOFR",
                                    normalizeDecimal(e.target.value)
                                  )
                                }
                                onKeyDown={(e) => onCellKeyDown(e, i, "countOFR")}
                                onWheel={blockWheel}
                                placeholder="0"
                                disabled={saving}
                              />
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                        )}

                        {/* Final Cost */}
                        {showFinalCost && (
                          <td>
                            {rowShowFinalCost ? (
                              <input
                                ref={refFinalCost}
                                type="text"
                                inputMode="decimal"
                                className="opening-count-input"
                                value={r.finalCost}
                                onChange={(e) =>
                                  updateCell(
                                    i,
                                    "finalCost",
                                    normalizeDecimal(e.target.value)
                                  )
                                }
                                onKeyDown={(e) => onCellKeyDown(e, i, "finalCost")}
                                onWheel={blockWheel}
                                placeholder="0.00"
                                disabled={saving}
                              />
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                        )}

                        {/* Final Cost OFR */}
                        {showFinalCostOfr && (
                          <td>
                            {rowShowFinalCostOfr ? (
                              <input
                                ref={refFinalCostOfr}
                                type="text"
                                inputMode="decimal"
                                className="opening-count-input"
                                value={r.finalCostOfr}
                                onChange={(e) =>
                                  updateCell(
                                    i,
                                    "finalCostOfr",
                                    normalizeDecimal(e.target.value)
                                  )
                                }
                                onKeyDown={(e) => onCellKeyDown(e, i, "finalCostOfr")}
                                onWheel={blockWheel}
                                placeholder="0.00"
                                disabled={saving}
                              />
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                        )}

                        {/* Date Received (month) */}
                        <td>
                          <input
                            ref={refDateReceived}
                            type="month"
                            className="opening-count-input"
                            value={r.dateReceivedInput || ""}
                            onChange={(e) => {
                              const [year, month] = e.target.value.split("-");
                              const formatted = `${parseInt(month, 10)}/${year}`; // e.g., "6/2025"
                              updateCell(i, "dateReceivedInput", e.target.value); // input shows YYYY-MM
                              updateCell(i, "dateReceived", formatted); // API gets M/YYYY
                            }}
                            onKeyDown={(e) => onCellKeyDown(e, i, "dateReceivedInput")}
                            onWheel={blockWheel}
                            disabled={saving}
                          />
                        </td>

                        {/* Condition */}
                        <td>
                          <select
                            ref={refCondition}
                            className="opening-count-input"
                            value={r.condition}
                            onChange={(e) =>
                              updateCell(i, "condition", e.target.value)
                            }
                            onKeyDown={(e) => onCellKeyDown(e, i, "condition")}
                            disabled={saving}
                          >
                            <option value="Clean">Clean</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Used">Used</option>
                            <option value="Defect">Defect</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {deleteMenu.visible && (
              <div
                className="context-menu-opening"
                style={{
                  position: "absolute",
                  top: deleteMenu.y,
                  left: deleteMenu.x,
                  zIndex: 1000,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="context-delete-btn"
                  onClick={handleDeleteSingle}
                  disabled={saving}
                >
                  Delete
                </button>
                <button
                  className="context-cancel-btn"
                  onClick={closeDeleteMenu}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <button
            className="opening-count-modal-btn search-btn"
            onClick={() => setSearchOpen(true)}
            disabled={saving}
          >
            Search Items
          </button>
        </div>
      </div>

      {searchOpen && (
        <CountOpeningSearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelectItems={handleSelectItems}
        />
      )}

      {notif.open && (
        <NotificationModal
          type={notif.type}
          message={notif.message}
          onClose={() => {
            setNotif((n) => ({ ...n, open: false }));
            if (notif.type === "success") onClose();
          }}
        />
      )}
    </>
  );
};

export default OpeningCountModal;
