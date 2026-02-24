// src/components/settings/CompanySettings.jsx
import React, { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";

export default function CompanySettings() {
  const [companies, setCompanies] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchCompanies = async () => {
    try {
      const { data } = await axiosClient.get("/company");
      setCompanies(data);
    } catch {
      setError("Failed to load companies.");
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    setError("");
    try {
      await axiosClient.post("/company", { companyName: name });
      setNewName("");
      await fetchCompanies();
    } catch {
      setError("Failed to add company.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (id) => {
    setError("");
    try {
      await axiosClient.patch(`/company/${id}/activate`);
      await fetchCompanies();
    } catch {
      setError("Failed to set active company.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this company?")) return;
    setError("");
    try {
      await axiosClient.delete(`/company/${id}`);
      await fetchCompanies();
    } catch {
      setError("Failed to delete company.");
    }
  };

  return (
    <div className="company-settings">
      <h2 className="company-settings__title">Company Management</h2>

      {error && <div className="company-settings__error">{error}</div>}

      {/* Add new company */}
      <div className="company-settings__add-row">
        <input
          className="company-settings__input"
          type="text"
          placeholder="Enter company name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={loading}
        />
        <button
          className="company-settings__btn company-settings__btn--add"
          onClick={handleAdd}
          disabled={loading || !newName.trim()}
        >
          + Add
        </button>
      </div>

      {/* Companies list */}
      <div className="company-settings__list">
        {companies.length === 0 && (
          <p className="company-settings__empty">No companies added yet.</p>
        )}

        {companies.map((c) => (
          <div
            key={c.id}
            className={`company-settings__item ${c.isActive ? "company-settings__item--active" : ""}`}
          >
            <div className="company-settings__item-left">
              {c.isActive && (
                <span className="company-settings__badge">✓ Active</span>
              )}
              <span className="company-settings__name">{c.companyName}</span>
            </div>

            <div className="company-settings__item-actions">
              {!c.isActive && (
                <button
                  className="company-settings__btn company-settings__btn--activate"
                  onClick={() => handleSetActive(c.id)}
                >
                  Set Active
                </button>
              )}
              <button
                className="company-settings__btn company-settings__btn--delete"
                onClick={() => handleDelete(c.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .company-settings {
          max-width: 600px;
          padding: 24px;
          font-family: Arial, sans-serif;
        }
        .company-settings__title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #0f172a;
        }
        .company-settings__error {
          background: #fee2e2;
          color: #dc2626;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 14px;
          font-size: 13px;
        }
        .company-settings__add-row {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .company-settings__input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
        }
        .company-settings__input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
        }
        .company-settings__btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .company-settings__btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .company-settings__btn--add {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }
        .company-settings__btn--add:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .company-settings__btn--activate {
          background: #22c55e;
          color: #fff;
          border-color: #22c55e;
        }
        .company-settings__btn--activate:hover {
          background: #16a34a;
        }
        .company-settings__btn--delete {
          background: #fff;
          color: #dc2626;
          border-color: #fca5a5;
        }
        .company-settings__btn--delete:hover {
          background: #fee2e2;
        }
        .company-settings__list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .company-settings__empty {
          color: #9ca3af;
          font-size: 13px;
        }
        .company-settings__item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #fff;
          transition: border-color 0.15s;
        }
        .company-settings__item--active {
          border-color: #22c55e;
          background: #f0fdf4;
        }
        .company-settings__item-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .company-settings__badge {
          background: #22c55e;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
        }
        .company-settings__name {
          font-size: 15px;
          font-weight: 500;
          color: #0f172a;
        }
        .company-settings__item-actions {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}