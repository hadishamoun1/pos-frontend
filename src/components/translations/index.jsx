// src/translations/index.js
import { en } from './en';
import { ar } from './ar';

export const translations = {
  en,
  ar
};

/**
 * Get translation value by key (supports nested keys with dot notation)
 * @param {string} language - 'en' or 'ar'
 * @param {string} key - Translation key (e.g., 'yearSettings.title')
 * @param {object} params - Optional parameters to replace in translation (e.g., {year: 2025})
 * @returns {string} Translated text or the key if not found
 */
export const getTranslation = (language, key, params = {}) => {
  const keys = key.split('.');
  let value = translations[language];
  
  // Navigate through nested keys
  for (const k of keys) {
    value = value?.[k];
  }
  
  // If translation not found, return the key itself
  if (typeof value !== 'string') {
    return key;
  }
  
  // Replace parameters in the translation
  // Example: "Year {year} was added" with params {year: 2025} becomes "Year 2025 was added"
  let result = value;
  Object.keys(params).forEach(paramKey => {
    const placeholder = `{${paramKey}}`;
    result = result.replace(new RegExp(placeholder, 'g'), params[paramKey]);
  });
  
  return result;
};
