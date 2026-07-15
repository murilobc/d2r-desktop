import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';

export const LOCALE_STORAGE_KEY = 'd2r_locale';
export const SUPPORTED_LOCALES = ['en-US', 'pt-BR', 'es'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export function detectInitialLocale(): SupportedLocale {
  // 1. Check localStorage
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
    return stored as SupportedLocale;
  }
  // 2. Clear invalid stored locale
  if (stored) {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  }
  // 3. Detect OS locale via navigator.language
  const osLocale = navigator.language;
  // Exact match
  if (SUPPORTED_LOCALES.includes(osLocale as SupportedLocale)) {
    return osLocale as SupportedLocale;
  }
  // Language-prefix match (e.g., "es-AR" → "es", "pt" → "pt-BR")
  const langPrefix = osLocale.split('-')[0];
  const match = SUPPORTED_LOCALES.find(
    (l) => l === langPrefix || l.startsWith(langPrefix + '-')
  );
  if (match) return match;
  // 4. Default to English
  return 'en-US';
}

i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'pt-BR': { translation: ptBR },
    'es': { translation: es },
  },
  lng: detectInitialLocale(),
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
