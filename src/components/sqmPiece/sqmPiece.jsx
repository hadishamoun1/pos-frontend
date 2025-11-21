// src/inventory/SqmPiecesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./sqmPiece.css";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, "");

const fmt2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function SqmPiecesPage() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [onlyRemaining, setOnlyRemaining] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const [modalHeader, setModalHeader] = useState(null);
  const [modalPieces, setModalPieces] = useState([]);

  // ─────────────────────────────────────
  // Load BOSTS lines
  // ─────────────────────────────────────
  const fetchLines = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await axios.get(`${baseUrl}/sqm-pieces/lines`);
      setLines(res.data || []);
    } catch (err) {
      console.error("Failed to load sqm-pieces lines", err);
      setLoadError("Failed to load BOSTS sqm lines. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLines();
  }, []);

  // ─────────────────────────────────────
  // Filters
  // ─────────────────────────────────────
  const filteredLines = useMemo(() => {
    let rows = [...lines];
    const q = searchText.trim().toLowerCase();

    if (q) {
      rows = rows.filter((r) => {
        const haystack = [
          r.transferNumber,
          r.itemName,
          r.origin,
          r.itemType,
          r.thickness?.toString(),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    if (onlyRemaining) {
      rows = rows.filter((r) => num(r.remainingSqm) > 0.0001);
    }

    return rows;
  }, [lines, searchText, onlyRemaining]);

  // ─────────────────────────────────────
  // Modal helpers
  // ─────────────────────────────────────
  const openModalForLine = async (transferItemId) => {
    setModalOpen(true);
    setModalLoading(true);
    setModalError("");
    setModalHeader(null);
    setModalPieces([]);

    try {
      const res = await axios.get(
        `${baseUrl}/sqm-pieces/lines/${transferItemId}`
      );
      const data = res.data;
      setModalHeader(data.header || null);
      setModalPieces(
        (data.pieces || []).map((p) => ({
          id: p.id,
          length: p.length ?? "",
          width: p.width ?? "",
          count: p.piecesCount ?? "",
        }))
      );
    } catch (err) {
      console.error("Failed to load line pieces", err);
      setModalError("Failed to load line details. Please close and try again.");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    if (modalSaving) return;
    setModalOpen(false);
    setModalHeader(null);
    setModalPieces([]);
    setModalError("");
  };

  const addPieceRow = () => {
    setModalPieces((prev) => [
      ...prev,
      { id: null, length: "", width: "", count: "" },
    ]);
  };

  const clearPieceRows = () => {
    setModalPieces([]);
  };

  const updatePieceField = (index, field, value) => {
    setModalPieces((prev) => {
      const rows = [...prev];
      rows[index] = { ...rows[index], [field]: value };
      return rows;
    });
  };

  const removePieceRow = (index) => {
    setModalPieces((prev) => prev.filter((_, i) => i !== index));
  };

  // ─────────────────────────────────────
  // Derived totals inside modal
  // ─────────────────────────────────────
  const modalComputed = useMemo(() => {
    const rows = modalPieces || [];
    const withCalc = rows.map((row) => {
      const L = num(row.length);
      const W = num(row.width);
      const count = Math.max(0, Math.floor(num(row.count)));
      const sqmPerPiece = L && W ? (L * W) / 10000 : 0;
      const sqmTotal = sqmPerPiece * count;
      return { ...row, sqmPerPiece, sqmTotal };
    });

    const totalAllocated = withCalc.reduce(
      (sum, r) => sum + r.sqmTotal,
      0
    );

    return { rows: withCalc, totalAllocated };
  }, [modalPieces]);

  const handleSavePieces = async () => {
    if (!modalHeader) return;

    setModalSaving(true);
    setModalError("");

    // Build payload, filter out empty rows
    const payloadPieces = modalComputed.rows
      .map((r) => ({
        length: num(r.length),
        width: num(r.width),
        count: Math.max(0, Math.floor(num(r.count))),
      }))
      .filter((r) => r.length > 0 && r.width > 0 && r.count > 0);

    try {
      const res = await axios.post(
        `${baseUrl}/sqm-pieces/lines/${modalHeader.transferItemId}`,
        { pieces: payloadPieces }
      );

      // Update modal with returned data
      const data = res.data;
      setModalHeader(data.header || null);
      setModalPieces(
        (data.pieces || []).map((p) => ({
          id: p.id,
          length: p.length ?? "",
          width: p.width ?? "",
          count: p.piecesCount ?? "",
        }))
      );

      // Refresh main list so totals/remaining update
      fetchLines();

      // Close modal after a successful save
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save pieces", err);
      const msgFromServer =
        err?.response?.data?.message ||
        "Failed to save pieces. Check your values and try again.";
      setModalError(
        Array.isArray(msgFromServer) ? msgFromServer.join(" | ") : msgFromServer
      );
    } finally {
      setModalSaving(false);
    }
  };

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────
  return (
    <div className="sqm-page">
      <div className="sqm-page-header">
        <div>
          <h1 className="sqm-page-title">SQM Pieces Allocation</h1>
          <p className="sqm-page-subtitle">
            This page lets you describe how{" "}
            <strong>BOSTS transfers</strong> (sheet/box → sqm) are split into
            actual pieces (dimensions). Inventory balances remain controlled by
            your normal transactions; here you only label how the sqm is cut.
          </p>
        </div>
        <button
          className="sqm-page-refresh-btn"
          onClick={fetchLines}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="sqm-page-filters">
        <div className="sqm-filter-group">
          <label className="sqm-filter-label">Search</label>
          <input
            className="sqm-filter-input"
            type="text"
            value={searchText}
            placeholder="Transfer #, item name, origin, thickness…"
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <label className="sqm-filter-checkbox">
          <input
            type="checkbox"
            checked={onlyRemaining}
            onChange={(e) => setOnlyRemaining(e.target.checked)}
          />
          Show only lines with remaining sqm
        </label>
      </div>

      {loadError && <div className="sqm-error-banner">{loadError}</div>}

      <div className="sqm-table-wrapper">
        <table className="sqm-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Transfer #</th>
              <th>Item</th>
              <th>Thick</th>
              <th>Type</th>
              <th>Origin</th>
              <th className="sqm-num-col">Total sqm</th>
              <th className="sqm-num-col">Allocated sqm</th>
              <th className="sqm-num-col">Remaining sqm</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && !lines.length ? (
              <tr>
                <td colSpan={10} className="sqm-table-empty">
                  Loading BOSTS sqm lines…
                </td>
              </tr>
            ) : !filteredLines.length ? (
              <tr>
                <td colSpan={10} className="sqm-table-empty">
                  No BOSTS sqm lines found with current filters.
                </td>
              </tr>
            ) : (
              filteredLines.map((row) => {
                const remaining = num(row.remainingSqm);
                const allocated = num(row.allocatedSqm);
                const total = num(row.totalSqm);
                const remainingRatio =
                  total > 0 ? remaining / total : remaining > 0 ? 1 : 0;
                const remainingClass =
                  remaining <= 0
                    ? "sqm-chip sqm-chip-empty"
                    : remainingRatio < 0.35
                    ? "sqm-chip sqm-chip-low"
                    : "sqm-chip sqm-chip-ok";

                return (
                  <tr key={row.transferItemId}>
                    <td>{row.date}</td>
                    <td>
                      <span className="sqm-transfer-tag">
                        {row.transferNumber}
                      </span>
                    </td>
                    <td>
                      <div className="sqm-item-cell">
                        <div className="sqm-item-name">
                          {row.itemName || <span className="sqm-muted">—</span>}
                        </div>
                        <div className="sqm-item-sub">
                          {row.itemType && (
                            <span className="sqm-pill">{row.itemType}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{row.thickness ?? "-"}</td>
                    <td>{row.itemType || "-"}</td>
                    <td>{row.origin || "-"}</td>
                    <td className="sqm-num-col">{fmt2(total)}</td>
                    <td className="sqm-num-col">{fmt2(allocated)}</td>
                    <td className="sqm-num-col">
                      <span className={remainingClass}>{fmt2(remaining)}</span>
                    </td>
                    <td>
                      <button
                        className="sqm-table-action-btn"
                        onClick={() =>
                          openModalForLine(row.transferItemId)
                        }
                      >
                        Manage pieces
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <SqmPiecesModal
          header={modalHeader}
          loading={modalLoading}
          saving={modalSaving}
          error={modalError}
          rows={modalComputed.rows}
          totalAllocated={modalComputed.totalAllocated}
          onChangeField={updatePieceField}
          onAddRow={addPieceRow}
          onClearRows={clearPieceRows}
          onRemoveRow={removePieceRow}
          onClose={closeModal}
          onSave={handleSavePieces}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────
// Modal component
// ─────────────────────────────────────
function SqmPiecesModal({
  header,
  loading,
  saving,
  error,
  rows,
  totalAllocated,
  onChangeField,
  onAddRow,
  onClearRows,
  onRemoveRow,
  onClose,
  onSave,
}) {
  const totalSqm = num(header?.totalSqm);
  const alreadyAllocated = num(header?.allocatedSqm);
  const remainingSqmFromHeader = num(header?.remainingSqm);

  const totalAllocatedPreview = totalAllocated;
  const diffAgainstLine = totalAllocatedPreview - totalSqm;
  const overAllocated = diffAgainstLine > 0.0001;

  return (
    <div className="sqm-modal-overlay">
      <div className="sqm-modal">
        <div className="sqm-modal-header">
          <div>
            <h2 className="sqm-modal-title">Define SQM Pieces</h2>
            {header && (
              <p className="sqm-modal-subtitle">
                Transfer{" "}
                <strong className="sqm-modal-tag">
                  {header.transferNumber}
                </strong>{" "}
                · {header.date} · {header.itemName} · {header.thickness}mm ·{" "}
                {header.origin}
              </p>
            )}
          </div>
          <button
            className="sqm-modal-close-btn"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        {loading || !header ? (
          <div className="sqm-modal-body sqm-modal-body-center">
            Loading line details…
          </div>
        ) : (
          <>
            <div className="sqm-modal-summary">
              <div className="sqm-summary-block">
                <span className="sqm-summary-label">Line total sqm</span>
                <span className="sqm-summary-value">
                  {fmt2(totalSqm)}
                </span>
              </div>
              <div className="sqm-summary-block">
                <span className="sqm-summary-label">Existing allocated</span>
                <span className="sqm-summary-value">
                  {fmt2(alreadyAllocated)}
                </span>
              </div>
              <div className="sqm-summary-block">
                <span className="sqm-summary-label">
                  Remaining (before this edit)
                </span>
                <span className="sqm-summary-value">
                  {fmt2(remainingSqmFromHeader)}
                </span>
              </div>
              <div className="sqm-summary-block sqm-summary-block-highlight">
                <span className="sqm-summary-label">
                  New allocation in this form
                </span>
                <span
                  className={
                    overAllocated
                      ? "sqm-summary-value sqm-summary-value-bad"
                      : "sqm-summary-value sqm-summary-value-good"
                  }
                >
                  {fmt2(totalAllocatedPreview)}
                </span>
              </div>
            </div>

            <div className="sqm-modal-body">
              {error && (
                <div className="sqm-error-banner sqm-error-banner-tight">
                  {error}
                </div>
              )}

              <div className="sqm-modal-toolbar">
                <button
                  type="button"
                  className="sqm-toolbar-btn"
                  onClick={onAddRow}
                  disabled={saving}
                >
                  + Add row
                </button>
                <button
                  type="button"
                  className="sqm-toolbar-btn sqm-toolbar-btn-ghost"
                  onClick={onClearRows}
                  disabled={saving || !rows.length}
                >
                  Clear all
                </button>
                <span className="sqm-toolbar-hint">
                  Enter dimensions in centimeters. Sqm per piece is
                  calculated as <code>(L × W) / 10,000</code>.
                </span>
              </div>

              <div className="sqm-modal-table-wrapper">
                <table className="sqm-modal-table">
                  <thead>
                    <tr>
                      <th>Length (cm)</th>
                      <th>Width (cm)</th>
                      <th>Pieces</th>
                      <th className="sqm-num-col">Sqm / piece</th>
                      <th className="sqm-num-col">Total sqm</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!rows.length ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="sqm-modal-table-empty"
                        >
                          No pieces defined yet. Click{" "}
                          <strong>“Add row”</strong> to start.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.length}
                              onChange={(e) =>
                                onChangeField(
                                  idx,
                                  "length",
                                  e.target.value
                                )
                              }
                              className="sqm-modal-input"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.width}
                              onChange={(e) =>
                                onChangeField(
                                  idx,
                                  "width",
                                  e.target.value
                                )
                              }
                              className="sqm-modal-input"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.count}
                              onChange={(e) =>
                                onChangeField(
                                  idx,
                                  "count",
                                  e.target.value
                                )
                              }
                              className="sqm-modal-input"
                            />
                          </td>
                          <td className="sqm-num-col">
                            {fmt2(row.sqmPerPiece)}
                          </td>
                          <td className="sqm-num-col">
                            {fmt2(row.sqmTotal)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="sqm-row-delete-btn"
                              onClick={() => onRemoveRow(idx)}
                              disabled={saving}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {overAllocated && (
              <div className="sqm-modal-warning">
                The total sqm of these pieces is higher than the line sqm.  
                Please reduce the number of pieces or their dimensions before
                saving.
              </div>
            )}

            <div className="sqm-modal-footer">
              <button
                type="button"
                className="sqm-footer-btn sqm-footer-btn-ghost"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sqm-footer-btn sqm-footer-btn-primary"
                onClick={onSave}
                disabled={saving || overAllocated}
              >
                {saving ? "Saving…" : "Save pieces"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
