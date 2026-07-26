# Requirements Document

## Introduction

The Trade Value Estimation feature adds community-sourced trade value information to the D2R Tracker desktop app. Each item tracked in the app can optionally display an estimated trade category indicating its worth in player-to-player trading, sourced from diablo2.io price data and embedded statically in the app build. Trade values are separate from the existing tier system: tier reflects farming efficiency, while trade value reflects market demand. Users who do not trade can hide this information via a settings toggle.

## Glossary

- **Trade_Value_Lookup**: The pure function that accepts an item name string and returns a `TradeValueEntry` or `null` from the static trade values map.
- **TradeValueEntry**: A data record containing a `category` (one of the four defined trade value categories) for a single item.
- **Trade_Value_Category**: One of four enumerated values: `"HR+"`, `"Mid"`, `"Low"`, or `"Self-use"`.
- **Trade_Values_Map**: The static `Record<string, TradeValueEntry>` exported from `src/data/tradeValues.ts`, populated at build time from diablo2.io price data.
- **Source_Attribution**: The string `"Values based on diablo2.io price data as of [date]"` displayed wherever trade values are shown.
- **Settings_Toggle**: The `show_trade_values` boolean preference persisted in `localStorage` that controls visibility of trade value information in the UI.
- **History_Page**: The app page that shows logged items per run.
- **RunTracker**: The component that shows logged items in the current session.
- **GameItem**: An item record from `src/data/items.ts` with `name`, `category`, `subcategory` fields.

---

## Requirements

### Requirement 1: Static Trade Value Data File

**User Story:** As a developer, I want trade value data stored in a dedicated static TypeScript file, so that the trade values concern is cleanly separated from the farming tier data in `items.ts`.

#### Acceptance Criteria

1. THE `Trade_Values_Map` SHALL be exported from `src/data/tradeValues.ts` as a `Record<string, TradeValueEntry>` keyed by exact item name string.
2. THE `TradeValueEntry` type SHALL contain exactly one field: `category` of type `Trade_Value_Category`.
3. THE `Trade_Value_Category` type SHALL be a TypeScript union of exactly four string literals: `"HR+"`, `"Mid"`, `"Low"`, and `"Self-use"`.
4. THE `tradeValues.ts` file SHALL include the `SOURCE_ATTRIBUTION` constant string in the format `"Values based on diablo2.io price data as of YYYY-MM-DD"`.
5. THE `tradeValues.ts` file SHALL NOT import from `items.ts` or any runtime data source — all values SHALL be statically declared at build time.
6. WHEN a new app release is prepared, THE `Trade_Values_Map` SHALL be updated to reflect current diablo2.io price data and the `SOURCE_ATTRIBUTION` date SHALL be updated accordingly.

---

### Requirement 2: Trade Value Lookup Function

**User Story:** As a developer, I want a deterministic lookup function for trade values, so that any component can query an item's trade category without duplicating logic.

#### Acceptance Criteria

1. THE `Trade_Value_Lookup` SHALL accept a single `itemName: string` parameter and return `TradeValueEntry | null`.
2. WHEN `itemName` matches a key in the `Trade_Values_Map`, THE `Trade_Value_Lookup` SHALL return the corresponding `TradeValueEntry`.
3. WHEN `itemName` does not match any key in the `Trade_Values_Map`, THE `Trade_Value_Lookup` SHALL return `null`.
4. THE `Trade_Value_Lookup` SHALL produce the same return value for the same `itemName` on every invocation — the function SHALL be deterministic and free of side effects.
5. IF `itemName` is an empty string, THEN THE `Trade_Value_Lookup` SHALL return `null`.

---

### Requirement 3: Trade Value Category Coverage

**User Story:** As a player, I want items to be assigned to meaningful trade value categories, so that I can quickly assess the market worth of items I find during runs.

#### Acceptance Criteria

1. THE `Trade_Values_Map` SHALL assign each entry a `category` value that is one of: `"HR+"`, `"Mid"`, `"Low"`, or `"Self-use"`.
2. THE `Trade_Values_Map` SHALL include entries for high-value runewords including Enigma, Infinity, Fortitude, and Call to Arms with category `"HR+"`.
3. THE `Trade_Values_Map` SHALL include entries for high runes (Sur, Ber, Jah, Cham, Zod) with category `"HR+"`.
4. THE `Trade_Values_Map` SHALL include entries for mid-value unique items such as Harlequin Crest (Shako), The Oculus, and Death's Web with appropriate Mid or HR+ categories.
5. THE `Trade_Values_Map` SHALL include entries for notable charms and jewels that are commonly traded (e.g., 40/15 max jewels, 3/20/20 small charms) with category `"HR+"`.
6. WHEN an item in the `Trade_Values_Map` has category `"Self-use"`, THE item description SHALL indicate it has personal gameplay value but low universal trade demand.

---

### Requirement 4: Settings Toggle for Trade Value Visibility

**User Story:** As a player who does not trade, I want to hide trade value information, so that the UI remains focused on the farming data I care about.

#### Acceptance Criteria

