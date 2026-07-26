# Design Document: Leaderboards

## Overview

The Leaderboards feature adds a dedicated page to D2R Tracker that surfaces a player's personal bests, month-over-month farming trends, seasonal archives, and shareable export cards — all computed entirely offline from the local SQLite database.

The design follows three principles already established in the codebase:

1. **Rust side owns data** — new Tauri commands handle SQL aggregation; no caching layer needed because SQLite is fast enough for these aggregations on typical run counts.
2. **TypeScript side owns presentation and export** — the community JSON schema is assembled entirely in TypeScript from the Rust-returned `PersonalBests` struct; no new Tauri command needed for export.
3. **Reuse before adding** — the monthly comparison view reuses the existing `get_comparison` command with `date_range` type, following the same pattern as the `Comparison.tsx` page.

### Key research notes

- **html2canvas 1.4.1** is the required version for the share card PNG export (per requirements). It renders a designated `<div ref>` to a canvas and returns a `Promise<HTMLCanvasElement>`, from which we call `canvas.toBlob()` → `Uint8Array` for Tauri `writeFile`.
- **fast-check** is already listed as a devDependency (`package.json`). Property tests will live in `src/pages/Leaderboards.property.test.ts` alongside the pure helper functions that compute personal bests from a run array.
- **SQLite transaction** support via `rusqlite` is used for the seasonal reset to satisfy the atomicity requirement (requirement 5.9).

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  src/pages/Leaderboards.tsx                              │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │PersonalBests│  │  Monthly   │  │ SeasonArchive +  │  │
│  │   Section   │  │ Comparison │  │  Export Actions  │  │
│  └──────┬──────┘  └─────┬──────┘  └────────┬─────────┘  │
│         │               │                  │             │
│  ┌──────▼───────────────▼──────────────────▼──────────┐  │
│  │  src/api.ts  (new functions)                        │  │
│  │  getPersonalBests  createSeason  getSeasons         │  │
│  │  getComparison (existing)                           │  │
│  └──────┬───────────────┬──────────────────┬──────────┘  │
└─────────┼───────────────┼──────────────────┼────────────┘
          │               │                  │
┌─────────▼───────────────▼──────────────────▼────────────┐
│  src-tauri/src/commands.rs  (new commands)               │
│  get_personal_bests   create_season   get_seasons        │
└─────────────────────────────────┬───────────────────────┘
                                  │  rusqlite
                          ┌───────▼───────┐
                          │  SQLite DB    │
                          │  runs/items   │
                          │  seasons      │
                          │  profiles     │
                          │  (+ new col)  │
                          └───────────────┘
