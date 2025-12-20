// src/components/transfers/previewTransferTable.jsx
import React, { useEffect, useState } from "react";
import "./previewTransferTable.css";
import { axiosClient } from "../api/axiosClient"; 

export default function PreviewTransferTable({
  transfers,
  rows,
  onEdit,
  onDelete,
  loading,
  error,
  autoFetch = false, // 🔹 when true & no transfers, we fetch from API
  reloadKey = 0, // 🔹 bump this from parent to re-fetch (e.g. after delete)
}) {
  const isRowsMode = Array.isArray(rows);

  // ----------------- INTERNAL STATE FOR API MODE -----------------
  const [internalTransfers, setInternalTransfers] = useState([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState("");

  useEffect(() => {
    if (isRowsMode) return; // inside TransferModal rows preview
    if (transfers && transfers.length) return; // parent already provided data
    if (!autoFetch) return; // only fetch if asked to

    setInternalLoading(true);
    axiosClient
      .get(`/transfers/v1/details`) // ✅ relative ONLY (NO baseUrl)
      .then((res) => {
        setInternalTransfers(res.data || []);
        setInternalError("");
      })
      .catch((err) => {
        console.error(
          "Failed to load transfers (autoFetch) in PreviewTransferTable",
          err
        );
        const msg =
          err.response?.data?.message ||
          err.response?.data ||
          err.message ||
          "Failed to load transfers";
        setInternalError(msg);
      })
      .finally(() => setInternalLoading(false));
  }, [isRowsMode, transfers, autoFetch, reloadKey]);

  /* ----------------- MODE 1: Modal preview (current transfer rows) ----------------- */
  if (isRowsMode) {
    if (!rows.length) {
      return (
        <div className="preview-transfer-table-wrapper">
          <div className="preview-empty">
            No items added to this transfer yet. Use <b>Search</b> to add rows,
            then come back to Preview.
          </div>
        </div>
      );
    }

    return (
      <div className="preview-transfer-table-wrapper">
        <div className="preview-subtitle">
          Preview of <b>this transfer’s</b> items (not saved yet)
        </div>
        <table className="preview-transfer-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Origin</th>
              <th>Type</th>
              <th>Length</th>
              <th>Width</th>
              <th>Sheets/Box</th>
              <th>SQM</th>
              <th>Price</th>
              <th>Condition</th>
              <th>Date Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td style={{ direction: "rtl" }}>{r.name}</td>
                <td>{r.origin}</td>
                <td>{r.type}</td>
                <td>{Math.floor(Number(r.length) || 0)}</td>
                <td>{Math.floor(Number(r.width) || 0)}</td>
                <td>{r.sheetsPerBox}</td>
                <td>{r.sqm}</td>
                <td>{r.price}</td>
                <td>{r.condition || ""}</td>
                <td>{r.dateReceived || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ----------------- MODE 2: Transfers list (page-level OR autoFetch) ----------------- */

  const effectiveLoading = loading ?? internalLoading;
  const effectiveError = error ?? internalError;
  const dataTransfers =
    Array.isArray(transfers) && transfers.length ? transfers : internalTransfers;

  if (effectiveLoading) {
    return <div className="preview-transfer-loading">Loading…</div>;
  }
  if (effectiveError) {
    return <div className="preview-transfer-error">{effectiveError}</div>;
  }

  const hasItemsArray = dataTransfers.some(
    (t) => Array.isArray(t.items) && t.items.length
  );

  if (!dataTransfers.length || !hasItemsArray) {
    return (
      <div className="preview-transfer-table-wrapper">
        <div className="preview-empty">No transfers found</div>
      </div>
    );
  }

  return (
    <div className="preview-transfer-table-wrapper">
      <table className="preview-transfer-table">
        <thead>
          <tr>
            <th>Transfer #</th>
            <th>Date</th>
            <th>Type</th>
            <th>Location</th>
            <th>Item Name</th>
            <th>Origin</th>
            <th>Type</th>
            <th>Length</th>
            <th>Width</th>
            <th>Sheets/Box</th>
            <th>SQM</th>
            <th>Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {dataTransfers.flatMap((t) =>
            (t.items || []).map((i) => (
              <tr key={`${t.id}-${i.id}`}>
                <td>{t.transferNumber}</td>
                <td>{t.date}</td>
                <td>{t.type}</td>
                <td>{t.location}</td>
                <td>{`${i.thickness} ملم ${i.itemName}`}</td>
                <td>{i.origin}</td>
                <td>{i.itemType === "box" ? "Box" : "Sheet"}</td>
                <td>{Math.floor(Number(i.length))}</td>
                <td>{Math.floor(Number(i.width))}</td>
                <td>{i.sheetsPerBox}</td>
                <td>{i.sqm}</td>
                <td>{i.price}</td>
                <td>
                  <div className="transfer-actions">
                    <button
                      className="transfer-btn-edit"
                      onClick={() => onEdit && onEdit(t)}
                    >
                      Edit
                    </button>
                    <button
                      className="transfer-btn-delete"
                      onClick={() => onDelete && onDelete(t.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
