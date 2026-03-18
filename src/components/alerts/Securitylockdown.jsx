import { useEffect, useState } from "react";
import "./Securitylockdown.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

export default function SecurityLockdown() {
  const [incidentId, setIncidentId] = useState("INC-LOADING");

  useEffect(() => {
    const fetchIncident = async () => {
      try {
        const res = await fetch(`${API_URL}/security-alert`);
        const data = await res.json();
        const ts = new Date(data.updatedAt).getTime().toString(36).toUpperCase().slice(-8);
        setIncidentId(`INC-${ts}`);
      } catch (e) {
        setIncidentId("INC-" + Date.now().toString(36).toUpperCase().slice(-8));
      }
    };
    fetchIncident();
  }, []);

  return (
    <div className="lockdown-page">
      <div className="lockdown-card">

        <div className="lockdown-icon-wrap">
          <svg className="lockdown-icon-svg" width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 className="lockdown-title">System Locked</h1>

        <p className="lockdown-desc">
          A security attack was detected. Your system has been locked immediately
          to protect your data. Do not attempt to restart any terminals.
        </p>

        <div className="lockdown-divider" />

        <div className="lockdown-info-grid">
          <div className="lockdown-info-item">
            <span className="lockdown-info-label">Incident ID</span>
            <span className="lockdown-info-value">{incidentId}</span>
          </div>
          <div className="lockdown-info-item">
            <span className="lockdown-info-label">Status</span>
            <span className="lockdown-status-badge">
              <span className="lockdown-status-dot" />
              Locked
            </span>
          </div>
        </div>

        <div className="lockdown-divider" />

        <div className="lockdown-contact">
          <span className="lockdown-contact-label">PLEASE REACH OUT TO ADMINISTRATOR</span>
      
        </div>

      </div>
    </div>
  );
}