// src/components/transfers/transferModal.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import TransferSearchModal from "./transferSearchModal";
import PreviewTransferTable from "./previewTransferTable";
import NotificationModal from "../recievables/NotificationModal";
import "./transferModal.css";
import { axiosClient } from "../api/axiosClient"; 

const TYPE_OPTIONS = ["G"];
const LOCATION_OPTIONS = [
  "JF",
  "FJ",
  "BOSTS",
  "STBOS",
  "Breakage",
  "Adjustment +",
  "Adjustment -",
  "Defects",
];

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function TransferModal({
  isOpen,
  onClose,
  existingTransfer = null,
  isEdit = false,
}) {
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [details, setDetails] = useState({
    transferNumber: "",
    date: new Date().toISOString().slice(0, 10),
    type: TYPE_OPTIONS[0],
    location: LOCATION_OPTIONS[0],
  });

  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // FJ target box selection
  const [boxSearchOpen, setBoxSearchOpen] = useState(false);
  const [boxTargetRowIndex, setBoxTargetRowIndex] = useState(null);

  const [notif, setNotif] = useState({
    open: false,
    type: "",
    message: "",
  });

  const wrapperRef = useRef();

  // editing id (works for edit opened from page OR edit from preview list inside modal)
  const [editingId, setEditingId] = useState(existingTransfer?.id ?? null);
  const [reloadKey, setReloadKey] = useState(0); // bump to refetch preview

  const isEditing = !!editingId;

  // ✅ Keys must match what search modal uses: `${variantId}-${batchId}`
  const existingKeys = useMemo(() => {
    const s = new Set();
    for (const r of rows) {
      const vid = r?.itemVariantId ?? null;
      const bid = r?.itemBatchId ?? null;
      if (vid && bid) s.add(`${vid}-${bid}`);
    }
    return s;
  }, [rows]);

  // ✅ Hydrate full transfer so itemBatchId is always available in edit mode
  const fetchFullTransfer = async (id) => {
    if (!id) return null;
    const res = await axiosClient.get(`/transfers/${id}`); // ✅ FIX: relative only
    return res.data;
  };

  // ✅ Normalize / merge itemBatchId from whichever shape we got (details vs full)
  const mergeBatchIds = (transferLike, fullTransfer) => {
    const fullItemsById = new Map(
      (fullTransfer?.items || []).map((it) => [Number(it.id), it])
    );

    const mergedItems = (transferLike?.items || []).map((i) => {
      const fullIt = fullItemsById.get(Number(i.id));
      const itemBatchId =
        i.itemBatchId ??
        i.batchId ??
        i.itemBatch?.id ??
        fullIt?.itemBatchId ??
        fullIt?.itemBatch?.id ??
        null;

      const itemVariantId =
        i.itemVariantId ??
        i.variantId ??
        i.itemVariant?.id ??
        fullIt?.itemVariantId ??
        fullIt?.itemVariant?.id ??
        null;

      return { ...i, itemBatchId, itemVariantId };
    });

    return { ...(transferLike || {}), ...(fullTransfer || {}), items: mergedItems };
  };

  // Helper to load a transfer into the form + rows
  const loadTransferIntoForm = (transfer) => {
    if (!transfer) return;

    setDetails({
      transferNumber: transfer.transferNumber || "",
      date: transfer.date
        ? String(transfer.date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      type: transfer.type || TYPE_OPTIONS[0],
      location: transfer.location || LOCATION_OPTIONS[0],
    });

    const mappedRows = (transfer.items || []).map((i) => {
      const itemBatchId = i.itemBatchId ?? i.batchId ?? i.itemBatch?.id ?? null;
      const itemVariantId =
        i.itemVariantId ?? i.variantId ?? i.itemVariant?.id ?? null;

      return {
        // ✅ keep ids (critical for payload + duplicate prevention)
        itemBatchId,
        itemVariantId,

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

        // FJ target
        toItemVariantId: i.toItemVariantId || null,
        toBoxLabel: i.toBoxLabel || "",
        toSheetsPerBox: i.toSheetsPerBox || null,
      };
    });

    setRows(mappedRows);
  };

  // ✅ Prefill when opened in edit mode from TransfersPage (hydrate full transfer first)
  useEffect(() => {
    if (!isOpen) return;

    // create mode reset
    if (!isEdit || !existingTransfer) return;

    (async () => {
      try {
        setEditingId(existingTransfer.id);

        // existingTransfer often comes from /transfers/v1/details (display shape)
        // so we hydrate from /transfers/:id to guarantee itemBatchId exists
        const full = await fetchFullTransfer(existingTransfer.id);
        const merged = mergeBatchIds(existingTransfer, full);
        loadTransferIntoForm(merged);
      } catch (err) {
        console.error("Failed to hydrate transfer for edit", err);
        const msg =
          err.response?.data?.message ||
          err.response?.data ||
          err.message ||
          "Failed to load transfer for edit.";
        setNotif({ open: true, type: "error", message: String(msg) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existingTransfer]);

  if (!isOpen) return null;

  const resetAll = () => {
    setDetails({
      transferNumber: "",
      date: new Date().toISOString().slice(0, 10),
      type: TYPE_OPTIONS[0],
      location: LOCATION_OPTIONS[0],
    });
    setRows([]);
    setPreviewing(false);
    setEditingId(null);
  };

  const handleDetailChange = (e) => {
    setDetails((d) => ({ ...d, [e.target.name]: e.target.value }));
  };

  const handleSelectItems = (items) => {
    const mapped = (items || []).map((i) => {
      const itemBatchId = i.itemBatchId ?? i.batchId ?? null;
      const itemVariantId = i.itemVariantId ?? i.variantId ?? null;

      return {
        itemBatchId,
        itemVariantId,

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
      };
    });

    // ✅ de-dupe by `${variantId}-${batchId}`
    setRows((prev) => {
      const next = [...prev];
      for (const r of mapped) {
        const k =
          r.itemVariantId && r.itemBatchId
            ? `${r.itemVariantId}-${r.itemBatchId}`
            : null;
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
    if (row.type === "box") return `${len}x${wid}-${toNum(row.sheetsPerBox, 0)}`;
    if (row.type === "sheet") return `${len}x${wid}`;
    return `0x0`;
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
        if (details.location === "FJ" && row.type === "sheet") {
          if (row.toSheetsPerBox) {
            row.sqm = (m2 * toNum(row.toSheetsPerBox, 0) * qty).toFixed(2);
          } else {
            row.sqm = "";
          }
        } else {
          if (row.type === "box") {
            row.sqm = (m2 * toNum(row.sheetsPerBox, 0) * qty).toFixed(2);
          } else if (row.type === "sheet") {
            row.sqm = (m2 * qty).toFixed(2);
          } else if (row.type === "sqm") {
            row.sqm = qty.toFixed(2);
          }
        }
      }

      copy[idx] = row;
      return copy;
    });

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
    if (!selected || boxTargetRowIndex == null) {
      setBoxSearchOpen(false);
      return;
    }

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
      row.toBoxLabel = `${selected.thickness} ملم ${selected.itemName} - ${Math.floor(
        toNum(selected.length, 0)
      )}x${Math.floor(toNum(selected.width, 0))}-${sheetsPerBox}`;

      if (details.location === "FJ" && row.type === "sheet" && qty > 0) {
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
      if (details.location === "FJ") {
        const withQty = rows.filter((r) => toNum(r.quantity, 0) > 0);

        const badTypes = withQty.filter((r) => r.type !== "sheet");
        if (badTypes.length > 0) {
          setNotif({
            open: true,
            type: "error",
            message: "FJ transfers only accept sheet items.",
          });
          setSaving(false);
          return;
        }

        const missingBox = withQty.filter((r) => !r.toItemVariantId);
        if (missingBox.length > 0) {
          setNotif({
            open: true,
            type: "error",
            message:
              "Please choose the target box item for all FJ rows that have quantity.",
          });
          setSaving(false);
          return;
        }
      }

      const payloadItems = rows
        .filter((r) => toNum(r.quantity, 0) > 0)
        .map((r, idx) => {
          if (!r.itemBatchId) {
            throw new Error(
              `Row #${idx + 1} is missing itemBatchId (edit payload cannot work).`
            );
          }
          return {
            itemBatchId: Number(r.itemBatchId),
            quantity: toNum(r.quantity, 0),
            sqm: toNum(r.sqm, 0),
            price: toNum(r.price, 0),
            ...(details.location === "FJ" && r.toItemVariantId
              ? { toItemVariantId: Number(r.toItemVariantId) }
              : {}),
          };
        });

      if (payloadItems.length === 0) {
        setNotif({
          open: true,
          type: "error",
          message: "No lines with quantity entered.",
        });
        setSaving(false);
        return;
      }

      const payload = {
        date: details.date,
        type: details.type,
        location: details.location,
        items: payloadItems,
      };

      if (isEditing) {
        await axiosClient.patch(`/transfers/${editingId}`, payload); // ✅ FIX: relative only
        setNotif({
          open: true,
          type: "success",
          message: "Transfer updated successfully!",
        });
      } else {
        await axiosClient.post(`/transfers`, payload); // ✅ FIX: relative only
        setNotif({
          open: true,
          type: "success",
          message: "Transfer saved successfully!",
        });
      }

      resetAll();
    } catch (err) {
      console.error("Failed to save transfer", err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "Save failed — please try again.";
      setNotif({
        open: true,
        type: "error",
        message: String(serverMsg),
      });
    } finally {
      setSaving(false);
    }
  };

  // ✅ Edit from the autoFetch preview INSIDE this modal:
  // hydrate using /transfers/:id before loading so itemBatchId exists.
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
      console.error("Failed to open transfer for edit from preview", err);
      const msg =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "Failed to open transfer for edit.";
      setNotif({ open: true, type: "error", message: String(msg) });
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this transfer?")) return;

    try {
      await axiosClient.delete(`/transfers/${id}`); // ✅ FIX: relative only
      setNotif({
        open: true,
        type: "success",
        message: "Transfer deleted successfully!",
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to delete transfer from modal preview", err);
      const msg =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "Delete failed — please try again.";
      setNotif({
        open: true,
        type: "error",
        message: String(msg),
      });
    }
  };

  return (
    <>
      <div className="transfer-modal-overlay" onClick={onClose} ref={wrapperRef}>
        <div
          className="transfer-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="transfer-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            &times;
          </button>

          <h2 className="transfer-txt">
            {isEditing ? "Edit Transfer" : "Transfer Inventory"}
          </h2>

          <div className="transfer-modal-header">
            <div className="transfer-action-buttons">
              <button
                className={`btn transfer-action-btn ${!previewing ? "active" : ""}`}
                onClick={() => setPreviewing(false)}
                disabled={saving}
              >
                {isEditing ? "Edit Form" : "Create Transfer"}
              </button>
              <button
                className={`btn transfer-action-btn ${previewing ? "active" : ""}`}
                onClick={() => setPreviewing(true)}
                disabled={saving}
              >
                Preview
              </button>
            </div>
          </div>

          {!previewing && (
            <div className="detail-actions">
              <button
                className="btn transfer-reset-btn"
                onClick={resetAll}
                disabled={saving}
              >
                Reset
              </button>
              <button
                className="btn transfer-save-btn"
                onClick={handleSave}
                disabled={saving || rows.length === 0}
              >
                {saving ? "Saving…" : isEditing ? "Update" : "Save"}
              </button>
            </div>
          )}

          {previewing ? (
            rows.length > 0 ? (
              <PreviewTransferTable rows={rows} />
            ) : (
              <PreviewTransferTable
                autoFetch
                onEdit={handlePreviewEdit}
                onDelete={handlePreviewDelete}
                reloadKey={reloadKey}
              />
            )
          ) : (
            <div className="transfer-modal-body">
              <div className="transfer-details">
                <label>
                  Date
                  <br />
                  <input
                    type="date"
                    name="date"
                    value={details.date}
                    onChange={handleDetailChange}
                    disabled={saving}
                  />
                </label>

                <label>
                  Type
                  <br />
                  <select
                    name="type"
                    value={details.type}
                    onChange={handleDetailChange}
                    disabled={saving}
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Location
                  <br />
                  <select
                    name="location"
                    value={details.location}
                    onChange={handleDetailChange}
                    disabled={saving}
                  >
                    {LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="transfer-search-wrapper">
                <button
                  className="transfer-search-btn"
                  onClick={() => setSearchOpen(true)}
                  disabled={saving}
                >
                  Search
                </button>
              </div>

              <div className="transfer-table-wrapper">
                <table className="transfer-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Dimension</th>
                      <th>Origin</th>
                      <th>Type</th>
                      {details.location === "FJ" && (
                        <th className="target-box-col">Target Box</th>
                      )}
                      <th>Quantity</th>
                      <th>SQM</th>
                      <th>Condition</th>
                      <th>Date Received</th>
                      <th>Item Price</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={details.location === "FJ" ? 10 : 9}
                          style={{ textAlign: "center", color: "#666" }}
                        >
                          No items added
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={`${r.itemVariantId || "v"}-${r.itemBatchId || "b"}-${i}`}>
                          <td>
                            <input className="transfer-input" value={r.name} readOnly />
                          </td>
                          <td>
                            <input
                              className="transfer-input"
                              value={getDimensionDisplay(r)}
                              readOnly
                            />
                          </td>
                          <td>
                            <input className="transfer-input" value={r.origin} readOnly />
                          </td>
                          <td>
                            <input className="transfer-input" value={r.type} readOnly />
                          </td>

                          {details.location === "FJ" && (
                            <td className="target-box-col">
                              <button
                                type="button"
                                className="transfer-box-select-btn"
                                onClick={() => handleOpenBoxPicker(i)}
                                disabled={saving || r.type !== "sheet"}
                              >
                                {r.toBoxLabel ? "Change Box" : "Choose Box"}
                              </button>
                              {r.toBoxLabel && (
                                <div className="transfer-box-label">{r.toBoxLabel}</div>
                              )}
                            </td>
                          )}

                          <td>
                            <input
                              type="number"
                              className="transfer-input transfer-col-small"
                              value={r.quantity}
                              onChange={(e) =>
                                updateRowField(i, "quantity", e.target.value)
                              }
                              disabled={saving}
                            />
                          </td>

                          <td>
                            <input className="transfer-input" value={r.sqm} readOnly />
                          </td>

                          <td>
                            <input
                              className="transfer-input"
                              value={r.condition || ""}
                              readOnly
                            />
                          </td>

                          <td>
                            <input
                              className="transfer-input"
                              value={r.dateReceived || ""}
                              readOnly
                            />
                          </td>

                          <td>
                            <input
                              className="transfer-input"
                              type="number"
                              value={r.price}
                              onChange={(e) => updateRowField(i, "price", e.target.value)}
                              disabled={saving}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* main search (batches to transfer FROM) */}
          <TransferSearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelect={handleSelectItems}
            existingKeys={existingKeys}
          />

          {/* FJ box picker (which box to transfer TO) */}
          <TransferSearchModal
            isOpen={boxSearchOpen}
            onClose={() => setBoxSearchOpen(false)}
            onSelect={handleSelectBoxForRow}
            existingKeys={new Set()}
            singleSelect={true}
          />
        </div>
      </div>

      {notif.open && (
        <NotificationModal
          type={notif.type}
          message={notif.message}
          onClose={closeNotif}
        />
      )}
    </>
  );
}
