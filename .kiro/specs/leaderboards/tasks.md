# Leaderboards — Tasks

## Task Dependency Graph

```
1.1 DB migrations
 └─► 2.1 Rust models
      └─► 3.1 get_personal_bests
           └─► 3.2 create_season
                └─► 3.3 get_seasons
                     └─► ✓ CHECKPOINT 4
                          ├─► 5.1 TS types
                          │    └─► 6.1 API functions
                          ├─► 7.1 leaderboard-helpers.ts
                          │    └─► 8.1–8.13 Property tests
                          └─► 6.1 + 7.1
                               └─► 9.1–9.4 Leaderboards.tsx
                                    └─► 10.1 App.tsx
                                         └─► 11.1 Unit tests
                                              └─► ✓ CHECKPOINT 12
```

---

## Tasks

### Phase 1 — Database Migrations

- [x] 1.1 Add `seasons` table and `profiles.season_start_date` column
  - `migrate_season_start_date(conn)` — `ALTER TABLE profiles ADD COLUMN season_start_date TEXT DEFAULT NULL` (guarded by column-existence check)
  - `migrate_seasons(conn)` — `CREATE TABLE IF NOT EXISTS seasons (id, profile_id, name, start_date, end_date, bests_snapshot_json, created_at)` + unique index on `(profile_id, name)`
  - Both called from `init_db` in `db.rs`

### Phase 2 — Rust Models

- [x] 2.1 Add `PersonalBests`, `Season` structs to `models.rs`
  - `PersonalBestRun { area, value, run_id, date }`
  - `PersonalBestItemsInRun { area, value, run_id, date, item_count }`
  - `PersonalBestItemsPerHour { area, value, run_id, date, items_per_hour }`
  - `PersonalBests { fastest_run, best_items_in_run, best_items_per_hour, longest_run }` (all Option)
  - `Season { id, profile_id, name, start_date, end_date, bests_snapshot, created_at }`

### Phase 3 — Rust Tauri Commands

- [x] 3.1 Implement `get_personal_bests(profile_id, since?)` in `commands.rs`
  - JOIN `runs` + `items`, filter by `status = 'completed'` and optional `finished_at >= since`
  - Compute all four metrics with recency tie-break
  - Return `PersonalBests` struct

- [x] 3.2 Implement `create_season(profile_id, name)` in `commands.rs`
  - Validate name length (1–80 chars)
  - Compute current personal bests (reuse query logic)
  - INSERT into `seasons`, UPDATE `profiles.season_start_date`
  - Return `Season`

- [x] 3.3 Implement `get_seasons(profile_id)` in `commands.rs`
  - SELECT from `seasons` WHERE `profile_id = ?` ORDER BY `created_at DESC`
  - Deserialize `bests_snapshot_json` for each row
  - Return `Vec<Season>`

### Phase 4 — Checkpoint

- [x] 4. Rust compilation check — `cargo check` passes with zero warnings

### Phase 5 — TypeScript Types

- [x] 5.1 Add `PersonalBest`, `PersonalBests`, `Season` interfaces to `src/types.ts`
  - `PersonalBest { area, value, run_id, date }`
  - `PersonalBests { fastest_run, best_items_in_run, best_items_per_hour, longest_run }`
  - `Season { id, profile_id, name, start_date, end_date, bests_snapshot, created_at }`

### Phase 6 — API Layer

- [x] 6.1 Add `getPersonalBests`, `createSeason`, `getSeasons` to `src/api.ts`
  - `getPersonalBests(profileId, since?)` → `invoke<PersonalBests>("get_personal_bests", ...)`
  - `createSeason(profileId, name)` → `invoke<Season>("create_season", ...)`
  - `getSeasons(profileId)` → `invoke<Season[]>("get_seasons", ...)`

### Phase 7 — Pure Helpers

- [x] 7.1 Write `src/pages/leaderboard-helpers.ts`
  - `RunWithItemCount` interface
  - `CommunityExport` interface (schema_version 1.0)
  - `computeFastestRun`, `computeBestItemsInRun`, `computeBestItemsPerHour`, `computeLongestRun`
  - `computePersonalBests`, `computePersonalBestsSince`
  - `buildCommunityExportJson`
  - `sanitizeFilename`
  - `getMonthBoundaries`

### Phase 8 — Property-Based Tests

- [x] 8.1 P1 — `computeFastestRun` returns minimum `duration_secs`
- [x] 8.2 P2 — `computeBestItemsInRun` returns maximum `item_count`
- [x] 8.3 P3 — `computeBestItemsPerHour` returns maximum rate
- [x] 8.4 P4 — Invalid runs (null `finished_at`) excluded from all metrics
- [x] 8.5 P5 — Non-improving run does not change any best
- [x] 8.6 P6 — Every returned `run_id` is a member of the input array
- [x] 8.7 P7 — Tie-break favors run with later `started_at`
- [x] 8.8 P8 — `computePersonalBestsSince` equals manually filtered subset bests
- [x] 8.9 P9 — `buildCommunityExportJson` has all 5 top-level keys
- [x] 8.10 P10 — JSON round-trip preserves all field values
- [x] 8.11 P11 — Null bests serialize as `null`, not omitted
- [x] 8.12 P12 — `sanitizeFilename` never contains `/ \ : * ? " < > |`
- [x] 8.13 P13 — `getMonthBoundaries` returns correct first-of-month boundaries

### Phase 9 — UI Component

- [x] 9.1 Personal Bests section
  - Table with Metric / Value / Area / Date columns
  - Empty state message when no runs exist
  - Error banner with Retry on load failure
  - Auto-refresh every 5 seconds via `setInterval`

- [x] 9.2 Monthly Comparison section
  - Reuse `getComparison` with `type: "date_range"` computed by `getMonthBoundaries`
  - Delta column with color-coded percentage change
  - Low-sample warning (⚠) when < 5 runs

- [x] 9.3 Season Archive section
  - "⊞ Start New Season" button → modal with name input (maxLength=80)
  - Archive table: Season / Date Range / Fastest / Best Items / Best /hr
  - Empty state when no seasons exist

- [x] 9.4 Export section
  - "◫ Export Share Card (PNG)" — html2canvas → Tauri save dialog → writeFile
  - "↓ Export Community JSON" — buildCommunityExportJson → Tauri save dialog → writeFile
  - Off-screen `<div ref={shareCardRef}>` for html2canvas target
  - Error banners for both export paths

### Phase 10 — App Integration

- [x] 10.1 Add Leaderboards route to `App.tsx`
  - Import `Leaderboards` from `./pages/Leaderboards`
  - Add nav item and route rendering

### Phase 11 — Unit Tests

- [x] 11.1 Write unit tests for `leaderboard-helpers.ts`
  - Edge cases: empty array, single run, all-invalid runs, identical values
  - `sanitizeFilename` with each forbidden character
  - `getMonthBoundaries` for January (tests month -1 wrap) and December (tests month 12 wrap)

### Phase 12 — Final Checkpoint

- [x] 12. All checks pass
  - `npm test` — all tests green
  - `npx tsc --noEmit` — zero TS errors
  - `cargo check` — zero Rust warnings
  - `npx vite build` — build succeeds
