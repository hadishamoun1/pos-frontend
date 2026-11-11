// src/components/settings/PurchaseStatusAccess.jsx
// Choose which non-admin users may set a purchase invoice to Shipped or
// Recieved by hand (normally set by shipment tracking). Admins always can.
import React, { useEffect, useMemo, useState } from "react";
import { axiosClient } from "../api/axiosClient";

export default function PurchaseStatusAccess() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null); // `${userId}:${field}`
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    axiosClient
      .get("/purchase-invoices/status-access/users")
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch((e) => setError(e?.response?.data?.message || "Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (user, field) => {
    const key = `${user.id}:${field}`;
    setSavingKey(key);
    setError("");
    try {
      const { data } = await axiosClient.put(`/purchase-invoices/status-access/users/${user.id}`, {
        [field]: !user[field],
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...data } : u)));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save.");
    } finally {
      setSavingKey(null);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => String(u.username || "").toLowerCase().includes(q));
  }, [users, search]);

  const counts = useMemo(
    () => ({
      shipped: users.filter((u) => u.shipped).length,
      received: users.filter((u) => u.received).length,
    }),
    [users]
  );

  return (
    <div className="psa">
      <h2 className="psa__title">Purchase Status Access</h2>
      <p className="psa__subtitle">
        Shipped and Recieved are normally set automatically by shipment tracking. Users ticked here can also set
        them by hand on a purchase invoice (Edit → Status). Admins can always do both. Setting{" "}
        <b>Recieved</b> books the stock and journal entries, so grant it with care. Changes apply immediately.
      </p>

      {error && <div className="psa__error">{error}</div>}

      <div className="psa__bar">
        <input
          className="psa__search"
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="psa__count">
          Shipped: <b>{counts.shipped}</b> · Recieved: <b>{counts.received}</b>
        </span>
      </div>

      {loading ? (
        <div className="psa__empty">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="psa__empty">{users.length ? "No users match your search." : "No non-admin users."}</div>
      ) : (
        <table className="psa__table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th className="psa__center">Ordered → Shipped</th>
              <th className="psa__center">→ Recieved</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id}>
                <td className="psa__name">{u.username}</td>
                <td className="psa__role">{u.role}</td>
                {["shipped", "received"].map((field) => (
                  <td key={field} className="psa__center">
                    <button
                      className={`psa__toggle ${u[field] ? "psa__toggle--on" : ""}`}
                      onClick={() => toggle(u, field)}
                      disabled={savingKey === `${u.id}:${field}`}
                      aria-pressed={!!u[field]}
                      title={u[field] ? "Allowed — click to remove" : "Not allowed — click to allow"}
                    >
                      <span className="psa__knob" />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <style>{`
        .psa { max-width: 760px; padding: 24px; font-family: Arial, sans-serif; color: #0f172a; }
        .psa__title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
        .psa__subtitle { font-size: 13px; color: #475569; line-height: 1.5; margin: 0 0 18px; }
        .psa__error { background: #fee2e2; color: #dc2626; padding: 8px 12px; border-radius: 6px; margin-bottom: 14px; font-size: 13px; }
        .psa__bar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
        .psa__search { flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; }
        .psa__search:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
        .psa__count { font-size: 13px; color: #475569; }
        .psa__empty { padding: 18px; text-align: center; color: #64748b; font-size: 14px; }
        .psa__table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .psa__table th { text-align: left; background: #f1f5f9; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #475569; }
        .psa__table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        .psa__center { text-align: center !important; }
        .psa__name { font-weight: 600; }
        .psa__role { color: #64748b; font-size: 13px; }
        .psa__toggle { position: relative; width: 44px; height: 24px; border-radius: 999px; border: none; background: #cbd5e1; cursor: pointer; transition: background .15s; padding: 0; }
        .psa__toggle--on { background: #16a34a; }
        .psa__toggle:disabled { opacity: .6; cursor: wait; }
        .psa__knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
        .psa__toggle--on .psa__knob { left: 23px; }
      `}</style>
    </div>
  );
}
