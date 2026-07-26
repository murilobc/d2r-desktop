# Implementation Plan: Trade Value Estimation

## Overview

Add static community-sourced trade value badges to item rows in RunTracker and History pages. The feature mirrors the existing `item-values.ts` / `TierBadge.tsx` pattern: a pure data module with a lookup function, a localStorage-backed settings hook, a display component, and integration into the two item-list pages and the Settings panel. No Rust/Tauri changes are needed.

## Tasks

- [x] 1. Create `src/data/tradeValues.ts` — static data module
  - [x] 1.1 Define `TradeValueCategory` union type, `TradeValueEntry` interface, `SOURCE_ATTRIBUTION` constant, `TRADE_VALUES` map, and `getTradeValue` function
    - Export `TradeValueCategory` as `"HR+" | "Mid" | "Low" | "Self-use"` — single source of truth, no other file may hardcode category strings
    - Export `TradeValueEntry` as `{ category: TradeValueCategory }` (intentionally minimal for future extension)
    - Export `SOURCE_ATTRIBUTION` as `"Values based on diablo2.io price data as of 2025-07-01"`
    - Export `TRADE_VALUES: Record<string, TradeValueEntry>` with all entries from the design (HR+ runewords/uniques/runes/charms, Mid, Low, Self-use — ~90 entries)
    - Export `getTradeValue(itemName: string): TradeValueEntry | null` using `??` null-coalescing — never throws, no imports from `items.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 8.2_

  - [x]* 1.2 Write property and unit tests for `tradeValues.ts` in `src/data/tradeValues.test.ts`
    - **Property 1: Valid Category Invariant** — exhaustive loop over all `TRADE_VALUES` entries, each `category` must be in `{"HR+","Mid","Low","Self-use"}`
      - **Validates: Requirements 1.3, 3.1**
    - **Property 2: Lookup Determinism** — `fc.assert(fc.property(fc.string(), s => expect(getTradeValue(s)).toEqual(getTradeValue(s))), { numRuns: 200 })`
      - **Validates: Requirements 2.4**
    - **Property 3: Null for Absent Keys** — `fc.assert(fc.property(fc.string().filter(s => !knownKeys.has(s)), s => expect(getTradeValue(s)).toBeNull()), { numRuns: 200 })`
      - **Validates: Requirements 2.3, 2.5**
    - **Property 4: Item DB Coverage Consistency** — exhaustive loop: every key in `TRADE_VALUES` must match a `GameItem.name` in `ALL_ITEMS` from `src/data/items.ts`
      - **Validates: Requirements 6.1, 6.3**
    - Unit: `SOURCE_ATTRIBUTION` matches `/^Values based on diablo2\.io price data as of \d{4}-\d{2}-\d{2}$/`
    - Unit: `getTradeValue("")` returns `null`
    - Unit: `getTradeValue("Enigma")?.category` equals `"HR+"`
    - Unit: `getTradeValue("Sur Rune")?.category` equals `"HR+"`
    - Unit: `getTradeValue("unknown-xyz-item")` returns `null`

- [x] 2. Add CSS classes to `src/App.css`
  - [x] 2.1 Append `.trade-badge`, `.trade-badge-hr`, `.trade-badge-mid`, `.trade-badge-low`, `.trade-badge-selfuse`, and `.trade-attribution` to `App.css`
    - `.trade-badge`: `display:inline-block`, `padding:1px 6px`, `border-radius:3px`, `font-size:0.72rem`, `font-weight:600`, `letter-spacing:0.02em`, `margin-left:4px`, `vertical-align:middle`, `cursor:default`
    - `.trade-badge-hr`: gold (`#b8860b` bg, `#fff9e6` text) — mirrors D2R item quality palette
    - `.trade-badge-mid`: silver-gray (`#707070` bg, `#f0f0f0` text)
    - `.trade-badge-low`: bronze-brown (`#7a4a1e` bg, `#fde8c8` text)
    - `.trade-badge-selfuse`: charcoal (`#3a3a3a` bg, `#aaa` text)
    - `.trade-attribution`: `font-size:0.72rem`, `color:var(--text-muted, #888)`, `margin-top:0.5rem`, `font-style:italic`
    - _Requirements: 5.4, 7.4_

