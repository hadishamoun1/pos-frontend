// src/recievables/CountModal.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import CountSearchModal from "./countSearchModal";
import PreviewTable from "./previewTable";
import NotificationModal from "../recievables/NotificationModal";
import "./countModal.css";
import OpeningCountModal from "./openingCountModal";

const TYPE_OPTIONS = ["S", "G", "SR", "RVR"];

const CountModal = ({ isOpen, onClose }) => {
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });
  const [view, setView] = useState("create"); // create | preview | opening

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

  if (!isOpen) return null;

  const resetAll = () => {
    setView("create");
    setRows([]);
  };

  const handleSave = async () => {
    if (!rows.length) {
      onClose();
      return;
    }
    setSaving(true);

    const payload = rows.map((r) => ({
      itemBatchId: r.itemBatchId,
      itemVariantId: r.itemVariantId,
      date: r.date,
      unit: r.unit,
      count: r.count === "" ? 0 : Number(r.count),
      type: r.type,
      countOFR: r.countOFR === "" ? 0 : Number(r.countOFR),
      finalCost: r.finalCost === "" ? 0 : Number(r.finalCost),
      finalCostOfr: r.finalCostOfr === "" ? 0 : Number(r.finalCostOfr),
    }));

    try {
      await axios.post("http://localhost:3000/inventory-count", payload);
      setNotif({
        open: true,
        type: "success",
        message: "Inventory counts saved successfully!",
      });
    } catch (err) {
      console.error("Error saving inventory counts", err);
      setNotif({
        open: true,
        type: "error",
        message: "Failed to save counts. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

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

  const handleSelectItems = (items) => {
    if (!items.length) {
      setSearchOpen(false);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const newRows = items.map((sel) => ({
      key: sel.key,
      itemBatchId: sel.batchId, // ← batchId now included
      itemVariantId: sel.itemVariantId,
      name: sel.item,
      dimension: `${Math.floor(sel.length)}×${Math.floor(sel.width)}-0${
        sel.sheetsPerBox
      }`,
      unit: sel.type,
      date: today,
      count: "",
      type: "S",
      countOFR: "",
      finalCost: "",
      finalCostOfr: "",
    }));
    setRows((prev) => [...prev, ...newRows]);
    setSearchOpen(false);
  };

  const existingKeys = new Set(rows.map((r) => r.key));
  const showCountOfr = rows.some((r) => r.type === "SR");
  const showFinalCost = rows.some((r) => ["S", "SR", "RVR"].includes(r.type));
  const showFinalCostOfr = rows.some((r) => ["G", "SR"].includes(r.type));

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
              <button
                className={`btn action-btn ${
                  view === "create" ? "active" : ""
                }`}
                onClick={() => setView("create")}
                disabled={saving}
              >
                Inventory Check
              </button>
              <button
                className={`btn action-btn ${
                  view === "preview" ? "active" : ""
                }`}
                onClick={() => setView("preview")}
                disabled={saving}
              >
                Preview
              </button>
              <button
                className={`btn action-btn opening-btn ${
                  view === "opening" ? "active" : ""
                }`}
                onClick={() => setView("opening")}
                disabled={saving}
              >
                Opening Count
              </button>
            </div>
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
                      <th>Date</th>
                      <th className="count-col">Count</th>
                      <th>Type</th>
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
                              type="text"
                              className="count-input-name"
                              value={r.name}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="count-input"
                              value={r.dimension}
                              readOnly
                            />
                          </td>
                          <td>
                            <select
                              className="count-input"
                              value={r.unit}
                              disabled
                            >
                              <option value="">Unit</option>
                              <option value="box">Box</option>
                              <option value="sheet">Sheet</option>
                              <option value="sqm">SQM</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="date"
                              className="count-input"
                              value={r.date}
                              readOnly
                            />
                          </td>
                          <td className="count-col">
                            <input
                              type="number"
                              className="count-input"
                              value={r.count}
                              onChange={(e) =>
                                updateCell(i, "count", e.target.value)
                              }
                              placeholder="0"
                              disabled={saving}
                            />
                          </td>
                          <td>
                            <select
                              className="count-input"
                              value={r.type}
                              onChange={(e) =>
                                updateCell(i, "type", e.target.value)
                              }
                              disabled={saving}
                            >
                              {TYPE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          {showCountOfr && (
                            <td>
                              {r.type === "SR" ? (
                                <input
                                  type="number"
                                  className="count-input"
                                  value={r.countOFR}
                                  onChange={(e) =>
                                    updateCell(i, "countOFR", e.target.value)
                                  }
                                  placeholder="0"
                                  disabled={saving}
                                />
                              ) : (
                                <span>—</span>
                              )}
                            </td>
                          )}
                          {showFinalCost && (
                            <td>
                              {["S", "SR", "RVR"].includes(r.type) ? (
                                <input
                                  type="number"
                                  className="count-input"
                                  value={r.finalCost}
                                  onChange={(e) =>
                                    updateCell(i, "finalCost", e.target.value)
                                  }
                                  placeholder="0.00"
                                  disabled={saving}
                                />
                              ) : (
                                <span>—</span>
                              )}
                            </td>
                          )}
                          {showFinalCostOfr && (
                            <td>
                              {["G", "SR"].includes(r.type) ? (
                                <input
                                  type="number"
                                  className="count-input"
                                  value={r.finalCostOfr}
                                  onChange={(e) =>
                                    updateCell(
                                      i,
                                      "finalCostOfr",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  disabled={saving}
                                />
                              ) : (
                                <span>—</span>
                              )}
                            </td>
                          )}
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
