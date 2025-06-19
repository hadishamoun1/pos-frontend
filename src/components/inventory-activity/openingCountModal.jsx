// src/recievables/OpeningCountModal.jsx
import React, { useState, useEffect, useRef } from "react";
import NotificationModal from "../recievables/NotificationModal";
import "./openingCountModal.css";

const TYPE_OPTIONS = ["S", "G", "SR", "RVR"];

const OpeningCountModal = ({ isOpen, onClose, rows, setRows }) => {
  // remove local useState for rows
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });
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

  const resetAll = () => {
    setRows([]);
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
      <div className="opening-count-inner">
        <button className="opening-count-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="opening-count-modal-header">
          <div className="header-buttons">
            <button
              className="opening-count-modal-btn reset-btn"
              onClick={resetAll}
              disabled={saving}
            >
              Reset
            </button>
          </div>
        </div>

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
                  <tr key={r.key} onContextMenu={(e) => onRowContextMenu(e, i)}>
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
                        value={r.dimension}
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
                        value={r.date}
                        readOnly
                      />
                    </td>
                    <td className="count-col">
                      <input
                        type="number"
                        className="opening-count-input"
                        value={r.count}
                        onChange={(e) => updateCell(i, "count", e.target.value)}
                        placeholder="0"
                        disabled={saving}
                      />
                    </td>
                    <td>
                      <select
                        className="opening-count-input"
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
      </div>

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