```

Pure helper functions that compute personal bests from a `Run[]` array live in `src/pages/leaderboard-helpers.ts` and are tested with `fast-check` in `src/pages/Leaderboards.property.test.ts`. These helpers are called by the frontend to power the PNG share card and community JSON export without needing additional Tauri round-trips.

---

## Components and Interfaces

### New Tauri Commands

#### `get_personal_bests`

```rust
#[tauri::command]
pub fn get_personal_bests(
    state: State<DbState>,
    profile_id: String,
    since: Option<String>,   // ISO-8601 date string; None → no date filter
) -> Result<PersonalBests, String>
```

Executes four SQL `SELECT` statements with `rusqlite::params!` — no string interpolation. The `since` parameter maps to `WHERE r.finished_at >= ?2 AND r.finished_at IS NOT NULL AND r.duration_secs > 0` (for time-sensitive metrics). Tie-breaking uses `ORDER BY r.started_at DESC LIMIT 1`.

#### `create_season`

```rust
#[tauri::command]
pub fn create_season(
    state: State<DbState>,
    profile_id: String,
    name: String,
) -> Result<Season, String>
```

Runs inside a single `BEGIN IMMEDIATE ... COMMIT` transaction:
1. Validates name length (1–80 chars) and uniqueness per profile.
2. Checks the 50-season limit.
3. Calls the same personal-bests SQL as `get_personal_bests` (using the profile's current `season_start_date`).
4. Inserts a new row in `seasons` with `bests_snapshot_json`.
5. Updates `profiles.season_start_date = NOW()`.

On any error, the transaction rolls back automatically (Rust `rusqlite` transaction drops without commit).

#### `get_seasons`

```rust
#[tauri::command]
pub fn get_seasons(
    state: State<DbState>,
    profile_id: String,
) -> Result<Vec<Season>, String>
```

Returns rows from `seasons` ordered by `end_date DESC`.

### New TypeScript Helpers (`src/pages/leaderboard-helpers.ts`)

```typescript
// All functions take a Run[] + associated item counts map
export function computePersonalBests(runs: RunWithItemCount[]): PersonalBests
export function computeFastestRun(runs: RunWithItemCount[]): PersonalBest | null
export function computeBestItemsInRun(runs: RunWithItemCount[]): PersonalBest & { item_count: number } | null
export function computeBestItemsPerHour(runs: RunWithItemCount[]): PersonalBest & { items_per_hour: number } | null
export function computeLongestRun(runs: RunWithItemCount[]): PersonalBest | null
export function buildCommunityExportJson(profile: Profile, bests: PersonalBests, activeSeason: Season | null): CommunityExport
export function sanitizeFilename(name: string): string   // replaces /\:*?"<>| with _
export function getMonthBoundaries(now: Date): { startA: string; endA: string; startB: string; endB: string }
```

`RunWithItemCount` is a local type extending `Run` with `item_count: number` (fetched from the items table by the Rust command and included in the returned struct).

### New Page: `src/pages/Leaderboards.tsx`

Four `div.herald-section` sections within a `div.page`:

| Section | Content |
|---|---|
| Personal Bests | Table of 4 metrics with area, value, date |
| Monthly Comparison | Calls `getComparison` with computed date_range, reuses `showWarning` util |
| Season Archive | List of archived seasons; "Start New Season" button with confirmation |
| Export Actions | "Export Share Card (PNG)" and "Export Community JSON" buttons |

Share card is rendered from a `<div ref={shareCardRef}>` that contains the profile name, class, mode, 4 metrics, and export date. It is hidden from the normal layout (absolute position off-screen or `visibility: hidden`) until `html2canvas` captures it.

### App.tsx Changes

Add `"leaderboards"` to the `Page` union type and add a lazy import + nav button + case in `renderPage()`. The page requires a selected profile (same pattern as `Statistics`, `Achievements`, etc.).

---

## Data Models

### New TypeScript Types (add to `src/types.ts`)

```typescript
export interface PersonalBest {
  area: string;
  value: number;
  run_id: string;
  date: string;            // ISO-8601 date string
}

export interface PersonalBests {
  fastest_run: PersonalBest | null;
  best_items_in_run: (PersonalBest & { item_count: number }) | null;
  best_items_per_hour: (PersonalBest & { items_per_hour: number }) | null;
  longest_run: PersonalBest | null;
}

export interface Season {
  id: string;
  profile_id: string;
  name: string;
  start_date: string;      // ISO-8601
  end_date: string;        // ISO-8601
  bests_snapshot: PersonalBests;
  created_at: string;
}

