import React, { useEffect, useState, useMemo } from "react";
import { axiosClient } from "../api/axiosClient";
import NotificationModal from "../recievables/NotificationModal";

export default function LinkedPartySettings() {
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [filter, setFilter] = useState("");
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axiosClient.get("/customers/v1/paginated?page=1&limit=500"),
      axiosClient.get("/suppliers/v1/filtered"),
    ])
      .then(([cRes, sRes]) => {
        const cList = Array.isArray(cRes.data?.customers) ? cRes.data.customers : [];
        const sList = Array.isArray(sRes.data) ? sRes.data : [];
        setCustomers(cList.map(c => ({ ...c, _pendingSupplier: c.linkedSupplierId ?? "" })));
        setSuppliers(sList);
      })
      .catch(() => setNotif({ open: true, type: "error", message: "Failed to load data." }))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.customerName || "").toLowerCase().includes(q) ||
      (c.customerAccountNumber || "").toLowerCase().includes(q)
    );
  }, [customers, filter]);

  const setCustomerPending = (id, supplierId) => {
    setCustomers(prev =>
      prev.map(c => c.id === id ? { ...c, _pendingSupplier: supplierId } : c)
    );
  };

  const save = async (customer) => {
    setSavingId(customer.id);
    try {
      const linkedSupplierId = customer._pendingSupplier !== "" ? Number(customer._pendingSupplier) : null;
      await axiosClient.patch(`/customers/${customer.id}`, { linkedSupplierId });
      setCustomers(prev =>
        prev.map(c => c.id === customer.id ? { ...c, linkedSupplierId } : c)
      );
      setNotif({ open: true, type: "success", message: "Saved." });
    } catch (e) {
      setNotif({ open: true, type: "error", message: e?.response?.data?.message || "Failed to save." });
    } finally {
      setSavingId(null);
    }
  };

  const supplierName = (id) => {
    if (!id) return "—";
    const s = suppliers.find(s => s.id === Number(id));
    return s ? s.supplierName : `#${id}`;
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 4 }}>Linked Parties</h2>
      <p style={{ color: "#6b7280", marginBottom: 16, fontSize: 14 }}>
        Link a customer to their corresponding supplier to enable Net Position statements.
        When linked, the account statement will show a combined AR + AP balance.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
          placeholder="Search by customer name or account number…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {loading ? "Loading…" : `${filtered.length} customer(s)`}
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
            <th style={thStyle}>Account #</th>
            <th style={thStyle}>Customer Name</th>
            <th style={thStyle}>Linked Supplier</th>
            <th style={thStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#9ca3af" }}>
                No customers found.
              </td>
            </tr>
          )}
          {filtered.map(c => {
            const isDirty = String(c._pendingSupplier ?? "") !== String(c.linkedSupplierId ?? "");
            const isSaving = savingId === c.id;
            return (
              <tr key={c.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={tdStyle}>{c.customerAccountNumber}</td>
                <td style={tdStyle}>{c.customerName}</td>
                <td style={tdStyle}>
                  <select
                    style={{ width: "100%", padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 13 }}
                    value={c._pendingSupplier ?? ""}
                    onChange={e => setCustomerPending(c.id, e.target.value)}
                  >
                    <option value="">— None —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplierName}</option>
                    ))}
                  </select>
                  {c.linkedSupplierId && !isDirty && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      Currently: {supplierName(c.linkedSupplierId)}
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  <button
                    disabled={!isDirty || isSaving}
                    onClick={() => save(c)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 5,
                      border: "none",
                      cursor: isDirty && !isSaving ? "pointer" : "default",
                      background: isDirty ? "#2563eb" : "#e5e7eb",
                      color: isDirty ? "#fff" : "#9ca3af",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

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

const thStyle = { padding: "10px 12px", fontWeight: 600, borderBottom: "2px solid #e5e7eb" };
const tdStyle = { padding: "8px 12px", verticalAlign: "middle" };
