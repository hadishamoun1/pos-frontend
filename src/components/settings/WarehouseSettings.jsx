import React, { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";

export default function WarehouseSettings() {
  const [warehouses, setWarehouses] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
              <span className="wh-settings__name">{w.name}</span>
            </div>

            <div className="wh-settings__item-actions">
              {!w.isHome && (
                <button
                  className="wh-settings__btn wh-settings__btn--home"
                  onClick={() => handleSetHome(w.id)}
                >
                  Set as Home
                </button>
              )}
              <button
                className="wh-settings__btn wh-settings__btn--delete"
                onClick={() => handleDelete(w.id)}
              >
                Delete
              </button>
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
        .wh-settings__btn--delete {
          background: #fff;
          color: #dc2626;
          border-color: #fca5a5;
        }
        .wh-settings__btn--delete:hover { background: #fee2e2; }
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