// Used only by leaderboard-helpers.ts (not in types.ts)
// CommunityExport mirrors the JSON schema from requirement 4.3
```

### New Rust Models (add to `src-tauri/src/models.rs`)

```rust
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PersonalBest {
    pub area: String,
    pub value: f64,
    pub run_id: String,
    pub date: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PersonalBests {
    pub fastest_run: Option<PersonalBestRun>,
    pub best_items_in_run: Option<PersonalBestItemsInRun>,
    pub best_items_per_hour: Option<PersonalBestItemsPerHour>,
    pub longest_run: Option<PersonalBestRun>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PersonalBestRun {
    pub area: String,
    pub value: f64,
    pub run_id: String,
    pub date: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PersonalBestItemsInRun {
    pub area: String,
    pub value: f64,
    pub run_id: String,
    pub date: String,
    pub item_count: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PersonalBestItemsPerHour {
    pub area: String,
    pub value: f64,
    pub run_id: String,
    pub date: String,
    pub items_per_hour: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct Season {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub bests_snapshot: PersonalBests,
    pub created_at: String,
}
```

### Database Schema Changes

#### New `seasons` table (added in `db.rs` via `migrate_seasons`)

```sql
CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    bests_snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_seasons_profile ON seasons(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_profile_name ON seasons(profile_id, name);
```

#### `profiles` table migration (add `season_start_date` column)

```sql
ALTER TABLE profiles ADD COLUMN season_start_date TEXT DEFAULT NULL;
```

Added via `migrate_season_start_date(conn)` following the existing conditional-column-add pattern used throughout `db.rs`.

#### SQL queries in `get_personal_bests`

All four queries follow the same parameterized pattern:

```sql
-- Fastest run (lowest duration_secs > 0)
SELECT r.id, r.area, r.duration_secs, r.started_at
FROM runs r
WHERE r.profile_id = ?1
  AND r.status = 'completed'
  AND r.finished_at IS NOT NULL
  AND r.duration_secs > 0
  AND (?2 IS NULL OR r.finished_at >= ?2)
ORDER BY r.duration_secs ASC, r.started_at DESC
LIMIT 1;

-- Best items in run
SELECT r.id, r.area, r.started_at, COUNT(i.id) as item_count
FROM runs r
LEFT JOIN items i ON i.run_id = r.id
WHERE r.profile_id = ?1
  AND r.status = 'completed'
  AND r.finished_at IS NOT NULL
  AND (?2 IS NULL OR r.finished_at >= ?2)
GROUP BY r.id
ORDER BY item_count DESC, r.started_at DESC
LIMIT 1;

-- Best items per hour
SELECT r.id, r.area, r.started_at, r.duration_secs,
       (CAST(COUNT(i.id) AS REAL) / r.duration_secs) * 3600 AS items_per_hour,
       COUNT(i.id) as item_count
FROM runs r
LEFT JOIN items i ON i.run_id = r.id
WHERE r.profile_id = ?1
  AND r.status = 'completed'
  AND r.finished_at IS NOT NULL
  AND r.duration_secs > 0
  AND (?2 IS NULL OR r.finished_at >= ?2)
GROUP BY r.id
ORDER BY items_per_hour DESC, r.started_at DESC
LIMIT 1;

-- Longest run
SELECT r.id, r.area, r.duration_secs, r.started_at
FROM runs r
WHERE r.profile_id = ?1
  AND r.status = 'completed'
  AND r.finished_at IS NOT NULL
  AND (?2 IS NULL OR r.finished_at >= ?2)
ORDER BY r.duration_secs DESC, r.started_at DESC
LIMIT 1;
```

All queries use `rusqlite::params![profile_id, since]` — no string interpolation.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property-based testing applies here because the personal best calculation helpers and community export builder are **pure TypeScript functions** whose correctness must hold across all possible input shapes. The properties below are tested using `fast-check` in `src/pages/Leaderboards.property.test.ts`.

---

### Property 1: Fastest run is the minimum-duration run

*For any* non-empty set of completed runs with `duration_secs > 0`, the `computeFastestRun` helper SHALL return the run whose `duration_secs` equals `Math.min(...runs.map(r => r.duration_secs))`.

**Validates: Requirements 7.1**

---

### Property 2: Best items in run is the maximum-item-count run

*For any* non-empty set of completed runs, the `computeBestItemsInRun` helper SHALL return the run whose `item_count` equals `Math.max(...runs.map(r => r.item_count))`.

**Validates: Requirements 7.2**

---

### Property 3: Best items-per-hour is the maximum-rate run

*For any* non-empty set of completed runs with `duration_secs > 0`, the `computeBestItemsPerHour` helper SHALL return the run whose `(item_count / duration_secs) × 3600` value is the greatest among all runs in the set.

**Validates: Requirements 7.3**

---

### Property 4: Invalid runs are excluded from all metric calculations

*For any* set of runs that includes some runs with `duration_secs = 0` or `finished_at = null`, computing personal bests on the full set SHALL produce identical results to computing bests on the subset that excludes those invalid runs.

**Validates: Requirements 1.7, 7.4**

---

### Property 5: Adding a non-improving run does not change any personal best

*For any* non-empty set of runs R and any run r whose `duration_secs` is not less than the current fastest, whose `item_count` is not greater than the current best, and whose items-per-hour rate is not greater than the current best rate, `computePersonalBests(R ∪ {r})` SHALL equal `computePersonalBests(R)` for all four metrics.

**Validates: Requirements 7.5**

---

### Property 6: Personal best run_id is a member of the input run set

*For any* set of runs, every non-null personal best returned by `computePersonalBests` SHALL have a `run_id` that exists in the input run array. No interpolated or invented values are returned.

**Validates: Requirements 7.6**

---

### Property 7: Tie-breaking favors the most recent run

*For any* set of runs where two or more runs share the exact same value for a given metric, the personal best for that metric SHALL be the run with the highest `started_at` timestamp.

**Validates: Requirements 1.4**

---

### Property 8: Season date filter correctly scopes personal bests

*For any* set of runs and any `since` date, the personal bests computed with the `since` filter SHALL be identical to computing bests on the subset of runs where `finished_at >= since`.

**Validates: Requirements 1.3, 5.3**

---

### Property 9: Community export always contains all required top-level keys

*For any* profile state (with or without runs, with or without an active season), the object returned by `buildCommunityExportJson` SHALL always contain the keys `schema_version`, `exported_at`, `profile`, `personal_bests`, and `season`.

**Validates: Requirements 9.3, 4.3**

---

### Property 10: Community export JSON round-trip preserves all field values

*For any* profile and personal bests input, `JSON.parse(JSON.stringify(buildCommunityExportJson(...)))` SHALL produce an object with identical field values, all numeric fields shall have `typeof === "number"`, and all date fields shall be parseable by `Date.parse()`.

**Validates: Requirements 9.1, 9.2, 4.4, 9.5**

---

### Property 11: Null personal bests serialize as null, not omitted

*For any* profile where one or more personal best metrics are absent, all four `personal_bests` sub-keys SHALL be present in the serialized JSON output and SHALL have the value `null` rather than being omitted.

**Validates: Requirements 4.9, 9.4**

---

### Property 12: Filename sanitization removes all forbidden characters

*For any* string used as a profile name, `sanitizeFilename(name)` SHALL produce a string containing none of the characters `/ \ : * ? " < > |`.

**Validates: Requirements 3.8**

---

### Property 13: Month boundary computation is correct for all dates

*For any* `Date` value `now`, the result of `getMonthBoundaries(now)` SHALL produce `startA` on the first day of `now`'s month at 00:00:00 local time, `endA` on the first day of the following month at 00:00:00 local time, `startB` on the first day of the previous month at 00:00:00 local time, and `endB` equal to `startA`.

**Validates: Requirements 2.2**

---

## Error Handling

| Scenario | Handling |
|---|---|
| `get_personal_bests` DB error | Rust returns `Err(String)`; page shows inline error banner with retry button |
| `create_season` name too long / not unique | Rust returns `Err(String)` with descriptive message; UI shows error in confirmation dialog |
| `create_season` 50-season limit reached | Rust returns `Err("Season limit reached (max 50)")` |
| `create_season` DB mid-transaction failure | Transaction rolls back atomically; no partial state |
| `get_comparison` error in Monthly section | Inline error message within that section; retry button |
| html2canvas render failure | Error message shown in share card export section; view not dismissed |
| Tauri `save` dialog cancelled (PNG or JSON) | Silent abort; no error shown (per requirements 3.4, 4.5) |
| `writeFile` failure (PNG or JSON) | Error message shown in the export section distinguishing render vs write step |
| Profile has zero runs | Empty-state message in Personal Bests section; other sections still render |

All Rust commands use the `Result<T, String>` pattern matching all other commands in `commands.rs`. No `panic!` or `unwrap()` in the new code paths.

---

## Testing Strategy

### Unit Tests (example-based)

File: `src/pages/Leaderboards.test.tsx`

- Personal Bests section renders all four metric labels with a populated `PersonalBests` fixture
- Empty-state message renders when `PersonalBests` is all-null
- Share card `div` contains profile name, class, mode, and export date
- Monthly Comparison section labels read "This Month" / "Last Month"
- Low-sample warning appears when a period has fewer than 5 runs (via `showWarning` helper)
- `getMonthBoundaries` returns correct ISO strings for a known date
- `buildCommunityExportJson` returns the correct schema for a known input
- Second season archive immediately after first (with zero new runs) has null bests

### Property-Based Tests (fast-check)

File: `src/pages/Leaderboards.property.test.ts`

Each property test uses `fc.assert(fc.property(...))` with at least 100 runs (`{ numRuns: 100 }`). Each test block is tagged with a comment in the format:
`// Feature: leaderboards, Property N: <property_text>`

Generators needed:
- `arbRun`: generates a `RunWithItemCount` with arbitrary area, valid `duration_secs` (0 or positive), nullable `finished_at`, and `item_count >= 0`
- `arbValidRun`: same but always `duration_secs > 0` and `finished_at` is an ISO string
- `arbProfile`: generates a `Profile` with arbitrary name, class, mode, optional `magic_find`
- `arbPersonalBests`: generates a `PersonalBests` with independently nullable sub-fields
- `arbSeason`: generates a `Season` with start/end dates and a snapshot

**Tests implementing the 13 properties above:**

1. `computeFastestRun([...arbValidRun])` result has `value === Math.min(...durations)` — validates Property 1
2. `computeBestItemsInRun([...arbValidRun])` result has `item_count === Math.max(...counts)` — validates Property 2
3. `computeBestItemsPerHour([...arbValidRun])` result has the max rate — validates Property 3
4. `computePersonalBests(allRuns)` === `computePersonalBests(validSubset)` when mixed — validates Property 4
5. Adding a non-improving run preserves all bests — validates Property 5
6. All non-null `run_id`s in bests exist in input array — validates Property 6
7. Tied runs resolve to the one with the latest `started_at` — validates Property 7
8. Since-filter bests equal bests of filtered-array — validates Property 8
9. `buildCommunityExportJson` always has all 5 top-level keys — validates Property 9
10. JSON round-trip: types and values preserved — validates Property 10
11. Null bests serialize as `null` not omitted — validates Property 11
12. `sanitizeFilename` never contains forbidden chars — validates Property 12
13. `getMonthBoundaries` month-boundary correctness — validates Property 13

### Integration Tests

- Tauri command invocations are exercised via the existing `npm test` suite (Vitest with mocked `@tauri-apps/api/core`). The `invoke` mock is extended with `get_personal_bests`, `create_season`, and `get_seasons` return stubs.
- The `get_comparison` integration path for monthly comparison is tested by asserting the correct date strings are passed to the mock.

### Accessibility

- All buttons have visible labels and `aria-label` where icon-only
- The share card section uses `role="region"` and `aria-label="Share card preview"`
- Tables in Personal Bests and Season Archive use `<th scope="col">` headers
- Error messages use `role="alert"` for screen reader announcement
