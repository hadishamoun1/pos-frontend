// CountModal.jsx (final with DateCountInput integrated)
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import CountSearchModal from "./countSearchModal";
import PreviewTable from "./previewTable";
import NotificationModal from "../recievables/NotificationModal";
import DateCountInput from "./inventoryDataEntry";
import OpeningCountModal from "./openingCountModal";
import "./countModal.css";

const TYPE_OPTIONS = ["S", "G", "SR", "RVR"];

const CountModal = ({ isOpen, onClose }) => {
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });
  const [view, setView] = useState("create");
  const [dateCountOpen, setDateCountOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });
  const tableWrapperRef = useRef();

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
  };

  const handleSave = async () => {
    if (!rows.length) return onClose();
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
    console.log("Selected items:", items); // ✅
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
          name: sel.name,
          dimension: `${Math.floor(sel.length)}×${Math.floor(sel.width)}-0${
            sel.sheetsPerBox
          }`,
          unit: sel.type,
          date: "",
          dateReceived: split.receivedDate || "",
          count: split.count || 0,
          type: "S",
          countOFR: "",
          finalCost: "",
          finalCostOfr: "",
        });
      });
    });
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
          {/* Header Buttons */}
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

          {/* Body Content */}
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
                {/* Table rendering */}
                <table className="count-modal-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Dimension</th>
                      <th>Unit</th>
                      <th>Date</th>
                      <th>Date Received</th>
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
                            <select
                              className="count-input"
                              value={r.unit}
                              disabled
                            >
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
                              value={r.type}
                              onChange={(e) =>
                                updateCell(i, "type", e.target.value)
                              }
                              disabled={saving}
                            >
                              {TYPE_OPTIONS.map((opt) => (
                                <option key={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          {showCountOfr && (
                            <td>
                              {r.type === "SR" ? (
                                <input
                                  className="count-input"
                                  type="number"
                                  value={r.countOFR}
                                  onChange={(e) =>
                                    updateCell(i, "countOFR", e.target.value)
                                  }
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
                                  className="count-input"
                                  type="number"
                                  value={r.finalCost}
                                  onChange={(e) =>
                                    updateCell(i, "finalCost", e.target.value)
                                  }
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
                                  className="count-input"
                                  type="number"
                                  value={r.finalCostOfr}
                                  onChange={(e) =>
                                    updateCell(
                                      i,
                                      "finalCostOfr",
                                      e.target.value
                                    )
                                  }
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
          {/* Let the component handle its internal layout */}
          <div onClick={(e) => e.stopPropagation()}>
            {selectedItems.length > 0 && (
              <DateCountInput
                onSave={handleDateCountConfirm}
                onCancel={() => {
                  setDateCountOpen(false);
                  setSelectedItems([]);
                }}
                unit={selectedItems[0].itemVariantType} // 'Box', 'Sheet', or 'SQM'
                length={selectedItems[0].length}
                width={selectedItems[0].width}
                sheetsPerBox={selectedItems[0].sheetsPerBox}
                originalBalance={selectedItems[0].balanceOFR} // in sqm
                thickness={selectedItems[0].thickness} // in mm
                itemName={selectedItems[0].name}
              />
            )}
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
