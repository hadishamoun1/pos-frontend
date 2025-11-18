// src/pages/settings/YearSettings.jsx
import React, { useEffect, useState } from "react";
import "./styles/SettingYear.css";

const YearSettings = () => {
  const [activeYear, setActiveYear] = useState("");
  const [newYear, setNewYear] = useState("");
  const [yearToActivate, setYearToActivate] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const rawBase = process.env.REACT_APP_API_BASE_URL || "";
  const baseUrl = rawBase.replace(/\/+$/, "");

  // Fetch current active year on mount
  useEffect(() => {
    const fetchActiveYear = async () => {
      try {
        const res = await fetch(`${baseUrl}/settings/active-year`);
        if (!res.ok) {
          throw new Error(`Failed to fetch active year (status ${res.status})`);
        }
        const year = await res.json(); // returns a string
        setActiveYear(String(year));
        setErrorMsg("");
      } catch (err) {
        console.error("Error fetching active year:", err);
        setErrorMsg("Failed to load active fiscal year.");
      }
    };

    fetchActiveYear();
  }, [baseUrl]);

  // Add new year
  const handleAddYear = async (e) => {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");

    const y = newYear.trim();
    if (!y) {
      setErrorMsg("Please enter the year you want to add.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/settings/add-year`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ year: y }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to add year.");
      }

      const saved = await res.json(); // Settings entity
      setStatusMsg(`Year ${saved.year} was added successfully.`);
      setNewYear("");
    } catch (err) {
      console.error("Error adding year:", err);
      setErrorMsg(err.message || "Error occurred while adding the year.");
    } finally {
      setLoading(false);
    }
  };

  // Set active year
  const handleSetActiveYear = async (e) => {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");

    const y = yearToActivate.trim();
    if (!y) {
      setErrorMsg("Please enter the year you want to set as active.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/settings/set-active-year`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ year: y }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to set active year.");
      }

      const updated = await res.json(); // Settings entity
      setActiveYear(String(updated.year));
      setStatusMsg(`Active fiscal year set to ${updated.year}.`);
      setYearToActivate("");
    } catch (err) {
      console.error("Error setting active year:", err);
      setErrorMsg(err.message || "Error occurred while setting active year.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setting-year-container">
      <h2 className="setting-year-title">Fiscal Year Settings</h2>

      <div className="setting-year-card">
        <h3 className="setting-year-card-title">Current Active Year</h3>
        <p className="setting-year-active-value">
          {activeYear || "No active fiscal year is set."}
        </p>
      </div>

      <div className="setting-year-card">
        <h3 className="setting-year-card-title">Add New Year</h3>
        <form className="setting-year-form" onSubmit={handleAddYear}>
          <label className="setting-year-label">
            Year:
            <input
              type="text"
              className="setting-year-input"
              placeholder="Example: 2025 or 25"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="setting-year-button"
            disabled={loading}
          >
            {loading ? "Saving..." : "Add Year"}
          </button>
        </form>
      </div>

      <div className="setting-year-card">
        <h3 className="setting-year-card-title">Set Active Year</h3>
        <form className="setting-year-form" onSubmit={handleSetActiveYear}>
          <label className="setting-year-label">
            Year to set as active:
            <input
              type="text"
              className="setting-year-input"
              placeholder="Enter an existing year"
              value={yearToActivate}
              onChange={(e) => setYearToActivate(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="setting-year-button setting-year-button-secondary"
            disabled={loading}
          >
            {loading ? "Saving..." : "Set as Active"}
          </button>
        </form>
      </div>

      {(statusMsg || errorMsg) && (
        <div
          className={`setting-year-message ${
            errorMsg ? "setting-year-message-error" : "setting-year-message-ok"
          }`}
        >
          {errorMsg || statusMsg}
        </div>
      )}
    </div>
  );
};

export default YearSettings;
