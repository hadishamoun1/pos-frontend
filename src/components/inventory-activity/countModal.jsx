import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import CountSearchModal from "./countSearchModal";
import "./countModal.css";

const TYPE_OPTIONS = ["S", "G", "SR", "RVR"];

const CountModal = ({ isOpen, onClose }) => {
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const tableWrapperRef = useRef();
  const wrapperRef = useRef();

  const closeDeleteMenu = () =>
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });

  const handleDeleteSingle = () => {
    const { rowIndex } = deleteMenu;
    if (rowIndex == null) return;
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
    closeDeleteMenu();
  };

  useEffect(() => {
    const onClick = () => closeDeleteMenu();
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  if (!isOpen) return null;

  const resetAll = () => setRows([]);

  const handleSave = async () => {
    if (!rows.length) {
      onClose();
      return;
    }
    setSaving(true);

    const payload = rows.map((r) => ({
      ...r,
      count: r.count === "" ? 0 : Number(r.count),
      countOFR: r.countOFR === "" ? 0 : Number(r.countOFR),
      finalCost: r.finalCost === "" ? 0 : Number(r.finalCost),
      finalCostOfr: r.finalCostOfr === "" ? 0 : Number(r.finalCostOfr),
    }));

    try {
      await axios.post("http://localhost:3000/inventory-count", payload);
      onClose();
    } catch (err) {
      console.error("Error saving inventory counts", err);
      alert("Failed to save counts. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateCell = (idx, field, value) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      // reset related fields when type changes
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
      itemVariantId: sel.key,
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

  // determine which cost columns to show
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

  return (
    <>
      <div className="count-modal-overlay" onClick={onClose} ref={wrapperRef}>
        <div
          className="count-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="count-modal-close" onClick={onClose}>
            &times;
          </button>

          <div className="count-modal-header">
            <h2>Count Inventory</h2>
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
          </div>

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
                  {showCountOfr && <th className="count-col">Count OFR</th>}
                  {showFinalCost && <th className="final-cost-th">Final Cost</th>}
                  {showFinalCostOfr && <th className="final-ofr-th">Final OFR</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} onContextMenu={(e) => onRowContextMenu(e, i)}>
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
                      <select className="count-input" value={r.unit} disabled>
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
                        onChange={(e) => updateCell(i, "count", e.target.value)}
                        placeholder="0"
                        disabled={saving}
                      />
                    </td>
                    <td>
                      <select
                        className="count-input"
                        value={r.type}
                        onChange={(e) => updateCell(i, "type", e.target.value)}
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
                  </tr>
                ))}
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
                <button onClick={handleDeleteSingle} disabled={saving}>
                  Delete
                </button>
                <button onClick={closeDeleteMenu} disabled={saving}>
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
        </div>
      </div>

      <CountSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelectItems}
        existingKeys={existingKeys}
      />
    </>
  );
};

export default CountModal;
