import { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./Securitylockdownsettings.css";

const SecurityLockdownSettings = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await axiosClient.get("/security-alert");
        setEnabled(res.data.isActive === true);
      } catch (e) {
        console.error("Failed to fetch security alert status:", e);
      } finally {
        setLoading(false);
      }
    };
    loadStatus();
  }, []);

  const save = async (value) => {
    setSaving(true);
    setConfirm(false);
    try {
      const endpoint = value ? "enable" : "disable";
      const res = await axiosClient.patch(`/security-alert/${endpoint}`);
      setEnabled(res.data.isActive === true);
    } catch (e) {
      console.error("Failed to update security alert:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="sls-loading">Loading...</div>;

  return (
    <div className="sls-page">

      {confirm && (
        <div className="sls-overlay">
          <div className="sls-modal">
            <div className="sls-modal-icon">⚠</div>
            <h3 className="sls-modal-title">Enable Security Lockdown?</h3>
            <p className="sls-modal-desc">
              This will immediately block all users from accessing any page and
              display a security alert screen. Only an admin can disable it from here.
            </p>
            <div className="sls-modal-actions">
              <button className="sls-btn-cancel" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="sls-btn-confirm" onClick={() => save(true)}>
                Yes, Lock System
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sls-header">
        <h2 className="sls-title">Security Lockdown</h2>
        <p className="sls-subtitle">
          Instantly block all users from accessing the system and display a
          security alert screen. Use this when an attack is detected.
        </p>
      </div>

      <div className={`sls-status-card ${enabled ? "sls-status-card-active" : "sls-status-card-inactive"}`}>
        <div className="sls-status-left">
          <span className="sls-status-dot" />
          <div className="sls-status-text">
            <span className="sls-status-label">
              {enabled ? "Lockdown Active" : "System Operating Normally"}
            </span>
            <span className="sls-status-desc">
              {enabled
                ? "All non-admin users are currently blocked."
                : "No lockdown is in effect. All users can access the system."}
            </span>
          </div>
        </div>
      </div>

      <div className="sls-toggle-row">
        <div className="sls-toggle-text">
          <span className="sls-toggle-label">Enable Security Lockdown</span>
          <span className="sls-toggle-hint">
            Turning this on will immediately affect all active sessions within 5 seconds.
          </span>
        </div>
        <button
          className={`sls-toggle ${enabled ? "sls-toggle-on" : "sls-toggle-off"}`}
          onClick={() => (enabled ? save(false) : setConfirm(true))}
          disabled={saving}
        >
          <span className="sls-toggle-knob" />
        </button>
      </div>

      <div className="sls-info-box">
        <span className="sls-info-icon">ℹ</span>
        <p className="sls-info-text">
          All connected users are checked every 5 seconds. When lockdown is enabled,
          non-admin users will see the security alert screen within 5 seconds and
          cannot navigate anywhere. Admins remain unaffected and can disable it here.
        </p>
      </div>

    </div>
  );
};

export default SecurityLockdownSettings;