import React, { useState, useEffect, useRef } from "react";
import NotificationModal from "../recievables/NotificationModal";
import "./openingCountModal.css";
import CountOpeningSearchModal from "./countOpeningSearchModal";

const TYPE_OPTIONS = ["S", "G", "SR", "RVR"];

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
      date: item.dateReceived ?? "",
      count: "",
      type: "S",
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
          date: row.date,
          count: parseFloat(row.count || 0),
          countOFR: parseFloat(row.countOFR || 0),
          type: row.type,
          unit: row.unit,
          finalCost: parseFloat(row.finalCost || 0),
          finalCostOfr: parseFloat(row.finalCostOfr || 0),
          dateReceived: row.dateReceived,
          condition: row.condition,
        };

        console.log("Sending payload:", payload);

        await fetch("http://localhost:3000/inventory-count/v1/opening", {
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
                  rows.map((r, i) => (
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
                      <td>
                        <input
                          type="date"
                          className="opening-count-input"
                          value={r.date || ""}
                          onChange={(e) =>
                            updateCell(i, "date", e.target.value)
                          }
                          disabled={saving}
                        />
                      </td>
                      <td className="count-col">
                        <input
                          type="number"
                          className="opening-count-input"
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
                          className="opening-count-input"
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
                              className="opening-count-input"
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
                              className="opening-count-input"
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
                              className="opening-count-input"
                              value={r.finalCostOfr}
                              onChange={(e) =>
                                updateCell(i, "finalCostOfr", e.target.value)
                              }
                              placeholder="0.00"
                              disabled={saving}
                            />
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      )}
                      <td>
                        <input
                          type="month"
                          className="opening-count-input"
                          value={r.dateReceivedInput || ""}
                          onChange={(e) => {
                            const [year, month] = e.target.value.split("-");
                            const formatted = `${parseInt(month, 10)}/${year}`; // e.g., "6/2025"
                            updateCell(i, "dateReceivedInput", e.target.value); // input shows YYYY-MM
                            updateCell(i, "dateReceived", formatted); // API gets M/YYYY
                          }}
                          disabled={saving}
                        />
                      </td>
                      <td>
                        <select
                          className="opening-count-input"
                          value={r.condition}
                          onChange={(e) =>
                            updateCell(i, "condition", e.target.value)
                          }
                          disabled={saving}
                        >
                          <option value="Clean">Clean</option>
                          <option value="Damaged">Damaged</option>
                          <option value="Used">Used</option>
                        </select>
                      </td>
                    </tr>
                  ))
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
