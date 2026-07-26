# Design Document: Trade Values

## Overview

The Trade Values feature adds lightweight, read-only trade tier annotations to the Run Tracker and History item lists. It consists of a static TypeScript data module, a small set of CSS classes, a single React component, a localStorage-backed settings hook, a Settings UI section, and integration patches to two existing pages.

There is no backend involvement — the entire feature is frontend-only. No database schema changes, no Tauri commands, no Rust code.

### Key Design Decisions

1. **Static data module, no API calls**: Trade values are curated constants sourced from community price data. They change infrequently and never need to be fetched at runtime. A plain `src/data/tradeValues.ts` file is the simplest, fastest, and most testable approach.
2. **localStorage for the toggle**: The show/hide preference is a pure UI preference with no need for profile-level persistence or cloud sync. `localStorage` is sufficient, lightweight, and survives page reloads without any backend round-trip.
3. **Null-return component pattern**: `TradeValueBadge` returns `null` when the item is not in the registry. This means callers do not need to guard against unknown items — they can unconditionally render the badge and it will silently disappear for unrecognized items.
4. **No new routes or pages**: The feature integrates into two existing pages (History, RunTracker) and one existing Settings section. No navigation changes needed.

## Architecture

```
src/data/tradeValues.ts          ← static registry + getTradeValue() + SOURCE_ATTRIBUTION
src/components/TradeValueBadge.tsx  ← UI component consuming getTradeValue()
src/hooks/useTradeValueSettings.ts  ← localStorage preference hook
src/App.css                      ← .trade-badge* CSS classes (appended)
src/pages/Settings.tsx           ← TradeValueSettings section (integrated)
src/pages/History.tsx            ← TradeValueBadge + showTradeValues guard (integrated)
src/pages/RunTracker.tsx         ← TradeValueBadge + showTradeValues guard (integrated)
```

### Data Flow

1. App renders History or RunTracker page
2. Page calls `useTradeValueSettings()` → reads `localStorage["show_trade_values"]` → returns `{ showTradeValues, toggle }`
3. For each item in the list, `{showTradeValues && <TradeValueBadge itemName={item.name} />}` is rendered
4. `TradeValueBadge` calls `getTradeValue(itemName)` → returns entry or null
5. If entry exists, renders `<span className="trade-badge trade-badge-{tier}">~{category}</span>`
6. If `showTradeValues` is true and list is non-empty, `SOURCE_ATTRIBUTION` string is rendered below the list
7. User can go to Settings → click the toggle → `toggle()` flips `showTradeValues` and writes to `localStorage`

## Components and Interfaces

### `src/data/tradeValues.ts`

```typescript
export type TradeValueCategory = "HR+" | "Mid" | "Low" | "Self-use";

export interface TradeValueEntry {
  category: TradeValueCategory;
}

/** Attribution string to display wherever trade values are shown. */
export const SOURCE_ATTRIBUTION: string;

/** Maps item names to TradeValueEntry records. */
export const TRADE_VALUES: Record<string, TradeValueEntry>;

/**
 * Returns the TradeValueEntry for the given item name, or null if not found.
 * Pure and deterministic.
 */
export function getTradeValue(itemName: string): TradeValueEntry | null;
```

**Data categories:**
- `HR+` — runewords (Enigma, Infinity, …), high runes (Ber–Zod, Sur), elite uniques, Anni/Torch, top charms/jewels
- `Mid` — mid-tier runewords (HotO, Exile, …), mid runes (Ohm, Lo, Vex, Gul), mid uniques, sunder charms, good facets
- `Low` — starter runewords (Spirit, Insight, Treachery, …), low runes (Ist, Mal, Um, Pul), common uniques
- `Self-use` — items with niche use but no meaningful trade demand

### `src/components/TradeValueBadge.tsx`

```typescript
interface Props {
  readonly itemName: string;
}

export default function TradeValueBadge({ itemName }: Props): JSX.Element | null;
```

- Calls `getTradeValue(itemName)` — returns `null` if no entry
- Renders `<span className={`trade-badge ${tierClass}`} title={...} aria-label={...}>~{category}</span>`
- `title` includes `SOURCE_ATTRIBUTION`
- `aria-label` reads "Estimated trade value: {category}"

### `src/hooks/useTradeValueSettings.ts`

```typescript
export function useTradeValueSettings(): {
  showTradeValues: boolean;
  toggle: () => void;
};
```

- Reads `localStorage.getItem("show_trade_values")` on initialization
- Defaults to `true` when key is absent
- `toggle()` flips the boolean and writes the new value back to `localStorage`

### `TradeValueSettings` (inline component in `src/pages/Settings.tsx`)

- Renders a labeled toggle button showing `ON`/`OFF`
- Uses `useTradeValueSettings()` hook
- Placed after the existing `<ScreenshotSettingsPanel />` in the settings layout

### History.tsx integration

