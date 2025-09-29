// EditCountModal.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import CountSearchModal from "./countSearchModal";
import NotificationModal from "../recievables/NotificationModal";
import "./editModal.css";

const TYPE_OPTIONS = ["S", "G", "SR", "RVR"];
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

const EditCountModal = ({ isOpen, onClose, initialRows }) => {
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [activeRow, setActiveRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    type: "success",
    message: "",
    onConfirm: null,
  });
  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const closeDeleteMenu = () =>
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });

  const handleDeleteSingle = () => {
    const { rowIndex } = deleteMenu;
    if (rowIndex == null) return;
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
    closeDeleteMenu();
  };

  const tableWrapperRef = useRef();
  const wrapperRef = useRef();

  // ← make sure you have this function

  // Normalize incoming rows
  useEffect(() => {
    setRows(
      initialRows.map((r) => {
        const itemName = `${r.thickness} ملم ${r.itemVariantName}`;
        let dimension = `${r.length}×${r.width}`;
        if (r.itemVariantType === "box") dimension += `-0${r.sheetsPerBox}`;
        const key = `${r.itemVariantGroupId}-${r.thickness}-${r.itemVariantId}-${r.itemBatchId}`;
        return {
          ...r,
          name: itemName,
          dimension,
          unit: r.itemVariantType,
          itemBatchId: r.itemBatchId || null,
          key,
        };
      })
    );
  }, [initialRows]);

  useEffect(() => {
    const onClick = () => closeDeleteMenu();
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!rows.length) {
      onClose();
      return;
    }
    setSaving(true);

    try {
      await Promise.all(
        rows.map((r) => {
          const body = {
            itemBatchId: r.itemBatchId, // ✅ now included
            date: r.date,
            count: r.count === "" ? 0 : Number(r.count),
            unit: r.unit,
            countOFR: r.countOFR === "" ? 0 : Number(r.countOFR),
            type: r.type,
            finalCost: r.finalCost === "" ? 0 : Number(r.finalCost),
            finalCostOfr: r.finalCostOfr === "" ? 0 : Number(r.finalCostOfr),
          };
          return axios.patch(
            `${baseUrl}/inventory-count/${r.id}`,
            body
          );
        })
      );

      // on success, show notification, then close everything
      setNotification({
        open: true,
        type: "success",
        message: "Counts updated successfully!",
        onConfirm: () => {
          setNotification((n) => ({ ...n, open: false }));
          onClose();
        },
      });
    } catch (err) {
      console.error("Error updating counts", err);
      setNotification({
        open: true,
        type: "error",
        message: "Failed to update counts. Please try again.",
        onConfirm: () => setNotification((n) => ({ ...n, open: false })),
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
    if (!items.length || activeRow == null) {
      setSearchOpen(false);
      return;
    }
    const sel = items[0];
    const itemName = `${parseFloat(sel.thickness)} ملم ${sel.itemName}`;
    let dimension = `${Math.floor(sel.length)}×${Math.floor(sel.width)}`;
    if (sel.type === "box") dimension += `-0${sel.sheetsPerBox}`;
    setRows((prev) => {
      const copy = [...prev];
      const key = `${sel.itemVariantGroupId}-${sel.thickness}-${sel.itemVariantId}-${sel.batchId}`;
      copy[activeRow] = {
        ...copy[activeRow],
        name: itemName,
        dimension,
        unit: sel.type,
        itemBatchId: sel.batchId,
        itemVariantId: sel.itemVariantId,
        thickness: sel.thickness,
        itemVariantGroupId: sel.itemVariantGroupId,
        key,
      };
      return copy;
    });
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

  return (
    <>
      <div
        className="edit-count-modal-overlay"
        onClick={onClose}
        ref={wrapperRef}
      >
        <div
          className="edit-count-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="edit-count-modal-close" onClick={onClose}>
            &times;
          </button>

          <div className="edit-count-modal-header">
            <h2>Edit Counts</h2>
            <div className="edit-header-buttons">
              <button
                className="edit-count-modal-btn edit-save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="edit-count-modal-table-wrapper" ref={tableWrapperRef}>
            <table className="edit-count-modal-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Dimension</th>
                  <th>Unit</th>
                  <th>Date</th>
                  <th className="edit-count">Count</th>
                  <th>Type</th>
                  {showCountOfr && (
                    <th className="edit-count-ofr">Count OFR</th>
                  )}
                  {showFinalCost && (
                    <th className="edit-final-cost">Final Cost</th>
                  )}
                  {showFinalCostOfr && (
                    <th className="edit-final-cost-ofr">Final Cost OFR</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} onContextMenu={(e) => onRowContextMenu(e, i)}>
                    <td>
                      <input
                        type="text"
                        className="edit-count-input-name"
                        value={r.name}
                        readOnly
                        onClick={() => {
                          setActiveRow(i);
                          setSearchKey((k) => k + 1);
                          setSearchOpen(true);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="edit-count-input"
                        value={r.dimension}
                        readOnly
                        onClick={() => {
                          setActiveRow(i);
                          setSearchKey((k) => k + 1);
                          setSearchOpen(true);
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="edit-count-input"
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
                        className="edit-count-input"
                        value={r.date}
                        onChange={(e) => updateCell(i, "date", e.target.value)}
                        disabled={saving}
                      />
                    </td>
                    <td className="count-col">
                      <input
                        type="number"
                        className="edit-count-input"
                        value={r.count}
                        onChange={(e) => updateCell(i, "count", e.target.value)}
                        disabled={saving}
                      />
                    </td>
                    <td>
                      <select
                        className="edit-count-input"
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
                            className="edit-count-input"
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
                            type="number"
                            className="edit-count-input"
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
                            type="number"
                            className="edit-count-input"
                            value={r.finalCostOfr}
                            onChange={(e) =>
                              updateCell(i, "finalCostOfr", e.target.value)
                            }
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
                className="edit-context-menu-count"
                style={{
                  position: "absolute",
                  top: deleteMenu.y,
                  left: deleteMenu.x,
                  zIndex: 1000,
                }}
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

          <CountSearchModal
            key={searchKey}
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelect={handleSelectItems}
            existingKeys={existingKeys}
            singleSelect={true}
          />
        </div>
      </div>

      {notification.open && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification((n) => ({ ...n, open: false }))}
          onConfirm={notification.onConfirm}
        />
      )}
    </>
  );
};

export default EditCountModal;
