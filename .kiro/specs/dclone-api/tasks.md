# Implementation Plan: DClone API Integration

## Overview

Implement live Diablo Clone progress tracking via the diablo2.io public API. The work proceeds
backend-first (pure-logic module → DB migrations → models → notifier → Tauri commands → CSP)
then frontend (TypeScript types → API functions → DCloneTracker.tsx updates and tests).

## Tasks

- [ ] 1. Implement pure-logic Rust module `dclone/mod.rs`
  - [ ] 1.1 Create `src-tauri/src/dclone/mod.rs` with region/mode mapping functions
    - Implement `code_to_region_name`, `region_name_to_code`, `code_to_mode_string`, `mode_string_to_code`
    - All four functions are pure; no I/O or state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [ ] 1.2 Add `clamp_progress`, `is_stale`, and `filter_by_rate_limit` to `dclone/mod.rs`
    - `clamp_progress(v: i64) -> u8` — clamps to [1, 6]
    - `is_stale(last_updated: &str, poll_interval_minutes: u32, now_rfc3339: &str) -> bool` — strict greater-than comparison
    - `filter_by_rate_limit(triggers: &[i64], min_interval_secs: i64) -> Vec<i64>` — filters by 5-min minimum
    - _Requirements: 3.1, 3.7, 5.1, 5.5, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 1.3 Write unit tests for mapping functions in `dclone/mod.rs` under `#[cfg(test)]`
    - `test_region_code_mapping` — all 6 valid mappings (3 regions × forward+inverse)
    - `test_mode_code_mapping` — all 8 valid mappings (4 modes × forward+inverse)
    - `test_invalid_region_returns_none` — codes "0", "4", "", "99"
    - `test_invalid_mode_returns_none` — codes "0", "5", "", "abc"
    - `test_clamp_progress_boundary` — inputs: 0→1, 1→1, 6→6, 7→6, -1→1
    - `test_is_stale_boundary` — exactly equal age is not stale; one second over is stale
    - _Requirements: 2.1–2.11, 3.1, 3.7, 5.5_

- [ ] 2. Write property-based tests for pure-logic functions
  - [ ]* 2.1 Write proptest for Property 1: Region Code Round-Trip Bijection
    - Use `prop_oneof!` over `{"1", "2", "3"}`
    - Assert `region_name_to_code(code_to_region_name(code)) == Some(code)`
    - Use regular `//` comments above `proptest!` macro (not `///`)
    - **Property 1: Region Code Round-Trip Bijection**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.10, 2.11**

  - [ ]* 2.2 Write proptest for Property 2: Mode Code Round-Trip Bijection
    - Use `prop_oneof!` over `{"1", "2", "3", "4"}`
    - Assert `mode_string_to_code(code_to_mode_string(code)) == Some(code)`
    - **Property 2: Mode Code Round-Trip Bijection**
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.10**

  - [ ]* 2.3 Write proptest for Property 3: Progress Clamping Invariant
    - Use `any::<i64>()` strategy
    - Assert `1 <= clamp_progress(v) && clamp_progress(v) <= 6` for all `v`
    - **Property 3: Progress Clamping Invariant**
    - **Validates: Requirements 3.1, 3.7**

  - [ ]* 2.4 Write proptest for Property 4: Stale Detection Consistency
    - Use `(0i64..=i64::MAX, 5u32..=30u32, 0i64..=i64::MAX)` for (last_updated_unix, interval, now_unix)
    - Convert unix timestamps to RFC 3339 strings; assert strict greater-than boundary
    - **Property 4: Stale Detection Consistency**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [ ]* 2.5 Write proptest for Property 5: Rate Limit Enforcement
    - Use `prop::collection::vec(0i64..86400i64, 1..20)` sorted ascending as trigger offsets
    - Assert every consecutive pair `(t1, t2)` in the result satisfies `t2 - t1 >= 300`
    - **Property 5: Rate Limit Enforcement**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [ ] 3. DB migrations
  - [ ] 3.1 Add `migrate_dclone_progress_v2` migration to `db.rs`
    - Create `dclone_progress_new` with composite `PRIMARY KEY (region, mode)`
    - Copy existing rows as `mode = 'Non-Ladder'`, `is_manual_override = 0`
    - Drop old table and rename; guard with `IF NOT EXISTS` / `INSERT OR IGNORE` for idempotency
    - Call `migrate_dclone_progress_v2` from `init_db`
    - _Requirements: 3.2, 3.5, 3.6_

  - [ ] 3.2 Add `dclone_settings` table migration to `db.rs`
    - Create table with `id INTEGER PRIMARY KEY CHECK(id = 1)` singleton pattern
    - `INSERT OR IGNORE` seed row with defaults: `auto_fetch_enabled=1`, `poll_interval_minutes=5`, `notify_threshold=5`, `preferred_region='Americas'`, `preferred_mode='Non-Ladder'`
    - Call from `init_db` after the dclone_progress migration
    - _Requirements: 8.1, 8.4_

