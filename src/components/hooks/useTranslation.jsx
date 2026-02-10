// src/hooks/useTranslation.js
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../translations';

/**
 * Hook to get translation function
 * @returns {object} Object with t function and current language
 */
export const useTranslation = () => {
  const { language } = useLanguage();
  
  /**
   * Translate a key
   * @param {string} key - Translation key (e.g., 'yearSettings.title')
   * @param {object} params - Optional parameters to replace (e.g., {year: 2025})
   * @returns {string} Translated text
   */
  const t = (key, params = {}) => {
    return getTranslation(language, key, params);
  };
  
  return { t, language };
};