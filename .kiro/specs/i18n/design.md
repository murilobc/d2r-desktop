# Design Document: Internationalization (i18n)

## Architecture Overview

The i18n system integrates `react-i18next` with the existing React/TypeScript/Vite application. It provides a centralized translation layer that all UI components consume via the `useTranslation` hook. Date and number formatting is handled by native `Intl` APIs wrapped in a locale-aware utility module. The system is initialized synchronously before the first React render to prevent language flashes.

### Component Architecture

```
src/i18n/
├── index.ts              # i18next initialization and configuration
├── locales/
│   ├── en-US.json        # Base English translations (source of truth)
│   ├── pt-BR.json        # Portuguese (Brazil) translations
│   └── es.json           # Spanish translations
└── formatters.ts         # Locale-aware date/number formatting utilities
```

## Components

### 1. i18next Configuration (`src/i18n/index.ts`)

Initializes i18next with react-i18next bindings. Configuration:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';

const LOCALE_STORAGE_KEY = 'd2r_locale';
const SUPPORTED_LOCALES = ['en-US', 'pt-BR', 'es'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

function detectInitialLocale(): SupportedLocale {
  // 1. Check localStorage
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
    return stored as SupportedLocale;
  }
  // 2. Clear invalid stored locale
  if (stored) {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  }
  // 3. Detect OS locale
  const osLocale = navigator.language; // e.g., "pt-BR", "es-AR", "en-US"
  // Exact match
  if (SUPPORTED_LOCALES.includes(osLocale as SupportedLocale)) {
    return osLocale as SupportedLocale;
  }
  // Language-prefix match (e.g., "es-AR" → "es")
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

export { SUPPORTED_LOCALES, LOCALE_STORAGE_KEY };
export type { SupportedLocale };
export default i18n;
```

Key design decisions:
- **Bundled translations**: JSON files are imported directly (no async network loading). This eliminates flash-of-wrong-language since translations are available synchronously.
- **Fallback to en-US**: If any key is missing from the active locale, i18next automatically falls back to English.
- **OS locale detection**: Uses `navigator.language` with prefix matching for partial locale codes (e.g., `es-AR` matches `es`).

### 2. Locale-Aware Formatters (`src/i18n/formatters.ts`)

Utility functions wrapping native `Intl` APIs, reactive to the current i18next locale:

```typescript
import i18n from './index';

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = i18n.language;
  return new Intl.DateTimeFormat(locale, options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = i18n.language;
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
```

Duration formatting remains locale-independent (timer format `H:MM:SS` is universal for gaming).

### 3. Language Selector Component

Added as a new section in `src/pages/Settings.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, LOCALE_STORAGE_KEY } from '../i18n';

const LOCALE_LABELS: Record<string, string> = {
  'en-US': 'English (US)',
  'pt-BR': 'Português (Brasil)',
  'es': 'Español',
};

function LanguageSettings() {
  const { i18n, t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locale = e.target.value;
    i18n.changeLanguage(locale);
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  };

  return (
    <div className="settings-section">
      <h2>{t('settings.language.title')}</h2>
      <p className="settings-description">{t('settings.language.description')}</p>
      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.language.label')}</span>
        <select value={i18n.language} onChange={handleChange} className="hotkey-btn">
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

### 4. Translation File Structure

Single JSON file per locale. Keys are organized by page/section using dot-notation nesting:

```json
{
  "app": {
    "title": "D2R Tracker",
    "sidebar": {
      "profiles": "Profiles",
      "runTracker": "Run Tracker",
      "routes": "Routes",
      "history": "History",
      "statistics": "Statistics",
      "compare": "Compare",
      "heralds": "Heralds",
      "ancients": "Ancients",
      "dclone": "DClone",
      "xp": "XP",
      "drops": "Drops",
      "coop": "Co-op",
      "settings": "Settings",
      "overlay": "Overlay",
      "widget": "Widget",
      "theme": "Theme",
      "export": "Export",
      "import": "Import"
    }
  },
  "settings": {
    "title": "Settings",
    "language": {
      "title": "Language",
      "description": "Choose your preferred language for the application interface.",
      "label": "Display language"
    },
    "hotkeys": { ... },
    "sound": { ... },
    "backup": { ... },
    ...
  },
  "tracker": { ... },
  "history": { ... },
  "profiles": { ... },
  ...
}
```

### 5. Game Terms Exclusion Strategy

Game-specific strings are NOT placed in translation files. They remain in their source data files (`src/data/items.ts`, `src/types.ts` constants):

- `AREAS` array — area names stay in English
- `D2R_CLASSES` — class names stay in English
- `ITEM_TYPES`, `RARITIES` — type/rarity labels stay in English
- Item names from `src/data/items.ts` — stay in English
- `COLOSSAL_BOSSES`, `DCLONE_REGIONS` — stay in English

These are rendered directly from data constants without passing through `t()`.

## Data Flow

```
App Startup
  → detectInitialLocale() reads localStorage / navigator.language
  → i18n.init() with detected locale (synchronous, bundled resources)
  → React renders with correct locale from first frame

Language Change (Settings)
  → User selects locale from dropdown
  → i18n.changeLanguage(locale) triggers re-render of all components using useTranslation()
  → localStorage.setItem(LOCALE_STORAGE_KEY, locale) persists choice
  → Intl formatters automatically use new i18n.language on next call
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing translation key | Falls back to en-US value (i18next `fallbackLng`) |
| Invalid locale in localStorage | Cleared, falls back to OS detection → en-US |
| OS locale not supported | Falls back to en-US |
| Translation file with extra keys | Ignored (no error) |
| Translation file with missing keys | Falls back to en-US for those keys |

## Integration Points

- **App.tsx**: Import `src/i18n/index.ts` before React render. Wrap with `useTranslation` for sidebar labels.
- **All page components**: Replace hardcoded strings with `t('key')` calls.
- **Settings.tsx**: Add `LanguageSettings` section near the top of the settings list.
- **Date displays**: Replace `new Date().toLocaleString("en-US")` with `formatDate()`.
- **Number displays**: Replace hardcoded `.toFixed()` or `.toLocaleString("en-US")` with `formatNumber()`.
- **Overlay & Widget**: Import the same i18n instance; listen for locale changes.

## Testing Strategy

- **Unit tests**: Verify i18n initialization, locale detection logic, fallback behavior.
- **Property tests**: Verify translation key completeness across locales, formatting correctness.
- **Integration tests**: Verify Settings language selector changes the UI.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Translation key completeness

*For any* translation key that exists in the English (en-US) locale file, that same key SHALL exist in every other supported locale file (pt-BR, es).

**Validates: Requirements 1.3, 4.3**

### Property 2: Fallback to English for missing keys

*For any* translation key that is present in en-US but absent from another locale, the i18n system SHALL return the en-US value when that locale is active.

**Validates: Requirements 1.2**

### Property 3: Locale persistence round-trip

*For any* supported locale, selecting it via the Language Selector and then reading localStorage SHALL yield the same locale string that was selected.

**Validates: Requirements 2.3, 2.4**

### Property 4: OS locale detection resolves to a supported locale

*For any* OS locale string (navigator.language), the detectInitialLocale function SHALL return a value that is a member of the SUPPORTED_LOCALES array.

**Validates: Requirements 2.5, 5.3**

### Property 5: Date formatting matches Intl.DateTimeFormat for the active locale

*For any* valid Date and any supported locale, the formatDate utility SHALL produce output equal to `Intl.DateTimeFormat(locale, defaultOptions).format(date)`.

**Validates: Requirements 3.1**

### Property 6: Number formatting matches Intl.NumberFormat for the active locale

*For any* finite number and any supported locale, the formatNumber utility SHALL produce output equal to `Intl.NumberFormat(locale, options).format(number)`.

**Validates: Requirements 3.2**
