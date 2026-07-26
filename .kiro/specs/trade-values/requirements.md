# Requirements Document

## Introduction

The Trade Values feature adds inline trade-value badges to item lists in the Run Tracker and History pages of D2R Desktop. When an item appears in a logged run, a small colored badge displays an estimated community trade tier (HR+, Mid, Low, or Self-use) drawn from a curated static dataset. A user-controlled setting in the Settings page allows the badge display to be toggled on or off. The dataset is attributed to diablo2.io community price data.

## Glossary

- **Trade_Value_Category**: One of four tiers used to classify item trade value: `HR+`, `Mid`, `Low`, `Self-use`
- **Trade_Value_Entry**: A record pairing an item name to its `Trade_Value_Category`
- **TRADE_VALUES**: The static registry mapping item names to `Trade_Value_Entry` records
- **TradeValueBadge**: The React UI component that renders a colored inline badge for a given item name
- **TradeValueSettings**: The Settings page section containing the show/hide toggle for trade value badges
- **useTradeValueSettings**: The React hook that manages the `showTradeValues` boolean preference via `localStorage`
- **SOURCE_ATTRIBUTION**: A string displayed beneath item lists crediting the data source with a date stamp
- **Item_List**: A list of logged items rendered in the Run Tracker or History page

## Requirements

### Requirement 1: Static Trade Value Data

**User Story:** As a player, I want the app to contain curated trade value data for well-known D2R items so that I can quickly gauge an item's worth during or after a farming run.

#### Acceptance Criteria

1. THE TRADE_VALUES registry SHALL map item names to `Trade_Value_Entry` records, where each entry has exactly one `Trade_Value_Category` value (`HR+`, `Mid`, `Low`, or `Self-use`)
2. THE TRADE_VALUES registry SHALL cover high-value runewords, unique items, runes, and charms spanning all four tiers
3. EVERY key in TRADE_VALUES SHALL match an item name present in the application's `ALL_ITEMS` database
4. THE module SHALL export a `SOURCE_ATTRIBUTION` constant that credits diablo2.io and includes a date stamp in `YYYY-MM-DD` format
5. THE module SHALL export a `getTradeValue(itemName)` pure function that returns the `Trade_Value_Entry` for a known item or `null` for an unknown item
6. THE `getTradeValue` function SHALL be deterministic: the same input SHALL always return the same output

### Requirement 2: TradeValueBadge Component

**User Story:** As a player, I want to see a small colored badge next to each item name in my run history that shows its estimated trade tier at a glance.

#### Acceptance Criteria

1. THE TradeValueBadge component SHALL accept a single `itemName` prop of type `string`
2. WHEN `itemName` matches a known item, THE badge SHALL render with the CSS class `trade-badge` and the tier-specific class (`trade-badge-hr`, `trade-badge-mid`, `trade-badge-low`, or `trade-badge-selfuse`)
3. WHEN `itemName` does not match any known item, THE component SHALL render nothing (return `null`)
4. THE badge text SHALL display the category prefixed with a tilde, e.g. `~HR+`
5. THE badge `title` attribute SHALL include the `SOURCE_ATTRIBUTION` string so users can see the data source on hover
6. THE badge SHALL include an `aria-label` attribute containing the words "trade value" for screen reader accessibility

### Requirement 3: CSS Styling for Badges

**User Story:** As a player, I want each trade tier badge to have a distinct color so I can instantly distinguish HR+ items from lower-tier ones.

#### Acceptance Criteria

1. THE `.trade-badge` base class SHALL define shared badge styling (font size, padding, border-radius, display)
2. THE `.trade-badge-hr` class SHALL use a gold/amber color scheme to visually highlight high-rune-value items
3. THE `.trade-badge-mid` class SHALL use a neutral gray color scheme
4. THE `.trade-badge-low` class SHALL use a warm brown color scheme
5. THE `.trade-badge-selfuse` class SHALL use a dark neutral color scheme to de-emphasize self-use items

### Requirement 4: User Preference — Show/Hide Toggle

**User Story:** As a player who finds the badges distracting, I want to be able to turn off trade value badges globally so that item lists stay clean.

#### Acceptance Criteria

1. THE `useTradeValueSettings` hook SHALL expose a `showTradeValues` boolean and a `toggle` function
2. THE `showTradeValues` preference SHALL default to `true` when no value is stored in `localStorage`
3. WHEN the user calls `toggle`, THE preference SHALL flip and the new value SHALL be persisted to `localStorage` under the key `show_trade_values`
4. WHEN `localStorage` contains `"true"`, the hook SHALL return `showTradeValues = true`; when it contains `"false"`, it SHALL return `showTradeValues = false`
5. THE preference SHALL survive page reloads by reading from `localStorage` on initialization

### Requirement 5: Settings Page Integration

**User Story:** As a player, I want to find the trade value badge toggle in the Settings page so that I can easily configure the display.

#### Acceptance Criteria

1. THE Settings page SHALL include a `TradeValueSettings` section rendered after the existing screenshot settings panel
2. THE section SHALL display the current toggle state as `ON` or `OFF`
3. WHEN the user clicks the toggle button, THE `showTradeValues` preference SHALL update immediately

### Requirement 6: Run Tracker Integration

**User Story:** As a player actively farming, I want to see trade value badges next to items in the Run Tracker's live item list so that I can assess item value in real time.

#### Acceptance Criteria

1. WHEN `showTradeValues` is `true`, THE Run Tracker item list SHALL render a `TradeValueBadge` for each item
2. WHEN `showTradeValues` is `false`, THE Run Tracker item list SHALL not render any `TradeValueBadge`
3. WHEN `showTradeValues` is `true` and the item list is non-empty, THE Run Tracker SHALL display the `SOURCE_ATTRIBUTION` string beneath the item list

### Requirement 7: History Page Integration

**User Story:** As a player reviewing past runs, I want to see trade value badges next to items in the History page so that I can evaluate what I found.

#### Acceptance Criteria

1. WHEN `showTradeValues` is `true`, THE History page item list SHALL render a `TradeValueBadge` for each item
2. WHEN `showTradeValues` is `false`, THE History page item list SHALL not render any `TradeValueBadge`
3. WHEN `showTradeValues` is `true` and the selected run has items, THE History page SHALL display the `SOURCE_ATTRIBUTION` string beneath the item list