- [ ] 4. Implement Rust models
  - [ ] 4.1 Update `DCloneProgress` struct in `models.rs`
    - Add `mode: String` and `is_manual_override: bool` fields
    - Derive `Debug, Serialize, Deserialize, Clone`
    - _Requirements: 3.5_

  - [ ] 4.2 Add `DCloneSettings` and `DCloneApiRecord` structs to `models.rs`
    - `DCloneSettings`: `auto_fetch_enabled`, `poll_interval_minutes: u32`, `notify_threshold: u8`, `preferred_region`, `preferred_mode`, `last_poll_at: Option<String>`, `last_notified_progress: Option<i64>`
    - `DCloneApiRecord`: `region: String`, `mode: String`, `progress: String`, `updated: String` (all strings as returned by API)
    - _Requirements: 8.1, 1.2_

- [ ] 5. Implement `dclone/notifier.rs`
  - [ ] 5.1 Create `src-tauri/src/dclone/notifier.rs` with `should_notify` and `format_notification_body`
    - `should_notify(region, mode, progress, settings) -> bool`: returns true iff `progress >= notify_threshold`, region/mode match preferred, and `progress != last_notified_progress`
    - `format_notification_body(region, mode, progress) -> String`: includes region, mode, progress value, and progress label (e.g., "Terrorizing")
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 5.2 Write proptest for Property 7: Notification Body Contains Required Fields
    - Use `(prop_oneof![...regions], prop_oneof![...modes], 1u8..=6u8)` strategy
    - Assert the body string contains region, mode, progress digit, and progress label
    - **Property 7: Notification Body Contains Required Fields**
    - **Validates: Requirements 7.3**

  - [ ]* 5.3 Write proptest for Property 8: Notification Deduplication
    - Use `1u8..=6u8` for progress and threshold
    - Assert `should_notify` returns false when `last_notified_progress == progress`
    - **Property 8: Notification Deduplication**
    - **Validates: Requirements 7.4**

- [ ] 6. Implement Tauri commands in `commands.rs`
  - [ ] 6.1 Implement `get_dclone_settings` and `update_dclone_settings` commands
    - `get_dclone_settings`: SELECT from `dclone_settings` WHERE id=1; return `DCloneSettings`
    - `update_dclone_settings`: validate `poll_interval_minutes ∈ [5,30]`, `notify_threshold ∈ [3,6]`, `preferred_region` and `preferred_mode` against allowed values; UPDATE and return updated record
    - Use `rusqlite::params!` for all queries (no string interpolation)
    - _Requirements: 8.1, 8.3, 8.4_

  - [ ]* 6.2 Write unit tests for `update_dclone_settings` validation
    - `test_settings_validation_rejects_invalid` — verify out-of-range `poll_interval_minutes` (4, 31) and `notify_threshold` (2, 7) return `Err`
    - _Requirements: 8.3, 4.5_

  - [ ]* 6.3 Write proptest for Property 9: Settings Range Validation
    - Use `any::<i64>()` for interval and threshold candidates
    - Assert accepted iff in valid range; boundary values 4, 31, 2, 7 must be rejected
    - **Property 9: Settings Range Validation**
    - **Validates: Requirements 8.3, 4.5**

  - [ ] 6.4 Update `update_dclone_progress` command signature and implementation
    - Add `mode: Option<String>` and `is_manual_override: Option<bool>` parameters
    - Upsert `dclone_progress` with composite key `(region, mode)`, persisting `is_manual_override`
    - Default `mode` to `"Non-Ladder"` if None; default `is_manual_override` to true on manual calls
    - _Requirements: 6.1, 6.5, 3.5_

  - [ ]* 6.5 Write proptest for Property 6: Manual Override Blocks API Overwrite
    - For any region/mode with `is_manual_override=true`, simulated poll must not alter `progress`
    - Verify flag remains true after the poll operation
    - **Property 6: Manual Override Blocks API Overwrite**
    - **Validates: Requirements 3.4, 6.2**

  - [ ] 6.6 Implement `poll_dclone_api` async Tauri command
    - Check `last_poll_at`; if < 5 min since last poll return current DB records (`Ok(Vec<DCloneProgress>)`)
    - Perform `reqwest::get("https://diablo2.io/api/dclone")` and handle non-200 and network errors
    - Parse response as `Vec<DCloneApiRecord>`; for each record: map codes, clamp progress, skip if `is_manual_override=true`, upsert DB, call `should_notify` and fire OS notification if warranted
    - Update `last_poll_at` and `last_notified_progress` in `dclone_settings`
    - Log warnings for unknown codes; log errors for failed upserts; continue processing on individual failures
    - Return `Ok(Vec<DCloneProgress>)` of all current records after processing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 7.1, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 6.7 Write unit tests for `poll_dclone_api` error handling
    - `test_poll_dclone_api_parse_error` — mock returning malformed JSON; verify `Err` returned
    - `test_poll_dclone_api_non200` — mock returning HTTP 500; verify `Err` returned
    - `test_manual_override_skipped` — pre-insert override record, run poll, verify progress unchanged
    - _Requirements: 1.3, 1.4, 1.5, 3.4_

