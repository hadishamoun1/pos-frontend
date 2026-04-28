import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { axiosClient } from "../api/axiosClient";
import { hasPerm } from "../auth/authz";
import "./ActivityMonitor.css";

const TAB_PERMS = {
  live:  "activity.liveStatus",
  log:   "activity.log",
  fraud: "activity.fraudAlerts",
};

const TODAY = new Date().toISOString().slice(0, 10);

function timeSince(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function actionClass(action) {
  const a = (action || "").toLowerCase();
  if (a === "login") return "login";
  if (a.includes("delete") || a.includes("void")) return "delete";
  if (a.includes("create")) return "create";
  if (a.includes("update") || a.includes("edit")) return "update";
  return "default";
}

function alertIcon(type) {
  if (type === "EXCESSIVE_DELETIONS") return "🗑️";
  if (type === "AFTER_HOURS_ACTIVITY") return "🌙";
  if (type === "BULK_OPERATIONS") return "⚡";
  return "⚠️";
}

// ─── Heartbeat: pings every 60 s while logged in ──────────────────────────
export function useHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (!sessionStorage.getItem("token")) return;
      axiosClient.post("/activity-log/heartbeat").catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, []);
}

// ══════════════════════════════════════════════════════════════════════════
export default function ActivityMonitor() {
  const navigate = useNavigate();

  // Resolve which tabs this user can see, and start on the first allowed one
  const allowedTabs = Object.entries(TAB_PERMS)
    .filter(([, perm]) => hasPerm(perm))
    .map(([key]) => key);

  const [tab, setTab] = useState(() => allowedTabs[0] ?? "live");

  // ── Live Status state ─────────────────────────────────────────────
  const [activeUsers, setActiveUsers] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);

  // ── Activity Log state ────────────────────────────────────────────
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPages, setLogPages] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [logLoading, setLogLoading] = useState(false);
  const [filterFrom, setFilterFrom] = useState(TODAY);
  const [filterTo, setFilterTo] = useState(TODAY);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [userOptions, setUserOptions] = useState([]);
  const [actionOptions, setActionOptions] = useState([]);

  // ── Fraud Alerts state ────────────────────────────────────────────
  const [alerts, setAlerts] = useState([]);
  const [alertLoading, setAlertLoading] = useState(false);

  // ─── Fetchers ──────────────────────────────────────────────────────
  const fetchActiveUsers = useCallback(async () => {
    setLiveLoading(true);
    try {
      const { data } = await axiosClient.get("/activity-log/active-users");
      setActiveUsers(data || []);
    } catch {
      setActiveUsers([]);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    setLogLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo)   params.set("to", filterTo);
      if (filterUser) params.set("userId", filterUser);
      if (filterAction) params.set("action", filterAction);
      const { data } = await axiosClient.get(`/activity-log?${params}`);
      setLogs(data.items || []);
      setLogTotal(data.total || 0);
      setLogPages(data.pages || 1);
      setLogPage(data.page || 1);
    } catch {
      setLogs([]);
    } finally {
      setLogLoading(false);
    }
  }, [filterFrom, filterTo, filterUser, filterAction]);

  const fetchAlerts = useCallback(async () => {
    setAlertLoading(true);
    try {
      const { data } = await axiosClient.get("/activity-log/fraud-alerts");
      setAlerts(data || []);
    } catch {
      setAlerts([]);
    } finally {
      setAlertLoading(false);
    }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [usersRes, actionRes] = await Promise.all([
        // Fetch all system users; fall back to users who have log entries
        axiosClient.get("/users").catch(() => axiosClient.get("/activity-log/users")),
        axiosClient.get("/activity-log/action-types"),
      ]);
      // /users returns [{id, username}], /activity-log/users returns [{userId, username}]
      const raw = usersRes.data || [];
      const normalized = raw.map((u) => ({
        userId: u.userId ?? u.id,
        username: u.username,
      }));
      setUserOptions(normalized);
      setActionOptions(actionRes.data || []);
    } catch {}
  }, []);

  // ─── Effects ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchActiveUsers();
    fetchMeta();
    const id = setInterval(fetchActiveUsers, 30_000);
    return () => clearInterval(id);
  }, [fetchActiveUsers, fetchMeta]);

  useEffect(() => {
    if (tab === "log") fetchLogs(1);
  }, [tab, fetchLogs]);

  // Auto-apply when user or action filter changes
  useEffect(() => {
    if (tab === "log") fetchLogs(1);
  }, [filterUser, filterAction]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "fraud") fetchAlerts();
  }, [tab, fetchAlerts]);

  const handleLogSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  // ─── Expanded rows ─────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRow = (id) =>
    setExpandedRows((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  // ─── Counts for badge ──────────────────────────────────────────────
  const highAlerts = alerts.filter((a) => a.severity === "high").length;

  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="am-page">
      {/* Header */}
      <div className="am-header">
        <div>
          <h1>Activity Monitor</h1>
          <div className="am-header-sub">Real-time employee activity tracking</div>
        </div>
        <button className="am-back-btn" onClick={() => navigate("/dashboard")}>
          ← Dashboard
        </button>
      </div>

      {/* Tabs */}
      <div className="am-tabs">
        {allowedTabs.includes("live") && (
          <button
            className={`am-tab ${tab === "live" ? "active" : ""}`}
            onClick={() => setTab("live")}
          >
            🟢 Live Status
            {activeUsers.filter((u) => u.status === "active").length > 0 && (
              <span className="am-tab-badge">
                {activeUsers.filter((u) => u.status === "active").length}
              </span>
            )}
          </button>
        )}
        {allowedTabs.includes("log") && (
          <button
            className={`am-tab ${tab === "log" ? "active" : ""}`}
            onClick={() => setTab("log")}
          >
            📋 Activity Log
          </button>
        )}
        {allowedTabs.includes("fraud") && (
          <button
            className={`am-tab ${tab === "fraud" ? "active" : ""}`}
            onClick={() => setTab("fraud")}
          >
            🚨 Fraud Alerts
            {highAlerts > 0 && (
              <span className="am-tab-badge">{highAlerts}</span>
            )}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="am-body">

        {allowedTabs.length === 0 && (
          <div className="am-no-users" style={{ paddingTop: 80 }}>
            You do not have permission to view any activity monitor tabs.
          </div>
        )}

        {/* ══ LIVE STATUS ══════════════════════════════════════════ */}
        {tab === "live" && allowedTabs.includes("live") && (
          <>
            <div className="am-live-header">
              <h2>
                Employee Status &nbsp;
                <span style={{ fontSize: 13, color: "#888", fontWeight: 400 }}>
                  (auto-refreshes every 30 s)
                </span>
              </h2>
              <button className="am-refresh-btn" onClick={fetchActiveUsers}>
                ↻ Refresh
              </button>
            </div>

            {liveLoading && <div className="am-loading">Loading…</div>}

            {!liveLoading && activeUsers.length === 0 && (
              <div className="am-no-users">
                No sessions detected yet. Users will appear here after their first heartbeat.
              </div>
            )}

            {!liveLoading && activeUsers.length > 0 && (
              <div className="am-user-grid">
                {activeUsers.map((u) => (
                  <div className="am-user-card" key={u.userId}>
                    <div
                      className="am-user-avatar"
                      style={{ background: avatarColor(u.username) }}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="am-user-name">{u.username}</div>
                    <div className="am-user-role">{u.role || "User"}</div>
                    <div className="am-status-row">
                      <span className={`am-dot ${u.status}`} />
                      <span className={`am-status-label ${u.status}`}>
                        {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                      </span>
                    </div>
                    <div className="am-last-seen">Last seen {timeSince(u.lastSeen)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ ACTIVITY LOG ══════════════════════════════════════════ */}
        {tab === "log" && allowedTabs.includes("log") && (
          <>
            <form className="am-log-toolbar" onSubmit={handleLogSearch}>
              <label>
                From
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  max={filterTo || undefined}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  min={filterFrom || undefined}
                />
              </label>
              <label>
                Employee
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  style={{ fontWeight: filterUser ? 600 : 400, borderColor: filterUser ? "#1a237e" : undefined }}
                >
                  <option value="">All employees</option>
                  {userOptions.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </label>
              {filterUser && (
                <button
                  type="button"
                  onClick={() => setFilterUser("")}
                  style={{ marginTop: 20, background: "none", border: "1px solid #d0d5dd", borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#666" }}
                >
                  ✕ Clear user
                </button>
              )}
              <label>
                Action
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                >
                  <option value="">All actions</option>
                  {actionOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="am-refresh-btn" style={{ marginTop: 20 }}>
                Search
              </button>
            </form>

            {logLoading && <div className="am-loading">Loading…</div>}

            {!logLoading && (
              <>
                <div
                  style={{ fontSize: 13, color: "#888", marginBottom: 12 }}
                >
                  {logTotal} record{logTotal !== 1 ? "s" : ""} found
                </div>

                <div className="am-table-wrap">
                  <table className="am-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Action</th>
                        <th>Entity</th>
                        <th>Description</th>
                        <th>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <div className="am-empty-log">
                              No activity found for the selected filters.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        logs.flatMap((log) => {
                          const changes = log.metadata?.changes;
                          const isOpen = expandedRows.has(log.id);
                          return [
                            <tr key={log.id}>
                              <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                                {formatTime(log.createdAt)}
                              </td>
                              <td style={{ fontSize: 12, color: "#888" }}>
                                {formatDate(log.createdAt)}
                              </td>
                              <td style={{ fontWeight: 600 }}>{log.username}</td>
                              <td>
                                <span className={`am-action-badge ${actionClass(log.action)}`}>
                                  {log.action}
                                </span>
                              </td>
                              <td style={{ color: "#666" }}>
                                {log.entityType
                                  ? `${log.entityType}${log.entityId ? ` #${log.entityId}` : ""}`
                                  : "—"}
                              </td>
                              <td style={{ color: "#555", maxWidth: 280 }}>
                                {log.description || "—"}
                                {changes && (
                                  <button
                                    className={`am-expand-btn${isOpen ? " open" : ""}`}
                                    onClick={() => toggleRow(log.id)}
                                  >
                                    {isOpen ? "▼" : "▶"} Details
                                  </button>
                                )}
                              </td>
                              <td style={{ fontSize: 11, color: "#aaa" }}>
                                {log.ipAddress || "—"}
                              </td>
                            </tr>,
                            isOpen && changes ? (
                              <tr key={`${log.id}-detail`} className="am-detail-row">
                                <td colSpan={7}>
                                  <ChangeDetail changes={changes} />
                                </td>
                              </tr>
                            ) : null,
                          ].filter(Boolean);
                        })
                      )}
                    </tbody>
                  </table>

                  {logPages > 1 && (
                    <div className="am-pagination">
                      <button
                        disabled={logPage <= 1}
                        onClick={() => fetchLogs(logPage - 1)}
                      >
                        ← Prev
                      </button>
                      <span>
                        Page {logPage} of {logPages}
                      </span>
                      <button
                        disabled={logPage >= logPages}
                        onClick={() => fetchLogs(logPage + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ══ FRAUD ALERTS ══════════════════════════════════════════ */}
        {tab === "fraud" && allowedTabs.includes("fraud") && (
          <>
            <div className="am-fraud-header">
              <h2>Fraud & Anomaly Alerts</h2>
              <span style={{ fontSize: 13, color: "#888" }}>
                Scanning the last 7 days
              </span>
              <button
                className="am-refresh-btn"
                style={{ marginLeft: "auto" }}
                onClick={fetchAlerts}
              >
                ↻ Refresh
              </button>
            </div>

            {alertLoading && <div className="am-loading">Analyzing…</div>}

            {!alertLoading && alerts.length === 0 && (
              <div className="am-no-alerts">
                ✅ No suspicious activity detected in the last 7 days.
              </div>
            )}

            {!alertLoading && alerts.length > 0 && (
              <div className="am-alert-list">
                {alerts.map((a, i) => (
                  <div key={i} className={`am-alert-card ${a.severity}`}>
                    <div className="am-alert-icon">{alertIcon(a.type)}</div>
                    <div className="am-alert-body">
                      <div className="am-alert-msg">{a.message}</div>
                      <div className="am-alert-meta">
                        {a.type.replace(/_/g, " ")}
                        {a.day ? ` · ${a.day}` : ""}
                        {a.createdAt
                          ? ` · ${formatDate(a.createdAt)} ${formatTime(a.createdAt)}`
                          : ""}
                      </div>
                    </div>
                    <span className={`am-severity-chip ${a.severity}`}>
                      {a.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────
const FIELD_LABELS = {
  sqm: "SQM", quantity: "Qty", unitPrice: "Price", totalAmount: "Total",
  length: "Length", width: "Width", sheetsPerBox: "Sheets/Box",
  date: "Date", invoiceType: "Type", customerId: "Customer",
  grandTotal: "Grand Total", discount: "Discount", notes: "Notes",
};
const fmtLabel = (f) => FIELD_LABELS[f] ?? f;
const fmtVal = (v) => (v == null ? "—" : String(v));

function ItemLine({ item }) {
  const thk = item.thickness != null ? ` ${item.thickness}mm` : "";
  const dims = [item.length, item.width].every((x) => x != null)
    ? ` · ${item.length}×${item.width}`
    : "";
  const box = item.sheetsPerBox != null ? ` · ${item.sheetsPerBox} sht/box` : "";
  return (
    <div className="am-detail-item">
      <strong>{item.name ?? `Batch #${item.batchId}`}</strong>
      {thk && <span className="am-item-meta">{thk}</span>}
      {dims && <span className="am-item-meta">{dims}</span>}
      {box && <span className="am-item-meta">{box}</span>}
      <span className="am-item-nums"> — qty: {fmtVal(item.quantity)}, sqm: {fmtVal(item.sqm)}, price: {fmtVal(item.unitPrice)}</span>
    </div>
  );
}

// ── Change Detail Panel ───────────────────────────────────────────────
function ChangeDetail({ changes }) {
  if (!changes) return null;

  // Invoice format: { header?: {...}, items?: { added, removed, modified } }
  const isStructured = changes.header !== undefined || changes.items !== undefined;

  if (isStructured) {
    const { header, items } = changes;
    return (
      <div className="am-detail-panel">
        {header && Object.keys(header).length > 0 && (
          <div className="am-detail-section">
            <div className="am-detail-section-title">Header changes</div>
            {Object.entries(header).map(([field, diff]) => (
              <div key={field} className="am-detail-field">
                <span className="am-detail-field-name">{fmtLabel(field)}</span>
                <span className="am-detail-from">{fmtVal(diff.from)}</span>
                <span className="am-detail-arrow">→</span>
                <span className="am-detail-to">{fmtVal(diff.to)}</span>
              </div>
            ))}
          </div>
        )}
        {items?.added?.length > 0 && (
          <div className="am-detail-section">
            <div className="am-detail-section-title added">Added ({items.added.length})</div>
            {items.added.map((item, i) => <ItemLine key={i} item={item} />)}
          </div>
        )}
        {items?.removed?.length > 0 && (
          <div className="am-detail-section">
            <div className="am-detail-section-title removed">Removed ({items.removed.length})</div>
            {items.removed.map((item, i) => <ItemLine key={i} item={item} />)}
          </div>
        )}
        {items?.modified?.length > 0 && (
          <div className="am-detail-section">
            <div className="am-detail-section-title modified">Modified ({items.modified.length})</div>
            {items.modified.map((item, i) => {
              const thk = item.thickness != null ? ` ${item.thickness}mm` : "";
              return (
                <div key={i} className="am-detail-item-modified">
                  <div className="am-detail-item-title">
                    {item.name ?? `Batch #${item.batchId}`}{thk && <span className="am-item-meta">{thk}</span>}
                  </div>
                  {Object.entries(item.changes).map(([field, diff]) => (
                    <div key={field} className="am-detail-field">
                      <span className="am-detail-field-name">{fmtLabel(field)}</span>
                      <span className="am-detail-from">{fmtVal(diff.from)}</span>
                      <span className="am-detail-arrow">→</span>
                      <span className="am-detail-to">{fmtVal(diff.to)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Flat diff format (receivables / purchase invoices)
  const entries = Object.entries(changes).filter(
    ([, v]) => v && typeof v === "object" && "from" in v
  );
  if (!entries.length) return null;

  return (
    <div className="am-detail-panel">
      <div className="am-detail-section">
        <div className="am-detail-section-title">Field changes</div>
        {entries.map(([field, diff]) => (
          <div key={field} className="am-detail-field">
            <span className="am-detail-field-name">{fmtLabel(field)}</span>
            <span className="am-detail-from">{fmtVal(diff.from)}</span>
            <span className="am-detail-arrow">→</span>
            <span className="am-detail-to">{fmtVal(diff.to)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Deterministic color from username string
function avatarColor(name) {
  const colors = [
    "#1a237e","#283593","#1565c0","#0277bd","#00695c",
    "#2e7d32","#558b2f","#e65100","#6a1b9a","#ad1457",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
