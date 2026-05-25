// src/components/settings/AccountingRoleSettings.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { axiosClient } from "../api/axiosClient"; // ✅ adjust if needed
import NotificationModal from "../recievables/NotificationModal"; // ✅ adjust if needed
import "./styles/AccountingRoleSettings.css";

const DEFAULT_TENANTS = [
  { id: 1, name: "Lebanon" },
  { id: 2, name: "Syria" },
];

// These are the "role keys" your services will later use.
// Add/rename freely; nothing here is hardcoded in backend logic.
const DEFAULT_ROLE_KEYS = [
  "AR_CUSTOMER",
  "AP_SUPPLIER",
  "SALES_REVENUE",
  "SALES_DISCOUNT",
  "SALES_VAT_OUTPUT",
  "SalesReturn_USD",
  "SalesReturn_LL",
  "PURCHASE_EXPENSE",
  "PURCHASE_DISCOUNT",
  "PURCHASE_VAT_INPUT",
  "PurchasesReturn_USD",
  "INVENTORY",
  "COGS",
  "CASH",
  "BANK",
  "INCOME_SUMMARY",
];

// You can expand if you support more.
const CURRENCIES = [
  { code: "", label: "Any" },
  { code: "LL", label: "LL" },
  { code: "USD", label: "USD" },
];

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function AccountingRoleSettings() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANTS[0]?.id ?? 1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState(new Set());

  const [filter, setFilter] = useState("");
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });

  const loadLock = useRef(false);

  const filteredRows = useMemo(() => {
    const q = (filter || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const role = (r.roleKey || "").toLowerCase();
      const cur = (r.currencyCode || "").toLowerCase();
      const acc = (r.accountNumber || "").toLowerCase();
      return role.includes(q) || cur.includes(q) || acc.includes(q);
    });
  }, [rows, filter]);

  async function load() {
    if (loadLock.current) return;
    loadLock.current = true;
    setLoading(true);

    try {
      // ✅ Expected backend:
      // GET /accounting/account-roles?tenantId=1
      // returns array: [{ id, tenantId, roleKey(or role), currencyCode, accountNumber }]
      const res = await axiosClient.get("/accounting/account-roles", {
        params: { tenantId },
      });

      const list = Array.isArray(res.data) ? res.data : [];
      // normalize + attach clientKey for react rendering even for new rows
      setRows(
        list.map((x) => ({
          id: x.id ?? null,
          clientKey: uid(),
          tenantId: x.tenantId ?? tenantId,

          // ✅ FIX: backend may return "role" instead of "roleKey"
          roleKey: x.roleKey ?? x.role ?? "",

          currencyCode: x.currencyCode ?? "",
          accountNumber: x.accountNumber ?? "",
          notes: x.notes ?? "", // keep if backend ever sends it; harmless otherwise
        }))
      );
    } catch (e) {
      setNotif({
        open: true,
        type: "error",
        message:
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load account role mappings.",
      });
      setRows([]);
    } finally {
      setLoading(false);
      loadLock.current = false;
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function setRow(clientKey, patch) {
    setRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r))
    );
  }

  function addRow(prefill = {}) {
    setRows((prev) => [
      {
        id: null,
        clientKey: uid(),
        tenantId,
        roleKey: prefill.roleKey ?? "",
        currencyCode: prefill.currencyCode ?? "",
        accountNumber: prefill.accountNumber ?? "",
        notes: prefill.notes ?? "",
      },
      ...prev,
    ]);
  }

  function seedDefaults() {
    // Adds missing roles only; doesn’t overwrite existing ones.
    setRows((prev) => {
      const existing = new Set(
        prev.map((r) => `${r.roleKey}__${r.currencyCode || ""}`)
      );

      const toAdd = DEFAULT_ROLE_KEYS.filter((k) => !existing.has(`${k}__`)).map(
        (k) => ({
          id: null,
          clientKey: uid(),
          tenantId,
          roleKey: k,
          currencyCode: "",
          accountNumber: "",
          notes: "",
        })
      );

      return [...toAdd, ...prev];
    });
  }

  async function saveRow(r) {
    // basic validation
    if (!r.roleKey?.trim()) {
      setNotif({ open: true, type: "error", message: "Role key is required." });
      return;
    }
    if (!r.accountNumber?.trim()) {
      setNotif({
        open: true,
        type: "error",
        message: "Account number is required.",
      });
      return;
    }

    // mark saving
    setSavingIds((prev) => new Set(prev).add(r.clientKey));

    try {
      // ✅ Expected backend:
      // POST /accounting/account-roles
      // IMPORTANT: your backend service expects "role" not "roleKey"
      const payload = {
        id: r.id ?? undefined,
        tenantId,

        // ✅ FIX: send "role" (backend requires it)
        role: r.roleKey.trim(),

        currencyCode: (r.currencyCode || "").trim() || null,
        accountNumber: r.accountNumber.trim(),
        // notes is UI-only unless your backend supports it; don't send to avoid validation surprises
      };

      const res = await axiosClient.post("/accounting/account-roles", payload);
      const saved = res.data || {};

      setRows((prev) =>
        prev.map((x) =>
          x.clientKey === r.clientKey
            ? {
                ...x,
                id: saved.id ?? x.id,
                tenantId: saved.tenantId ?? tenantId,

                // ✅ FIX: backend may return "role" (or "roleKey" if your controller maps it)
                roleKey: saved.roleKey ?? saved.role ?? x.roleKey,

                currencyCode: saved.currencyCode ?? x.currencyCode,
                accountNumber: saved.accountNumber ?? x.accountNumber,
              }
            : x
        )
      );

      setNotif({ open: true, type: "success", message: "Saved." });
    } catch (e) {
      setNotif({
        open: true,
        type: "error",
        message:
          e?.response?.data?.message ||
          e?.message ||
          "Failed to save mapping.",
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(r.clientKey);
        return next;
      });
    }
  }

  async function deleteRow(r) {
    // new row not saved yet → just remove
    if (!r.id) {
      setRows((prev) => prev.filter((x) => x.clientKey !== r.clientKey));
      return;
    }

    try {
      // ✅ Expected backend:
      // DELETE /accounting/account-roles/:id
      await axiosClient.delete(`/accounting/account-roles/${r.id}`);
      setRows((prev) => prev.filter((x) => x.clientKey !== r.clientKey));
      setNotif({ open: true, type: "success", message: "Deleted." });
    } catch (e) {
      setNotif({
        open: true,
        type: "error",
        message:
          e?.response?.data?.message ||
          e?.message ||
          "Failed to delete mapping.",
      });
    }
  }

  return (
    <div className="acc-role-wrap">
      <div className="acc-role-header">
        <div>
          <h2 className="acc-role-title">Account Roles</h2>
          <div className="acc-role-sub">
            Map “role keys” to account numbers per country/tenant (and optionally
            currency).
          </div>
        </div>

        <div className="acc-role-actions">
          <div className="acc-role-tenant">
            <label>Country / Tenant</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(Number(e.target.value))}
            >
              {DEFAULT_TENANTS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <button className="acc-btn" onClick={() => addRow()}>
            + Add
          </button>

          <button className="acc-btn acc-btn-secondary" onClick={seedDefaults}>
            Seed Defaults
          </button>

          <button className="acc-btn acc-btn-secondary" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      <div className="acc-role-toolbar">
        <input
          className="acc-role-search"
          placeholder="Search role / currency / account…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="acc-role-count">
          {loading ? "Loading…" : `${filteredRows.length} row(s)`}
        </div>
      </div>

      <div className="acc-role-table-wrap">
        <table className="acc-role-table">
          <thead>
            <tr>
              <th style={{ width: 340 }}>Role Key</th>
              <th style={{ width: 160 }}>Currency</th>
              <th style={{ width: 220 }}>Account Number</th>
              <th>Notes</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {!loading && filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="acc-role-empty">
                  No mappings found. Click <b>Seed Defaults</b> or <b>Add</b>.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const isSaving = savingIds.has(r.clientKey);

                return (
                  <tr key={r.clientKey}>
                    <td>
                      <input
                        className="acc-input"
                        value={r.roleKey}
                        onChange={(e) =>
                          setRow(r.clientKey, { roleKey: e.target.value })
                        }
                        placeholder="ex: SALES_REVENUE"
                      />
                      <div className="acc-hint">
                        Tip: keep role keys stable; services will reference them.
                      </div>
                    </td>

                    <td>
                      <select
                        className="acc-select"
                        value={r.currencyCode || ""}
                        onChange={(e) =>
                          setRow(r.clientKey, { currencyCode: e.target.value })
                        }
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <div className="acc-hint">
                        “Any” applies for all currencies.
                      </div>
                    </td>

                    <td>
                      <input
                        className="acc-input"
                        value={r.accountNumber}
                        onChange={(e) =>
                          setRow(r.clientKey, { accountNumber: e.target.value })
                        }
                        placeholder="ex: 4111"
                      />
                      <div className="acc-hint">
                        Account number from your chart of accounts.
                      </div>
                    </td>

                    <td>
                      <input
                        className="acc-input"
                        value={r.notes || ""}
                        onChange={(e) =>
                          setRow(r.clientKey, { notes: e.target.value })
                        }
                        placeholder="Optional note"
                      />
                      <div className="acc-hint">
                        Optional UI-only note (ignored by backend unless you
                        store it).
                      </div>
                    </td>

                    <td className="acc-actions-cell">
                      <button
                        className="acc-btn acc-btn-primary"
                        disabled={isSaving}
                        onClick={() => saveRow(r)}
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>

                      <button
                        className="acc-btn acc-btn-danger"
                        disabled={isSaving}
                        onClick={() => deleteRow(r)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {notif.open && (
        <NotificationModal
          type={notif.type}
          message={notif.message}
          onClose={() => setNotif({ open: false, type: "", message: "" })}
        />
      )}
    </div>
  );
}
