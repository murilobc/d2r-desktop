# Implementation Plan: Trade Values

## Overview

This plan implements the Trade Values feature end-to-end: a static data module, CSS badge classes, a localStorage settings hook, a badge component, and integration into the Settings, History, and RunTracker pages. The feature is entirely frontend-only with no Rust, no database changes, and no Tauri commands.

## Tasks

- [x] 1. Create `src/data/tradeValues.ts` — static data module
  - Define `TradeValueCategory` type union: `"HR+" | "Mid" | "Low" | "Self-use"`
  - Define `TradeValueEntry` interface with a single `category` field
  - Export `SOURCE_ATTRIBUTION` constant crediting diablo2.io with a `YYYY-MM-DD` date stamp
  - Export `TRADE_VALUES` record mapping item names to entries across all four tiers
  - Export `getTradeValue(itemName)` pure function returning `TradeValueEntry | null`
  - Write unit tests and property-based tests (Properties 1-4)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Add CSS classes to `src/App.css`
  - Append `.trade-badge` base class (font-size, padding, border-radius, display, margin, font-weight)
  - Append `.trade-badge-hr` (gold/amber: `#b8860b` background, `#fff9e6` text)
  - Append `.trade-badge-mid` (neutral gray: `#707070` background, `#f0f0f0` text)
  - Append `.trade-badge-low` (warm brown: `#7a4a1e` background, `#fde8c8` text)
  - Append `.trade-badge-selfuse` (dark neutral: `#3a3a3a` background, `#aaa` text)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Create `src/hooks/useTradeValueSettings.ts`
  - Implement `useTradeValueSettings()` hook returning `{ showTradeValues: boolean, toggle: () => void }`
  - Initialize from `localStorage.getItem("show_trade_values")`, defaulting to `true` when absent
  - `toggle()` flips the boolean and writes `"true"` or `"false"` to `localStorage`
  - Write unit tests: default true, reads false from storage, toggle once, toggle twice, persistence
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Create `src/components/TradeValueBadge.tsx`
  - Accept a single `itemName: string` readonly prop
  - Call `getTradeValue(itemName)` and return `null` if no entry found
  - Render `<span className="trade-badge {tierClass}" title={...} aria-label={...}>~{category}</span>`
  - Include `SOURCE_ATTRIBUTION` in the `title` attribute
  - Include `aria-label` of the form `"Estimated trade value: {category}"`
  - Write unit tests and property-based test (Property 5)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 5. Checkpoint — core module verification
  - Ensure all tests pass: `npm test`
  - Ensure TypeScript compiles: `npx tsc --noEmit`

- [x] 6. Add `TradeValueSettings` to `Settings.tsx`
  - Import `useTradeValueSettings` from `../hooks/useTradeValueSettings`
  - Add inline `TradeValueSettings` function component with labeled toggle button showing `ON`/`OFF`
  - Set `aria-pressed` on the toggle button to reflect current state
  - Render `<TradeValueSettings />` after `<ScreenshotSettingsPanel />` in the settings layout
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Integrate `TradeValueBadge` into `History.tsx`
  - Add imports: `TradeValueBadge`, `SOURCE_ATTRIBUTION`, `useTradeValueSettings`
  - Call `useTradeValueSettings()` in the component body
  - Render `{showTradeValues && <TradeValueBadge itemName={item.name} />}` inside each item row after `<TierBadge>`
  - Render `{showTradeValues && items.length > 0 && <p className="trade-attribution">{SOURCE_ATTRIBUTION}</p>}` below the item list
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 8. Integrate `TradeValueBadge` into `RunTracker.tsx`
  - Add imports: `TradeValueBadge`, `SOURCE_ATTRIBUTION`, `useTradeValueSettings`
  - Call `useTradeValueSettings()` in the component body
  - Render `{showTradeValues && <TradeValueBadge itemName={item.name} />}` inside each item row after `<TierBadge>`
  - Render `{showTradeValues && items.length > 0 && <p className="trade-attribution">{SOURCE_ATTRIBUTION}</p>}` below the item list
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. Final checkpoint — full feature verification
  - Ensure all tests pass: `npm test`
  - Ensure TypeScript compiles: `npx tsc --noEmit`
  - Verify Vite build succeeds: `npx vite build`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3", "4"] },
    { "id": 2, "tasks": ["5"] },
    { "id": 3, "tasks": ["6", "7", "8"] },
    { "id": 4, "tasks": ["9"] }
  ]
}
```

## Notes

- No Rust, no SQLite, no Tauri commands — purely frontend
- No i18n keys required; category labels are game-specific terms displayed as-is
- Property-based tests use `fast-check` with minimum 200 iterations
- Tasks 7 and 8 are independent and can be executed in parallel
- The `SOURCE_ATTRIBUTION` date should be updated whenever the trade value data is refreshed
