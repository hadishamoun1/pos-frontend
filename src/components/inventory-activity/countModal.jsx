// CountModal.jsx (with axiosClient + save/rebuild locks + spread fixes)
import React, { useState, useEffect, useRef } from "react";

// ✅ use your axios client (adjust path)
import { axiosClient } from "../api/axiosClient";

import CountSearchModal from "./countSearchModal";
import PreviewTable from "./previewTable";
import NotificationModal from "../recievables/NotificationModal";
import DateCountInput from "./inventoryDataEntry";
import OpeningCountModal from "./openingCountModal";
import "./countModal.css";

const CountModal = ({ isOpen, onClose }) => {
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });
  const [view, setView] = useState("create");
  const [dateCountOpen, setDateCountOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  // ✅ Locks to prevent double-call (fast double-click before React disables button)
  const saveLockRef = useRef(false);
  const rebuildLockRef = useRef(false);

  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const tableWrapperRef = useRef(null);

  useEffect(() => {
    const onClick = () =>
      setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  if (!isOpen) return null;

  const resetAll = () => {
    setView("create");
    setRows([]);
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  const handleSave = async () => {
    if (saveLockRef.current || saving) return;
    if (!rows.length) return onClose();

    saveLockRef.current = true;
    setSaving(true);

    try {
      const firstRow = rows[0];

      const payload = {
        itemBatchId: firstRow.itemBatchId,
        itemType: (firstRow.unit || "").toLowerCase(), // 'box', 'sheet', 'sqm'
        length: Number(firstRow.length),
        width: Number(firstRow.width),
        sheetsPerBox: Number(firstRow.sheetsPerBox),
        records: rows.map((r) => ({
          count: Number(r.count),
          receivedDate: r.dateReceived,
          status: r.status,
          // If your backend expects "date", add: date: r.date
        })),
      };

      console.log("✅ Payload being sent:", payload);

      // ✅ axiosClient (relative URL)
      await axiosClient.post("/inventory-count/v1/inventory-check", payload);

      setNotif({
        open: true,
        type: "success",
        message: "✅ Inventory check saved successfully!",
      });

      resetAll();
    } catch (err) {
      console.error("❌ Error saving inventory check", err);
      setNotif({
        open: true,
        type: "error",
        message:
          err?.response?.data?.message ||
          "❌ Failed to save inventory check. Please try again.",
      });
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  const handleRebuildOpeningCounts = async () => {
    if (rebuildLockRef.current || saving) return;

    rebuildLockRef.current = true;
    setSaving(true);

    try {
      const payload = {
        keepDate: "2025-11-29",
        deleteDate: "2025-10-31",
      };

      // ✅ axiosClient (relative URL)
      await axiosClient.post("/inventory-count/opening/rebuild", payload);

      setNotif({
        open: true,
        type: "success",
        message:
          "✅ Opening counts rebuilt (kept 29-11-2025, deleted 31-10-2025).",
      });
    } catch (err) {
      console.error("❌ Error rebuilding opening counts", err);
      setNotif({
        open: true,
        type: "error",
        message:
          err?.response?.data?.message ||
          "❌ Failed to rebuild opening counts. Check server logs.",
      });
    } finally {
      rebuildLockRef.current = false;
      setSaving(false);
    }
  };

  const updateCell = (idx, field, value) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };

      // If you change type, clear dependent fields (keep your behavior)
      if (field === "type") {
        copy[idx].count = "";
        copy[idx].countOFR = "";
        copy[idx].finalCost = "";
        copy[idx].finalCostOfr = "";
      }

      return copy;
    });
  };

  const handleSelectItems = (items) => {
    console.log("Selected items:", items);
    setSelectedItems(items);
    setDateCountOpen(true);
    setSearchOpen(false);
  };

  const handleDateCountConfirm = (splits) => {
    const newRows = [];

    selectedItems.forEach((sel) => {
      splits.forEach((split, index) => {
        newRows.push({
          key: `${sel.key}-${index}`,
          itemBatchId: sel.batchId,
          itemVariantId: sel.itemVariantId,
          name: sel.itemName,
          dimension: `${Math.floor(sel.length)}×${Math.floor(sel.width)}-0${
            sel.sheetsPerBox
          }`,
          unit: sel.itemVariantType,
          length: sel.length,
          width: sel.width,
          sheetsPerBox: sel.sheetsPerBox,
          date: "",
          dateReceived: split.receivedDate || "",
          count: split.count || 0,
          status: split.status,
          type: split.status,
          condition: sel.condition,
        });
      });
    });

    // ✅ fixed spread
    setRows((prev) => [...prev, ...newRows]);

    setDateCountOpen(false);
    setSelectedItems([]);
  };

  const existingKeys = new Set(rows.map((r) => r.key));
  const showCountOfr = rows.some((r) => r.type === "SR");
  const showFinalCost = rows.some((r) => ["S", "SR", "RVR"].includes(r.type));
  const showFinalCostOfr = rows.some((r) => ["G", "SR"].includes(r.type));

  const onRowContextMenu = (e, i) => {
    e.preventDefault();
    if (!tableWrapperRef.current) return;

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
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  return (
    <>
      <div className="count-modal-overlay" onClick={onClose}>
        <div
          className="count-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="count-modal-close" onClick={onClose}>
            &times;
          </button>

          {/* Header */}
          <div className="count-modal-header">
            <h2>Count Inventory</h2>

            <div className="action-buttons">
              {["create", "preview", "opening"].map((v) => (
                <button
                  key={v}
                  className={`btn action-btn ${view === v ? "active" : ""}`}
                  onClick={() => setView(v)}
                  disabled={saving}
                >
                  {v === "create"
                    ? "Inventory Check"
                    : v === "preview"
                    ? "Preview"
                    : "Opening Count"}
                </button>
              ))}
            </div>

            {view === "opening" && (
              <div className="header-buttons">
                <button
                  className="count-modal-btn save-btn"
                  onClick={handleRebuildOpeningCounts}
                  disabled={saving}
                  title="Deletes Opening Counts of 31-10-2025 and rebuilds Opening Count txns using 29-11-2025 only"
                >
                  {saving ? "Rebuilding…" : "Rebuild Opening Counts"}
                </button>
              </div>
            )}

            {view === "create" && (
              <div className="header-buttons">
                <button
                  className="count-modal-btn reset-btn"
                  onClick={resetAll}
                  disabled={saving}
                >
                  Reset
                </button>
                <button
                  className="count-modal-btn save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          {view === "preview" ? (
            <PreviewTable rows={rows} onClose={() => setView("create")} />
          ) : view === "opening" ? (
            <OpeningCountModal
              rows={rows}
              setRows={setRows}
              onClose={() => setView("create")}
            />
          ) : (
            <>
              <div className="count-modal-table-wrapper" ref={tableWrapperRef}>
                <table className="count-modal-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Dimension</th>
                      <th>Unit</th>
                      <th>Date</th>
                      <th>Date Received</th>
                      <th className="count-col">Count</th>
                      <th>Status</th>
                      <th>Condition</th>
                      {showCountOfr && <th>Count OFR</th>}
                      {showFinalCost && <th>Final Cost</th>}
                      {showFinalCostOfr && <th>Final Cost OFR</th>}
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
                      rows.map((r, i) => (
                        <tr
                          key={r.key}
                          onContextMenu={(e) => onRowContextMenu(e, i)}
                        >
                          <td>
                            <input
                              className="count-input-name"
                              value={r.name}
                              readOnly
                            />
                          </td>

                          <td>
                            <input
                              className="count-input"
                              value={r.dimension}
                              readOnly
                            />
                          </td>

                          <td>
                            <select className="count-input" value={r.unit} disabled>
                              <option>Box</option>
                              <option>Sheet</option>
                              <option>SQM</option>
                            </select>
                          </td>

                          <td>
                            <input
                              type="date"
                              className="count-input"
                              value={r.date}
                              onChange={(e) =>
                                updateCell(i, "date", e.target.value)
                              }
                              disabled={saving}
                            />
                          </td>

                          <td>
                            <input
                              className="count-input"
                              value={r.dateReceived || ""}
                              readOnly
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              className="count-input"
                              value={r.count}
                              onChange={(e) =>
                                updateCell(i, "count", e.target.value)
                              }
                              disabled={saving}
                            />
                          </td>

                          <td>
                            <select
                              className="count-input"
                              value={r.status}
                              onChange={(e) =>
                                updateCell(i, "status", e.target.value)
                              }
                              disabled={saving}
                            >
                              <option value="adj+">adj+</option>
                              <option value="adj-">adj-</option>
                              <option value="breakage">breakage</option>
                            </select>
                          </td>

                          <td>
                            <input
                              className="count-input"
                              value={r.condition || ""}
                              readOnly
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {deleteMenu.visible && (
                  <div
                    className="context-menu-purchases"
                    style={{
                      position: "absolute",
                      top: deleteMenu.y,
                      left: deleteMenu.x,
                      zIndex: 1000,
                    }}
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
                      onClick={() =>
                        setDeleteMenu({
                          visible: false,
                          x: 0,
                          y: 0,
                          rowIndex: null,
                        })
                      }
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <button
                className="count-modal-add-row"
                onClick={() => setSearchOpen(true)}
                disabled={saving}
              >
                Search Items
              </button>
            </>
          )}
        </div>
      </div>

      <CountSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelectItems}
        existingKeys={existingKeys}
      />

      {dateCountOpen && selectedItems.length > 0 && (
        <div
          className="date-count-overlay"
          onClick={() => {
            setDateCountOpen(false);
            setSelectedItems([]);
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <DateCountInput
              onSave={handleDateCountConfirm}
              onCancel={() => {
                setDateCountOpen(false);
                setSelectedItems([]);
              }}
              unit={selectedItems[0].itemVariantType}
              length={selectedItems[0].length}
              width={selectedItems[0].width}
              sheetsPerBox={selectedItems[0].sheetsPerBox}
              originalBalance={selectedItems[0].balanceOFR}
              thickness={selectedItems[0].thickness}
              itemName={selectedItems[0].itemName}
            />
          </div>
        </div>
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

export default CountModal;
