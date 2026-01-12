// src/components/inventory-activity/countModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { axiosClient } from "../api/axiosClient";

import SearchBatchModal from "./searchInventoryCheck"; // SOURCE picker
import PreviewTable from "./previewTable";
import NotificationModal from "../recievables/NotificationModal";
import DateCountInput from "./inventoryDataEntry";
import OpeningCountModal from "./openingCountModal";
import "./countModal.css";

const CountModal = ({ isOpen, onClose }) => {
  const [rows, setRows] = useState([]);

  const [batchSearchOpen, setBatchSearchOpen] = useState(false);
  const [dateCountOpen, setDateCountOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });
  const [view, setView] = useState("create");

  const [selectedSource, setSelectedSource] = useState(null);

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
    setSelectedSource(null);
    setDateCountOpen(false);
    setBatchSearchOpen(false);
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  const handleSave = async () => {
    if (saveLockRef.current || saving) return;
    if (!rows.length) return onClose();

    // backend works per ONE source batch
    const distinctSources = new Set(rows.map((r) => Number(r.itemBatchId)));
    if (distinctSources.size > 1) {
      return setNotif({
        open: true,
        type: "error",
        message:
          "❌ You selected rows from multiple source batches. Save works per ONE source batch only.",
      });
    }

    saveLockRef.current = true;
    setSaving(true);

    try {
      const firstRow = rows[0];

      const payload = {
        itemBatchId: Number(firstRow.itemBatchId),
        itemType: String(firstRow.unit || "").toLowerCase(), // box|sheet|sqm
        length: Number(firstRow.length),
        width: Number(firstRow.width),
        sheetsPerBox: Number(firstRow.sheetsPerBox),
        records: rows.map((r) => ({
          count: Number(r.count),
          status: r.status,

          // ✅ KEEP these (backend uses them in findOrCreateTargetByCondDate)
          receivedDate: r.receivedDate || null, // expects YYYY-MM from UI (backend normalizes)
          condition: r.condition || null,

          // ✅ optional targetBatchId (backend uses directly when present)
          targetBatchId:
            r.status === "adj+" && r.targetBatchId
              ? Number(r.targetBatchId)
              : null,
        })),
      };

      console.log("✅ Inventory-check payload:", payload);
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

  // ✅ SOURCE picked (single) -> open data entry directly
  const handlePickSourceFromModal = (row) => {
    if (!row) return;

    const picked = {
      batchId: Number(row.batchId),
      itemName: row.itemName,
      thickness: row.thickness,
      type: row.type,
      length: row.length,
      width: row.width,
      sheetsPerBox: row.sheetsPerBox,
      balanceOFR: row.balanceOFR, // QTY
      condition: row.condition ?? "",
      dateReceived: row.dateReceived ?? "",
      variantId: row.variantId,
    };

    setSelectedSource(picked);
    setBatchSearchOpen(false);
    setDateCountOpen(true);
  };

  // ✅ DataEntry returns records (rows) already cleaned
  const handleDataEntryConfirm = (records) => {
    if (!selectedSource) return;

    const newRows = (records || []).map((rec, index) => ({
      key: `${selectedSource.batchId}-${Date.now()}-${index}`,
      itemBatchId: selectedSource.batchId,
      itemVariantId: selectedSource.variantId,

      // optional
      targetBatchId: rec.targetBatchId ?? null,

      name: selectedSource.itemName,
      dimension: `${Math.floor(Number(selectedSource.length || 0))}×${Math.floor(
        Number(selectedSource.width || 0)
      )}${
        String(selectedSource.type || "").toLowerCase() === "box"
          ? `-${String(selectedSource.sheetsPerBox || 0).padStart(3, "0")}`
          : ""
      }`,
      unit: selectedSource.type,
      length: selectedSource.length,
      width: selectedSource.width,
      sheetsPerBox: selectedSource.sheetsPerBox,

      // keep these
      receivedDate: rec.receivedDate || "",
      condition: rec.condition || "",

      // main values
      count: rec.count,
      status: rec.status,

      date: "", // optional UI field
    }));

    setRows((prev) => [...prev, ...newRows]);
    setDateCountOpen(false);
    setSelectedSource(null);
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
                      <th>Date</th>
                      <th>Date Received</th>
                      <th className="count-col">Count</th>
                      <th>Status</th>
                      <th>Condition</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center" }}>
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
                              value={r.receivedDate || ""}
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
                onClick={() => setBatchSearchOpen(true)}
                disabled={saving}
              >
                Search Items (Pick Source)
              </button>
            </>
          )}
        </div>
      </div>

      {/* SOURCE picker (single select) */}
 <SearchBatchModal
  isOpen={batchSearchOpen}
  onClose={() => setBatchSearchOpen(false)}
  onSelect={(selected) => handlePickSourceFromModal((selected || [])[0])}
/>

      {/* Data entry (same modal, no target picker modal) */}
      {dateCountOpen && selectedSource && (
        <div
          className="date-count-overlay"
          onClick={() => {
            setDateCountOpen(false);
            setSelectedSource(null);
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <DateCountInput
              sourceBatchId={selectedSource.batchId}
              itemVariantId={selectedSource.variantId}
              onSave={handleDataEntryConfirm}
              onCancel={() => {
                setDateCountOpen(false);
                setSelectedSource(null);
              }}
              unit={selectedSource.type}
              length={selectedSource.length}
              width={selectedSource.width}
              sheetsPerBox={selectedSource.sheetsPerBox}
              originalBalance={selectedSource.balanceOFR}
              thickness={selectedSource.thickness}
              itemName={selectedSource.itemName}
              defaultCondition={selectedSource.condition}
              defaultReceivedDate={selectedSource.dateReceived}
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