```tsx
// imports added:
import TradeValueBadge from "../components/TradeValueBadge";
import { SOURCE_ATTRIBUTION } from "../data/tradeValues";
import { useTradeValueSettings } from "../hooks/useTradeValueSettings";

// inside component:
const { showTradeValues } = useTradeValueSettings();

// inside item row render:
{showTradeValues && <TradeValueBadge itemName={item.name} />}

// below item list:
{showTradeValues && items.length > 0 && (
  <p className="trade-attribution">{SOURCE_ATTRIBUTION}</p>
)}
```

### RunTracker.tsx integration

Same pattern as History.tsx — identical import additions, same conditional rendering.

## CSS Classes (`src/App.css`)

```css
/* ===== TRADE VALUE BADGES ================================================= */
.trade-badge {
  font-size: 0.7rem;
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  margin-left: 4px;
  vertical-align: middle;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.trade-badge-hr    { background-color: #b8860b; color: #fff9e6; }  /* gold  */
.trade-badge-mid   { background-color: #707070; color: #f0f0f0; }  /* gray  */
.trade-badge-low   { background-color: #7a4a1e; color: #fde8c8; }  /* brown */
.trade-badge-selfuse { background-color: #3a3a3a; color: #aaa; }   /* dark  */
```

## Data Models

This feature introduces no new data models, database tables, or Tauri commands. All state is managed purely in the frontend:

- `TradeValueCategory` — TypeScript union type: `"HR+" | "Mid" | "Low" | "Self-use"`
- `TradeValueEntry` — TypeScript interface: `{ category: TradeValueCategory }`
- `TRADE_VALUES` — `Record<string, TradeValueEntry>` — static compile-time constant in `src/data/tradeValues.ts`
- `show_trade_values` — `localStorage` key storing `"true"` or `"false"` string; not persisted to SQLite

No extensions to `SyncPayload`, `src/types.ts`, or any Rust struct are needed.

## Correctness Properties

### Property 1: Valid Category Invariant

*For every* entry in `TRADE_VALUES`, the `category` field SHALL be one of the four valid values: `"HR+"`, `"Mid"`, `"Low"`, `"Self-use"`. No entry may have an unrecognized category.

**Validates: Requirements 1.1**

### Property 2: Lookup Determinism

*For any* string input `s`, calling `getTradeValue(s)` twice in succession SHALL return the same result both times. The function has no side effects and no mutable state.

**Validates: Requirements 1.6**

### Property 3: Null for Absent Keys

*For any* string `s` that is not a key in `TRADE_VALUES`, `getTradeValue(s)` SHALL return `null`.

**Validates: Requirements 1.5**

### Property 4: Item DB Coverage Consistency

*For every* key in `TRADE_VALUES`, that key SHALL exist as a `name` in the application's `ALL_ITEMS` database. The trade value registry must not reference items that don't exist in the item database.

**Validates: Requirements 1.3**

### Property 5: Badge Renders for Known Items

*For any* `(itemName, entry)` pair in `TRADE_VALUES`, rendering `<TradeValueBadge itemName={itemName} />` SHALL produce a DOM element with:
- the class `trade-badge`
- the tier-specific class matching `entry.category`
- text content equal to `~{entry.category}`

**Validates: Requirements 2.2, 2.4**

## Testing Strategy

### Unit Tests (Example-Based)

- **`tradeValues.ts`**: null for empty string, null for unknown item, correct category for representative items in each tier, SOURCE_ATTRIBUTION format
- **`useTradeValueSettings.ts`**: defaults to true, reads false from storage, toggle once → false, toggle twice → true, localStorage persistence
- **`TradeValueBadge.tsx`**: renders nothing for unknown item, correct CSS class for Enigma (HR+), title contains SOURCE_ATTRIBUTION, aria-label present

### Property-Based Tests

**Library**: `fast-check` (already used in the project, integrates with Vitest)

**Configuration**: Minimum 200 iterations per property test.

Each correctness property above maps to a property-based test:
- Property 1 → Exhaustive loop over all `TRADE_VALUES` entries (static, no fast-check needed)
- Property 2 → `fc.string()` with 200 iterations — call twice, assert equal
- Property 3 → `fc.string().filter(s => !knownKeys.has(s))` with 200 iterations — assert null
- Property 4 → Exhaustive loop over all `TRADE_VALUES` keys (static check)
- Property 5 → `fc.constantFrom(...entries)` — render badge, assert classes and text

## Error Handling

| Scenario | Behavior |
|---|---|
| `itemName` not in `TRADE_VALUES` | `getTradeValue` returns `null`; `TradeValueBadge` renders nothing |
| `localStorage` unavailable (e.g., private browsing) | `useTradeValueSettings` may throw; wrapping in `try/catch` and defaulting to `true` is recommended |
| `TRADE_VALUES` entry has an unexpected category | TypeScript compile-time union type prevents this; runtime the CSS class lookup returns `undefined` and no tier class is applied |

## Notes

- No Tauri commands, no SQLite tables, no Rust code
- No i18n keys needed — the category labels (`HR+`, `Mid`, `Low`, `Self-use`) are game-specific terms displayed as-is
- The `SOURCE_ATTRIBUTION` date should be updated whenever the trade value data is refreshed
- Badge ordering in the item row: `item name → TierBadge → TradeValueBadge → item type → rarity`
