import React, { useRef } from "react";
import "./styles/alternativeSummarySection.css";

// Raw ShipsGo ocean status -> a friendly label + color bucket for the small
// tracking badge shown next to the BL field. Kept intentionally simple here
// (no ETA/route awareness) since all we get on the invoice is the last
// status the sync job saw — the full picture lives on the Shipment Tracking
// page.
const SHIPSGO_STATUS_DISPLAY = {
  NEW: { label: "Booked · not sailing yet", tone: "mute" },
  BOOKED: { label: "Booked · not sailing yet", tone: "mute" },
  UNTRACKED: { label: "Not sailing yet", tone: "mute" },
  INPROGRESS: { label: "Sailing", tone: "good" },
  LOADED: { label: "Sailing", tone: "good" },
  SAILING: { label: "Sailing", tone: "good" },
  ARRIVED: { label: "Arrived", tone: "good" },
  DISCHARGED: { label: "Arrived", tone: "good" },
};

// AIS navigational status codes we surface — mirrors NAV_STATUS on the
// backend (vessel-tracking.service.ts). Anything else just shows as "At sea".
const NAV_STATUS_DISPLAY = {
  0: { label: "Under way", tone: "good" },
  1: { label: "At anchor", tone: "warn" },
  5: { label: "Moored", tone: "warn" },
};

const TRACKING_MODES = [
  { key: "bl", label: "BL Number" },
  { key: "container", label: "Container Number" },
  { key: "vessel", label: "Vessel (Charter)" },
];

