# Requirements Document

## Introduction

This feature adds internationalization (i18n) support to the D2R Tracker desktop application. All user-facing UI strings will be extracted from components and rendered through an i18n framework (react-i18next). The application will ship with English (US), Portuguese (Brazil), and Spanish translations. Users can switch languages from the Settings page, and date/number formatting will adapt to the selected locale. Game-specific terms (D2R item names, area names, class names) remain untranslated.

## Glossary

- **I18n_System**: The react-i18next framework integrated into the application, responsible for loading translation files, resolving translation keys, and providing translated strings to React components.
- **Locale**: A language-region code identifying the user's language preference (e.g., `en-US`, `pt-BR`, `es`).
- **Translation_File**: A single JSON file per locale containing all UI string key-value pairs.
- **Language_Selector**: A dropdown control on the Settings page that allows the user to change the active locale.
- **Game_Term**: A D2R-specific string (item names, area names, class names, rune names) that remains in its original English form regardless of locale.
- **Intl_Formatter**: The browser-native `Intl.DateTimeFormat` and `Intl.NumberFormat` APIs used to format dates and numbers according to the active locale.

## Requirements

### Requirement 1

**User Story:** As a user, I want the application UI to be available in my language, so that I can understand and navigate the interface without needing English proficiency.

#### Acceptance Criteria

1. THE I18n_System SHALL render all user-facing UI strings through translation key lookups rather than hardcoded English text.
2. WHEN a translation key is missing from the active Translation_File, THEN THE I18n_System SHALL fall back to the English (en-US) translation for that key.
3. THE I18n_System SHALL provide translations for all UI strings in three locales: English (en-US), Portuguese-Brazil (pt-BR), and Spanish (es).
4. THE I18n_System SHALL exclude Game_Terms from translation — item names, area names, class names, rune names, and boss names SHALL remain in their original English form regardless of the active locale.

### Requirement 2

**User Story:** As a user, I want to select my preferred language from the Settings page, so that I can switch the entire UI to a language I understand.

#### Acceptance Criteria

1. WHEN a user opens the Settings page, THE Language_Selector SHALL display a dropdown listing all available locales with their native language names.
2. WHEN a user selects a locale from the Language_Selector, THE I18n_System SHALL immediately switch the entire UI to the selected locale without requiring an application restart.
3. WHEN a user selects a locale, THE I18n_System SHALL persist the selection to localStorage under a dedicated key.
4. WHEN the application starts, THE I18n_System SHALL read the persisted locale from localStorage and activate it.
5. WHEN no persisted locale exists in localStorage, THE I18n_System SHALL detect the operating system locale and activate the matching translation if available, or fall back to English (en-US) if no match exists.

### Requirement 3

**User Story:** As a user, I want dates and numbers to be formatted according to my selected language, so that temporal and numeric data appears familiar to me.

#### Acceptance Criteria

1. WHEN displaying dates or times, THE Intl_Formatter SHALL format them using the active locale's conventions (e.g., day/month/year for pt-BR, month/day/year for en-US).
2. WHEN displaying numeric values (run counts, durations, XP values), THE Intl_Formatter SHALL format them using the active locale's number separators (e.g., 1.000 for pt-BR, 1,000 for en-US).
3. WHEN the active locale changes, THE Intl_Formatter SHALL immediately apply the new formatting to all visible dates and numbers without requiring page navigation.

### Requirement 4

**User Story:** As a developer or community contributor, I want to add a new language to the application by creating a single JSON file, so that extending localization requires no code changes.

#### Acceptance Criteria

1. THE I18n_System SHALL load translations from individual JSON files located in a well-defined directory (`src/i18n/locales/`).
2. WHEN a new Translation_File is added to the locales directory following the established key structure, THE I18n_System SHALL make it available as a selectable locale after a rebuild.
3. THE I18n_System SHALL validate at test time that all Translation_Files contain the same set of keys as the base English (en-US) Translation_File.

### Requirement 5

**User Story:** As a user, I want the application to remember my language choice and load it instantly on startup, so that I don't have to re-select my language each time I open the app.

#### Acceptance Criteria

1. WHEN the application initializes, THE I18n_System SHALL load the persisted locale preference from localStorage before rendering the first component.
2. WHEN the persisted locale is loaded, THE I18n_System SHALL display the UI in the correct language on first render without a flash of the default language.
3. IF the persisted locale references a Translation_File that no longer exists, THEN THE I18n_System SHALL fall back to English (en-US) and clear the invalid preference from localStorage.
