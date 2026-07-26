# DClone API — Tasks

## Task Dependency Graph

```
1.1 Pure logic functions (clampProgress, mapRegionCode, mapModeCode, isStale)
 └─► 1.2 Property tests for pure logic
3.1 DB migration: dclone_progress v2 (composite PK + is_manual_override)
 └─► 3.2 DB migration: dclone_settings table
      └─► 4.1 Rust DCloneSettings model
           └─► 4.2 Rust DCloneApiRecord model
                └─► 5.1 Notifier helper
                     └─► 6.1 poll_dclone_api command
                          └─► 6.2 get_dclone_settings command
                               └─► 6.3 update_dclone_settings command
                                    └─► 6.4 update_dclone_progress (updated)
                                         └─► 6.5 get_dclone_progress (unchanged, verify)
                                              └─► 6.6 Register all new commands in lib.rs
                                                   └─► 7.1 Register commands
                                                        └─► ✓ CHECKPOINT 8
                                                             ├─► 9.1 CSP check
                                                             ├─► 10.1 TS types
                                                             │    └─► 11.1 API functions
                                                             └─► 11.1 + 10.1
                                                                  └─► 12.1–12.6 DCloneTracker.tsx
                                                                       └─► 13.1–13.2 Frontend tests
                                                                            └─► ✓ CHECKPOINT 14
```

---

## Tasks

### Phase 1 — Pure Logic Functions

- [x] 1.1 Extract pure logic functions to `dclone-helpers.ts` (or inline in `commands.rs` as module-level fns)
  - `clampProgress(n: number): number` — clamp to `[1, 6]`
  - `mapRegionCode(code: string): string` — maps "1"→"Americas", "2"→"Europe", "3"→"Asia", else "Unknown"
  - `mapModeCode(code: string): string` — maps "1"→"Non-Ladder", "2"→"Ladder", "3"→"Hardcore Non-Ladder", "4"→"Hardcore Ladder", else "Unknown"
  - `isStale(lastUpdated: string, pollIntervalMinutes: number): boolean` — true when elapsed > `pollIntervalMinutes × 2` minutes

- [x] 1.2 Write property-based tests for pure logic functions
  - P1: `clampProgress` always in `[1, 6]`
  - P2: `mapRegionCode` always returns a non-empty string
  - P3: `mapModeCode` always returns a non-empty string
  - P4: `isStale` returns `true` iff elapsed > threshold

### Phase 3 — DB Migrations

- [x] 3.1 `migrate_dclone_progress_v2(conn)` — recreate `dclone_progress` with composite PK
  - Check if `mode` column exists; if already migrated, return `Ok(())`
  - Create `dclone_progress_new` with `(region, mode)` PRIMARY KEY + `is_manual_override` column
  - Copy existing rows with `mode = 'Non-Ladder'`
  - Drop old table, rename new table
  - Call from `init_db`

- [x] 3.2 `migrate_dclone_settings(conn)` — create `dclone_settings` singleton table
  - `CREATE TABLE IF NOT EXISTS dclone_settings (id INTEGER PRIMARY KEY CHECK(id = 1), ...)`
  - `INSERT OR IGNORE` default row
  - Call from `init_db` after 3.1

### Phase 4 — Rust Models

- [x] 4.1 Add `DCloneSettings` struct to `models.rs`
  - Fields: `auto_fetch_enabled: bool`, `poll_interval_minutes: u32`, `notify_threshold: u8`, `preferred_region: String`, `preferred_mode: String`, `last_poll_at: Option<String>`, `last_notified_progress: Option<i64>`

- [x] 4.2 Add `DCloneApiRecord` struct to `models.rs`
  - Fields: `region: String`, `mode: String`, `progress: String`, `updated: String`
  - `#[allow(dead_code)]` on `updated` (kept for future use)

### Phase 5 — Notification Helper

- [x] 5.1 Notifier helper (frontend)
  - Compare preferred-region/mode progress against `notify_threshold`
  - Use `settings.last_notified_progress` to avoid repeat notifications
  - Update settings via `updateDcloneSettings` after firing

### Phase 6 — Rust Commands

- [x] 6.1 Implement `poll_dclone_api` in `commands.rs`
  - `async fn poll_dclone_api(state: State<'_, DbState>) -> Result<Vec<DCloneProgress>, String>`
  - Rate-limit check: read `last_poll_at`, return early if < 1 minute ago
  - `reqwest::Client` with 10s timeout
  - GET `https://diablo2.io/api/`
  - Parse JSON array of `DCloneApiRecord`
  - For each record: `map_region_code`, `map_mode_code`, `clamp_progress`
  - UPSERT `dclone_progress` WHERE NOT `is_manual_override = 1`
  - Update `last_poll_at`
  - Return all current rows

