# Implementation Plan: Leaderboards

## Overview

Implements the Leaderboards page for D2R Tracker, delivering personal bests, month-over-month farming trends, seasonal archives, and shareable export cards — all computed offline from the local SQLite database. The implementation follows the project's Rust-owns-data / TypeScript-owns-presentation split: new Tauri commands handle SQL aggregation, pure TypeScript helpers power the export logic, and the existing `get_comparison` command is reused for the monthly view.

## Tasks

- [ ] 1. Database migrations
  - [-] 1.1 Add `seasons` table and `profiles.season_start_date` column
    - In `src-tauri/src/db.rs`, add `migrate_seasons(conn: &Connection)` that runs the `CREATE TABLE IF NOT EXISTS seasons` DDL with `idx_seasons_profile` and `idx_seasons_profile_name` indexes as specified in the design
    - Add `migrate_season_start_date(conn: &Connection)` that executes `ALTER TABLE profiles ADD COLUMN season_start_date TEXT DEFAULT NULL`, handling "duplicate column" errors gracefully (skip if already migrated) following the existing conditional-column-add pattern in `db.rs`
    - Call both migration functions from the existing `init_db` or database setup function so they run on app startup
    - _Requirements: 5.2, 5.3, 5.4_

- [ ] 2. Rust data models
  - [~] 2.1 Add `PersonalBests` and `Season` model structs to `src-tauri/src/models.rs`
    - Add `PersonalBestRun`, `PersonalBestItemsInRun`, `PersonalBestItemsPerHour`, `PersonalBests`, and `Season` structs exactly as specified in the design, all with `#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]`
    - Ensure zero compiler warnings (`cargo check` must pass clean)
    - _Requirements: 1.1, 5.2_

- [ ] 3. Rust Tauri commands
  - [~] 3.1 Implement `get_personal_bests` command in `src-tauri/src/commands.rs`
    - Add `pub fn get_personal_bests(state: State<DbState>, profile_id: String, since: Option<String>) -> Result<PersonalBests, String>`
    - Execute the four parameterized SQL queries from the design (fastest run, best items in run, best items per hour, longest run) using `rusqlite::params!` — no string interpolation
    - Apply `WHERE r.finished_at IS NOT NULL AND r.duration_secs > 0` and `ORDER BY ... started_at DESC` tie-breaking as specified
    - _Requirements: 1.1, 1.3, 1.4, 1.7_

  - [~] 3.2 Implement `create_season` command in `src-tauri/src/commands.rs`
    - Add `pub fn create_season(state: State<DbState>, profile_id: String, name: String) -> Result<Season, String>`
    - Wrap all operations in a single `BEGIN IMMEDIATE ... COMMIT` transaction using `rusqlite`
    - Validate name is 1–80 chars and unique per profile; check 50-season limit; call personal-bests SQL with the profile's current `season_start_date`; insert into `seasons`; update `profiles.season_start_date = NOW()`
    - On any error the transaction rolls back automatically; return descriptive `Err(String)` for limit/validation failures
    - _Requirements: 5.1, 5.2, 5.3, 5.8, 5.9_

  - [~] 3.3 Implement `get_seasons` command in `src-tauri/src/commands.rs`
    - Add `pub fn get_seasons(state: State<DbState>, profile_id: String) -> Result<Vec<Season>, String>`
    - Query `seasons` table ordered by `end_date DESC`, deserializing `bests_snapshot_json` into `PersonalBests`
    - Register all three new commands in `src-tauri/src/lib.rs` `generate_handler!` list
    - _Requirements: 5.5_

- [~] 4. Checkpoint — Rust backend complete
  - Run `cd src-tauri && cargo check` and ensure zero warnings
  - Verify all three new commands compile and are registered in `generate_handler!`
  - Ask the user if questions arise.

- [ ] 5. TypeScript types
  - [~] 5.1 Add `PersonalBest`, `PersonalBests`, and `Season` interfaces to `src/types.ts`
    - Add `PersonalBest`, `PersonalBests`, and `Season` interfaces exactly as specified in the design's "New TypeScript Types" section
    - _Requirements: 1.1, 5.2_

- [ ] 6. API functions
  - [~] 6.1 Add `getPersonalBests`, `createSeason`, and `getSeasons` to `src/api.ts`
    - Add `getPersonalBests(profileId: string, since?: string)` invoking `"get_personal_bests"` with `{ profileId, since: since ?? null }`
    - Add `createSeason(profileId: string, name: string)` invoking `"create_season"` with `{ profileId, name }`
    - Add `getSeasons(profileId: string)` invoking `"get_seasons"` with `{ profileId }`
    - Import the new types from `./types`
    - _Requirements: 1.1, 5.2, 5.5_

