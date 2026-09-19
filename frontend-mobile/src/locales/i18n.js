import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';

const LANGUAGE_STORAGE_KEY = 'kisanq_selected_locale';

const resources = {
  mr: { translation: mr },
  hi: { translation: hi },
  en: { translation: en }
};

// Initialize i18n synchronously with Marathi (mr) / device default fallback
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'mr', // Default to Marathi for APMC procurement regions
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

// Async loader to hydrate persisted user preference from storage
export const initStoredLanguage = async () => {
  try {
    const savedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLang && resources[savedLang]) {
      await i18n.changeLanguage(savedLang);
      return savedLang;
    }
  } catch (error) {
    console.warn('[i18n] Failed to load saved language preference:', error);
  }
  return 'mr';
};

export const setAppLanguage = async (langCode) => {
  try {
    if (resources[langCode]) {
      await i18n.changeLanguage(langCode);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, langCode);
    }
  } catch (error) {
    console.warn('[i18n] Failed to persist language choice:', error);
  }
};

export default i18n;
