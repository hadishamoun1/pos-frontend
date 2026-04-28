import React, { useEffect, useMemo, useState } from "react";
import "./users.css";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

function getToken() {
  return sessionStorage.getItem("token");
}

// ✅ Group permissions into sections
const PERMISSION_GROUPS = [
  {
    title: "Dashboard Access Permissions",
    description: "Controls what the user can SEE in the dashboard (cards/pages).",
    perms: [
      "pos.view",
      "recievables.view",
      "inventory.view",
      "customers.view",
      "purchases.view",
      "settings.view",
      "suppliers.view",
      "items.view",
      "cost.view",
      "accounts.view",
      "payments.view",
      "transactions.view",
      "inventoryActivity.view",
      "reports.view",
      "sqm.view",
      "cuts.view",
      "viewing.view",
      "employeeFiles.view",
      "cashFlow.view",
      "activity.view",
    ],
  },
  {
    title: "Reports Permissions",
    description: "Controls access to specific reports within the Reports page.",
    perms: [
      "reports.view",
      "reports.trialBalance",
      "reports.accountStatement",
      "reports.costAnalysis",
      "reports.customerBalances",
      "reports.profitability",
    ],
  },
  {
    title: "Buttons / Actions Permissions",
    description: "Controls what the user can DO inside pages (create/update/delete).",
    perms: [
      "items.create",
      "items.update",
      "items.delete",
      "inventory.update",
      "invoices.view",
      "invoices.create",
      "invoices.update",
      "invoices.delete",
      "accounts.view",
      "accounts.create",
      "accounts.update",
      "accounts.delete",
      "inventoryCount.view",
      "inventoryCount.create",
      "inventoryCount.update",
      "inventoryCount.delete",
      "inventoryCount.rebuild",
      "currency.view",
      "currency.manage",
      "customers.view",
      "customers.create",
      "inventoryAudit.view",
      "inventoryAudit.fix",
      "inventoryTx.view",
      "inventoryTx.create",
      "inventoryTx.delete",
      "invoices.view",
      "invoices.create",
      "invoices.update",
      "invoices.return",
      "itemsDesc.view",
      "itemsDesc.manage",
      "realDesc.view",
      "realDesc.manage",
      "items.view",
      "items.create",
      "items.update",
      "items.delete",
      "inventory.update",
      "journal.view",
      "journal.create",
      "journal.update",
      "journal.delete",
      "purchases.view",
      "purchases.create",
      "purchases.update",
      "purchaseSettings.view",
      "purchaseSettings.update",
      "recompute.run",
      "reports.view",
      "requests.view",
      "requests.create",
      "requests.update",
      "settings.view",
      "settings.update",
      "suppliers.view",
      "suppliers.create",
      "suppliers.delete",
      "transfers.view",
      "transfers.create",
      "transfers.update",
      "transfers.delete",
      "cuts.view",
      "inventory.view",
      "settings.accountRoles",
      "settings.general",
      "settings.invoice",
      "settings.permissions",
      "settings.purchaseInvoice",
      "settings.itemBatches",
      "settings.descriptionsReal",
      "settings.descriptionsItemName",
      "settings.variantRelinker",
      "settings.editDescriptions",
      "settings.fiscalYear",
      "settings.currency",
      "settings.invoiceDisplay",
      "settings.stockTotalsAudit",
      "settings.inventoryAudit",
      "settings.logoutUsers",
      "settings.invoiceAudit",
      "settings.company", // ✅ NEW
      "pos.search.stockTab",
      "pos.search.allTab",
      "pos.search.sqmTab",
      "pos.rvr",
      "pos.return",
      "invoice.showVatZero",
      "recievables.create",
      "recievables.update",
      "recievables.delete",
      "customers.update",
      "sqm.update",
      "cashFlow.create",
      "cashFlow.delete",
      "cashFlow.print",
      "cashFlow.viewAny",
      "users.list",
      "payments.view",
    "payments.create",
    "payments.update",
    "payments.delete",
    ],
  },
  {
    title: "Activity Monitor Permissions",
    description: "Controls access to the Activity Monitor page and its individual tabs.",
    perms: [
      "activity.view",
      "activity.liveStatus",
      "activity.log",
      "activity.fraudAlerts",
    ],
  },
  {
    title: "Admin Permissions",
    description: "Only admins should have these.",
    perms: ["users.manage"],
  },
];

function uniqueSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [role, setRole] = useState("USER");
  const [perms, setPerms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedId) || null,
    [users, selectedId]
  );

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
      throw new Error(msg);
    }
    return data;
  }

  async function loadUsers() {
    setErr("");
    setLoading(true);
    try {
      const data = await api("/users", { method: "GET" });
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (e) {
      setErr(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setRole(selectedUser.role || "USER");
    setPerms(Array.isArray(selectedUser.permissions) ? selectedUser.permissions : []);
  }, [selectedUser]);

  function togglePerm(p) {
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function clearGroup(groupPerms) {
    setPerms((prev) => prev.filter((p) => !groupPerms.includes(p)));
  }

  function selectAllGroup(groupPerms) {
    setPerms((prev) => uniqueSorted([...prev, ...groupPerms]));
  }

  async function save() {
    if (!selectedUser) return;
    setErr("");
    setSaving(true);
    try {
      await api(`/users/${selectedUser.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

      const updated = await api(`/users/${selectedUser.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: uniqueSorted(perms) }),
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, ...updated } : u))
      );
    } catch (e) {
      setErr(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <h2>Users & Permissions</h2>
        <button onClick={loadUsers} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {err ? <div className="users-error">{err}</div> : null}

      <div className="users-layout">
        {/* Left list */}
        <div className="users-list">
          <div className="users-list-title">Users</div>

          {users.map((u) => (
            <button
              key={u.id}
              className={`users-list-item ${u.id === selectedId ? "active" : ""}`}
              onClick={() => setSelectedId(u.id)}
            >
              <div className="users-list-name">{u.username}</div>
              <div className="users-list-meta">
                #{u.id} • {u.role}
              </div>
            </button>
          ))}

          {!users.length && !loading ? <div className="users-empty">No users</div> : null}
        </div>

        {/* Right editor */}
        <div className="users-editor">
          {!selectedUser ? (
            <div className="users-empty">Select a user</div>
          ) : (
            <>
              <div className="users-editor-title">
                Editing: <b>{selectedUser.username}</b>
              </div>

              <div className="users-row">
                <label className="users-label">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="CASHIER">CASHIER</option>
                </select>
              </div>

              {/* Permission sections */}
              <div className="users-perms">
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g.title} className="perm-section">
                    <div className="perm-section-head">
                      <div>
                        <div className="perm-section-title">{g.title}</div>
                        <div className="perm-section-desc">{g.description}</div>
                      </div>

                      <div className="perm-section-actions">
                        <button
                          type="button"
                          className="perm-mini-btn"
                          onClick={() => selectAllGroup(g.perms)}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="perm-mini-btn"
                          onClick={() => clearGroup(g.perms)}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="users-perms-grid">
                      {g.perms.map((p) => (
                        <label key={p} className="users-perm">
                          <input
                            type="checkbox"
                            checked={perms.includes(p)}
                            onChange={() => togglePerm(p)}
                          />
                          <span>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="users-actions">
                <button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>

              <div className="users-note">
                Note: users must logout/login again to receive updated permissions in their JWT.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}