- [x] 3. Create `src/hooks/useTradeValueSettings.ts`
  - [x] 3.1 Implement `useTradeValueSettings` hook — thin localStorage wrapper following the `useTheme` pattern
    - `STORAGE_KEY = "show_trade_values"`, `useState` initializer reads from `localStorage` (absent → default `true`)
    - Serialize as `"true"` / `"false"` strings — same convention as `d2r_obs_prefs` / `d2r_hotkeys`
    - Export `{ showTradeValues: boolean, toggle: () => void }` — `toggle` writes new value to `localStorage` immediately
    - _Requirements: 4.1, 4.4, 4.5_

  - [x]* 3.2 Write unit tests for `useTradeValueSettings` in `src/hooks/useTradeValueSettings.test.ts`
    - Test: defaults to `true` when `localStorage` key is absent
    - Test: reads `false` correctly when key is `"false"` in storage
    - Test: toggle once → `showTradeValues` is `false`, `localStorage` updated to `"false"`
    - Test: toggle twice → `showTradeValues` is `true`, `localStorage` updated to `"true"`
    - _Requirements: 4.1, 4.4, 4.5_

- [x] 4. Create `src/components/TradeValueBadge.tsx`
  - [x] 4.1 Implement `TradeValueBadge` component — returns `null` for items with no trade entry
    - `Props: { readonly itemName: string }` — no `showTradeValues` prop; callers conditionally render it (same pattern as `TierBadge`)
    - Local `CATEGORY_CSS` map: `{ "HR+": "trade-badge-hr", "Mid": "trade-badge-mid", "Low": "trade-badge-low", "Self-use": "trade-badge-selfuse" }`
    - Render `<span className={\`trade-badge \${CATEGORY_CSS[entry.category]}\`} title={\`~\${entry.category} trade value — \${SOURCE_ATTRIBUTION}\`} aria-label={\`Estimated trade value: \${entry.category}\`}>~{entry.category}</span>`
    - The `~` prefix on both visible label and tooltip satisfies the "Estimated" disclaimer (Requirement 5.6)
    - `aria-label` provides screen reader context (WCAG)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 7.1_

  - [x]* 4.2 Write property and unit tests for `TradeValueBadge` in `src/components/TradeValueBadge.test.tsx`
    - **Property 5: Badge Renders for Known Items** — `fc.assert(fc.property(fc.constantFrom(...entries), ([name, entry]) => { render(<TradeValueBadge itemName={name} />); expect(container.querySelector(".trade-badge")).not.toBeNull(); expect(badge?.classList.contains(cssMap[entry.category])).toBe(true); }), { numRuns: Math.min(entries.length, 100) })`
      - **Validates: Requirements 5.1, 5.2, 5.4**
    - Unit: `<TradeValueBadge itemName="unknown-xyz" />` renders nothing (returns `null`)
    - Unit: `<TradeValueBadge itemName="Enigma" />` renders `.trade-badge.trade-badge-hr` with text `~HR+`
    - Unit: `title` attribute contains `SOURCE_ATTRIBUTION` string for a known item
    - Unit: `aria-label` is present for a known item
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_

- [x] 5. Checkpoint — ensure data layer and component compile cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add `TradeValueSettings` sub-component to `src/pages/Settings.tsx`
  - [x] 6.1 Add the `TradeValueSettings` function component inside `Settings.tsx` and render it in the `Settings` page
    - Import `useTradeValueSettings` from `../hooks/useTradeValueSettings`
    - Follows the identical pattern of `SoundSettings` / `ObsSettings` / `ScreenshotSettingsPanel` already in `Settings.tsx`
    - Render inside `<div className="settings-section">`: `<h2>Trade Value Display</h2>`, descriptive `<p className="settings-description">`, and a `hotkey-row` with a toggle `<button>` using `aria-pressed`
    - The toggle button uses `className={\`hotkey-btn toggle-btn \${showTradeValues ? "recording" : ""}\`}` and renders `ON` / `OFF` text
    - Add `<TradeValueSettings />` to the `Settings` page JSX after `<ScreenshotSettingsPanel />`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x]* 6.2 Write unit tests for the Settings panel integration in `src/components/TradeValueSettings.test.tsx`
    - Test: `TradeValueSettings` section renders with a toggle button
    - Test: toggle button reflects current `showTradeValues` state (ON/OFF text)
    - Test: clicking toggle calls through and updates localStorage
    - _Requirements: 4.6_

