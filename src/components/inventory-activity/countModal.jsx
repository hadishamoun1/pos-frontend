// src/components/inventory-activity/countModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { axiosClient } from "../api/axiosClient";

import SearchBatchModal from "./searchInventoryCheck";
import PreviewTable from "./previewTable";
import NotificationModal from "../recievables/NotificationModal";
import OpeningCountModal from "./openingCountModal";
import "./countModal.css";

const CountModal = ({ isOpen, onClose }) => {
  const [rows, setRows] = useState([]);
  const [batchSearchOpen, setBatchSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });
  const [view, setView] = useState("create");

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
    setBatchSearchOpen(false);
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  const handleSave = async () => {
    if (saveLockRef.current || saving) return;
    if (!rows.length) return onClose();

    // Group rows by source batch — one API call per batch
    const byBatch = new Map();
    for (const r of rows) {
      const key = Number(r.itemBatchId);
      if (!byBatch.has(key)) byBatch.set(key, []);
      byBatch.get(key).push(r);
    }

    saveLockRef.current = true;
    setSaving(true);

    try {
      for (const [batchId, batchRows] of byBatch.entries()) {
        const firstRow = batchRows[0];
        const payload = {
          itemBatchId: batchId,
          itemType: String(firstRow.unit || "").toLowerCase(),
          length: Number(firstRow.length),
          width: Number(firstRow.width),
          sheetsPerBox: Number(firstRow.sheetsPerBox),
          records: batchRows.map((r) => ({
            count: Number(r.count),
            status: r.status,
            receivedDate: r.receivedDate || null,
            condition: r.condition || null,
            targetBatchId:
              r.status === "adj+" && r.targetBatchId
                ? Number(r.targetBatchId)
                : null,
          })),
        };
        console.log("✅ Inventory-check payload:", payload);
        await axiosClient.post("/inventory-count/v1/inventory-check", payload);
      }

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
      const payload = { keepDate: "2025-11-29", deleteDate: "2025-10-31" };
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
      return copy;
    });
  };

  // Convert "MM/YYYY" stored format → "YYYY-MM" required by <input type="month">
  const toMonthInput = (dateStr) => {
    if (!dateStr) return "";
    const s = String(dateStr).trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
    return s;
  };

  // All selected items added directly as rows — no intermediate data entry modal
  const handlePickSourcesFromModal = (selected) => {
    const list = (selected || []).filter(Boolean);
    if (!list.length) return;

    const newRows = list.map((row, index) => ({
      key: `${row.batchId}-${Date.now()}-${index}`,
      itemBatchId: Number(row.batchId),
      itemVariantId: row.variantId,
      targetBatchId: null,
      name: row.itemName,
      dimension: `${Math.floor(Number(row.length || 0))}×${Math.floor(
        Number(row.width || 0)
      )}${
        String(row.type || "").toLowerCase() === "box"
          ? `-${String(row.sheetsPerBox || 0).padStart(3, "0")}`
          : ""
      }`,
      unit: row.type,
      length: row.length,
      width: row.width,
      sheetsPerBox: row.sheetsPerBox,
      receivedDate: toMonthInput(row.dateReceived),
      condition: row.condition || "",
      count: "",
      status: "adj+",
      date: "",
    }));

    setRows((prev) => [...prev, ...newRows]);
    setBatchSearchOpen(false);
  };

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
                      <th>Date Received</th>
                      <th className="count-col">Count</th>
                      <th>Status</th>
                      <th>Condition</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center" }}>
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
                            <input
                              className="count-input"
                              value={r.unit}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="month"
                              className="count-input"
                              value={r.receivedDate || ""}
                              onChange={(e) =>
                                updateCell(i, "receivedDate", e.target.value)
                              }
                              disabled={saving}
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
                              onChange={(e) =>
                                updateCell(i, "condition", e.target.value)
                              }
                              disabled={saving}
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
                onClick={() => setBatchSearchOpen(true)}
                disabled={saving}
              >
                Search Items (Pick Source)
              </button>
            </>
          )}
        </div>
      </div>

      <SearchBatchModal
        isOpen={batchSearchOpen}
        onClose={() => setBatchSearchOpen(false)}
        onSelect={handlePickSourcesFromModal}
      />

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