- [ ] 7. Pure helper functions
  - [~] 7.1 Create `src/pages/leaderboard-helpers.ts` with all pure computation functions
    - Define local `RunWithItemCount` type extending `Run` with `item_count: number`
    - Define local `CommunityExport` type mirroring the JSON schema from requirement 4.3
    - Implement `computeFastestRun(runs: RunWithItemCount[]): PersonalBest | null` — returns min `duration_secs > 0`, tie-breaks by latest `started_at`; returns `null` if no valid runs
    - Implement `computeBestItemsInRun(runs: RunWithItemCount[]): (PersonalBest & { item_count: number }) | null` — returns max `item_count`, tie-breaks by latest `started_at`; filters out `finished_at = null`
    - Implement `computeBestItemsPerHour(runs: RunWithItemCount[]): (PersonalBest & { items_per_hour: number }) | null` — returns max `(item_count / duration_secs) × 3600`, excludes `duration_secs = 0`; filters `finished_at = null`
    - Implement `computeLongestRun(runs: RunWithItemCount[]): PersonalBest | null` — returns max `duration_secs`; filters `finished_at = null`
    - Implement `computePersonalBests(runs: RunWithItemCount[]): PersonalBests` — calls all four helpers and assembles the struct
    - Implement `buildCommunityExportJson(profile: Profile, bests: PersonalBests, activeSeason: Season | null): CommunityExport` — assembles the full schema with all required top-level keys; missing metrics serialize as `null`, not omitted
    - Implement `sanitizeFilename(name: string): string` — replaces `/\:*?"<>|` with `_`
    - Implement `getMonthBoundaries(now: Date): { startA: string; endA: string; startB: string; endB: string }` — computes first-of-current-month (startA), first-of-next-month (endA), first-of-previous-month (startB), first-of-current-month (endB) as ISO strings using local time
    - _Requirements: 1.1, 1.3, 1.4, 1.7, 2.2, 3.8, 4.3, 4.4, 4.9_