1. THE Settings_Toggle `show_trade_values` SHALL be a boolean value persisted in `localStorage` under the key `"show_trade_values"`.
2. WHEN `show_trade_values` is `true`, THE app SHALL display trade value categories alongside item entries in the History_Page and RunTracker.
3. WHEN `show_trade_values` is `false`, THE app SHALL not render any trade value category badges or labels in the History_Page or RunTracker.
4. WHEN `show_trade_values` has no value in `localStorage`, THE app SHALL default to `true` (trade values visible by default).
5. WHEN the user changes the Settings_Toggle, THE app SHALL persist the new value to `localStorage` immediately without requiring a page reload.
6. THE Settings_Toggle SHALL be accessible from the app's settings panel with a descriptive label indicating its purpose.

---

### Requirement 5: Trade Value Display in History Page and RunTracker

**User Story:** As a player, I want to see the trade value category next to items in my run history and active session, so that I know at a glance which drops are worth trading.

#### Acceptance Criteria

1. WHILE `show_trade_values` is `true`, THE History_Page SHALL display the trade value category badge for each item row where the `Trade_Value_Lookup` returns a non-null result.
2. WHILE `show_trade_values` is `true`, THE RunTracker SHALL display the trade value category badge for each item entry where the `Trade_Value_Lookup` returns a non-null result.
3. WHEN `Trade_Value_Lookup` returns `null` for an item, THE app SHALL not render any trade value badge for that item row.
4. THE trade value category badge SHALL use visually distinct styling for each of the four categories to allow quick scanning.
5. THE Source_Attribution string SHALL be displayed on every view that shows one or more trade value badges.
6. THE app SHALL label trade value categories with an explicit disclaimer such as "Estimated" or "~" prefix to communicate they are approximations, not exact prices.
7. WHEN an item has both a tier value and a trade value, THE app SHALL display them as separate, clearly labeled indicators so the user understands they represent different concepts.

---

### Requirement 6: Data Integrity Between Items DB and Trade Values

**User Story:** As a developer, I want the trade values data to be internally consistent with the items database, so that lookups never reference item names that don't exist in the app.

#### Acceptance Criteria

1. WHEN a key exists in the `Trade_Values_Map`, the same string SHALL match the `name` field of a `GameItem` in `src/data/items.ts`.
2. THE `Trade_Values_Map` SHALL NOT contain duplicate keys.
3. IF the `Trade_Values_Map` contains a key that does not match any `GameItem.name` in `items.ts`, THEN a compile-time or test-time check SHALL surface this inconsistency.
4. THE `Trade_Value_Category` type SHALL be the single source of truth for valid category values — no component or utility SHALL hardcode category strings outside of `tradeValues.ts`.

---

### Requirement 7: Source Attribution Visibility

**User Story:** As a player, I want to know where the trade value estimates come from, so that I can trust the data and verify it independently.

#### Acceptance Criteria

1. THE `SOURCE_ATTRIBUTION` constant SHALL be exported from `src/data/tradeValues.ts` and used by all display components — no component SHALL hardcode the attribution string independently.
2. WHEN trade values are visible (`show_trade_values` is `true`) and at least one trade value badge is shown in a view, THE Source_Attribution SHALL be rendered in that view.
3. THE Source_Attribution SHALL include the data date so the user can assess how current the estimates are.
4. THE Source_Attribution SHALL be rendered in a visually subordinate style (e.g., small muted text or tooltip) so it does not compete with item information.

---

### Requirement 8: No Network Dependency

**User Story:** As a player using the app offline or in a restricted network environment, I want trade values to work without any internet connection, so that the feature is always available.

#### Acceptance Criteria

1. THE app SHALL NOT make any network requests to fetch trade value data at runtime.
2. THE `Trade_Values_Map` SHALL be fully embedded in the compiled app bundle at build time.
3. WHEN the app is launched without network access, THE trade value feature SHALL function identically to when network access is available.

---

## Correctness Properties

The following properties define testable invariants for the trade value feature and guide property-based testing.

### Property 1: Valid Category Invariant

For every key-value pair in the `Trade_Values_Map`, the `category` field SHALL be one of exactly `"HR+"`, `"Mid"`, `"Low"`, or `"Self-use"`. No entry SHALL have a category outside this set. This is an invariant over the entire map and must hold regardless of map size or content.

### Property 2: Lookup Determinism (Idempotence)

For any item name string `s`, calling `Trade_Value_Lookup(s)` twice SHALL return structurally equal results. The function is pure: same input always produces same output.

### Property 3: Null for Absent Keys

For any string `s` that is not a key in the `Trade_Values_Map`, `Trade_Value_Lookup(s)` SHALL return `null` — never an error, never a default entry.

### Property 4: Item DB Coverage Consistency

For every key `k` in the `Trade_Values_Map`, `k` SHALL match the `name` property of at least one `GameItem` in the items database. No orphaned trade value entries are permitted.

### Property 5: Source Attribution Presence

WHEN a UI component renders a trade value badge, the `SOURCE_ATTRIBUTION` string SHALL also be rendered in the same view. This property must hold for every combination of items shown.