- [x] 7. Integrate `TradeValueBadge` into `src/pages/History.tsx`
  - [x] 7.1 Add `useTradeValueSettings` hook, conditional `<TradeValueBadge>` per item row, and attribution footer to `History.tsx`
    - Add imports: `TradeValueBadge` from `../components/TradeValueBadge`, `SOURCE_ATTRIBUTION` from `../data/tradeValues`, `useTradeValueSettings` from `../hooks/useTradeValueSettings`
    - Inside `History` component body: `const { showTradeValues } = useTradeValueSettings();`
    - In the `items-list` render (inside the detail panel), after the existing `<TierBadge>`: `{showTradeValues && <TradeValueBadge itemName={item.name} />}`
    - Below the `items-list` div: `{showTradeValues && runItems[selectedRun.id]?.length > 0 && (<p className="trade-attribution">{SOURCE_ATTRIBUTION}</p>)}`
    - Both `TierBadge` and `TradeValueBadge` are displayed as separate, clearly labeled indicators (Requirement 5.7)
    - Attribution is only shown when trade values are enabled and items exist (Requirement 7.2)
    - _Requirements: 4.2, 4.3, 5.1, 5.3, 5.5, 5.7, 7.2, 7.3, 7.4, 8.1_

  - [x]* 7.2 Write unit/integration tests for History page trade value integration in `src/pages/History.test.tsx` (or add to existing test file if present)
    - Test: item row renders both `TierBadge` and `TradeValueBadge` when `showTradeValues` is `true` and item is in `TRADE_VALUES`
    - Test: `TradeValueBadge` is absent when `showTradeValues` is `false`
    - Test: attribution text is present when `showTradeValues` is `true` and items include a trade-valued item
    - Test: attribution text is absent when `showTradeValues` is `false`
    - _Requirements: 4.2, 4.3, 5.5, 7.2_

- [x] 8. Integrate `TradeValueBadge` into `src/pages/RunTracker.tsx`
  - [x] 8.1 Apply the same pattern to `RunTracker.tsx` as applied to `History.tsx` in task 7.1
    - Add imports: `TradeValueBadge`, `SOURCE_ATTRIBUTION`, `useTradeValueSettings`
    - `const { showTradeValues } = useTradeValueSettings();` inside `RunTracker` component
    - In `items.map()` inside `.items-list`, after `<TierBadge>`: `{showTradeValues && <TradeValueBadge itemName={item.name} />}`
    - Below `.items-list`: `{showTradeValues && items.length > 0 && (<p className="trade-attribution">{SOURCE_ATTRIBUTION}</p>)}`
    - _Requirements: 4.2, 4.3, 5.2, 5.3, 5.5, 5.7, 7.2, 7.3, 7.4, 8.1_

  - [x]* 8.2 Write unit/integration tests for RunTracker page trade value integration
    - Test: item row renders `TradeValueBadge` when `showTradeValues` is `true` and item is in `TRADE_VALUES`
    - Test: no badge when `showTradeValues` is `false`
    - Test: attribution text visible when `showTradeValues` is `true` and session has items
    - _Requirements: 4.2, 4.3, 5.5, 7.2_

- [x] 9. Final checkpoint — ensure all tests pass and TypeScript compiles
  - Ensure all tests pass (`npm test`), TypeScript compiles (`npx tsc --noEmit`), and ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` (already in `devDependencies` at v4.9.0) with `numRuns: 200` for Properties 2 & 3, and `Math.min(entries.length, 100)` for Property 5
- Properties 1 and 4 are deterministic exhaustive loops — no fast-check needed, direct iteration is more readable
- `TradeValueBadge` never accepts `showTradeValues` as a prop — callers conditionally render it, matching the `TierBadge` pattern
- `SOURCE_ATTRIBUTION` is the single source of truth — no component hardcodes the attribution string
- The `~` prefix on badge labels and tooltips communicates estimated/approximate values (Requirement 5.6)
- No Rust/Tauri changes, no routing changes, no new pages — pure frontend addition

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "7.1", "8.1"] },
    { "id": 5, "tasks": ["7.2", "8.2"] }
  ]
}
```