- [ ] 8. Property-based tests
  - [ ]* 8.1 Write property test — Property 1: Fastest run equals minimum-duration run
    - File: `src/pages/Leaderboards.property.test.ts`
    - Use `fc.array(arbValidRun, { minLength: 1 })` and assert `computeFastestRun(runs).value === Math.min(...runs.map(r => r.duration_secs))`
    - `// Feature: leaderboards, Property 1: Fastest run is the minimum-duration run`
    - **Validates: Requirements 7.1**

  - [ ]* 8.2 Write property test — Property 2: Best items in run equals maximum item count
    - Same file; use `fc.array(arbValidRun, { minLength: 1 })` and assert `computeBestItemsInRun(runs).item_count === Math.max(...runs.map(r => r.item_count))`
    - `// Feature: leaderboards, Property 2: Best items in run is the maximum-item-count run`
    - **Validates: Requirements 7.2**

  - [ ]* 8.3 Write property test — Property 3: Best items-per-hour equals maximum rate
    - Same file; assert that the returned run has the highest `(item_count / duration_secs) × 3600` among all valid runs
    - `// Feature: leaderboards, Property 3: Best items-per-hour is the maximum-rate run`
    - **Validates: Requirements 7.3**

  - [ ]* 8.4 Write property test — Property 4: Invalid runs excluded from all metrics
    - Mix `arbValidRun` and `arbInvalidRun` (duration_secs=0 or finished_at=null); assert `computePersonalBests(mixed)` equals `computePersonalBests(validSubset)`
    - `// Feature: leaderboards, Property 4: Invalid runs are excluded from all metric calculations`
    - **Validates: Requirements 1.7, 7.4**

  - [ ]* 8.5 Write property test — Property 5: Adding non-improving run changes no personal best
    - Build a run that does not improve any metric; assert `computePersonalBests(R ∪ {r})` equals `computePersonalBests(R)` for all four metrics
    - `// Feature: leaderboards, Property 5: Adding a non-improving run does not change any personal best`
    - **Validates: Requirements 7.5**

  - [ ]* 8.6 Write property test — Property 6: Personal best run_id is a member of the input set
    - Assert every non-null personal best `run_id` from `computePersonalBests(runs)` exists in `runs.map(r => r.id)`
    - `// Feature: leaderboards, Property 6: Personal best run_id is a member of the input run set`
    - **Validates: Requirements 7.6**

  - [ ]* 8.7 Write property test — Property 7: Tie-breaking favors most recent run
    - Generate two runs with identical metric values but different `started_at`; assert the one with the later `started_at` is chosen
    - `// Feature: leaderboards, Property 7: Tie-breaking favors the most recent run`
    - **Validates: Requirements 1.4**

  - [ ]* 8.8 Write property test — Property 8: Since-filter correctly scopes personal bests
    - Assert `computePersonalBests` on a since-filtered subset equals applying the filter manually then computing bests on the full set
    - `// Feature: leaderboards, Property 8: Season date filter correctly scopes personal bests`
    - **Validates: Requirements 1.3, 5.3**

  - [ ]* 8.9 Write property test — Property 9: Community export always contains all required top-level keys
    - Use `arbProfile`, `arbPersonalBests`, `arbSeasonOrNull`; assert all five keys (`schema_version`, `exported_at`, `profile`, `personal_bests`, `season`) always present
    - `// Feature: leaderboards, Property 9: Community export always contains all required top-level keys`
    - **Validates: Requirements 9.3, 4.3**

  - [ ]* 8.10 Write property test — Property 10: Community export JSON round-trip preserves all field values
    - Assert `JSON.parse(JSON.stringify(buildCommunityExportJson(...)))` produces identical field values; all numeric fields `typeof === "number"`; all date strings parseable by `Date.parse()`
    - `// Feature: leaderboards, Property 10: Community export JSON round-trip preserves all field values`
    - **Validates: Requirements 9.1, 9.2, 4.4, 9.5**

  - [ ]* 8.11 Write property test — Property 11: Null personal bests serialize as null, not omitted
    - Use a profile with no personal bests; assert all four `personal_bests` sub-keys are present and are `null`
    - `// Feature: leaderboards, Property 11: Null personal bests serialize as null, not omitted`
    - **Validates: Requirements 4.9, 9.4**

  - [ ]* 8.12 Write property test — Property 12: Filename sanitization removes all forbidden characters
    - Use `fc.string()` as input; assert `sanitizeFilename(s)` never contains any of `/ \ : * ? " < > |`
    - `// Feature: leaderboards, Property 12: Filename sanitization removes all forbidden characters`
    - **Validates: Requirements 3.8**

  - [ ]* 8.13 Write property test — Property 13: Month boundary computation is correct for all dates
    - Use `fc.date()` as `now`; assert `startA` is the first of `now`'s month, `endA` is the first of the next month, `startB` is the first of the previous month, `endB === startA`
    - `// Feature: leaderboards, Property 13: Month boundary computation is correct for all dates`
    - **Validates: Requirements 2.2**

- [ ] 9. Leaderboards page
  - [~] 9.1 Create `src/pages/Leaderboards.tsx` — Personal Bests section
    - Create the file with a `Leaderboards` component accepting `{ profile: Profile }` prop
    - Add Personal Bests section (`div.herald-section`) that calls `getPersonalBests` on mount and when `profile.id` changes (requirement 6.3)
    - Display a table with `<th scope="col">` headers for all four metrics (Fastest Run, Best Items in Run, Best Items Per Hour, Longest Run), including area, value, and date columns
    - Show empty-state message when all bests are null (requirement 1.2)
    - Show inline error banner with retry button on `get_personal_bests` failure
    - Set up a `useEffect` with a polling interval (≤5 s) or event listener so new run completions refresh the board without a full page reload (requirement 1.6)
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.8, 6.2, 6.3_

  - [~] 9.2 Add Monthly Comparison section to `Leaderboards.tsx`
    - Add Monthly Comparison section that calls `getComparison` with `type: "date_range"`, using `getMonthBoundaries(new Date())` to compute the four date boundary strings
    - Label periods as "This Month" and "Last Month" (requirement 2.5)
    - Display deltas for `items_per_hour`, `items_per_run`, `fastest_run_secs`, and `total_runs` as signed percentages; render `fastest_run_secs` negative delta in green (requirement 2.4)
    - Apply `showWarning` threshold (< 5 runs) on either period (requirement 2.6)
    - Handle zero-run months per requirements 2.3 and show inline error with retry on command failure (requirement 2.7)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [~] 9.3 Add Season Archive section to `Leaderboards.tsx`
    - Add Season Archive section that calls `getSeasons` and displays archived seasons ordered by end date descending (requirement 5.5), showing season name, date range, and archived personal best values
    - Add "Start New Season" button that opens a confirmation dialog prompting for a season name (1–80 chars); on confirm call `createSeason` (requirements 5.1, 5.2)
    - Show error message in the dialog for name validation failures, uniqueness violations, and the 50-season limit (requirements 5.1, 5.8)
    - On cancel, abort without modifying data (requirement 5.7)
    - After successful reset, reload seasons list and personal bests to reflect the new season start date (requirement 5.3)
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.7, 5.8_

  - [~] 9.4 Add Export Actions section to `Leaderboards.tsx`
    - Add Export Actions section with two buttons: "Export Share Card (PNG)" and "Export Community JSON"
    - Implement PNG export: render `<div ref={shareCardRef}>` (hidden off-screen) containing profile name, class, mode, four personal best metrics, and export date formatted as `YYYY-MM-DD`; capture via `html2canvas` 1.4.1; convert canvas to `Uint8Array` via `canvas.toBlob()`; prompt with Tauri `save` dialog filtered to `.png`; write with `@tauri-apps/plugin-fs` `writeFile`; use default filename from `sanitizeFilename` per requirement 3.8; show distinct error for render vs write failure; silent abort on dialog cancel (requirements 3.1–3.8)
    - Implement JSON export: assemble payload via `buildCommunityExportJson`; prompt Tauri `save` dialog filtered to `.json`; write UTF-8 with `writeFile`; use default filename per requirement 4.7; show persistent error on write failure; silent abort on dialog cancel; no network transmission (requirements 4.1–4.9)
    - The share card `div` must use `role="region"` and `aria-label="Share card preview"`; all buttons must have visible labels; error messages must use `role="alert"`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

