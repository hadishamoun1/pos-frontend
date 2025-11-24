// src/sqm-pieces/SqmPiecesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./sqmPiece.css";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, "");

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt2 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const PAGE_SIZE = 30;

export default function SqmPiecesPage() {
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(false); // initial / reset load
  const [loadingMore, setLoadingMore] = useState(false); // "Load more"
  const [errorMsg, setErrorMsg] = useState("");
  const [searchText, setSearchText] = useState("");

  // track which group is currently firing "trash all"
  const [groupTrashingKey, setGroupTrashingKey] = useState(null);
  // track which group is currently firing "restore all"
  const [groupRestoreKey, setGroupRestoreKey] = useState(null);

  // Notification modal for "trash all remaining"
  const [trashModal, setTrashModal] = useState({
    open: false,
    groupKey: null,
    itemLabel: "",
    remaining: 0,
    stage: "confirm", // 'confirm' | 'success' | 'error'
    loading: false,
    error: "",
  });

  // Notification modal for "restore trashed unallocated"
  const [restoreModal, setRestoreModal] = useState({
    open: false,
    groupKey: null,
    itemLabel: "",
    stage: "confirm", // 'confirm' | 'success' | 'error'
    loading: false,
    error: "",
  });

  // Modal state (per-line pieces)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalHeader, setModalHeader] = useState(null);
  const [modalPieces, setModalPieces] = useState([]); // rows user edits
  const [originalPieces, setOriginalPieces] = useState([]); // rows from backend

  // Which item-group is expanded (only one at a time)
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);

  /**
   * Fetch grouped BOSTS lines from backend with pagination + search.
   * Backend returns:
   * {
   *   page, limit, totalGroups, hasMore,
   *   data: [ { key, thickness, itemName, lines: [...], totals... }, ... ]
   * }
   */
  const fetchLines = async ({
    page: pageToLoad = 1,
    reset = false,
    q,
  } = {}) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setErrorMsg("");

    try {
      const res = await axios.get(`${baseUrl}/sqm-pieces/lines`, {
        params: {
          page: pageToLoad,
          limit: PAGE_SIZE,
          q: (q ?? searchText)?.trim() || undefined,
        },
      });

      const payload = res.data || {};
      const newGroups = payload.data || payload.groups || [];
      const hasMoreFlag = !!payload.hasMore;

      setGroups((prev) => (reset ? newGroups : [...prev, ...newGroups]));
      setPage(pageToLoad);
      setHasMore(hasMoreFlag);

      if (reset) {
        setExpandedGroupKey(null);
      }
    } catch (err) {
      console.error("Failed to load SQM BOSTS lines", err);
      setErrorMsg("Failed to load SQM BOSTS lines. Please try again.");
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    fetchLines({ page: 1, reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Modal helpers -----

  const loadLinePieces = async (transferItemId, { keepOpen = false } = {}) => {
    if (!keepOpen) {
      setModalOpen(true);
    }
    setModalLoading(true);
    setModalError("");
    setModalSuccess("");
    if (!keepOpen) {
      setModalHeader(null);
      setModalPieces([]);
      setOriginalPieces([]);
    }

    try {
      const res = await axios.get(
        `${baseUrl}/sqm-pieces/lines/${transferItemId}`
      );
      const data = res.data;
      setModalHeader(data.header || null);

      const mapped = (data.pieces || []).map((p) => ({
        id: p.id,
        length: p.length ?? "",
        width: p.width ?? "",
        count: p.piecesCount ?? "",
      }));

      setModalPieces(mapped);
      setOriginalPieces(mapped);
    } catch (err) {
      console.error("Failed to load line pieces", err);
      setModalError("Failed to load line details. Please close and try again.");
    } finally {
      setModalLoading(false);
    }
  };

  const openModalForLine = (transferItemId) => {
    loadLinePieces(transferItemId, { keepOpen: false });
  };

  const closeModal = () => {
    if (modalSaving) return;
    setModalOpen(false);
    setModalHeader(null);
    setModalPieces([]);
    setOriginalPieces([]);
    setModalError("");
    setModalSuccess("");
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

  // computed sqm per piece + row total inside modal
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

    const totalAllocated = withCalc.reduce((sum, r) => sum + r.sqmTotal, 0);

    return { rows: withCalc, totalAllocated };
  }, [modalPieces]);

  // detect if user changed anything vs backend
  const hasUnsavedChanges = useMemo(() => {
    if (!modalHeader) return false;
    const a = originalPieces || [];
    const b = modalPieces || [];
    if (a.length !== b.length) return true;

    for (let i = 0; i < a.length; i++) {
      const ra = a[i] || {};
      const rb = b[i] || {};
      if (
        num(ra.length) !== num(rb.length) ||
        num(ra.width) !== num(rb.width) ||
        Math.floor(num(ra.count)) !== Math.floor(num(rb.count))
      ) {
        return true;
      }
    }
    return false;
  }, [originalPieces, modalPieces, modalHeader]);

  // Over-allocation check: new allocation + already trashed (unallocated) must not exceed line sqm
  const overAllocated = useMemo(() => {
    if (!modalHeader) return false;
    const lineSqm = num(modalHeader.totalSqm);
    const trashedUnalloc = num(
      modalHeader.trashUnallocatedSqm ?? modalHeader.sqmTrashUnallocated
    );
    const newAllocated = modalComputed.totalAllocated;

    return newAllocated + trashedUnalloc - lineSqm > 0.0001;
  }, [modalHeader, modalComputed.totalAllocated]);

  const handleSavePieces = async () => {
    if (!modalHeader) return;
    if (!hasUnsavedChanges) return;

    setModalSaving(true);
    setModalError("");
    setModalSuccess("");

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

      const data = res.data;
      setModalHeader(data.header || null);

      const mapped = (data.pieces || []).map((p) => ({
        id: p.id,
        length: p.length ?? "",
        width: p.width ?? "",
        count: p.piecesCount ?? "",
      }));

      setModalPieces(mapped);
      setOriginalPieces(mapped);

      await fetchLines({ page: 1, reset: true });
      setModalSuccess("Pieces were saved successfully.");
    } catch (err) {
      console.error("Failed to save pieces", err);
      const msg =
        err?.response?.data?.message ||
        "Failed to save pieces. Check your values and try again.";
      setModalError(Array.isArray(msg) ? msg.join(" | ") : msg);
    } finally {
      setModalSaving(false);
    }
  };

  const handleTrashRemainingUnallocated = async () => {
    if (!modalHeader) return;

    // we always use the CURRENT saved unallocated, not the form edits
    const savedUnallocated =
      modalHeader.unallocatedSqm != null
        ? num(modalHeader.unallocatedSqm)
        : Math.max(
            0,
            num(modalHeader.totalSqm) -
              num(modalHeader.allocatedSqm) -
              num(
                modalHeader.trashUnallocatedSqm ??
                  modalHeader.sqmTrashUnallocated
              )
          );

    const sqmToTrash = Number(savedUnallocated.toFixed(4));

    if (sqmToTrash <= 0) {
      setModalError("No unallocated sqm left (saved) to trash on this line.");
      return;
    }

    if (hasUnsavedChanges) {
      setModalError(
        "You have unsaved changes in pieces. Please save first, then trash remaining sqm."
      );
      return;
    }

    setModalSaving(true);
    setModalError("");
    setModalSuccess("");

    try {
      await axios.post(
        `${baseUrl}/sqm-pieces/lines/${modalHeader.transferItemId}/trash-unallocated`,
        { sqmToTrash }
      );

      // Reload header + pieces, keep modal open
      await loadLinePieces(modalHeader.transferItemId, { keepOpen: true });
      await fetchLines({ page: 1, reset: true });

      setModalSuccess(
        `Current unallocated sqm (${fmt2(sqmToTrash)}) was moved to trash.`
      );
    } catch (err) {
      console.error("Failed to trash remaining sqm", err);
      const msg =
        err?.response?.data?.message ||
        "Failed to trash remaining sqm. Please try again.";
      setModalError(Array.isArray(msg) ? msg.join(" | ") : msg);
    } finally {
      setModalSaving(false);
    }
  };

  const handleRestoreUnallocated = async () => {
    if (!modalHeader) return;

    const trashedUnalloc = num(
      modalHeader.trashUnallocatedSqm 
    );
    const sqmToRestore = Number(trashedUnalloc.toFixed(4));

    if (sqmToRestore <= 0) {
      setModalError("No trashed unallocated sqm to restore on this line.");
      return;
    }

    if (hasUnsavedChanges) {
      setModalError(
        "You have unsaved changes in pieces. Please save first, then restore trashed sqm."
      );
      return;
    }

    setModalSaving(true);
    setModalError("");
    setModalSuccess("");

    try {
      await axios.post(
        `${baseUrl}/sqm-pieces/lines/${modalHeader.transferItemId}/restore-unallocated`,
        { sqmToRestore }
      );

      // Reload header + pieces, keep modal open
      await loadLinePieces(modalHeader.transferItemId, { keepOpen: true });
      await fetchLines({ page: 1, reset: true });

      setModalSuccess(
        `Previously trashed unallocated sqm (${fmt2(
          sqmToRestore
        )}) was restored back to stock.`
      );
    } catch (err) {
      console.error("Failed to restore unallocated sqm", err);
      const msg =
        err?.response?.data?.message ||
        "Failed to restore unallocated sqm. Please try again.";
      setModalError(Array.isArray(msg) ? msg.join(" | ") : msg);
    } finally {
      setModalSaving(false);
    }
  };

  const toggleGroup = (key) => {
    setExpandedGroupKey((prev) => (prev === key ? null : key));
  };

  // ---- Group-level "trash all remaining" ----
  const handleTrashAllForGroup = (group, itemLabel) => {
    if (!group) return;

    const remaining = num(group.totalAvailableSqm);
    if (remaining <= 0.0001) {
      // keep using banner if nothing to trash
      setErrorMsg(
        "There is no remaining available sqm in this group to move to trash."
      );
      return;
    }

    // Open professional confirmation modal instead of window.confirm
    setTrashModal({
      open: true,
      groupKey: group.key,
      itemLabel: itemLabel || "",
      remaining,
      stage: "confirm",
      loading: false,
      error: "",
    });
  };

  const closeTrashModal = () => {
    setTrashModal({
      open: false,
      groupKey: null,
      itemLabel: "",
      remaining: 0,
      stage: "confirm",
      loading: false,
      error: "",
    });
  };

  const confirmTrashAllForGroup = async () => {
    if (!trashModal.groupKey) return;

    setTrashModal((prev) => ({ ...prev, loading: true, error: "" }));
    setGroupTrashingKey(trashModal.groupKey);

    try {
      await axios.post(`${baseUrl}/sqm-pieces/groups/trash-all`, {
        groupKey: trashModal.groupKey,
      });

      // Reload from first page with current search
      await fetchLines({ page: 1, reset: true, q: searchText });

      // Show success state in modal
      setTrashModal((prev) => ({
        ...prev,
        loading: false,
        stage: "success",
      }));
    } catch (err) {
      console.error("Failed to trash all remaining sqm for group", err);
      const msg =
        err?.response?.data?.message ||
        "Failed to trash all remaining sqm for this group. Please try again.";
      setTrashModal((prev) => ({
        ...prev,
        loading: false,
        stage: "error",
        error: Array.isArray(msg) ? msg.join(" | ") : msg,
      }));
    } finally {
      setGroupTrashingKey(null);
    }
  };

  // ---- Group-level "restore trashed unallocated" ----
  const handleRestoreAllForGroup = (group, itemLabel) => {
    if (!group) return;

    setErrorMsg("");

    // Open confirmation modal for restore
    setRestoreModal({
      open: true,
      groupKey: group.key,
      itemLabel: itemLabel || "",
      stage: "confirm",
      loading: false,
      error: "",
    });
  };

  const closeRestoreModal = () => {
    setRestoreModal({
      open: false,
      groupKey: null,
      itemLabel: "",
      stage: "confirm",
      loading: false,
      error: "",
    });
  };

  const confirmRestoreAllForGroup = async () => {
    if (!restoreModal.groupKey) return;

    setRestoreModal((prev) => ({ ...prev, loading: true, error: "" }));
    setGroupRestoreKey(restoreModal.groupKey);

    try {
      await axios.post(
        `${baseUrl}/sqm-pieces/groups/restore-all-unallocated`,
        {
          groupKey: restoreModal.groupKey,
        }
      );

      // Reload from first page with current search
      await fetchLines({ page: 1, reset: true, q: searchText });

      // Show success state in modal
      setRestoreModal((prev) => ({
        ...prev,
        loading: false,
        stage: "success",
      }));
    } catch (err) {
      console.error(
        "Failed to restore trashed unallocated sqm for group",
        err
      );
      const msg =
        err?.response?.data?.message ||
        "Failed to restore trashed unallocated sqm for this group. Please try again.";
      setRestoreModal((prev) => ({
        ...prev,
        loading: false,
        stage: "error",
        error: Array.isArray(msg) ? msg.join(" | ") : msg,
      }));
    } finally {
      setGroupRestoreKey(null);
    }
  };

  return (
    <div className="sqm-page">
      <div className="sqm-page-header">
        <div>
          <h1 className="sqm-page-title">SQM Pieces &amp; BOSTS Lines</h1>
          <p className="sqm-page-subtitle">
            Each card is an <strong>item (thickness + name)</strong>. All
            origins for that item are combined in this SQM view. The card header
            shows the <strong>totals for all BOSTS lines</strong> of that item.
            Click <strong>“View lines”</strong> to see and allocate pieces per
            transfer line.
          </p>
        </div>
        <div className="sqm-page-header-right">
          <button
            className="sqm-page-refresh-btn"
            onClick={() => fetchLines({ page: 1, reset: true })}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Legend to make columns clear */}
      <div className="sqm-legend">
        <span>
          <strong>Line sqm</strong> = sqm moved to BOSTS on this transfer line.
        </span>
        <span>
          <strong>Allocated</strong> = sqm already split into piece dimensions.
        </span>
        <span>
          <strong>Sold</strong> = sqm that left stock by sales from pieces.
        </span>
        <span>
          <strong>Trash</strong> = all discarded sqm (from pieces + unallocated).
        </span>
        <span>
          <strong>Available</strong> = sqm still in stock (unallocated +
          remaining pieces).
        </span>
      </div>

      <div className="sqm-page-filters">
        <div className="sqm-filter-group">
          <label className="sqm-filter-label">
            Search by item / origin / transfer
          </label>
          <input
            className="sqm-filter-input"
            type="text"
            value={searchText}
            placeholder="5.5ملم ابيض, origin, transfer #…"
            onChange={(e) => {
              const value = e.target.value;
              setSearchText(value);
              fetchLines({ page: 1, reset: true, q: value });
            }}
          />
        </div>
      </div>

      {errorMsg && <div className="sqm-error-banner">{errorMsg}</div>}

      <div className="sqm-groups-wrapper">
        {loading && !groups.length ? (
          <div className="sqm-empty-state">Loading SQM BOSTS lines…</div>
        ) : !groups.length ? (
          <div className="sqm-empty-state">
            No lines found with current filters.
          </div>
        ) : (
          <>
            {groups.map((group) => {
              const itemLabel =
                (group.thickness != null
                  ? `${group.thickness}ملم `
                  : "") + (group.itemName || "");
              const isOpen = expandedGroupKey === group.key;
              const groupAvailable = num(group.totalAvailableSqm);
              const groupSold = num(group.totalSoldSqm);

              return (
                <div
                  key={group.key}
                  className={
                    "sqm-group-card" + (isOpen ? " sqm-group-card-open" : "")
                  }
                >
                  <div
                    className="sqm-group-card-header"
                    onClick={() => toggleGroup(group.key)}
                  >
                    <div className="sqm-group-card-main">
                      <div className="sqm-group-card-title-row">
                        <span className="sqm-group-card-title">
                          {itemLabel}
                        </span>
                      </div>
                      <div className="sqm-group-card-sub">
                        <span className="sqm-group-lines-count">
                          {group.lines.length} line
                          {group.lines.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="sqm-group-card-metrics">
                      <div className="sqm-group-metric">
                        <span className="sqm-group-metric-label">
                          Total line sqm
                        </span>
                        <span className="sqm-group-metric-value">
                          {fmt2(group.totalLineSqm)}
                        </span>
                      </div>
                      <div className="sqm-group-metric">
                        <span className="sqm-group-metric-label">
                          Total allocated
                        </span>
                        <span className="sqm-group-metric-value">
                          {fmt2(group.totalAllocatedSqm)}
                        </span>
                      </div>
                      <div className="sqm-group-metric">
                        <span className="sqm-group-metric-label">
                          Total sold
                        </span>
                        <span className="sqm-group-metric-value">
                          {fmt2(groupSold)}
                        </span>
                      </div>
                      <div className="sqm-group-metric">
                        <span className="sqm-group-metric-label">
                          Total trash
                        </span>
                        <span className="sqm-group-metric-value">
                          {fmt2(group.totalTrashSqm)}
                        </span>
                      </div>
                      <div className="sqm-group-metric">
                        <span className="sqm-group-metric-label">
                          Total available
                        </span>
                        <span className="sqm-group-metric-value">
                          {fmt2(groupAvailable)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="sqm-group-card-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="sqm-group-view-btn"
                        onClick={() => toggleGroup(group.key)}
                      >
                        {isOpen ? "Hide lines" : "View lines"}
                      </button>

                      <button
                        type="button"
                        className="sqm-group-view-btn sqm-group-trash-all-btn"
                        onClick={() =>
                          handleTrashAllForGroup(group, itemLabel)
                        }
                        disabled={
                          groupTrashingKey === group.key ||
                          groupRestoreKey === group.key ||
                          groupAvailable <= 0.0001
                        }
                        title={
                          groupAvailable <= 0.0001
                            ? "No remaining sqm in this group to trash."
                            : "Move ALL remaining sqm (all lines of this item) to trash."
                        }
                      >
                        {groupTrashingKey === group.key
                          ? "Trashing…"
                          : "Trash all remaining"}
                      </button>

                      <button
                        type="button"
                        className="sqm-group-view-btn sqm-group-restore-all-btn"
                        onClick={() =>
                          handleRestoreAllForGroup(group, itemLabel)
                        }
                        disabled={
                          groupTrashingKey === group.key ||
                          groupRestoreKey === group.key
                        }
                        title="Restore all trashed unallocated sqm for this item (all its lines)."
                      >
                        {groupRestoreKey === group.key
                          ? "Restoring…"
                          : "Restore trashed unallocated"}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="sqm-group-card-body">
                      <table className="sqm-lines-table">
                        <thead>
                          <tr>
                            <th>Transfer #</th>
                            <th>Date</th>
                            <th className="sqm-num-col">Line sqm</th>
                            <th className="sqm-num-col">
                              Allocated (pieces)
                            </th>
                            <th className="sqm-num-col">Sold sqm</th>
                            <th className="sqm-num-col">Trash (total)</th>
                            <th className="sqm-num-col">Available</th>
                            <th>Status</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.lines.map((row) => {
                            const noPieces =
                              num(row.allocatedSqm) <= 0.0001 &&
                              num(row.unallocatedSqm) > 0.0001 &&
                              num(row.totalTrashSqm) <= 0.0001;

                            const allTrashedOrSold =
                              num(row.availableSqm) <= 0.0001 &&
                              num(row.lineSqm) > 0.0001;

                            let statusLabel = "";
                            if (noPieces) {
                              statusLabel = "No pieces defined yet";
                            } else if (allTrashedOrSold) {
                              statusLabel = "All sqm used (sold or trashed)";
                            } else if (num(row.allocatedSqm) > 0.0001) {
                              statusLabel = "Pieces defined";
                            } else {
                              statusLabel = "Unallocated";
                            }

                            return (
                              <tr key={row.transferItemId}>
                                <td>{row.transferNumber}</td>
                                <td>{row.date}</td>
                                <td className="sqm-num-col">
                                  {fmt2(row.lineSqm)}
                                </td>
                                <td className="sqm-num-col">
                                  {fmt2(row.allocatedSqm || 0)}
                                </td>
                                <td className="sqm-num-col">
                                  {fmt2(row.soldSqm || 0)}
                                </td>
                                <td className="sqm-num-col">
                                  {fmt2(row.totalTrashSqm || 0)}
                                </td>
                                <td className="sqm-num-col">
                                  {fmt2(row.availableSqm || 0)}
                                </td>
                                <td>
                                  <span
                                    className={
                                      noPieces
                                        ? "sqm-status-pill sqm-status-pill-warning"
                                        : allTrashedOrSold
                                        ? "sqm-status-pill sqm-status-pill-muted"
                                        : "sqm-status-pill"
                                    }
                                  >
                                    {statusLabel}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="sqm-table-action-btn"
                                    onClick={() =>
                                      openModalForLine(row.transferItemId)
                                    }
                                  >
                                    Allocate pieces
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div className="sqm-load-more-wrapper">
                <button
                  type="button"
                  className="sqm-load-more-btn"
                  onClick={() =>
                    fetchLines({ page: page + 1, reset: false })
                  }
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading more…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Group-level notification modal for "Trash all remaining" */}
      {trashModal.open && (
        <div className="sqm-notify-modal-overlay">
          <div className="sqm-notify-modal">
            <div className="sqm-notify-header">
              <div
                className={
                  trashModal.stage === "success"
                    ? "sqm-notify-icon sqm-notify-icon-success"
                    : trashModal.stage === "error"
                    ? "sqm-notify-icon sqm-notify-icon-error"
                    : "sqm-notify-icon sqm-notify-icon-warning"
                }
              >
                {trashModal.stage === "success"
                  ? "✓"
                  : trashModal.stage === "error"
                  ? "!"
                  : "!"}
              </div>
              <div>
                <h3 className="sqm-notify-title">
                  {trashModal.stage === "confirm"
                    ? "Trash all remaining sqm?"
                    : trashModal.stage === "success"
                    ? "Remaining sqm trashed"
                    : "Failed to trash sqm"}
                </h3>
                <p className="sqm-notify-text">
                  {trashModal.stage === "confirm"
                    ? `This will move ALL remaining available sqm (${fmt2(
                        trashModal.remaining
                      )}) for "${trashModal.itemLabel}" to trash across all its lines. You can only bring it back using restore.`
                    : trashModal.stage === "success"
                    ? `All remaining available sqm (${fmt2(
                        trashModal.remaining
                      )}) for "${trashModal.itemLabel}" was moved to trash.`
                    : trashModal.error ||
                      "An unexpected error occurred while trashing the remaining sqm."}
                </p>
              </div>
            </div>
            <div className="sqm-notify-actions">
              {trashModal.stage === "confirm" && (
                <>
                  <button
                    type="button"
                    className="sqm-notify-btn sqm-notify-btn-ghost"
                    onClick={closeTrashModal}
                    disabled={trashModal.loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="sqm-notify-btn sqm-notify-btn-danger"
                    onClick={confirmTrashAllForGroup}
                    disabled={trashModal.loading}
                  >
                    {trashModal.loading ? "Trashing…" : "Yes, trash all"}
                  </button>
                </>
              )}
              {trashModal.stage !== "confirm" && (
                <button
                  type="button"
                  className="sqm-notify-btn sqm-notify-btn-primary"
                  onClick={closeTrashModal}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group-level notification modal for "Restore trashed unallocated" */}
      {restoreModal.open && (
        <div className="sqm-notify-modal-overlay">
          <div className="sqm-notify-modal">
            <div className="sqm-notify-header">
              <div
                className={
                  restoreModal.stage === "success"
                    ? "sqm-notify-icon sqm-notify-icon-success"
                    : restoreModal.stage === "error"
                    ? "sqm-notify-icon sqm-notify-icon-error"
                    : "sqm-notify-icon sqm-notify-icon-warning"
                }
              >
                {restoreModal.stage === "success"
                  ? "✓"
                  : restoreModal.stage === "error"
                  ? "!"
                  : "↺"}
              </div>
              <div>
                <h3 className="sqm-notify-title">
                  {restoreModal.stage === "confirm"
                    ? "Restore trashed unallocated sqm?"
                    : restoreModal.stage === "success"
                    ? "Trashed unallocated restored"
                    : "Failed to restore sqm"}
                </h3>
                <p className="sqm-notify-text">
                  {restoreModal.stage === "confirm"
                    ? `This will restore all trashed unallocated sqm for "${restoreModal.itemLabel}" across all its lines back into stock as available sqm.`
                    : restoreModal.stage === "success"
                    ? `All trashed unallocated sqm for "${restoreModal.itemLabel}" was restored back into available stock.`
                    : restoreModal.error ||
                      "An unexpected error occurred while restoring the trashed unallocated sqm."}
                </p>
              </div>
            </div>
            <div className="sqm-notify-actions">
              {restoreModal.stage === "confirm" && (
                <>
                  <button
                    type="button"
                    className="sqm-notify-btn sqm-notify-btn-ghost"
                    onClick={closeRestoreModal}
                    disabled={restoreModal.loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="sqm-notify-btn sqm-notify-btn-primary"
                    onClick={confirmRestoreAllForGroup}
                    disabled={restoreModal.loading}
                  >
                    {restoreModal.loading ? "Restoring…" : "Yes, restore all"}
                  </button>
                </>
              )}
              {restoreModal.stage !== "confirm" && (
                <button
                  type="button"
                  className="sqm-notify-btn sqm-notify-btn-primary"
                  onClick={closeRestoreModal}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <SqmPiecesModal
          header={modalHeader}
          loading={modalLoading}
          saving={modalSaving}
          error={modalError}
          success={modalSuccess}
          rows={modalComputed.rows}
          totalAllocated={modalComputed.totalAllocated}
          overAllocated={overAllocated}
          hasUnsavedChanges={hasUnsavedChanges}
          onChangeField={updatePieceField}
          onAddRow={addPieceRow}
          onClearRows={clearPieceRows}
          onRemoveRow={removePieceRow}
          onClose={closeModal}
          onSave={handleSavePieces}
          onTrashRemaining={handleTrashRemainingUnallocated}
          onRestoreUnallocated={handleRestoreUnallocated}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Modal component (per-line pieces)
// ------------------------------------------------------------------

function SqmPiecesModal({
  header,
  loading,
  saving,
  error,
  success,
  rows,
  totalAllocated,
  overAllocated,
  hasUnsavedChanges,
  onChangeField,
  onAddRow,
  onClearRows,
  onRemoveRow,
  onClose,
  onSave,
  onTrashRemaining,
  onRestoreUnallocated,
}) {
  const lineSqm = num(header?.totalSqm);
  const savedPiecesSqm = num(header?.allocatedSqm);
  const trashedUnalloc = num(
    header?.trashUnallocatedSqm ?? header?.sqmTrashUnallocated
  );

  const unallocatedBeforeEdit =
    header?.unallocatedSqm != null
      ? num(header.unallocatedSqm)
      : Math.max(0, lineSqm - savedPiecesSqm - trashedUnalloc);

  const headerLabel =
    (header?.thickness != null ? `${header.thickness}ملم ` : "") +
    (header?.itemName || "");

  const diff = totalAllocated - savedPiecesSqm;

  return (
    <div className="sqm-modal-overlay">
      <div className="sqm-modal">
        <div className="sqm-modal-header">
          <div className="sqm-modal-header-left">
            <h2 className="sqm-modal-title">Allocate SQM pieces</h2>
            {header && (
              <p className="sqm-modal-subtitle">
                Transfer{" "}
                <span className="sqm-modal-tag">{header.transferNumber}</span>{" "}
                · {header.date} · {headerLabel} · {header.origin}
              </p>
            )}
          </div>
          <div className="sqm-modal-header-right">
            {header && !loading && (
              <span
                className={
                  hasUnsavedChanges
                    ? "sqm-badge sqm-badge-warning"
                    : "sqm-badge sqm-badge-success"
                }
              >
                {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
              </span>
            )}
            <button
              className="sqm-modal-close-btn"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              ×
            </button>
          </div>
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
                <span className="sqm-summary-value">{fmt2(lineSqm)}</span>
              </div>
              <div className="sqm-summary-block">
                <span className="sqm-summary-label">Saved pieces sqm</span>
                <span className="sqm-summary-value">
                  {fmt2(savedPiecesSqm)}
                </span>
              </div>
              <div className="sqm-summary-block">
                <span className="sqm-summary-label">Trashed (unallocated)</span>
                <span className="sqm-summary-value">
                  {fmt2(trashedUnalloc)}
                </span>
              </div>
              <div className="sqm-summary-block sqm-summary-block-highlight">
                <span className="sqm-summary-label">
                  Unallocated sqm (current saved)
                </span>
                <span className="sqm-summary-value">
                  {fmt2(unallocatedBeforeEdit)}
                </span>
              </div>
            </div>

            <div className="sqm-modal-body">
              {error && (
                <div className="sqm-error-banner sqm-error-banner-tight">
                  {error}
                </div>
              )}
              {success && (
                <div className="sqm-success-banner">{success}</div>
              )}

              {/* Section 1: Define pieces */}
              <div className="sqm-modal-section">
                <div className="sqm-modal-toolbar">
                  <div className="sqm-modal-section-title">
                    Define / edit piece dimensions
                  </div>
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
                    Enter dimensions in centimeters. Sqm per piece =
                    <code> (L × W) / 10,000</code>.
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
                          <td colSpan={6} className="sqm-modal-table-empty">
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
                                  onChangeField(idx, "length", e.target.value)
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
                                  onChangeField(idx, "width", e.target.value)
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
                                  onChangeField(idx, "count", e.target.value)
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

                {/* Allocation / remaining summary + trash/restore buttons */}
                <div className="sqm-modal-allocation-bar">
                  <div className="sqm-modal-allocation-info">
                    <span>
                      After saving, pieces sqm will be{" "}
                      <strong>{fmt2(totalAllocated)}</strong> sqm{" "}
                      <span
                        className={
                          diff > 0
                            ? "sqm-text-up"
                            : diff < 0
                            ? "sqm-text-down"
                            : "sqm-text-neutral"
                        }
                      >
                        {diff > 0
                          ? `(+${fmt2(diff)})`
                          : diff < 0
                          ? `(${fmt2(diff)})`
                          : "(no change)"}
                      </span>
                    </span>
                    <span className="sqm-modal-note">
                      <strong>Current unallocated sqm (saved):</strong>{" "}
                      {fmt2(unallocatedBeforeEdit)} sqm. <br />
                      <strong>Trashed unallocated sqm:</strong>{" "}
                      {fmt2(trashedUnalloc)} sqm.
                    </span>
                  </div>
                  <div className="sqm-modal-allocation-actions">
                    <button
                      type="button"
                      className="sqm-toolbar-btn sqm-toolbar-btn-danger"
                      onClick={onTrashRemaining}
                      disabled={
                        saving ||
                        unallocatedBeforeEdit <= 0 ||
                        hasUnsavedChanges
                      }
                      title={
                        hasUnsavedChanges
                          ? "Save your piece changes first, then trash remaining sqm."
                          : unallocatedBeforeEdit <= 0
                          ? "No unallocated sqm left to trash."
                          : "Move all unallocated (saved) sqm to trash."
                      }
                    >
                      Trash remaining sqm
                    </button>
                    <button
                      type="button"
                      className="sqm-toolbar-btn sqm-toolbar-btn-restore"
                      onClick={onRestoreUnallocated}
                      disabled={
                        saving || trashedUnalloc <= 0 || hasUnsavedChanges
                      }
                      title={
                        hasUnsavedChanges
                          ? "Save your piece changes first, then restore trashed sqm."
                          : trashedUnalloc <= 0
                          ? "There is no trashed unallocated sqm on this line."
                          : "Restore all trashed unallocated sqm back to stock."
                      }
                    >
                      Restore trashed unallocated
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {overAllocated && (
              <div className="sqm-modal-warning">
                The total sqm of these pieces + existing unallocated trash
                exceeds this line sqm. Reduce the number of pieces or their
                dimensions before saving.
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
                disabled={saving || overAllocated || !hasUnsavedChanges}
                title={
                  !hasUnsavedChanges
                    ? "There are no changes to save."
                    : overAllocated
                    ? "Fix the allocation so it doesn't exceed this line sqm."
                    : "Save these piece definitions."
                }
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
