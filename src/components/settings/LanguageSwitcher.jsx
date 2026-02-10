// src/components/LanguageSwitcher.jsx
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from '../hooks/useTranslation';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { language, setToEnglish, setToArabic, isArabic, isEnglish } = useLanguage();
  const { t } = useTranslation();
  
  return (
    <div className="language-switcher-container">
      <div className="language-switcher-header">
        <h3 className="language-switcher-title">{t('languageSettings.title')}</h3>
        <div className="language-current">
          <span className="language-current-label">{t('languageSettings.currentLanguage')}:</span>
          <span className="language-current-value">
            {isArabic ? 'العربية' : 'English'}
          </span>
        </div>
      </div>
      
      <div className="language-switcher-content">
        <label className="language-switcher-label">
          {t('languageSettings.selectLanguage')}:
        </label>
        
        <div className="language-buttons">
          <button 
            className={`language-btn ${isEnglish ? 'active' : ''}`}
            onClick={setToEnglish}
            type="button"
          >
            <span className="language-flag">🇬🇧</span>
            <span className="language-text">English</span>
          </button>
          
          <button 
            className={`language-btn ${isArabic ? 'active' : ''}`}
            onClick={setToArabic}
            type="button"
          >
            <span className="language-flag">🇸🇦</span>
            <span className="language-text">العربية</span>
          </button>
        </div>
        
        <p className="language-note">
          {isArabic 
            ? 'سيتم حفظ اختيارك تلقائياً'
            : 'Your selection will be saved automatically'}
        </p>
      </div>
    </div>
  );
};

export default LanguageSwitcher;