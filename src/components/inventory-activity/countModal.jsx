import React, { useState, useEffect, useRef } from "react";
import CountSearchModal from "./countSearchModal";
import "./countModal.css";

const CountModal = ({ isOpen, onClose }) => {
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const tableWrapperRef = useRef();
  const wrapperRef = useRef();

  const closeDeleteMenu = () => {
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  const handleDeleteSingle = () => {
    const { rowIndex } = deleteMenu;
    if (rowIndex == null) return;
    setRows((prevRows) => prevRows.filter((_, i) => i !== rowIndex));
    closeDeleteMenu();
  };

  useEffect(() => {
    const handleClick = () => closeDeleteMenu();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  if (!isOpen) return null;

  const resetAll = () => setRows([]);
  const handleSave = () => {
    console.log("Saving rows:", rows);
    onClose();
  };

  const updateCell = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
  };

  const handleSelectItems = (items) => {
    if (items.length) {
      const today = new Date().toISOString().slice(0, 10);
      const newRows = items.map((sel) => ({
        key: sel.key,
        name: sel.item,
        dimension: `${Math.floor(sel.length)}×${Math.floor(sel.width)}-0${
          sel.sheetsPerBox
        }`,
        unit: sel.type,
        date: today,
        count: "",
      }));
      setRows((prev) => [...prev, ...newRows]);
    }
    setSearchOpen(false);
  };

  const existingKeys = new Set(rows.map((r) => r.key));

  const onRowContextMenu = (e, index) => {
    e.preventDefault();
    const rect = tableWrapperRef.current.getBoundingClientRect();
    setDeleteMenu({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      rowIndex: index,
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
              <button className="count-modal-btn reset-btn" onClick={resetAll}>
                Reset
              </button>
              <button className="count-modal-btn save-btn" onClick={handleSave}>
                Save
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
                        onChange={(e) =>
                          updateCell(i, "dimension", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="count-input"
                        value={r.unit}
                        onChange={(e) => updateCell(i, "unit", e.target.value)}
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
                        onChange={(e) => updateCell(i, "date", e.target.value)}
                      />
                    </td>
                    <td className="count-col">
                      <input
                        type="number"
                        className="count-input"
                        value={r.count}
                        onChange={(e) => updateCell(i, "count", e.target.value)}
                        placeholder="0"
                      />
                    </td>
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
                <button onClick={handleDeleteSingle}>Delete</button>
                <button onClick={closeDeleteMenu}>Cancel</button>
              </div>
            )}
          </div>

          <button
            className="count-modal-add-row"
            onClick={() => setSearchOpen(true)}
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
