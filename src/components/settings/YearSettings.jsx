// src/pages/settings/YearSettings.jsx
import React, { useEffect, useState } from "react";
import "./styles/SettingYear.css";
import { axiosClient } from "../api/axiosClient";
import { useTranslation } from "../hooks/useTranslation";
import LanguageSwitcher from "./LanguageSwitcher";

const YearSettings = () => {
  const { t } = useTranslation(); // ✅ Translation hook
  
  const [activeYear, setActiveYear] = useState("");
  const [newYear, setNewYear] = useState("");
  const [yearToActivate, setYearToActivate] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch current active year on mount
  useEffect(() => {
    const fetchActiveYear = async () => {
      try {
        const res = await axiosClient.get(`/settings/active-year`);
        const year = res.data;
        setActiveYear(String(year));
        setErrorMsg("");
      } catch (err) {
        console.error("Error fetching active year:", err);
        setErrorMsg(t('yearSettings.loadError'));
      }
    };

    fetchActiveYear();
  }, [t]);

  // Add new year
  const handleAddYear = async (e) => {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");

    const y = newYear.trim();
    if (!y) {
      setErrorMsg(t('yearSettings.enterYearError'));
      return;
    }

    try {
      setLoading(true);
      const res = await axiosClient.post(`/settings/add-year`, { year: y });
      const saved = res.data;

      setStatusMsg(t('yearSettings.yearAddedSuccess', { year: saved.year }));
      setNewYear("");
    } catch (err) {
      console.error("Error adding year:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        t('yearSettings.addError');
      setErrorMsg(String(msg));
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
      setErrorMsg(t('yearSettings.enterActiveYearError'));
      return;
    }

    try {
      setLoading(true);
      const res = await axiosClient.patch(`/settings/set-active-year`, {
        year: y,
      });

      const updated = res.data;
      setActiveYear(String(updated.year));
      setStatusMsg(t('yearSettings.activeYearSetSuccess', { year: updated.year }));
      setYearToActivate("");
    } catch (err) {
      console.error("Error setting active year:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        t('yearSettings.setActiveError');
      setErrorMsg(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setting-year-container">
      <h2 className="setting-year-title">{t('yearSettings.title')}</h2>

      {/* ✅ Language Switcher - NEW */}
      <LanguageSwitcher />

      <div className="setting-year-card">
        <h3 className="setting-year-card-title">{t('yearSettings.currentActiveYear')}</h3>
        <p className="setting-year-active-value">
          {activeYear || t('yearSettings.noActiveYear')}
        </p>
      </div>

      <div className="setting-year-card">
        <h3 className="setting-year-card-title">{t('yearSettings.addNewYear')}</h3>
        <form className="setting-year-form" onSubmit={handleAddYear}>
          <label className="setting-year-label">
            {t('yearSettings.yearLabel')}
            <input
              type="text"
              className="setting-year-input"
              placeholder={t('yearSettings.yearPlaceholder')}
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="setting-year-button"
            disabled={loading}
          >
            {loading ? t('yearSettings.saving') : t('yearSettings.addYearButton')}
          </button>
        </form>
      </div>

      <div className="setting-year-card">
        <h3 className="setting-year-card-title">{t('yearSettings.setActiveYear')}</h3>
        <form className="setting-year-form" onSubmit={handleSetActiveYear}>
          <label className="setting-year-label">
            {t('yearSettings.yearToActivateLabel')}
            <input
              type="text"
              className="setting-year-input"
              placeholder={t('yearSettings.yearToActivatePlaceholder')}
              value={yearToActivate}
              onChange={(e) => setYearToActivate(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="setting-year-button setting-year-button-secondary"
            disabled={loading}
          >
            {loading ? t('yearSettings.saving') : t('yearSettings.setAsActiveButton')}
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