import React, { useRef, useEffect, useMemo, useState } from "react";
import TransferSearchModal from "./transferSearchModal";
import PreviewTransferTable from "./previewTransferTable";
import NotificationModal from "../recievables/NotificationModal";
import "./transferModal.css";
import { axiosClient } from "../api/axiosClient";

const LOCATION_OPTIONS = [
  "BS", "SB", "SQM", "SQM Return", "Breakage",
  "Adjustment +", "Adjustment -", "Defects",
];

// Display label → backend value sent to API
const LOCATION_TO_BACKEND = {
  "BS":         "JF",
  "SB":         "FJ",
  "SQM":        "BOSTS",
  "SQM Return": "STBOS",
};
const toBackendLocation = (loc) => LOCATION_TO_BACKEND[loc] ?? loc;

// Backend value → display label (for loading existing transfers)
const BACKEND_TO_LOCATION = Object.fromEntries(
  Object.entries(LOCATION_TO_BACKEND).map(([display, backend]) => [backend, display])
);
const toDisplayLocation = (loc) => BACKEND_TO_LOCATION[loc] ?? loc;

const LOCATION_COLORS = {
  "BS":         { bg: "#e8f4fd", border: "#2196f3", text: "#1565c0" },
  "SB":         { bg: "#e8f4fd", border: "#2196f3", text: "#1565c0" },
  "SQM":        { bg: "#f3e8fd", border: "#9c27b0", text: "#6a1b9a" },
  "SQM Return": { bg: "#f3e8fd", border: "#9c27b0", text: "#6a1b9a" },
  "Breakage":     { bg: "#fdecea", border: "#f44336", text: "#b71c1c" },
  "Adjustment +": { bg: "#e8f5e9", border: "#4caf50", text: "#1b5e20" },
  "Adjustment -": { bg: "#fff3e0", border: "#ff9800", text: "#e65100" },
  "Defects":      { bg: "#fdecea", border: "#f44336", text: "#b71c1c" },
};