function timeAgo(rawTs) {
  if (!rawTs) return null;
  const then = new Date(String(rawTs).replace(" ", "T"));
  if (isNaN(then.getTime())) return null;
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const AlternativeSummarySection = ({
  shippingLine,
  onShippingLineChange,
  etd,
  onEtdChange,
  numberOfContainers,
  onNumberOfContainersChange,
  blNumber,
  onBlNumberChange,
  containerNumber,
  onContainerNumberChange,
  isEditable,
  shipsgoShipmentId,
  shipsgoStatus,
  shipsgoLastCheckedAt,
  isTrackingShipment,
  onTrackShipment,
  onSyncShipment,
  onUntrackShipment,
  canTrackShipment,
  blDocumentPath,
  isUploadingBlDocument,
  onUploadBlDocument,
  onViewBlDocument,
  onDownloadBlDocument,
  canUploadBlDocument,
  vesselName,
  onVesselNameChange,
  vesselImo,
  vesselMmsi,
  vesselNavStatus,
  vesselSpeedKnots,
  vesselArrivedAtPort,
  vesselLastCheckedAt,
  vesselPositionAt,
  isSearchingVessel,
  isTrackingVessel,
  onSearchVessel,
  onSyncVessel,
  onUntrackVessel,
  canTrackVessel,
  vesselSearchResults,
  showVesselPicker,
  onCloseVesselPicker,
  onConfirmVesselTracking,
  trackingMode,
  onTrackingModeChange,
  otherDocuments,
  isUploadingOtherDocuments,
  onUploadOtherDocuments,
  onViewOtherDocument,
  onDownloadOtherDocument,
  onDeleteOtherDocument,
  canUploadOtherDocuments,
  canManageShipmentTracking,
}) => {
  const display = shipsgoStatus ? SHIPSGO_STATUS_DISPLAY[shipsgoStatus] : null;
  const lastChecked = timeAgo(shipsgoLastCheckedAt);
  const fileInputRef = useRef(null);
  const fileName = blDocumentPath ? blDocumentPath.split(/[/\\]/).pop() : null;
  const otherDocsInputRef = useRef(null);

  const isShipsgoTracked = Boolean(shipsgoShipmentId);
  const isVesselTracked = Boolean(vesselImo || vesselMmsi);
  const isTracked = isShipsgoTracked || isVesselTracked;
  const navDisplay = vesselNavStatus != null ? NAV_STATUS_DISPLAY[vesselNavStatus] : null;
  const vesselLastChecked = timeAgo(vesselLastCheckedAt);
  const vesselPositionAgo = timeAgo(vesselPositionAt);
  // The position itself can be stale even right after a successful check —
  // a vessel's AIS feed can stall on the provider's end independent of how
  // often we ask. 24h is a loose threshold: normal AIS gaps (open ocean,
  // out of terrestrial range) are usually much shorter than this.
  const isPositionStale =
    vesselPositionAt && Date.now() - new Date(String(vesselPositionAt).replace(" ", "T")).getTime() > 24 * 60 * 60 * 1000;

  // Which tracking method this invoice is using — drives which fields and
  // buttons actually show, so an untracked BL-number shipment never shows
  // the container-number or vessel fields, and vice versa. Owned by the
  // parent (not local state here) since it also has to decide which field
  // an uploaded BL's extraction result gets applied to.
  const showTabs = isEditable && !isTracked;
  const showLinerFields = trackingMode === "bl" || trackingMode === "container";
  const showBlRow = trackingMode === "bl" || trackingMode === "container";
  const showVesselRow = trackingMode === "vessel";

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (file) onUploadBlDocument?.(file);
  };

  const handleOtherDocsChosen = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file(s) later
    if (files.length) onUploadOtherDocuments?.(files);
  };

  const formatFileSize = (bytes) => {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="summary-section">
      <h4>Shipping &amp; BL Details</h4>

      {showTabs && (
        <div className="tracking-mode-tabs">
          {TRACKING_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`tracking-mode-tab${trackingMode === m.key ? " active" : ""}`}
              onClick={() => onTrackingModeChange(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="alternative-fields">
        <label>
          Expected Time Departure
          <input
            type="date"
            value={etd}
            onChange={(e) => onEtdChange(e.target.value)}
          />
        </label>

        {showLinerFields && (
          <>
            <label>
              Shipping Line
              <input
                type="text"
                value={shippingLine}
                onChange={(e) => onShippingLineChange(e.target.value)}
                placeholder="Enter shipping line"
              />
            </label>

            <label>
              Number of Containers
              <input
                type="number"
                value={numberOfContainers}
                onChange={(e) => onNumberOfContainersChange(Number(e.target.value))}
                placeholder="e.g., 5"
              />
            </label>
          </>
        )}

        {trackingMode === "bl" && (
          <label>
            BL Number
            <input
              type="text"
              value={blNumber}
              onChange={(e) => onBlNumberChange(e.target.value)}
              placeholder="Enter BL number"
            />
          </label>
        )}

        {trackingMode === "container" && (
          <label>
            Container Number
            <input
              type="text"
              value={containerNumber}
              onChange={(e) => onContainerNumberChange(e.target.value)}
              placeholder="e.g., TCLU7716090"
            />
          </label>
        )}

        {trackingMode === "vessel" && (
          <label>
            Vessel Name
            <input
              type="text"
              value={vesselName}
              onChange={(e) => onVesselNameChange(e.target.value)}
              placeholder="e.g., SITIA"
              disabled={isVesselTracked}
            />
          </label>
        )}
      </div>

      <div className="bl-document-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={handleFileChosen}
          hidden
        />

        {blDocumentPath ? (
          <div className="bl-document-attached">
            <span className="bl-document-icon" aria-hidden="true">📄</span>
            <span className="bl-document-name" title={fileName}>{fileName}</span>
            <div className="bl-document-actions">
              <button type="button" className="bl-document-btn" onClick={onViewBlDocument}>
                View
              </button>
              <button type="button" className="bl-document-btn" onClick={onDownloadBlDocument}>
                Download
              </button>
              {isEditable && canManageShipmentTracking && (
                <button
                  type="button"
                  className="bl-document-btn bl-document-btn--replace"
                  disabled={isUploadingBlDocument}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingBlDocument ? "Uploading…" : "Replace"}
                </button>
              )}
            </div>
          </div>
        ) : (
          canManageShipmentTracking && (
            <>
              <button
                type="button"
                className="bl-attach-btn"
                disabled={!isEditable || !canUploadBlDocument || isUploadingBlDocument}
                onClick={() => fileInputRef.current?.click()}
                title={!canUploadBlDocument ? "Save the invoice first" : "Attach the scanned Bill of Lading"}
              >
                {isUploadingBlDocument ? "Uploading…" : "📎 Attach Bill of Lading"}
              </button>
              <span className="bl-document-hint">
                Upload the scanned original (PDF or image) — the BL number (or, for a charter-party BL, the vessel
                name) above will be auto-filled from it.
              </span>
            </>
          )
        )}
      </div>

      {showBlRow && (
        <div className="bl-tracking-row">
          {isShipsgoTracked ? (
            <div className="bl-tracking-status">
              <span className={`bl-tracking-pill ${display?.tone || "mute"}`}>
                {display?.label || shipsgoStatus || "Tracking"}
              </span>
              <span className="bl-tracking-meta">
                {lastChecked ? ` · checked ${lastChecked}` : ""}
              </span>
              {canManageShipmentTracking && (
                <button
                  type="button"
                  className="bl-document-btn"
                  disabled={isTrackingShipment}
                  onClick={onSyncShipment}
                >
                  {isTrackingShipment ? "Refreshing…" : "Refresh"}
                </button>
              )}
              {isEditable && canManageShipmentTracking && (
                <button type="button" className="bl-document-btn bl-document-btn--replace" onClick={onUntrackShipment}>
                  Untrack
                </button>
              )}
            </div>
          ) : (
            canManageShipmentTracking && (
              <>
                <button
                  type="button"
                  className="bl-track-btn"
                  disabled={
                    !isEditable ||
                    !canTrackShipment ||
                    (trackingMode === "bl" ? !blNumber?.trim() : !containerNumber?.trim()) ||
                    isTrackingShipment
                  }
                  onClick={onTrackShipment}
                  title={
                    !canTrackShipment
                      ? "Save the invoice first"
                      : trackingMode === "bl"
                      ? !blNumber?.trim()
                        ? "Enter a BL number first"
                        : "Start tracking this shipment via ShipsGo"
                      : !containerNumber?.trim()
                      ? "Enter a container number first"
                      : "Start tracking this shipment via ShipsGo"
                  }
                >
                  {isTrackingShipment ? "Starting tracking…" : "Track Shipment"}
                </button>
                <span className="bl-tracking-hint">
                  Starts live tracking on the Shipment Tracking page and auto-updates this invoice's status as it
                  sails and arrives.
                </span>
              </>
            )
          )}
        </div>
      )}

      {showVesselRow && (
        <div className="vessel-tracking-row">
          {isVesselTracked ? (
            <div className="bl-tracking-status">
              <span className={`bl-tracking-pill ${navDisplay?.tone || "mute"}`}>
                {navDisplay?.label || "At sea"}
              </span>
              <span className="bl-tracking-meta">
                {vesselName}
                {vesselSpeedKnots != null ? ` · ${vesselSpeedKnots} kn` : ""}
                {vesselArrivedAtPort ? ` · arrived at ${vesselArrivedAtPort}` : ""}
                {vesselPositionAgo ? ` · position as of ${vesselPositionAgo}` : ""}
                {vesselLastChecked ? ` (checked ${vesselLastChecked})` : ""}
              </span>
              {isPositionStale && (
                <span className="bl-tracking-pill bad" title="VesselAPI's data for this vessel hasn't updated in over 24h — its feed may have stalled. Cross-check with vesselfinder.com if this matters right now.">
                  ⚠ Stale data
                </span>
              )}
              {canManageShipmentTracking && (
                <button
                  type="button"
                  className="bl-document-btn"
                  disabled={isTrackingVessel}
                  onClick={onSyncVessel}
                >
                  {isTrackingVessel ? "Refreshing…" : "Refresh"}
                </button>
              )}
              {isEditable && canManageShipmentTracking && (
                <button
                  type="button"
                  className="bl-document-btn bl-document-btn--replace"
                  disabled={isTrackingVessel}
                  onClick={onUntrackVessel}
                >
                  Untrack
                </button>
              )}
            </div>
          ) : (
            canManageShipmentTracking && (
              <>
                <button
                  type="button"
                  className="bl-track-btn"
                  disabled={!isEditable || !canTrackVessel || !vesselName?.trim() || isSearchingVessel}
                  onClick={onSearchVessel}
                  title={
                    !canTrackVessel
                      ? "Save the invoice first"
                      : !vesselName?.trim()
                      ? "Enter a vessel name first"
                      : "Search for this vessel and start AIS tracking"
                  }
                >
                  {isSearchingVessel ? "Searching…" : "Track Vessel"}
                </button>
              </>
            )
          )}
        </div>
      )}

      <div className="other-documents-section">
        <h5 className="other-documents-title">Other Documents</h5>
        <span className="bl-document-hint">
          Attach any other supporting files (packing list, invoice copy, certificate of origin, etc.) — these are
          just saved and stored, no data is read from them automatically.
        </span>

        <input
          ref={otherDocsInputRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx,.xls,.xlsx"
          onChange={handleOtherDocsChosen}
          hidden
        />

        {(otherDocuments || []).length > 0 && (
          <ul className="other-documents-list">
            {otherDocuments.map((doc) => (
              <li key={doc.id} className="other-document-item">
                <span className="bl-document-icon" aria-hidden="true">📄</span>
                <span className="bl-document-name" title={doc.originalFileName}>
                  {doc.originalFileName}
                </span>
                {doc.fileSize != null && (
                  <span className="other-document-size">{formatFileSize(doc.fileSize)}</span>
                )}
                <div className="bl-document-actions">
                  <button type="button" className="bl-document-btn" onClick={() => onViewOtherDocument?.(doc)}>
                    View
                  </button>
                  <button type="button" className="bl-document-btn" onClick={() => onDownloadOtherDocument?.(doc)}>
                    Download
                  </button>
                  {isEditable && (
                    <button
                      type="button"
                      className="bl-document-btn bl-document-btn--replace"
                      onClick={() => onDeleteOtherDocument?.(doc)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {isEditable && (
          <button
            type="button"
            className="bl-attach-btn"
            disabled={!canUploadOtherDocuments || isUploadingOtherDocuments}
            onClick={() => otherDocsInputRef.current?.click()}
            title={!canUploadOtherDocuments ? "Save the invoice first" : "Attach supporting documents"}
          >
            {isUploadingOtherDocuments ? "Uploading…" : "📎 Attach Documents"}
          </button>
        )}
      </div>

      {showVesselPicker && (
        <div className="vessel-picker-overlay" onClick={onCloseVesselPicker}>
          <div className="vessel-picker" onClick={(e) => e.stopPropagation()}>
            <div className="vessel-picker-header">
              <h5>Select the vessel</h5>
              <button type="button" className="vessel-picker-close" onClick={onCloseVesselPicker}>
                ×
              </button>
            </div>
            <p className="vessel-picker-hint">
              Vessel names aren't unique — pick the one matching this shipment.
            </p>
            <div className="vessel-picker-list">
              {(vesselSearchResults || []).map((v) => (
                <button
                  type="button"
                  key={`${v.imo || v.mmsi}-${v.name}`}
                  className="vessel-picker-item"
                  disabled={isTrackingVessel}
                  onClick={() => onConfirmVesselTracking(v)}
                >
                  <span className="vessel-picker-name">{v.name}</span>
                  <span className="vessel-picker-meta">
                    {v.vessel_type || "Vessel"}
                    {v.country ? ` · ${v.country}` : ""}
                    {v.imo ? ` · IMO ${v.imo}` : ""}
                    {!v.imo && v.mmsi ? ` · MMSI ${v.mmsi}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlternativeSummarySection;
