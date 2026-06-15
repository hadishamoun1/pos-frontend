// src/components/inventory-activity/inventoryDataEntry.jsx
import React, { useEffect, useMemo, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./inventoryDataEntry.css";

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const safeStr = (v) => (v == null ? "" : String(v));

const DateCountInput = ({
  sourceBatchId,
  itemVariantId,
  onSave,
  onCancel,
  unit,
  length,
  width,
  sheetsPerBox,
  originalBalance, // QTY
  itemName,
  thickness,
  defaultCondition = "",
  defaultReceivedDate = "",
}) => {
  const [entries, setEntries] = useState([
    {
      count: "",
      status: "adj+",
      receivedDate: defaultReceivedDate || "", // YYYY-MM or ""
      condition: defaultCondition || "",
      targetBatchId: "",
    },
  ]);

  const [targets, setTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  // Load possible target batches (same variant, exclude source)
  useEffect(() => {
    if (!itemVariantId) return;

    let cancelled = false;

    const load = async () => {
      setLoadingTargets(true);
      try {
        const res = await axiosClient.get(
          `/items/v2/filtered-items?page=1&limit=5000`
        );
        const payload = res?.data || {};
        const list = Array.isArray(payload?.data) ? payload.data : [];

        const filtered = list
          .filter((r) => Number(r.variantId) === Number(itemVariantId))
          .filter((r) => Number(r.batchId) !== Number(sourceBatchId));

        if (!cancelled) setTargets(filtered);
      } catch (e) {
        if (!cancelled) setTargets([]);
      } finally {
        if (!cancelled) setLoadingTargets(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [itemVariantId, sourceBatchId]);

  const len = safeNum(length) / 100;
  const wid = safeNum(width) / 100;
  const sheets = Math.max(1, safeNum(sheetsPerBox));
  const lowerUnit = safeStr(unit).toLowerCase();

  const sqmPerUnit = useMemo(() => {
    if (lowerUnit === "box") return len * wid * sheets;
    if (lowerUnit === "sheet") return len * wid;
    return 1;
  }, [lowerUnit, len, wid, sheets]);

  const originalQty = useMemo(() => {
    const q = safeNum(originalBalance);
    return Math.round(q * 100) / 100;
  }, [originalBalance]);

  const originalBalanceSQM = useMemo(() => {
    const v = originalQty * (sqmPerUnit || 0);
    return Math.round(v * 100) / 100;
  }, [originalQty, sqmPerUnit]);

  const computed = useMemo(() => {
    let totalSQM = 0;
    let calculatedQty = 0;

    const validRows = (entries || [])
      .map((e) => ({
        countNum: safeNum(e.count),
        status: safeStr(e.status) || "adj+",

        // ✅ OPTIONAL: send null if empty
        receivedDate: safeStr(e.receivedDate).trim() || null, // YYYY-MM or null
        condition: safeStr(e.condition).trim() || null,

        // ✅ optional target id (only meaningful for adj+)
        targetBatchId: safeStr(e.targetBatchId).trim() || null,
      }))
      .filter((e) => e.countNum > 0);

    for (const e of validRows) {
      calculatedQty += e.countNum;

      if (lowerUnit === "box") totalSQM += e.countNum * len * wid * sheets;
      else if (lowerUnit === "sheet") totalSQM += e.countNum * len * wid;
      else totalSQM += e.countNum;
    }

    totalSQM = Math.round(totalSQM * 100) / 100;
    calculatedQty = Math.round(calculatedQty * 100) / 100;

    const remainingQty = Math.round((originalQty - calculatedQty) * 100) / 100;
    const remainingSQM = Math.round((originalBalanceSQM - totalSQM) * 100) / 100;

    const exceeds = calculatedQty > originalQty;

    return {
      validRows,
      totalSQM,
      calculatedQty,
      remainingQty,
      remainingSQM,
      exceeds,
    };
  }, [entries, len, wid, sheets, lowerUnit, originalQty, originalBalanceSQM]);

  const disableSave = useMemo(() => {
    return computed.validRows.length === 0;
  }, [computed]);

  const handleChange = (index, field, value) => {
    setEntries((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };

      // nice UX: if status changes away from adj+, clear targetBatchId
      if (field === "status" && value !== "adj+") {
        copy[index].targetBatchId = "";
      }
      return copy;
    });
  };

  const addRow = () =>
    setEntries((prev) => [
      ...prev,
      {
        count: "",
        status: "adj+",
        receivedDate: defaultReceivedDate || "",
        condition: defaultCondition || "",
        targetBatchId: "",
      },
    ]);

  const removeRow = (index) => {
    setEntries((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
    );
  };

  const handleSaveClick = () => {
    if (disableSave) return;

    const payload = computed.validRows.map((r) => ({
      count: r.countNum,
      status: r.status,

      // ✅ keep them, but allow null
      receivedDate: r.receivedDate,
      condition: r.condition,

      // ✅ only send targetBatchId if adj+ AND selected
      targetBatchId:
        r.status === "adj+" && r.targetBatchId ? Number(r.targetBatchId) : null,
    }));

    onSave(payload);
  };

  return (
    <div className="inventory-date-table-container">
      <h3>
        <span className="inventory-date-table-title">Inventory Check Entry</span>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            fontSize: "1.1rem",
            fontWeight: "500",
          }}
        >
          <div className="item-dimensions">
            {lowerUnit === "box"
              ? `${safeStr(length)}*${safeStr(width)}-${safeStr(sheetsPerBox).padStart(
                  3,
                  "0"
                )}`
              : `${safeStr(length)}*${safeStr(width)}`}
          </div>

          <div
            className="item-name-thickness"
            style={{ direction: "rtl", textAlign: "right" }}
          >
            {`${safeStr(thickness)}ملم ${safeStr(itemName)}`}
          </div>
        </div>
      </h3>

      <div style={{ textAlign: "center", marginBottom: 10, opacity: 0.9 }}>
        <b>Note:</b> Date Received &amp; Condition are <b>optional</b>. Target batch is optional for <b>adj+</b>
        (backend can find/create).
      </div>

      <table className="inventory-table">
        <thead>
          <tr>
            <th>Count</th>
            <th>Status</th>
            <th>Date Received (Optional)</th>
            <th>Condition (Optional)</th>
            <th>Target Batch (Optional for adj+)</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry, index) => {
            const isAdjPlus = entry.status === "adj+";

            return (
              <tr key={index}>
                <td>
                  <input
                    type="number"
                    value={entry.count}
                    onChange={(e) => handleChange(index, "count", e.target.value)}
                    placeholder="Enter count"
                    min="0"
                    step="any"
                  />
                </td>

                <td className="status-col">
                  <select
                    value={entry.status}
                    onChange={(e) => handleChange(index, "status", e.target.value)}
                  >
                    <option value="adj+">adj+</option>
                    <option value="adj-">adj-</option>
                    <option value="breakage">breakage</option>
                  </select>
                </td>

                <td>
                  <input
                    type="month"
                    value={entry.receivedDate}
                    onChange={(e) =>
                      handleChange(index, "receivedDate", e.target.value)
                    }
                  />
                </td>

                <td>
                  <input
                    type="text"
                    value={entry.condition}
                    onChange={(e) =>
                      handleChange(index, "condition", e.target.value)
                    }
                    placeholder="e.g., Clean, A, B..."
                    style={{ minWidth: "150px" }}
                  />
                </td>

                <td>
                  <select
                    value={entry.targetBatchId}
                    onChange={(e) =>
                      handleChange(index, "targetBatchId", e.target.value)
                    }
                    disabled={!isAdjPlus}
                    style={{ width: "100%" }}
                  >
                    <option value="">
                      {isAdjPlus
                        ? loadingTargets
                          ? "Loading..."
                          : "Auto (backend chooses)"
                        : "-"}
                    </option>

                    {isAdjPlus &&
                      targets.map((t) => (
                        <option key={t.batchId} value={t.batchId}>
                          {`#${t.batchId} — ${safeStr(t.condition || "")} — ${safeStr(
                            t.dateReceived || ""
                          )} — Bal:${safeStr(t.balanceOFR || "")}`}
                        </option>
                      ))}
                  </select>
                </td>

                <td>
                  <button
                    onClick={() => removeRow(index)}
                    className="remove-btn"
                    title="Remove Row"
                    disabled={entries.length === 1}
                    style={{
                      opacity: entries.length === 1 ? 0.5 : 1,
                      cursor: entries.length === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="inventory-summary dual-summary">
        <div className="summary-column">
          <p>
            <strong>Original Balance (sqm):</strong> {originalBalanceSQM.toFixed(2)}
          </p>
          <p>
            <strong>Moved/Deducted (sqm):</strong> {computed.totalSQM.toFixed(2)}
          </p>
          <p>
            <strong>Remaining in original (sqm):</strong>{" "}
            <span style={{ color: computed.remainingSQM < 0 ? "red" : "inherit" }}>
              {computed.remainingSQM.toFixed(2)}
            </span>
          </p>
        </div>

        <div className="summary-column">
          <p>
            <strong>Original Balance (qty):</strong> {originalQty.toFixed(2)}
          </p>
          <p>
            <strong>Moved/Deducted (qty):</strong>{" "}
            <span style={{ color: computed.exceeds ? "red" : "inherit" }}>
              {computed.calculatedQty.toFixed(2)}
            </span>
          </p>
          <p>
            <strong>Remaining in original (qty):</strong>{" "}
            <span style={{ color: computed.remainingQty < 0 ? "red" : "inherit" }}>
              {computed.remainingQty.toFixed(2)}
            </span>
          </p>
        </div>
      </div>

      <div className="inventory-actions-wrapper">
        {computed.validRows.length === 0 && (
          <p className="inventory-warning-msg">
            ⚠️ Add at least one row with a positive count before saving.
          </p>
        )}

        {computed.exceeds && (
          <p className="inventory-warning-msg">
            ⚠️ Cannot save: count exceeds original quantity.
          </p>
        )}

        <div className="inventory-actions">
          <button onClick={addRow} className="add-row-btn">
            + Add Row
          </button>

          <div className="inventory-actions">
            <button
              onClick={handleSaveClick}
              className="save-btn"
              disabled={disableSave}
              style={{
                opacity: disableSave ? 0.6 : 1,
                cursor: disableSave ? "not-allowed" : "pointer",
              }}
            >
              Save
            </button>
            <button onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateCountInput;