- [ ] 7. Register new commands and wire dclone module in `lib.rs`
  - [ ] 7.1 Add `mod dclone;` declaration and register new Tauri commands in `lib.rs`
    - Add `mod dclone;` to `lib.rs` alongside existing module declarations
    - Register `commands::poll_dclone_api`, `commands::get_dclone_settings`, `commands::update_dclone_settings` in `invoke_handler`
    - Ensure `tauri_plugin_notification` is initialized: `.plugin(tauri_plugin_notification::Builder::new().build())`
    - _Requirements: 7.1, 1.1_

- [ ] 8. Checkpoint — verify Rust compilation
  - Run `cd src-tauri && cargo check` and confirm zero warnings. Ask the user if anything is unclear before continuing.

- [ ] 9. Update CSP in `tauri.conf.json`
  - [ ] 9.1 Add `https://diablo2.io` to the `connect-src` directive
    - Current value: `connect-src ipc: http://ipc.localhost https://github.com https://api.github.com`
    - New value: append `https://diablo2.io` to the same directive
    - _Requirements: 1.7_

- [ ] 10. TypeScript types in `src/types.ts`
  - [ ] 10.1 Update `DCloneProgress` interface and add `DCloneSettings`, `DCLONE_MODES`, `DCLONE_POLL_INTERVALS`
    - Update existing `DCloneProgress` to add `mode: string` and `is_manual_override: boolean`
    - Add `DCloneSettings` interface with all seven fields matching the Rust struct
    - Add `DCLONE_MODES` const tuple and `DCLONE_POLL_INTERVALS` const tuple
    - _Requirements: 8.1, 8.5_

- [ ] 11. TypeScript API functions in `src/api.ts`
  - [ ] 11.1 Add `pollDcloneApi`, `getDcloneSettings`, `updateDcloneSettings` and update `updateDcloneProgress`
    - `pollDcloneApi()`: `invoke<DCloneProgress[]>("poll_dclone_api")`
    - `getDcloneSettings()`: `invoke<DCloneSettings>("get_dclone_settings")`
    - `updateDcloneSettings(settings)`: `invoke<DCloneSettings>("update_dclone_settings", { settings })`
    - Update `updateDcloneProgress` signature to accept `mode?: string` and `isManualOverride?: boolean`; pass as `mode ?? null` and `isManualOverride ?? null`
    - Import `DCloneSettings` from `./types`
    - _Requirements: 8.4, 8.5, 4.1, 4.2, 4.3, 6.1, 6.3_