const CONDITION_ROW_COLOR = (condition) => {
  const c = (condition || "").toLowerCase();
  if (c.includes("clean") || c.includes("good") || c.includes("new")) return "#f0faf3";
  if (c.includes("broken")) return "#fff8ec";
  if (c.includes("damaged") || c.includes("defect")) return "#fef2f2";
  return "";
};

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function TransferModal({ isOpen, onClose, existingTransfer = null, isEdit = false }) {
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [details, setDetails] = useState({
    transferNumber: "",
    date: new Date().toISOString().slice(0, 10),
    type: "G",
    location: LOCATION_OPTIONS[0],
  });

  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [boxSearchOpen, setBoxSearchOpen] = useState(false);
  const [boxTargetRowIndex, setBoxTargetRowIndex] = useState(null);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });

  const wrapperRef = useRef();
  const [editingId, setEditingId] = useState(existingTransfer?.id ?? null);
  const [reloadKey, setReloadKey] = useState(0);
  const isEditing = !!editingId;

  const existingKeys = useMemo(() => {
    const s = new Set();
    for (const r of rows) {
      const vid = r?.itemVariantId ?? null;
      const bid = r?.itemBatchId ?? null;
      if (vid && bid) s.add(`${vid}-${bid}`);
    }
    return s;
  }, [rows]);

  const fetchFullTransfer = async (id) => {
    if (!id) return null;
    const res = await axiosClient.get(`/transfers/${id}`);
    return res.data;
  };

  const mergeBatchIds = (transferLike, fullTransfer) => {
    const fullItemsById = new Map((fullTransfer?.items || []).map((it) => [Number(it.id), it]));
    const mergedItems = (transferLike?.items || []).map((i) => {
      const fullIt = fullItemsById.get(Number(i.id));
      const itemBatchId = i.itemBatchId ?? i.batchId ?? i.itemBatch?.id ?? fullIt?.itemBatchId ?? fullIt?.itemBatch?.id ?? null;
      const itemVariantId = i.itemVariantId ?? i.variantId ?? i.itemVariant?.id ?? fullIt?.itemVariantId ?? fullIt?.itemVariant?.id ?? null;
      return { ...i, itemBatchId, itemVariantId };
    });
    return { ...(transferLike || {}), ...(fullTransfer || {}), items: mergedItems };
  };

  const loadTransferIntoForm = (transfer) => {
    if (!transfer) return;
    setDetails({
      transferNumber: transfer.transferNumber || "",
      date: transfer.date ? String(transfer.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: transfer.type || "G",
      location: toDisplayLocation(transfer.location || LOCATION_OPTIONS[0]),
    });
    const mappedRows = (transfer.items || []).map((i) => ({
      itemBatchId: i.itemBatchId ?? i.batchId ?? i.itemBatch?.id ?? null,
      itemVariantId: i.itemVariantId ?? i.variantId ?? i.itemVariant?.id ?? null,
      name: i.name ?? `${i.thickness} ملم ${i.itemName}`,
      origin: i.origin,
      type: i.itemType ?? i.type,
      length: i.length,
      width: i.width,
      sheetsPerBox: i.sheetsPerBox,
      condition: i.condition,
      dateReceived: i.dateReceived,
      balanceOFR: i.balanceOFR,
      quantity: i.quantity ?? 0,
      sqm: i.sqm ?? 0,
      price: i.price ?? 0,
      toItemVariantId: i.toItemVariantId || null,
      toBoxLabel: i.toBoxLabel || "",
      toSheetsPerBox: i.toSheetsPerBox || null,
    }));
    setRows(mappedRows);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!isEdit || !existingTransfer) return;
    (async () => {
      try {
        setEditingId(existingTransfer.id);
        const full = await fetchFullTransfer(existingTransfer.id);
        const merged = mergeBatchIds(existingTransfer, full);
        loadTransferIntoForm(merged);
      } catch (err) {
        const msg = err.response?.data?.message || err.response?.data || err.message || "Failed to load transfer for edit.";
        setNotif({ open: true, type: "error", message: String(msg) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existingTransfer]);

  if (!isOpen) return null;

  const resetAll = () => {
    setDetails({ transferNumber: "", date: new Date().toISOString().slice(0, 10), type: "G", location: LOCATION_OPTIONS[0] });
    setRows([]);
    setPreviewing(false);
    setEditingId(null);
  };

  const handleSelectItems = (items) => {
    const mapped = (items || []).map((i) => ({
      itemBatchId: i.itemBatchId ?? i.batchId ?? null,
      itemVariantId: i.itemVariantId ?? i.variantId ?? null,
      name: `${i.thickness} ملم ${i.itemName}`,
      origin: i.origin,
      type: i.itemVariantType,
      length: i.length,
      width: i.width,
      sheetsPerBox: i.sheetsPerBox,
      condition: i.condition,
      dateReceived: i.dateReceived,
      balanceOFR: i.balanceOFR,
      quantity: 0,
      sqm: 0,
      price: 0,
      toItemVariantId: null,
      toBoxLabel: "",
      toSheetsPerBox: null,
    }));

    setRows((prev) => {
      const next = [...prev];
      for (const r of mapped) {
        const k = r.itemVariantId && r.itemBatchId ? `${r.itemVariantId}-${r.itemBatchId}` : null;
        if (!k) continue;
        if (next.some((x) => `${x.itemVariantId}-${x.itemBatchId}` === k)) continue;
        next.push(r);
      }
      return next;
    });
    setSearchOpen(false);
  };

  const getDimensionDisplay = (row) => {
    const len = Math.floor(toNum(row.length, 0));
    const wid = Math.floor(toNum(row.width, 0));
    if (row.type === "box") return `${len}×${wid}-${toNum(row.sheetsPerBox, 0)}`;
    if (row.type === "sheet") return `${len}×${wid}`;
    return `0×0`;
  };

  const updateRowField = (idx, field, value) =>
    setRows((rs) => {
      const copy = [...rs];
      const row = { ...copy[idx], [field]: value };
      const len = toNum(row.length, 0);
      const wid = toNum(row.width, 0);
      const m2 = (len / 100) * (wid / 100);
      const qty = toNum(row.quantity, 0);

      if (field === "quantity") {
        if (details.location === "SB" && row.type === "sheet") {
          row.sqm = (m2 * qty).toFixed(2);
        } else {
          if (row.type === "box") row.sqm = (m2 * toNum(row.sheetsPerBox, 0) * qty).toFixed(2);
          else if (row.type === "sheet") row.sqm = (m2 * qty).toFixed(2);
          else if (row.type === "sqm") row.sqm = qty.toFixed(2);
        }
      }
      copy[idx] = row;
      return copy;
    });

  const removeRow = (idx) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const closeNotif = () => {
    setNotif((n) => ({ ...n, open: false }));
    if (notif.type === "success") onClose();
  };

  const handleOpenBoxPicker = (rowIndex) => {
    setBoxTargetRowIndex(rowIndex);
    setBoxSearchOpen(true);
  };

  const handleSelectBoxForRow = (items) => {
    const selected = items && items[0];
    if (!selected || boxTargetRowIndex == null) { setBoxSearchOpen(false); return; }
    setRows((prev) => {
      const copy = [...prev];
      const row = { ...copy[boxTargetRowIndex] };
      const len = toNum(row.length, 0);
      const wid = toNum(row.width, 0);
      const m2 = (len / 100) * (wid / 100);
      const qty = toNum(row.quantity, 0);
      const sheetsPerBox = toNum(selected.sheetsPerBox, 0);
      row.toItemVariantId = selected.itemVariantId;
      row.toSheetsPerBox = sheetsPerBox;
      row.toBoxLabel = `${selected.thickness} ملم ${selected.itemName} - ${Math.floor(toNum(selected.length, 0))}×${Math.floor(toNum(selected.width, 0))}-${sheetsPerBox}`;
      if (details.location === "SB" && row.type === "sheet" && qty > 0) {
        row.sqm = (m2 * sheetsPerBox * qty).toFixed(2);
      }
      copy[boxTargetRowIndex] = row;
      return copy;
    });
    setBoxSearchOpen(false);
    setBoxTargetRowIndex(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (details.location === "SB") {
        const withQty = rows.filter((r) => toNum(r.quantity, 0) > 0);
        if (withQty.some((r) => r.type !== "sheet")) {
          setNotif({ open: true, type: "error", message: "FJ transfers only accept sheet items." });
          setSaving(false); return;
        }
        if (withQty.some((r) => !r.toItemVariantId)) {
          setNotif({ open: true, type: "error", message: "Please choose the target box item for all FJ rows that have quantity." });
          setSaving(false); return;
        }
      }

      const payloadItems = rows.filter((r) => toNum(r.quantity, 0) > 0).map((r, idx) => {
        if (!r.itemBatchId) throw new Error(`Row #${idx + 1} is missing itemBatchId.`);
        return {
          itemBatchId: Number(r.itemBatchId),
          quantity: toNum(r.quantity, 0),
          sqm: toNum(r.sqm, 0),
          price: toNum(r.price, 0),
          ...(details.location === "SB" && r.toItemVariantId ? { toItemVariantId: Number(r.toItemVariantId) } : {}),
        };
      });

      if (payloadItems.length === 0) {
        setNotif({ open: true, type: "error", message: "No lines with quantity entered." });
        setSaving(false); return;
      }

      const payload = { date: details.date, type: details.type, location: toBackendLocation(details.location), items: payloadItems };

      if (isEditing) {
        await axiosClient.patch(`/transfers/${editingId}`, payload);
        setNotif({ open: true, type: "success", message: "Transfer updated successfully!" });
      } else {
        await axiosClient.post(`/transfers`, payload);
        setNotif({ open: true, type: "success", message: "Transfer saved successfully!" });
      }
      resetAll();
    } catch (err) {
      const status = err.response?.status;
      const serverMsg = status === 403
        ? "404 transfer entity compress corruption"
        : (err.response?.data?.message || err.response?.data || err.message || "Save failed — please try again.");
      setNotif({ open: true, type: "error", message: String(serverMsg) });
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewEdit = async (transfer) => {
    if (!transfer?.id) return;
    try {
      setSaving(true);
      setEditingId(transfer.id);
      const full = await fetchFullTransfer(transfer.id);
      const merged = mergeBatchIds(transfer, full);
      loadTransferIntoForm(merged);
      setPreviewing(false);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || err.message || "Failed to open transfer for edit.";
      setNotif({ open: true, type: "error", message: String(msg) });
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this transfer?")) return;
    try {
      await axiosClient.delete(`/transfers/${id}`);
      setNotif({ open: true, type: "success", message: "Transfer deleted successfully!" });
      setReloadKey((k) => k + 1);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || err.message || "Delete failed — please try again.";
      setNotif({ open: true, type: "error", message: String(msg) });
    }
  };

  const totalQty = rows.reduce((s, r) => s + toNum(r.quantity, 0), 0);
  const totalSqm = rows.reduce((s, r) => s + toNum(r.sqm, 0), 0);

  const locColor = LOCATION_COLORS[details.location] || { bg: "#f5f5f5", border: "#ccc", text: "#333" };

  return (
    <>
      <div className="tm-overlay" onClick={onClose} ref={wrapperRef}>
        <div className="tm-content" onClick={(e) => e.stopPropagation()}>

          {/* ── Top bar ── */}
          <div className="tm-topbar">
            <div className="tm-topbar-left">
              <h2 className="tm-title">{isEditing ? "Edit Transfer" : "Transfer Inventory"}</h2>
              <div className="tm-tabs">
                <button
                  className={`tm-tab ${!previewing ? "tm-tab--active" : ""}`}
                  onClick={() => setPreviewing(false)}
                  disabled={saving}
                >
                  {isEditing ? "Edit Form" : "Create"}
                </button>
                <button
                  className={`tm-tab ${previewing ? "tm-tab--active" : ""}`}
                  onClick={() => setPreviewing(true)}
                  disabled={saving}
                >
                  History
                </button>
              </div>
            </div>
            <button className="tm-close" onClick={onClose} disabled={saving}>×</button>
          </div>

          {!previewing && (
            <>
              {/* ── Header card ── */}
              <div className="tm-header-card">
                <div className="tm-field">
                  <span className="tm-field-label">Date</span>
                  <input
                    type="date"
                    className="tm-date-input"
                    name="date"
                    value={details.date}
                    onChange={(e) => setDetails((d) => ({ ...d, date: e.target.value }))}
                    disabled={saving}
                  />
                </div>

                <div className="tm-field tm-field--grow">
                  <span className="tm-field-label">Location</span>
                  <div className="tm-location-chips">
                    {LOCATION_OPTIONS.map((loc) => {
                      const col = LOCATION_COLORS[loc];
                      const active = details.location === loc;
                      return (
                        <button
                          key={loc}
                          type="button"
                          className={`tm-chip ${active ? "tm-chip--active" : ""}`}
                          style={active ? { background: col.bg, borderColor: col.border, color: col.text } : {}}
                          onClick={() => setDetails((d) => ({ ...d, location: loc }))}
                          disabled={saving}
                        >
                          {loc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="tm-header-actions">
                  <button className="tm-btn tm-btn--add" onClick={() => setSearchOpen(true)} disabled={saving}>
                    + Add Items
                  </button>
                  <button className="tm-btn tm-btn--reset" onClick={resetAll} disabled={saving}>
                    Reset
                  </button>
                  <button
                    className="tm-btn tm-btn--save"
                    onClick={handleSave}
                    disabled={saving || rows.length === 0}
                  >
                    {saving ? "Saving…" : isEditing ? "Update" : "Save"}
                  </button>
                </div>
              </div>

              {/* ── Location badge ── */}
              {rows.length > 0 && (
                <div className="tm-location-badge" style={{ background: locColor.bg, borderColor: locColor.border, color: locColor.text }}>
                  {details.location}
                </div>
              )}

              {/* ── Table ── */}
              <div className="tm-table-wrapper">
                <table className="tm-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Dimension</th>
                      <th>Origin</th>
                      <th>Type</th>
                      {details.location === "SB" && <th>Target Box</th>}
                      <th>Qty</th>
                      <th>SQM</th>
                      <th>Condition</th>
                      <th>Date Received</th>
                      <th>Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={details.location === "SB" ? 11 : 10} className="tm-empty-row">
                          No items added — click <strong>+ Add Items</strong> to start
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={`${r.itemVariantId || "v"}-${r.itemBatchId || "b"}-${i}`}
                            style={{ background: CONDITION_ROW_COLOR(r.condition) || undefined }}>
                          <td className="tm-td-name" dir="rtl">{r.name}</td>
                          <td className="tm-td-center">{getDimensionDisplay(r)}</td>
                          <td className="tm-td-center">{r.origin}</td>
                          <td className="tm-td-center">
                            <span className={`tm-type-badge tm-type-${r.type}`}>{r.type}</span>
                          </td>

                          {details.location === "SB" && (
                            <td className="tm-td-center">
                              <button
                                type="button"
                                className="tm-box-btn"
                                onClick={() => handleOpenBoxPicker(i)}
                                disabled={saving || r.type !== "sheet"}
                              >
                                {r.toBoxLabel ? "Change" : "Choose Box"}
                              </button>
                              {r.toBoxLabel && <div className="tm-box-label">{r.toBoxLabel}</div>}
                            </td>
                          )}

                          <td>
                            <input
                              type="number"
                              className="tm-input tm-input--num"
                              value={r.quantity}
                              onChange={(e) => updateRowField(i, "quantity", e.target.value)}
                              disabled={saving}
                              min={0}
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              className="tm-input tm-input--num"
                              value={r.sqm}
                              onChange={(e) => updateRowField(i, "sqm", e.target.value)}
                              disabled={saving}
                              min={0}
                            />
                          </td>

                          <td className="tm-td-center">
                            {r.condition ? (
                              <span className="tm-condition-badge">{r.condition}</span>
                            ) : "—"}
                          </td>

                          <td className="tm-td-center">{r.dateReceived || "—"}</td>

                          <td>
                            <input
                              type="number"
                              className="tm-input tm-input--num"
                              value={r.price}
                              onChange={(e) => updateRowField(i, "price", e.target.value)}
                              disabled={saving}
                              min={0}
                            />
                          </td>

                          <td className="tm-td-delete">
                            <button
                              type="button"
                              className="tm-delete-btn"
                              onClick={() => removeRow(i)}
                              disabled={saving}
                              title="Remove row"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot>
                      <tr className="tm-footer-row">
                        <td colSpan={details.location === "SB" ? 5 : 4} className="tm-footer-label">
                          {rows.length} item{rows.length !== 1 ? "s" : ""}
                        </td>
                        <td className="tm-footer-val">{totalQty.toLocaleString()}</td>
                        <td className="tm-footer-val">{totalSqm.toFixed(2)}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}

          {previewing && (
            <div className="tm-preview-wrapper">
              {rows.length > 0 ? (
                <PreviewTransferTable rows={rows} />
              ) : (
                <PreviewTransferTable
                  autoFetch
                  onEdit={handlePreviewEdit}
                  onDelete={handlePreviewDelete}
                  reloadKey={reloadKey}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <TransferSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelectItems}
        existingKeys={existingKeys}
      />

      <TransferSearchModal
        isOpen={boxSearchOpen}
        onClose={() => setBoxSearchOpen(false)}
        onSelect={handleSelectBoxForRow}
        existingKeys={new Set()}
        singleSelect={true}
      />

      {notif.open && (
        <NotificationModal type={notif.type} message={notif.message} onClose={closeNotif} />
      )}
    </>
  );
}
