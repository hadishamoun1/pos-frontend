import React, { useEffect, useState } from "react";
import "./styles/maintenance.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

async function apiState() {
  const res = await fetch(`${API_BASE}/auth/state`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function MaintenanceModePage() {
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  async function load() {
    setLoading(true);
    const r = await apiState();

    // Safe default: if state endpoint fails, assume locked
    if (!r.ok) {
      setIsLocked(true);
      setLoading(false);
      return;
    }

    setIsLocked(!!r.data?.isLocked);
    setLoading(false);

    // If system is NOT locked anymore, return to login
    if (r.data && !r.data.isLocked) {
      window.location.href = "/";
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => {
      load();
      setPulseKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="maint-wrap">
      <div className="maint-bg">
        <div className="maint-orb maint-orb-a" />
        <div className="maint-orb maint-orb-b" />
        <div className="maint-orb maint-orb-c" />
      </div>

      <div className="maint-card">
        <div className="maint-top">
          <div className="maint-icon" aria-hidden>
            <div className="maint-gear" />
            <div className="maint-gear small" />
          </div>

          <div className="maint-head">
            <div className="maint-badge">
              <span className={`dot ${loading ? "dot-warn" : isLocked ? "dot-warn" : "dot-ok"}`} />
              {loading ? "Checking..." : isLocked ? "Maintenance" : "Online"}
            </div>
            <h2>System Maintenance</h2>
            <p className="maint-sub">
              {loading
                ? "We’re checking the system status…"
                : isLocked
                ? "We’re doing a quick upgrade to keep things fast and reliable."
                : "Maintenance is off. You can continue to login normally."}
            </p>
          </div>
        </div>

        <div className="maint-body">
          {loading ? (
            <div className="maint-skel">
              <div className="sk-line w-80" />
              <div className="sk-line w-65" />
              <div className="sk-line w-55" />
            </div>
          ) : isLocked ? (
            <>
              <div className="maint-panel" key={pulseKey}>
                <div className="maint-panel-title">Temporarily unavailable</div>
                <div className="maint-panel-text">
                  Please try again in a few minutes.
                </div>
              </div>

              <div className="maint-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => (window.location.href = "/?admin=1")}
                >
                  Login
                </button>

                <button className="btn btn-ghost" onClick={load}>
                  Refresh
                </button>
              </div>

              <div className="maint-foot">
                Status auto-refreshes every <b>3 seconds</b>.
              </div>
            </>
          ) : (
            <>
              <div className="maint-panel ok">
                <div className="maint-panel-title">Maintenance is OFF</div>
                <div className="maint-panel-text">You can login normally.</div>
              </div>

              <div className="maint-actions">
                <button className="btn btn-primary" onClick={() => (window.location.href = "/")}>
                  Go to Login
                </button>
                <button className="btn btn-ghost" onClick={load}>
                  Refresh
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="maint-credit">POS System • Secure Session Mode</div>
    </div>
  );
}