- [x] 6.2 Implement `get_dclone_settings` in `commands.rs`
  - SELECT from `dclone_settings WHERE id = 1`
  - Return defaults on `QueryReturnedNoRows`

- [x] 6.3 Implement `update_dclone_settings` in `commands.rs`
  - Validate `poll_interval_minutes ∈ {5, 10, 15, 30}`
  - Validate `notify_threshold ∈ [3, 6]`
  - UPSERT `dclone_settings WHERE id = 1`
  - Return saved `DCloneSettings`

- [x] 6.4 Update `update_dclone_progress` signature in `commands.rs`
  - Accept `mode: Option<String>` and `is_manual_override: Option<bool>`
  - Default `mode` to `"Non-Ladder"` if None
  - Clamp progress before UPSERT
  - UPSERT on `(region, mode)` composite key

- [x] 6.5 Verify `get_dclone_progress` still works correctly
  - SELECT all rows from `dclone_progress` ORDER BY `region, mode`
  - Confirm `is_manual_override` column is included in result

- [x] 6.6 Register all new/updated commands in `lib.rs`
  - Add `commands::poll_dclone_api`
  - Add `commands::get_dclone_settings`
  - Add `commands::update_dclone_settings`
  - Verify `commands::update_dclone_progress` already registered

### Phase 7 — Command Registration

- [x] 7.1 Verify `lib.rs` `invoke_handler` includes all 3 new commands
  - `commands::poll_dclone_api`
  - `commands::get_dclone_settings`
  - `commands::update_dclone_settings`

### Phase 8 — Checkpoint

- [x] 8. Rust compilation check — `cargo check` passes with zero warnings

### Phase 9 — CSP Verification

- [x] 9.1 Confirm `tauri.conf.json` CSP does not include diablo2.io domain
  - HTTP is issued from Rust; CSP stays restrictive

### Phase 10 — TypeScript Types

- [x] 10.1 Add/update types in `src/types.ts`
  - `DCloneProgress` — add `mode: string` and `is_manual_override: boolean` fields
  - `DCloneSettings` interface (new)
  - `DCLONE_REGIONS`, `DCLONE_MODES`, `DCLONE_POLL_INTERVALS` constants

### Phase 11 — API Functions

- [x] 11.1 Add/update API functions in `src/api.ts`
  - `pollDcloneApi()` → `invoke<DCloneProgress[]>("poll_dclone_api")`
  - `getDcloneSettings()` → `invoke<DCloneSettings>("get_dclone_settings")`
  - `updateDcloneSettings(settings)` → `invoke<DCloneSettings>("update_dclone_settings", { settings })`
  - `updateDcloneProgress(region, progress, mode?, isManualOverride?)` — updated signature

### Phase 12 — DCloneTracker.tsx Updates

- [x] 12.1 Add `settings` and `settingsError` state
  - Initial value matches default `DCloneSettings`

- [x] 12.2 Update `loadData` to call `getDcloneSettings` and `getAnniLogs`
  - localStorage migration logic for legacy `d2r-dclone-notify-threshold` and `d2r-dclone-preferred-region`

- [x] 12.3 Add polling `useEffect`
  - `setInterval(pollDcloneApi, pollIntervalMinutes × 60_000)`
  - Dependency array: `[settings.auto_fetch_enabled, settings.poll_interval_minutes]`
  - Cleanup: `clearInterval`

- [x] 12.4 Update progress grid to show all 4 modes per region
  - Map `DCLONE_REGIONS × DCLONE_MODES` to `getRegionModeProgress(region, mode)`
  - Show mode label in each sub-row

- [x] 12.5 Add stale indicator and manual-override badge
  - `isStale()` computed from `last_updated` and `poll_interval_minutes`
  - ⏰ icon with `title` attribute when stale
  - "Manual" badge + "Clear override" button when `is_manual_override = true`

- [x] 12.6 Add Settings section
  - Auto-Fetch toggle button
  - Poll Interval select (5/10/15/30 min)
  - Preferred Region select
  - Preferred Mode select
  - Notify at Progress select (3–6)
  - "Last API poll" timestamp display
  - Error banner on `settingsError`

### Phase 13 — Frontend Tests

- [x] 13.1 Property tests (`dclone.property.test.ts`)
  - P1–P4 for pure logic functions

- [x] 13.2 Unit tests (`DCloneTracker.test.tsx` or adjacent)
  - Settings display and toggle behavior
  - Stale indicator renders for old timestamps
  - Manual override badge and clear button

### Phase 14 — Final Checkpoint

- [x] 14. All checks pass
  - `npm test` — all tests green
  - `npx tsc --noEmit` — zero TS errors
  - `cargo check` — zero Rust warnings
  - `npx vite build` — build succeeds
