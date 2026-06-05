import { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./Securitylockdownsettings.css";

const PosControlsSettings = () => {
  const [controls, setControls] = useState({ blockCreation: false, blockViewing: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axiosClient
      .get("/pos-controls")
      .then((res) => setControls(res.data ?? {}))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (field) => {
    setSaving(true);
    try {
      const res = await axiosClient.patch("/pos-controls", {
        [field]: !controls[field],
      });
      setControls(res.data ?? {});
    } catch (e) {
      console.error("Failed to update POS controls:", e);
    } finally {
      setSaving(false);
    }
  };

  const bothOff = !controls.blockCreation && !controls.blockViewing;
  const bothOn  =  controls.blockCreation &&  controls.blockViewing;

  const statusLabel = bothOn
    ? "Creation & Viewing Blocked"
    : controls.blockCreation
    ? "Creation Blocked"
    : controls.blockViewing
    ? "Viewing Hidden"
    : "All Access Enabled";

  const statusDesc = bothOff
    ? "Users can create and view invoices and requests normally."
    : "Some POS functions are currently restricted for all users.";

  if (loading) return <div className="sls-loading">Loading...</div>;

  return (
    <div className="sls-page">

      <div className="sls-header">
        <h2 className="sls-title">POS Access Controls</h2>
        <p className="sls-subtitle">
          Control whether users can create or view invoices and requests in the POS screen.
          Changes take effect immediately for all active sessions.
        </p>
      </div>

      {/* Status card */}
      <div className={`sls-status-card ${!bothOff ? "sls-status-card-active" : "sls-status-card-inactive"}`}>
        <div className="sls-status-left">
          <span className="sls-status-dot" />
          <div className="sls-status-text">
            <span className="sls-status-label">{statusLabel}</span>
            <span className="sls-status-desc">{statusDesc}</span>
          </div>
        </div>
      </div>

      {/* Toggle 1 — Block Creation */}
      <div className="sls-toggle-row">
        <div className="sls-toggle-text">
          <span className="sls-toggle-label">Block Invoice &amp; Request Creation</span>
          <span className="sls-toggle-hint">
            When ON, any attempt to create a new invoice or request will be rejected with an error.
          </span>
        </div>
        <button
          className={`sls-toggle ${controls.blockCreation ? "sls-toggle-on" : "sls-toggle-off"}`}
          onClick={() => toggle("blockCreation")}
          disabled={saving}
        >
          <span className="sls-toggle-knob" />
        </button>
      </div>

      {/* Toggle 2 — Block Viewing */}
      <div className="sls-toggle-row">
        <div className="sls-toggle-text">
          <span className="sls-toggle-label">Hide Invoice &amp; Request Lists</span>
          <span className="sls-toggle-hint">
            When ON, the invoices panel and requests panel are hidden from the POS screen.
          </span>
        </div>
        <button
          className={`sls-toggle ${controls.blockViewing ? "sls-toggle-on" : "sls-toggle-off"}`}
          onClick={() => toggle("blockViewing")}
          disabled={saving}
        >
          <span className="sls-toggle-knob" />
        </button>
      </div>

      <div className="sls-info-box">
        <span className="sls-info-icon">ℹ</span>
        <p className="sls-info-text">
          Only users with the <strong>settings.posControls</strong> permission can change these settings.
          All other authenticated users are affected by them immediately.
        </p>
      </div>

    </div>
  );
};

export default PosControlsSettings;
