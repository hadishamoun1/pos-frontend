// src/contexts/LanguageContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getPayload, getToken } from '../auth/authz';
import { axiosClient } from '../api/axiosClient';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // Initialize language from token or localStorage
  const [language, setLanguage] = useState(() => {
    // 1. Try to get from JWT token (if user is logged in)
    const payload = getPayload();
    if (payload?.language) {
      return payload.language;
    }
    
    // 2. Fall back to localStorage
    const saved = localStorage.getItem('app-language');
    return saved || 'en';
  });

  // Save to localStorage and update document settings whenever language changes
  useEffect(() => {
    // Save to localStorage (fallback for when not logged in)
    localStorage.setItem('app-language', language);
    
    // Keep layout as LTR always
    document.documentElement.dir = 'ltr';
    
    // Set document language attribute
    document.documentElement.lang = language;
    
    // Add/remove Arabic class to body for font styling
    if (language === 'ar') {
      document.body.classList.add('arabic-mode');
      document.body.classList.remove('english-mode');
    } else {
      document.body.classList.add('english-mode');
      document.body.classList.remove('arabic-mode');
    }
  }, [language]);

  // Function to change language and sync with backend
  const changeLanguage = async (newLanguage) => {
    // Update local state immediately for instant UI update
    setLanguage(newLanguage);
    
    // If user is logged in, save to backend
    const token = getToken();
    if (token) {
      try {
        await axiosClient.patch('/users/me/language', { 
          language: newLanguage 
        });
        console.log('✅ Language saved to backend:', newLanguage);
      } catch (error) {
        console.error('❌ Failed to save language to backend:', error);
        // Language is still changed locally even if backend fails
      }
    }
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ar' : 'en';
    changeLanguage(newLang);
  };

  const setToEnglish = () => changeLanguage('en');
  const setToArabic = () => changeLanguage('ar');

  return (
    <LanguageContext.Provider 
      value={{ 
        language, 
        setLanguage: changeLanguage,
        toggleLanguage,
        setToEnglish,
        setToArabic,
        isArabic: language === 'ar',
        isEnglish: language === 'en'
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};