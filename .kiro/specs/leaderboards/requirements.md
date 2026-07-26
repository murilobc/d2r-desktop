# Leaderboards — Requirements

## Overview

A Leaderboards page that shows a player's personal-best stats across four key metrics, compares this month's performance to last month's, lets the player archive seasonal data, and exports results as a shareable PNG card or a community JSON file.

---

## Requirements

### 1. Personal Bests Board

**1.1** The system MUST compute and display four personal-best metrics for the active profile:
- **Fastest Run** — minimum `duration_secs` among completed runs
- **Best Items in Run** — maximum item count among completed runs
- **Best Items per Hour** — maximum `(item_count / duration_secs) × 3600` rate among timed completed runs
- **Longest Run** — maximum `duration_secs` among completed runs

**1.2** Each metric entry MUST display the value, the area it was achieved in, and the date (YYYY-MM-DD).

**1.3** Runs with `finished_at = NULL` MUST be excluded from all metric calculations. Timed metrics (Fastest Run, Best Items/Hour) additionally exclude runs where `duration_secs = 0`.

**1.4** When two runs tie on a metric value, the one with the later `started_at` MUST win (recency tie-break).

**1.5** The board MUST refresh automatically every 5 seconds while the page is open.

**1.6** If `profile.season_start_date` is set, personal bests MUST be scoped to runs whose `finished_at >= season_start_date`.

### 2. Monthly Comparison

**2.1** The system MUST display a side-by-side comparison of the current month vs. the previous calendar month, reusing the existing `get_comparison` Tauri command with `type: "date_range"`.

**2.2** The comparison table MUST show Total Runs, Items/Hour, Items/Run, and Fastest Run, including a delta column (percentage change, lower-is-better for Fastest Run).

**2.3** A low-sample-size warning icon (⚠) MUST appear next to a month column header when that month has fewer than 5 runs.

### 3. Season Archive

**3.1** A "Start New Season" button MUST open a modal dialog where the player enters a season name (1–80 characters).

**3.2** Confirming the dialog MUST:
1. Snapshot the current personal bests into a new `seasons` row.
2. Record `start_date = NOW()` and `end_date = NOW()` at the moment of archival.
3. Set `profiles.season_start_date = NOW()` so future personal-bests queries are scoped to the new season.
4. Return the created `Season` record.

**3.3** The season archive table MUST be displayed with columns: Season name, date range, Fastest, Best Items, Best /hr.

**3.4** Season names MUST be unique per profile (enforced at the database level).

### 4. Export

**4.1** A "Export Share Card (PNG)" button MUST capture the off-screen share-card `<div>` via html2canvas and save it as a PNG file using Tauri's native save dialog (plugin-dialog + plugin-fs).

**4.2** The PNG export default filename MUST follow the pattern `d2r_leaderboard_<sanitized_profile_name>_<YYYY-MM-DD>.png`.

**4.3** A "Export Community JSON" button MUST save a structured JSON file following schema version `"1.0"`, containing:
- `schema_version`, `exported_at`, `profile` (name, class, mode, magic_find)
- `personal_bests` (fastest_run, best_items_in_run, best_items_per_hour, longest_session_secs — all nullable)
- `season` (name, start_date — both nullable when no active season)

**4.4** The JSON export default filename MUST follow the pattern `d2r_leaderboard_<sanitized_profile_name>_<YYYY-MM-DD>.json`.

**4.5** Filename sanitization MUST replace the characters `/ \ : * ? " < > |` with `_`.

### 5. Navigation

**5.1** The Leaderboards page MUST be reachable from the main navigation in `App.tsx`.

### 6. Database

**6.1** A `seasons` table MUST exist with columns: `id`, `profile_id`, `name`, `start_date`, `end_date`, `bests_snapshot_json`, `created_at`.

**6.2** A `season_start_date TEXT DEFAULT NULL` column MUST exist on the `profiles` table.

**6.3** Both migrations MUST be additive (no data loss) and use `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN` patterns.

### 7. Rust Tauri Commands

**7.1** `get_personal_bests(profile_id, since?)` — queries runs + items, computes the four metrics, returns a `PersonalBests` struct.

**7.2** `create_season(profile_id, name)` — validates name (1–80 chars), snapshots bests, updates `season_start_date`, returns the new `Season` struct.

**7.3** `get_seasons(profile_id)` — returns all seasons for a profile ordered by `created_at DESC`.

### 8. Pure TypeScript Helpers

**8.1** A `leaderboard-helpers.ts` module MUST contain pure functions for computing all four metrics client-side (`computeFastestRun`, `computeBestItemsInRun`, `computeBestItemsPerHour`, `computeLongestRun`, `computePersonalBests`, `computePersonalBestsSince`) plus `buildCommunityExportJson`, `sanitizeFilename`, and `getMonthBoundaries`. No I/O or React imports.

### 9. Correctness Properties (PBT)

The following properties MUST be verified with fast-check property-based tests:

| # | Property |
|---|----------|
| P1 | `computeFastestRun` returns the minimum `duration_secs` from valid runs |
| P2 | `computeBestItemsInRun` returns the maximum `item_count` from valid runs |
| P3 | `computeBestItemsPerHour` returns the maximum rate from valid timed runs |
| P4 | Invalid runs (null `finished_at`) are excluded from all metric calculations |
| P5 | Adding a non-improving run does not change fastest or best-items bests |
| P6 | Every personal-best `run_id` is a member of the input run array |
| P7 | Tie-breaking favors the run with the later `started_at` |
| P8 | `computePersonalBestsSince` equals `computePersonalBests` on the manually filtered subset |
| P9 | `buildCommunityExportJson` always contains all 5 required top-level keys |
| P10 | Community export JSON round-trips cleanly through `JSON.parse(JSON.stringify(...))` |
| P11 | Null personal bests serialize as `null`, not omitted from the JSON |
| P12 | `sanitizeFilename` never contains forbidden filesystem characters |
| P13 | `getMonthBoundaries` returns correct first-of-month boundaries for any date |