- [ ] 12. Update `DCloneTracker.tsx`
  - [ ] 12.1 Add settings state, on-mount data loading, and localStorage migration
    - Add `settings: DCloneSettings` state initialized to defaults
    - In `loadData`: call `getDcloneSettings()` and `getDcloneProgress()` in parallel; set both states
    - After loading settings: check `localStorage.getItem("d2r-dclone-notify-threshold")` and `"d2r-dclone-preferred-region"`. If present, call `updateDcloneSettings` with merged values; on success call `localStorage.removeItem` for each key
    - Remove old `notifyThreshold` / `preferredRegion` useState declarations that read from localStorage
    - _Requirements: 8.2, 8.4_

  - [ ] 12.2 Implement polling `useEffect` driven by `settings.auto_fetch_enabled` and `settings.poll_interval_minutes`
    - Create `setInterval` that calls `pollDcloneApi()` and updates progress state with returned records
    - Return cleanup function that calls `clearInterval`
    - Re-run the effect when `settings.auto_fetch_enabled` or `settings.poll_interval_minutes` change
    - On `pollDcloneApi` error: leave existing progress state unchanged (no-op on error)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 10.1, 10.3_

  - [ ] 12.3 Add stale indicator rendering
    - In the region card render, compute `isStale = Date.now() - new Date(rp.last_updated).getTime() > settings.poll_interval_minutes * 2 * 60_000`
    - Render a `⏰` or warning icon next to the region name when `isStale` is true; add `aria-label="Stale data"` for accessibility
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 10.2_

  - [ ] 12.4 Add manual override badge and clear-override control
    - Show a badge (e.g., "Manual") when `rp.is_manual_override === true`
    - Render a "Clear override" button alongside the badge; on click call `updateDcloneProgress(region, rp.progress, rp.mode, false)` then `loadData()`
    - Update `handleUpdateProgress` to pass `isManualOverride: true` when user clicks a progress button
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 12.5 Add settings section to replace localStorage controls
    - Replace `saveNotifySettings` and its localStorage writes with calls to `updateDcloneSettings`
    - Render controls: auto-fetch toggle, poll interval select (5/10/15/30), notify threshold select (3–6), preferred region select, preferred mode select (using `DCLONE_MODES`)
    - Update local `settings` state optimistically on each control change; call `updateDcloneSettings` and revert on error
    - _Requirements: 8.1, 8.3, 8.5, 4.5_

  - [ ] 12.6 Add mode display to region cards
    - Update `getRegionProgress` to return `DCloneProgress[]` for all modes of a region
    - Render one row per mode inside each region card, each showing its own progress bar and controls
    - _Requirements: 2.4–2.7_

- [ ] 13. Frontend tests
  - [ ]* 13.1 Write example-based tests in `DCloneTracker.test.tsx`
    - Mock `invoke` via `vi.mock("@tauri-apps/api/core")`
    - `renders last known progress on mount` — verify progress values from mocked `get_dclone_progress` appear
    - `settings are loaded from Tauri on mount` — verify `get_dclone_settings` is called and state reflects returned values
    - `localStorage migration fires updateDcloneSettings and removes keys` — set localStorage, mount, assert invoke called with merged settings and keys removed
    - `stale indicator appears when age exceeds interval×2` — provide `last_updated` in the past beyond threshold, assert stale icon present
    - `manual override badge shown when is_manual_override=true` — verify "Manual" badge present
    - `clear override button calls updateDcloneProgress with isManualOverride=false`
    - `setInterval created when auto_fetch_enabled=true` — spy on `setInterval`
    - `clearInterval called on unmount`
    - `error from pollDcloneApi does not clear existing progress state`
    - _Requirements: 5.1, 5.3, 5.4, 6.4, 8.2, 4.1, 4.2, 10.1_

  - [ ]* 13.2 Write property-based test in `DCloneTracker.property.test.tsx`
    - Use `fast-check` with `fc.record({ last_updated: fc.date(), poll_interval_minutes: fc.integer({ min: 5, max: 30 }) })`
    - Assert stale indicator is shown if and only if age strictly exceeds `poll_interval_minutes * 2` minutes
    - Follow existing `*.property.test.tsx` file convention; mock `invoke` for all Tauri calls
    - **Mirrors Rust Property 4 at the UI layer**
    - **Validates: Requirements 5.1, 5.5_**

- [ ] 14. Final checkpoint — verify full build
  - Run `npm test`, `npx tsc --noEmit`, `cd src-tauri && cargo check`, and `npx vite build`. Ensure all tests pass and zero warnings. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The polling timer lives entirely in the frontend (`setInterval` in `useEffect`) — there is no background Rust thread
- All Rust comments above `proptest!` blocks must use `//` not `///` (see rust-conventions.md)
- All SQL must use `rusqlite::params!` — no string interpolation
- `reqwest` must be added to `src-tauri/Cargo.toml` with the `json` feature if not already present; check before task 6.6
- `tauri-plugin-notification` must be added to `src-tauri/Cargo.toml` and `lib.rs` before task 7.1
- Checkpoints at tasks 8 and 14 provide incremental validation gates

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 9, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 10, "tasks": ["6.5", "6.6"] },
    { "id": 11, "tasks": ["6.7", "7.1"] },
    { "id": 12, "tasks": ["9.1", "10.1"] },
    { "id": 13, "tasks": ["11.1"] },
    { "id": 14, "tasks": ["12.1"] },
    { "id": 15, "tasks": ["12.2", "12.3", "12.4", "12.5", "12.6"] },
    { "id": 16, "tasks": ["13.1", "13.2"] }
  ]
}
```