- [ ] 10. App.tsx integration
  - [~] 10.1 Wire `Leaderboards` page into `App.tsx`
    - Add `"leaderboards"` to the `Page` union type
    - Add `const Leaderboards = lazy(() => import("./pages/Leaderboards"))` with the other lazy imports
    - Add a `case "leaderboards"` to `renderPage()` that renders `<Leaderboards profile={selectedProfile} />` when a profile is selected, or redirects to `<Profiles>` otherwise (same guard pattern as `Statistics`, `Achievements`)
    - Add a nav button in the sidebar `<ul>` labelled "Leaderboards" (requirement 6.1), `disabled={!selectedProfile}`, with an appropriate icon character consistent with the sidebar style
    - _Requirements: 6.1, 6.2, 6.4_

- [ ] 11. Example-based tests
  - [ ]* 11.1 Write unit tests in `src/pages/Leaderboards.test.tsx`
    - Test that Personal Bests section renders all four metric labels with a populated `PersonalBests` fixture
    - Test empty-state message renders when `PersonalBests` is all-null
    - Test share card `div` contains profile name, class, mode, and export date
    - Test Monthly Comparison section labels read "This Month" / "Last Month"
    - Test low-sample warning appears when a period has fewer than 5 runs
    - Test `getMonthBoundaries` returns correct ISO strings for a known date
    - Test `buildCommunityExportJson` returns the correct schema for a known input
    - Test second `createSeason` immediately after first (zero new runs) produces null bests in the second archive
    - Mock `@tauri-apps/api/core` `invoke` for `get_personal_bests`, `create_season`, `get_seasons` using existing mock patterns in the test suite
    - _Requirements: 1.1, 1.2, 2.5, 2.6, 3.7, 4.3, 5.2, 8.4_

- [~] 12. Final checkpoint — full verification
  - Run `npm test` and ensure all tests pass
  - Run `npx tsc --noEmit` and ensure zero TypeScript errors
  - Run `cd src-tauri && cargo check` and ensure zero warnings
  - Run `npx vite build` and ensure the bundle builds cleanly
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests validate the 13 correctness properties defined in the design document
- All Rust code must compile with zero warnings per project conventions; use `//` (not `///`) before any macro invocations
- All SQL uses `rusqlite::params!` — no string interpolation
- The `create_season` transaction must roll back atomically on any failure (requirement 5.9); no `unwrap()` or `panic!` in new code paths
- PNG export must use `html2canvas` 1.4.1 specifically; never use Blob URLs or `<a>` element click simulation
- The `share card` `<div>` is rendered off-screen and captured by `html2canvas` — it is not shown in the normal page layout until export time

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "8.11", "8.12", "8.13"] },
    { "id": 7, "tasks": ["9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3"] },
    { "id": 9, "tasks": ["9.4"] },
    { "id": 10, "tasks": ["10.1"] },
    { "id": 11, "tasks": ["11.1"] }
  ]
}
```
