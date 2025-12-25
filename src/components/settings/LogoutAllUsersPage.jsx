import React, { useEffect, useMemo, useState } from "react";
import "./styles/logoutAllUsers.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

function getToken() {
  return sessionStorage.getItem("token");
}

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      (Array.isArray(data?.message) ? data.message.join(", ") : data?.message) ||
      `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ✅ public (no token) api helper for /auth/state
async function publicApi(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function LogoutAllUsersPage() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [err, setErr] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);

  // ✅ global logout state
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [logoutAllResult, setLogoutAllResult] = useState(null);

  // ✅ per-user logout state
  const [selectedIds, setSelectedIds] = useState([]);
  const [loggingOutSelected, setLoggingOutSelected] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  // ✅ lock state
  const [stateLoading, setStateLoading] = useState(false);
  const [authState, setAuthState] = useState(null); // { isLocked, lockAllowedUserId, globalTokenVersion }
  const [lockAllowedUserId, setLockAllowedUserId] = useState(null);

  // once you run logout-all OR lock, your token becomes invalid (because gver increments)
  const [tokenInvalidNow, setTokenInvalidNow] = useState(false);

  const usersCount = useMemo(() => (Array.isArray(users) ? users.length : 0), [users]);

  const selectedCount = selectedIds.length;

  async function loadUsers() {
    setErr("");
    setLoadingUsers(true);
    try {
      const data = await api("/users", { method: "GET" });
      const list = Array.isArray(data) ? data : [];
      setUsers(list);

      // if lockAllowedUserId is not chosen, default it to current lock state if exists
      if (lockAllowedUserId == null && authState?.lockAllowedUserId != null) {
        setLockAllowedUserId(authState.lockAllowedUserId);
      }
    } catch (e) {
      setErr(e?.message || "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadAuthState() {
    setStateLoading(true);
    try {
      const r = await publicApi("/auth/state");
      if (r.ok) {
        setAuthState(r.data);
        // keep dropdown in sync with backend lockAllowedUserId
        if (r.data?.lockAllowedUserId != null) {
          setLockAllowedUserId(r.data.lockAllowedUserId);
        }
      }
    } finally {
      setStateLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    loadAuthState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Logout ALL users
  async function logoutAllNow() {
    setErr("");
    setConfirmOpen(false);
    setLoggingOutAll(true);
    setLogoutAllResult(null);

    try {
      const res = await api("/auth/logout-all", { method: "POST", body: "{}" });

      setLogoutAllResult({
        ...res,
        at: new Date().toISOString(),
      });

      // token invalid now
      setTokenInvalidNow(true);
    } catch (e) {
      setErr(e?.message || "Failed to logout all users");
    } finally {
      setLoggingOutAll(false);
    }
  }

  // ✅ Logout ONE user
  async function logoutOne(userId) {
    setErr("");
    setSelectedResult(null);

    const username = users.find((u) => u.id === userId)?.username || String(userId);

    try {
      const res = await api("/auth/logout-user", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });

      setSelectedResult({
        at: new Date().toISOString(),
        total: 1,
        successCount: 1,
        failCount: 0,
        results: [
          {
            userId,
            username,
            ok: true,
            message: "Logged out (token invalidated)",
            tokenVersion: res?.tokenVersion,
          },
        ],
      });
    } catch (e) {
      setSelectedResult({
        at: new Date().toISOString(),
        total: 1,
        successCount: 0,
        failCount: 1,
        results: [
          {
            userId,
            username,
            ok: false,
            message: e?.message || "Failed",
          },
        ],
      });
    }
  }

  // ✅ Logout selected users (multi)
  async function logoutSelected() {
    if (!selectedIds.length) return;

    setErr("");
    setLoggingOutSelected(true);
    setSelectedResult(null);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const userId of selectedIds) {
      const username = users.find((u) => u.id === userId)?.username || String(userId);

      try {
        const res = await api("/auth/logout-user", {
          method: "POST",
          body: JSON.stringify({ userId }),
        });

        successCount += 1;
        results.push({
          userId,
          username,
          ok: true,
          message: "Logged out (token invalidated)",
          tokenVersion: res?.tokenVersion,
        });
      } catch (e) {
        failCount += 1;
        results.push({
          userId,
          username,
          ok: false,
          message: e?.message || "Failed",
        });
      }
    }

    setSelectedResult({
      at: new Date().toISOString(),
      total: selectedIds.length,
      successCount,
      failCount,
      results,
    });

    setLoggingOutSelected(false);
  }

  function goToLoginAndClear() {
    sessionStorage.removeItem("token");
    window.location.href = "/login";
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function selectAll() {
    setSelectedIds(users.map((u) => u.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  // ✅ LOCK (maintenance mode)
  async function lockSystemNow() {
    setErr("");
    setStateLoading(true);

    try {
      // if not selected, fallback to current locked allowed id, else first admin, else first user
      const fallback =
        authState?.lockAllowedUserId ??
        users.find((u) => u.role === "ADMIN")?.id ??
        users[0]?.id;

      const allowedUserIdFinal = Number(lockAllowedUserId ?? fallback);

      const res = await api("/auth/lock", {
        method: "POST",
        body: JSON.stringify({ allowedUserId: allowedUserIdFinal }),
      });

      // token invalid now because lock increments globalTokenVersion
      setTokenInvalidNow(true);

      // refresh public state
      await loadAuthState();

      // show something similar to logout result
      setLogoutAllResult({
        success: true,
        globalTokenVersion: res?.globalTokenVersion,
        at: new Date().toISOString(),
      });
    } catch (e) {
      setErr(e?.message || "Failed to lock system");
    } finally {
      setStateLoading(false);
    }
  }

  // ✅ UNLOCK
  async function unlockSystemNow() {
    setErr("");
    setStateLoading(true);

    try {
      await api("/auth/unlock", { method: "POST", body: "{}" });
      await loadAuthState();
    } catch (e) {
      setErr(e?.message || "Failed to unlock system");
    } finally {
      setStateLoading(false);
    }
  }

  return (
    <div className="logout-all-users-page">
      <div className="lau-header">
        <div>
          <h2>Sessions Admin</h2>
          <div className="lau-sub">
            Logout all users, logout selected users, and lock/unlock the system.
          </div>
        </div>

        <div className="lau-header-actions">
          <button
            className="lau-btn"
            onClick={loadUsers}
            disabled={loadingUsers || tokenInvalidNow}
            title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
          >
            {loadingUsers ? "Refreshing..." : "Refresh Users"}
          </button>

          <button
            className="lau-btn"
            onClick={selectAll}
            disabled={tokenInvalidNow || !users.length}
            title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
          >
            Select All
          </button>

          <button
            className="lau-btn"
            onClick={clearSelection}
            disabled={tokenInvalidNow || !selectedCount}
            title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
          >
            Clear Selection
          </button>

          <button
            className="lau-btn lau-danger"
            onClick={() => setConfirmOpen(true)}
            disabled={loggingOutAll}
          >
            {loggingOutAll ? "Logging out ALL..." : "Logout ALL Users"}
          </button>
        </div>
      </div>

      {err ? <div className="lau-error">{err}</div> : null}

      {/* ✅ Lock / Unlock Panel */}
      <div className="lau-panel">
        <div className="lau-panel-title">System Lock (Maintenance Mode)</div>

        <div className="lau-panel-body">
          <div className="lau-kv">
            <div className="lau-k">Status</div>
            <div className="lau-v">
              {stateLoading ? (
                <span className="lau-muted">Loading...</span>
              ) : authState?.isLocked ? (
                <span className="lau-pill lau-pill-bad">LOCKED</span>
              ) : (
                <span className="lau-pill lau-pill-ok">UNLOCKED</span>
              )}
            </div>
          </div>

          <div className="lau-kv">
            <div className="lau-k">Allowed User</div>
            <div className="lau-v">
              {authState?.lockAllowedUserId != null
                ? `#${authState.lockAllowedUserId}`
                : "-"}
            </div>
          </div>

          <div className="lau-note">
            When LOCKED: only the allowed user can login. Everyone else is blocked and should see <b>/maintenance</b>.
          </div>

          <div className="lau-row" style={{ marginTop: 10 }}>
            <div className="lau-k" style={{ width: 160 }}>Lock Allowed User</div>
            <select
              className="lau-input"
              value={lockAllowedUserId ?? ""}
              onChange={(e) => setLockAllowedUserId(e.target.value ? Number(e.target.value) : null)}
              disabled={tokenInvalidNow || stateLoading || !users.length}
              style={{ flex: 1 }}
              title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
            >
              <option value="">(choose user)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  #{u.id} - {u.username} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="lau-divider" />

          <div className="lau-inline-actions">
            <button className="lau-btn" onClick={loadAuthState} disabled={stateLoading}>
              Refresh Status
            </button>

            <button
              className="lau-btn lau-danger"
              onClick={lockSystemNow}
              disabled={tokenInvalidNow || stateLoading}
              title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
            >
              Lock System
            </button>

            <button
              className="lau-btn"
              onClick={unlockSystemNow}
              disabled={tokenInvalidNow || stateLoading}
              title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
            >
              Unlock System
            </button>

            {tokenInvalidNow ? (
              <button className="lau-btn" onClick={goToLoginAndClear}>
                Go to Login
              </button>
            ) : null}
          </div>

          <div className="lau-note" style={{ marginTop: 10 }}>
            If you lock or logout-all, your token becomes invalid too — you must login again.
          </div>
        </div>
      </div>

      {/* ✅ Global Logout Result */}
      <div className="lau-panel">
        <div className="lau-panel-title">Global Logout</div>

        {!logoutAllResult ? (
          <div className="lau-panel-body">
            <div className="lau-muted">
              Click <b>Logout ALL Users</b> to invalidate everyone’s JWT (including you).
            </div>
          </div>
        ) : (
          <div className="lau-panel-body">
            <div className="lau-kv">
              <div className="lau-k">Status</div>
              <div className="lau-v">
                <span className="lau-pill lau-pill-ok">SUCCESS</span>
              </div>
            </div>

            <div className="lau-kv">
              <div className="lau-k">Issued At</div>
              <div className="lau-v">{logoutAllResult.at}</div>
            </div>

            <div className="lau-kv">
              <div className="lau-k">Users affected</div>
              <div className="lau-v">{usersCount} (all users)</div>
            </div>

            <div className="lau-divider" />

            <div className="lau-note">
              Your current session token is now invalid too.
            </div>

            <button className="lau-btn" onClick={goToLoginAndClear}>
              Go to Login
            </button>
          </div>
        )}
      </div>

      {/* ✅ Selected Logout Panel */}
      <div className="lau-panel">
        <div className="lau-panel-title">Logout Selected Users</div>

        <div className="lau-panel-body">
          <div className="lau-kv">
            <div className="lau-k">Selected</div>
            <div className="lau-v">{selectedCount}</div>
          </div>

          <div className="lau-note">
            This invalidates ONLY the selected users’ tokens (per-user tokenVersion).
          </div>

          <div className="lau-inline-actions">
            <button
              className="lau-btn lau-danger"
              onClick={logoutSelected}
              disabled={!selectedCount || loggingOutSelected || tokenInvalidNow}
              title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
            >
              {loggingOutSelected ? "Logging out..." : "Logout Selected"}
            </button>
          </div>

          {selectedResult ? (
            <>
              <div className="lau-divider" />

              <div className="lau-kv">
                <div className="lau-k">Run At</div>
                <div className="lau-v">{selectedResult.at}</div>
              </div>

              <div className="lau-kv">
                <div className="lau-k">Success</div>
                <div className="lau-v">
                  <span className="lau-pill lau-pill-ok">{selectedResult.successCount}</span>
                </div>
              </div>

              <div className="lau-kv">
                <div className="lau-k">Failed</div>
                <div className="lau-v">
                  <span className="lau-pill lau-pill-bad">{selectedResult.failCount}</span>
                </div>
              </div>

              <div className="lau-results">
                {selectedResult.results.map((r) => (
                  <div key={r.userId} className={`lau-result-row ${r.ok ? "ok" : "bad"}`}>
                    <div className="lau-result-main">
                      <b>{r.username}</b> <span className="lau-muted">#{r.userId}</span>
                      {r.ok && r.tokenVersion != null ? (
                        <span className="lau-muted"> • tokenVersion: {r.tokenVersion}</span>
                      ) : null}
                    </div>
                    <div className="lau-result-msg">{r.message}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ✅ Users list */}
      <div className="lau-table-wrap">
        <div className="lau-table-title">Users ({usersCount})</div>

        <table className="lau-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Sel</th>
              <th style={{ width: 80 }}>ID</th>
              <th>Username</th>
              <th style={{ width: 140 }}>Role</th>
              <th style={{ width: 180 }}>Actions</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    disabled={tokenInvalidNow}
                    title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
                  />
                </td>
                <td>#{u.id}</td>
                <td>{u.username}</td>
                <td>
                  <span className="lau-role">{u.role}</span>
                </td>
                <td>
                  <button
                    className="lau-btn lau-mini lau-danger"
                    onClick={() => logoutOne(u.id)}
                    disabled={tokenInvalidNow}
                    title={tokenInvalidNow ? "Token invalid now. Login again." : ""}
                  >
                    Logout user
                  </button>
                </td>
                <td className="lau-perms">{(u.permissions || []).join(", ")}</td>
              </tr>
            ))}

            {!users.length && !loadingUsers ? (
              <tr>
                <td colSpan={6} className="lau-empty">
                  No users to show
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* ✅ Confirm modal */}
      {confirmOpen && (
        <div className="lau-modal-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="lau-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lau-modal-title">Logout ALL Users?</div>
            <div className="lau-modal-text">
              This will invalidate every existing token. Everyone (including you) will need to login again.
            </div>

            <div className="lau-modal-actions">
              <button className="lau-btn" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button className="lau-btn lau-danger" onClick={logoutAllNow}>
                Yes, logout everyone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
