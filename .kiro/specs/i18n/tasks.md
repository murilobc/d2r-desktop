# Implementation Plan: Internationalization (i18n)

## Overview

Add full internationalization support to D2R Tracker using react-i18next. Extract all UI strings into translation files, provide English (US), Portuguese (Brazil), and Spanish translations, add a language selector to Settings, and ensure date/number formatting respects the active locale. Game-specific terms (item names, areas, classes) remain untranslated.

## Tasks

- [x] 1. Install dependencies and set up i18n infrastructure
  - [x] 1.1 Install `react-i18next` and `i18next` packages
    - Run `npm install react-i18next i18next`
    - Verify packages are added to package.json dependencies
    - _Requirements: 1.1_

  - [x] 1.2 Create i18n configuration module (`src/i18n/index.ts`)
    - Implement `detectInitialLocale()` function that checks localStorage, then OS locale via `navigator.language`, with fallback to `en-US`
    - Define `SUPPORTED_LOCALES` constant array and `LOCALE_STORAGE_KEY`
    - Initialize i18next with `initReactI18next`, bundled resources, `fallbackLng: 'en-US'`, and `useSuspense: false`
    - Export the configured i18n instance, constants, and types
    - _Requirements: 1.2, 2.4, 2.5, 5.1, 5.3_

  - [x] 1.3 Create locale-aware formatting utilities (`src/i18n/formatters.ts`)
    - Implement `formatDate(date, options?)` wrapping `Intl.DateTimeFormat` with active i18n locale
    - Implement `formatNumber(value, options?)` wrapping `Intl.NumberFormat` with active i18n locale
    - Keep existing `formatDuration(seconds)` logic locale-independent (timer format)
    - _Requirements: 3.1, 3.2_

  - [x] 1.4 Create base English translation file (`src/i18n/locales/en-US.json`)
    - Extract all UI strings from the application into a structured JSON file
    - Organize keys by section: `app`, `sidebar`, `settings`, `tracker`, `history`, `statistics`, `profiles`, `comparison`, `heralds`, `ancients`, `dclone`, `xp`, `drops`, `coop`, `overlay`, `widget`, `common`
    - Exclude game terms (item names, area names, class names, boss names, rune names)
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 1.5 Import i18n module in application entry point (`src/main.tsx`)
    - Add `import './i18n'` before the React render call to ensure synchronous initialization
    - _Requirements: 5.1, 5.2_

- [x] 2. Integrate i18n into core application components
  - [x] 2.1 Update `App.tsx` sidebar with translation keys
    - Replace all hardcoded sidebar labels (Profiles, Run Tracker, Routes, etc.) with `t()` calls
    - Replace footer text ("Active profile:", export/import labels) with `t()` calls
    - Keep game terms (profile name, class name) untranslated
    - _Requirements: 1.1, 1.4_

  - [x] 2.2 Update `Settings.tsx` with translation keys and add Language Selector
    - Add `LanguageSettings` component as the first section in Settings
    - Implement locale dropdown with native language labels (English, Português, Español)
    - Wire `i18n.changeLanguage()` and localStorage persistence on selection
    - Replace all hardcoded strings in existing settings sections with `t()` calls
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Update `RunTracker.tsx` with translation keys
    - Replace session control labels, stat labels, goal labels, area selector labels with `t()` calls
    - Replace status messages and button text with `t()` calls
    - Keep area names and item names untranslated (game terms)
    - Replace `toLocaleString("en-US")` date calls with `formatDate()`
    - _Requirements: 1.1, 1.4, 3.1_

  - [x] 2.4 Update remaining page components with translation keys
    - Update `Profiles.tsx`, `History.tsx`, `Statistics.tsx`, `Comparison.tsx`
    - Update `HeraldTracker.tsx`, `ColossalAncients.tsx`, `DCloneTracker.tsx`, `XPTracker.tsx`
    - Update `DropCalculator.tsx`, `RouteEditor.tsx`, `CoopPanel.tsx`
    - Replace all hardcoded UI strings with `t()` calls
    - Replace all `toLocaleString("en-US")` and hardcoded date formatting with `formatDate()` / `formatNumber()`
    - _Requirements: 1.1, 3.1, 3.2, 3.3_

  - [x] 2.5 Update shared components with translation keys
    - Update `ItemSearch.tsx`, `MFCalculator.tsx`, `QuickTags.tsx`, `SessionTimeline.tsx`
    - Update `TerrorZoneDisplay.tsx`, `TierBadge.tsx`, `UpdateChecker.tsx`, `SyncStatusIndicator.tsx`, `CloudSyncSettings.tsx`
    - Update Overlay (`src/overlay/Overlay.tsx`) and Widget (`src/widget/Widget.tsx`)
    - _Requirements: 1.1_

- [x] 3. Checkpoint - Verify base i18n integration
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm test` to verify existing 174 tests still pass with i18n changes
  - Run `npx tsc --noEmit` to verify no TypeScript errors

- [x] 4. Create translation files for additional locales
  - [x] 4.1 Create Portuguese (Brazil) translation file (`src/i18n/locales/pt-BR.json`)
    - Translate all keys from en-US.json to Brazilian Portuguese
    - Maintain identical key structure to en-US.json
    - _Requirements: 1.3_

  - [x] 4.2 Create Spanish translation file (`src/i18n/locales/es.json`)
    - Translate all keys from en-US.json to Spanish
    - Maintain identical key structure to en-US.json
    - _Requirements: 1.3_

  - [x] 4.3 Register new locale files in i18n configuration
    - Import pt-BR.json and es.json in `src/i18n/index.ts`
    - Add to resources object in i18n.init()
    - _Requirements: 1.3, 4.1_

- [x] 5. Testing
  - [x]* 5.1 Write property test for translation key completeness
    - **Property 1: Translation key completeness**
    - For any key in en-US.json, verify it exists in pt-BR.json and es.json
    - Recursively flatten nested keys and compare sets
    - **Validates: Requirements 1.3, 4.3**

  - [x]* 5.2 Write property test for locale detection
    - **Property 4: OS locale detection resolves to a supported locale**
    - For any arbitrary navigator.language string, detectInitialLocale() returns a member of SUPPORTED_LOCALES
    - Test with exact matches, prefix matches, and unsupported locales
    - **Validates: Requirements 2.5, 5.3**

  - [x]* 5.3 Write property test for date formatting
    - **Property 5: Date formatting matches Intl.DateTimeFormat for active locale**
    - For any valid Date and any supported locale, formatDate output matches Intl.DateTimeFormat
    - **Validates: Requirements 3.1**

  - [x]* 5.4 Write property test for number formatting
    - **Property 6: Number formatting matches Intl.NumberFormat for active locale**
    - For any finite number and any supported locale, formatNumber output matches Intl.NumberFormat
    - **Validates: Requirements 3.2**

  - [x]* 5.5 Write unit tests for language selector and persistence
    - Test that selecting a locale updates i18n.language
    - Test that localStorage is written on selection
    - Test that invalid stored locale falls back to en-US
    - **Validates: Requirements 2.2, 2.3, 5.3**

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run full verification: `npm test`, `npx tsc --noEmit`, `npx vite build`
  - Verify language switching works for all three locales

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Game terms (item names, area names, class names, boss names, runes) are intentionally excluded from translation
- The i18n module is imported synchronously in main.tsx to prevent flash of English before locale loads
- Native `Intl` APIs handle date/number formatting — no additional library needed
- Duration formatting (H:MM:SS) remains locale-independent as it's a universal timer format
- Adding a new language after implementation requires only creating a new JSON file in `src/i18n/locales/` and registering it in `index.ts`
