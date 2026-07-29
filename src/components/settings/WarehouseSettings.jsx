import React, { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";

export default function WarehouseSettings() {
  const [warehouses, setWarehouses] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const fetch = async () => {
    try {
      const { data } = await axiosClient.get("/warehouses");
      setWarehouses(data);
    } catch {
      setError("Failed to load warehouses.");
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    setError("");
    try {
      await axiosClient.post("/warehouses", { name });
      setNewName("");
      await fetch();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to add warehouse.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetHome = async (id) => {
    setError("");
    try {
      await axiosClient.patch(`/warehouses/${id}/set-home`);
      await fetch();
    } catch {
      setError("Failed to set home warehouse.");
    }
  };

  const handleEditStart = (w) => {
    setEditId(w.id);
    setEditName(w.name);
    setError("");
  };

  const handleEditSave = async () => {
    const name = editName.trim();
    if (!name) return;
    setLoading(true);
    setError("");
    try {
      await axiosClient.patch(`/warehouses/${editId}`, { name });
      setEditId(null);
      setEditName("");
      await fetch();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to rename warehouse.");
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm(
      "This will update ALL item batches where warehouse = \"Shamoun\" (or is blank) to the current home warehouse.\n\nProceed?"
    )) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosClient.post("/warehouses/migrate-batches");
      alert(`Done — updated ${data.updated} batch record(s) to "${data.homeName}".`);
    } catch (e) {
      setError(e?.response?.data?.message || "Migration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this warehouse?")) return;
    setError("");
    try {
      await axiosClient.delete(`/warehouses/${id}`);
      await fetch();
    } catch {
      setError("Failed to delete warehouse.");
    }
  };

  return (
    <div className="wh-settings">
      <h2 className="wh-settings__title">Warehouse Management</h2>
      <p className="wh-settings__hint">
        Mark one warehouse as <strong>Home</strong> — it becomes the default source for inventory.
        Transfer location options ("To&nbsp;X") are generated from this list.
      </p>

      {error && <div className="wh-settings__error">{error}</div>}

      <div className="wh-settings__migrate-row">
        <button
          className="wh-settings__btn wh-settings__btn--migrate"
          onClick={handleMigrate}
          disabled={loading}
        >
          Fix Existing Batch Data
        </button>
        <span className="wh-settings__migrate-hint">
          Updates all inventory batches labelled "Shamoun" to the current home warehouse.
          Run this once after changing the home warehouse.
        </span>
      </div>

      <div className="wh-settings__add-row">
        <input
          className="wh-settings__input"
          type="text"
          placeholder="Warehouse name (e.g. Shamoun, Tripoli)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={loading}
        />
        <button
          className="wh-settings__btn wh-settings__btn--add"
          onClick={handleAdd}
          disabled={loading || !newName.trim()}
        >
          + Add
        </button>
      </div>

      <div className="wh-settings__list">
        {warehouses.length === 0 && (
          <p className="wh-settings__empty">No warehouses added yet.</p>
        )}

        {warehouses.map((w) => (
          <div
            key={w.id}
            className={`wh-settings__item ${w.isHome ? "wh-settings__item--home" : ""}`}
          >
            <div className="wh-settings__item-left">
              {w.isHome && <span className="wh-settings__badge">Home</span>}
              {editId === w.id ? (
                <input
                  className="wh-settings__input wh-settings__input--inline"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEditSave();
                    if (e.key === "Escape") { setEditId(null); setEditName(""); }
                  }}
                  autoFocus
                  disabled={loading}
                />
              ) : (
                <span className="wh-settings__name">{w.name}</span>
              )}
            </div>

            <div className="wh-settings__item-actions">
              {editId === w.id ? (
                <>
                  <button
                    className="wh-settings__btn wh-settings__btn--save"
                    onClick={handleEditSave}
                    disabled={loading || !editName.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="wh-settings__btn wh-settings__btn--cancel"
                    onClick={() => { setEditId(null); setEditName(""); }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {!w.isHome && (
                    <button
                      className="wh-settings__btn wh-settings__btn--home"
                      onClick={() => handleSetHome(w.id)}
                    >
                      Set as Home
                    </button>
                  )}
                  <button
                    className="wh-settings__btn wh-settings__btn--edit"
                    onClick={() => handleEditStart(w)}
                  >
                    Rename
                  </button>
                  <button
                    className="wh-settings__btn wh-settings__btn--delete"
                    onClick={() => handleDelete(w.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .wh-settings {
          max-width: 560px;
          padding: 24px;
          font-family: Arial, sans-serif;
        }
        .wh-settings__title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #0f172a;
        }
        .wh-settings__hint {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .wh-settings__error {
          background: #fee2e2;
          color: #dc2626;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 14px;
          font-size: 13px;
        }
        .wh-settings__add-row {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .wh-settings__input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
        }
        .wh-settings__input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
        }
        .wh-settings__btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .wh-settings__btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .wh-settings__btn--add {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }
        .wh-settings__btn--add:hover:not(:disabled) { background: #1d4ed8; }
        .wh-settings__btn--home {
          background: #f0fdf4;
          color: #16a34a;
          border-color: #86efac;
        }
        .wh-settings__btn--home:hover { background: #dcfce7; }
        .wh-settings__btn--edit {
          background: #fff;
          color: #2563eb;
          border-color: #93c5fd;
        }
        .wh-settings__btn--edit:hover { background: #eff6ff; }
        .wh-settings__btn--save {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }
        .wh-settings__btn--save:hover:not(:disabled) { background: #1d4ed8; }
        .wh-settings__btn--cancel {
          background: #fff;
          color: #6b7280;
          border-color: #d1d5db;
        }
        .wh-settings__btn--cancel:hover { background: #f9fafb; }
        .wh-settings__btn--delete {
          background: #fff;
          color: #dc2626;
          border-color: #fca5a5;
        }
        .wh-settings__btn--delete:hover { background: #fee2e2; }
        .wh-settings__input--inline {
          padding: 4px 8px;
          font-size: 14px;
          width: 180px;
        }
        .wh-settings__migrate-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 12px 14px;
          background: #fefce8;
          border: 1px solid #fde68a;
          border-radius: 8px;
        }
        .wh-settings__migrate-hint {
          font-size: 12px;
          color: #92400e;
          line-height: 1.4;
        }
        .wh-settings__btn--migrate {
          background: #f59e0b;
          color: #fff;
          border-color: #f59e0b;
          white-space: nowrap;
        }
        .wh-settings__btn--migrate:hover:not(:disabled) { background: #d97706; }
        .wh-settings__list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .wh-settings__empty {
          color: #9ca3af;
          font-size: 13px;
        }
        .wh-settings__item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #fff;
        }
        .wh-settings__item--home {
          border-color: #22c55e;
          background: #f0fdf4;
        }
        .wh-settings__item-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .wh-settings__badge {
          background: #22c55e;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
        }
        .wh-settings__name {
          font-size: 15px;
          font-weight: 500;
          color: #0f172a;
        }
        .wh-settings__item-actions {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}
