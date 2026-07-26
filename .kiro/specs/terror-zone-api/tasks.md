# Implementation Plan: Terror Zone API Integration

## Overview

Implement the Terror Zone API integration end-to-end: a pure Rust logic module with deterministic SP rotation, five proptest properties, SQLite persistence, Tauri commands, TypeScript bindings, and three UI surfaces (TerrorZone page, RunTracker banner, Settings section). All outbound HTTP is routed through the Rust backend to satisfy the CSP constraint.

## Tasks

- [ ] 1. Implement Rust pure-logic module (`tz/mod.rs`)
  - [ ] 1.1 Create `src-tauri/src/tz/mod.rs` with `TERROR_ZONES` constant (63 zone names in D2R v3.2 rotation order), `rotation_index`, `zone_at`, `next_boundary`, `upcoming_zones`, `RateLimiter`, and `tier_for_zone`
    - Use `div_euclid` for all timestamp math to handle negative timestamps correctly
    - `RateLimiter` tracks `last_fetch_secs: Option<i64>` and `cooldown_secs: i64`; `should_fetch` updates `last_fetch_secs` on every dispatched call
    - `tier_for_zone` uses a `std::collections::HashMap<&str, &str>` (or `match`) mapping each zone to S/A/B/C
    - No Tauri dependencies — pure logic only
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 3.1, 3.3, 11.1–11.5_

  - [ ]* 1.2 Write five proptest properties in `#[cfg(test)] mod tests` inside `tz/mod.rs`
    - **Property 1: Zone membership** — `prop_zone_membership(t in any::<i64>())`: `zone_at(t)` is in `TERROR_ZONES` — **Validates: Requirements 11.1, 5.1**
    - **Property 2: Same-hour determinism** — `prop_same_hour_same_zone(t in any::<i64>(), offset in 0i64..3600)`: `zone_at(t)` equals `zone_at(t.div_euclid(3600) * 3600 + offset)` — **Validates: Requirements 11.2, 5.3**
    - **Property 3: Hourly boundary zone change** — `prop_boundary_zone_changes(hour in any::<i64>())`: `zone_at(hour.saturating_mul(3600))` differs from `zone_at(hour.saturating_mul(3600).saturating_sub(1))` — **Validates: Requirements 11.3**
    - **Property 4: Rate limit enforcement** — `prop_rate_limit_enforcement(start in 0i64..1_000_000, gaps in vec(1i64..599, 1..20))`: total dispatched fetches for a sequence where all gaps < 600s equals exactly 1 — **Validates: Requirements 11.4, 3.1, 3.3**
    - **Property 5: Upcoming zones strict monotonicity** — `prop_upcoming_monotonic(t in any::<i64>(), n in 2usize..8)`: every consecutive pair of scheduled times in `upcoming_zones(t, n)` differs by exactly 3600s — **Validates: Requirements 11.5, 5.5, 7.5**
    - Use `//` comments only before `proptest!` blocks — never `///` (see rust-conventions.md)
    - Configure each block with `#![proptest_config(ProptestConfig::with_cases(256))]`
    - _Requirements: 11.1–11.5_

- [ ] 2. Add SQLite migrations for TZ tables
  - [ ] 2.1 Add `terror_zone_cache` and `tz_settings` table creation to `init_db` in `src-tauri/src/db.rs`
    - `terror_zone_cache`: `id INTEGER PRIMARY KEY CHECK(id = 1)`, `current_zone TEXT NOT NULL`, `next_zone TEXT NOT NULL`, `upcoming TEXT NOT NULL` (JSON array), `fetched_at TEXT NOT NULL` (ISO-8601 UTC)
    - `tz_settings`: `id INTEGER PRIMARY KEY CHECK(id = 1)`, `polling_enabled INTEGER NOT NULL DEFAULT 1`, `good_tz_tier TEXT NOT NULL DEFAULT 'A'`
    - Both use singleton `id = 1` pattern (same as other settings tables in this codebase)
    - _Requirements: 4.1, 10.1, 10.2_

- [ ] 3. Implement Rust data models and Tauri commands (`tz/commands.rs`)
  - [ ] 3.1 Create `src-tauri/src/tz/commands.rs` with `TerrorZoneApiResponse`, `TerrorZoneInfo`, and `TzSettings` structs (all derive `Debug, Serialize, Deserialize, Clone`)
    - `TerrorZoneApiResponse`: `current_zone: String`, `next_zone: String`, `upcoming: Vec<String>`
    - `TerrorZoneInfo`: `zone_name: String`, `tier: String`, `fetched_at: Option<String>`
    - `TzSettings`: `polling_enabled: bool`, `good_tz_tier: String`
    - _Requirements: 1.3, 5.2_

  - [ ] 3.2 Implement `fetch_terror_zone` Tauri command in `tz/commands.rs`
    - Send GET to `https://www.terrorzonetracker.com/api/v1/tz` using `reqwest` with a 10-second timeout
    - On 200: parse JSON into `TerrorZoneApiResponse`; upsert result into `terror_zone_cache` via `INSERT OR REPLACE`
    - On non-200: return `Err("API returned status {code}")` without touching the cache
    - On parse failure: return `Err("Parse error: {serde_error}; raw body: {raw}")`
    - On network/timeout error: return `Err("Network error: {detail}")`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.2_

  - [ ] 3.3 Implement `get_sp_terror_zone`, `get_tz_cache`, `get_tz_settings`, and `update_tz_settings` Tauri commands in `tz/commands.rs`
    - `get_sp_terror_zone(timestamp_unix: i64)`: call `tz::zone_at` and `tz::tier_for_zone`, return `TerrorZoneInfo` with `fetched_at: None`
    - `get_tz_cache`: query `terror_zone_cache` for `id = 1`; return `Ok(None)` if empty
    - `get_tz_settings`: query `tz_settings` for `id = 1`; return defaults if empty
    - `update_tz_settings(settings: TzSettings)`: `INSERT OR REPLACE INTO tz_settings`; return `Err(String)` on DB failure (do not panic)
    - All DB access via `rusqlite::params!` — no string interpolation
    - _Requirements: 4.3, 4.4, 5.2, 10.1, 10.2, 10.4_

- [ ] 4. Register `tz` module and commands in `lib.rs`
  - [ ] 4.1 Add `pub mod tz;` to `src-tauri/src/lib.rs` alongside existing module declarations
    - Add `tz::commands::fetch_terror_zone`, `tz::commands::get_sp_terror_zone`, `tz::commands::get_tz_cache`, `tz::commands::get_tz_settings`, `tz::commands::update_tz_settings` to `tauri::generate_handler![]`
    - Verify `cargo check` reports zero warnings after this change
    - _Requirements: 1.1, 5.2_

- [ ] 5. Update CSP in `tauri.conf.json`
  - [ ] 5.1 Add `https://www.terrorzonetracker.com` to the `connect-src` directive in `tauri.conf.json`
    - Preserve all existing entries: `ipc:`, `http://ipc.localhost`, `https://github.com`, `https://api.github.com`
    - _Requirements: 2.1, 2.2_

- [ ] 6. Add TypeScript types and API functions
  - [ ] 6.1 Add `TerrorZoneApiResponse`, `TerrorZoneInfo`, `TzSettings`, and `UpcomingZoneEntry` interfaces to `src/types.ts`
    - `TerrorZoneInfo.tier` typed as `"S" | "A" | "B" | "C"`
    - `TzSettings.good_tz_tier` typed as `"S" | "A" | "B" | "C"`
    - `UpcomingZoneEntry`: `zone_name: string`, `tier: "S" | "A" | "B" | "C"`, `utc_start_secs: number`
    - _Requirements: 1.3, 5.2, 10.1, 10.2_

  - [ ] 6.2 Add `fetchTerrorZone`, `getSpTerrorZone`, `getTzCache`, `getTzSettings`, and `updateTzSettings` to `src/api.ts`
    - `getSpTerrorZone(timestampUnix: number)`: pass `Math.floor(timestampUnix)` as `timestampUnix` param
    - Import new types from `./types`
    - _Requirements: 1.1, 5.2, 4.3, 10.1, 10.2_

- [ ] 7. Implement `useTerrorZone` hook
  - [ ] 7.1 Create `src/hooks/useTerrorZone.ts`
    - Calls `getTzCache()` first; if result is null falls back to `getSpTerrorZone(Date.now() / 1000)`
    - Returns `{ tzInfo: TerrorZoneInfo | null, loading: boolean, error: string | null }`
    - Used by RunTracker to get passive TZ state without owning any polling logic
    - _Requirements: 4.3, 4.4, 5.2, 6.2, 6.3, 8.1_

- [ ] 8. Implement `TzSuggestionBanner` component
  - [ ] 8.1 Create `src/components/TzSuggestionBanner.tsx`
    - Props: `tzInfo: TerrorZoneInfo | null`, `isGoodTz: boolean`, `onApply: (zoneName: string) => void`
    - Renders nothing when `tzInfo` is null (requirement 8.4)
    - Shows zone name and tier badge; when `isGoodTz` is true shows a "⭐ Good TZ" label
    - Clicking the banner calls `onApply(tzInfo.zone_name)` to pre-fill the area selector
    - Accessible: `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 9. Implement `TerrorZone.tsx` page
  - [ ] 9.1 Create `src/pages/TerrorZone.tsx` with `TzDisplaySection`, `TzCalendarSection`, `TzAdvisorSection`, and `TzSettingsSection` sub-components
    - **TzDisplaySection** (Requirement 6): shows current zone name, `TierBadge`, countdown in minutes to next UTC boundary; updates countdown every 60 seconds via `setInterval`; shows loading skeleton when no data; auto-refreshes displayed zone when countdown reaches zero
    - **TzCalendarSection** (Requirement 7): displays 3–5 upcoming zones in ascending UTC order; each entry shows zone name, `TierBadge`, and UTC clock time formatted as "HH:00 UTC"; uses `upcoming` field from API response when in Online mode, falls back to `upcoming_zones` SP calculation
    - **TzAdvisorSection** (Requirement 9): calls `getAreaRunStats(profile.id, tzInfo.zone_name)` when a TZ is active; shows items/hour vs profile-wide average; shows "Recommended" label when TZ items/hour ≥ profile average × 1.1; shows tier-as-proxy with insufficiency note when < 3 runs; renders nothing when no TZ is active
    - **TzSettingsSection** (Requirement 10): polling toggle (default enabled) and tier threshold selector (S/A/B/C, default A); persists via `updateTzSettings`; on DB error retains in-memory state and shows "Settings not saved — database error" warning banner; polling toggle change applies immediately via state update (no restart required)
    - Polling / TZ_Scheduler logic: poll `fetchTerrorZone` at most once every 10 minutes while page is visible; bypass cooldown when countdown reaches zero (hour boundary); skip all polls when `polling_enabled` is false; call `getSpTerrorZone` for SP profiles
    - Import `getAreaRunStats` from `../api` for the advisor section
    - _Requirements: 3.1–3.6, 6.1–6.6, 7.1–7.5, 9.1–9.5, 10.1–10.5_

- [ ] 10. Integrate TerrorZone page into `App.tsx`
  - [ ] 10.1 Add `"terrorzone"` to the `Page` union type in `App.tsx`
    - Add `const TerrorZone = lazy(() => import("./pages/TerrorZone"))` alongside existing lazy imports
    - Add nav button `⚡ Terror Zone` (disabled when no profile) in the sidebar
    - Add `case "terrorzone": return selectedProfile ? <TerrorZone profile={selectedProfile} /> : <Profiles .../>` to `renderPage()`
    - _Requirements: 6.1_

- [ ] 11. Integrate `TzSuggestionBanner` into `RunTracker.tsx`
  - [ ] 11.1 Add `useTerrorZone` hook usage to `RunTracker.tsx`
    - Call `useTerrorZone()` to get `tzInfo`
    - Determine `isGoodTz`: call `getAreaRunStats` for the active profile and check if `tzInfo.zone_name` is in the user's top 5 areas with ≥ 3 runs; compare by items/hour
    - Render `<TzSuggestionBanner tzInfo={tzInfo} isGoodTz={isGoodTz} onApply={(zone) => setArea(zone)} />` above the area selector
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 12. Checkpoint — verify Rust and TypeScript compile cleanly
  - Run `cargo check` in `src-tauri/` — zero warnings required (see rust-conventions.md)
  - Run `npx tsc --noEmit` — zero type errors required
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Write frontend tests
  - [ ]* 13.1 Write `src/hooks/useTerrorZone.test.ts`
    - Mock `getTzCache` and `getSpTerrorZone` via `vi.mock('../api')`
    - Test SP fallback: when `getTzCache` returns null, hook calls `getSpTerrorZone`
    - Test null returned when both calls fail
    - _Requirements: 4.3, 4.4, 6.2_

  - [ ]* 13.2 Write `src/components/TzSuggestionBanner.test.tsx`
    - Render with non-null `tzInfo` — assert banner text includes zone name
    - Render with `tzInfo = null` — assert nothing is rendered
    - Render with `isGoodTz = true` — assert "⭐ Good TZ" label is present
    - Test `onApply` callback is called with zone name on click
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 13.3 Write `src/pages/TerrorZone.test.tsx`
    - Mock Tauri `invoke` via `vi.mock('@tauri-apps/api/core')`
    - Test countdown timer fires with 60-second interval
    - Test polling is skipped when `elapsed < 10 * 60 * 1000`
    - Test polling fires regardless of elapsed when hour boundary is detected
    - _Requirements: 3.1, 3.3, 3.5, 6.6_

- [ ] 14. Final checkpoint — all tests pass
  - Run `cargo test` in `src-tauri/` — all five property tests must pass
  - Run `npm test -- --run` — all frontend tests must pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The Rust module mirrors the `screenshot/` pattern: `tz/mod.rs` (pure logic) + `tz/commands.rs` (Tauri command layer) — add `pub mod tz;` to `lib.rs`
- All `proptest!` blocks use `//` comments only — never `///` — per rust-conventions.md
- `RateLimiter` in `tz/mod.rs` is a pure Rust mirror of the frontend scheduler, making property test P4 independent of any frontend state
- `terror_zone_cache` and `tz_settings` both use the `id = 1` singleton pattern (same as `tz_settings` and `screenshot_settings` tables)
- `fetch_terror_zone` must upsert the cache on every 200 response, so `get_tz_cache` always returns the most recent known TZ on app restart
- The frontend rate-limit guard in `TerrorZone.tsx` is checked before calling `fetchTerrorZone`; the hour-boundary flag bypasses the cooldown
- `TzSuggestionBanner` is purely presentational — it accepts `tzInfo` and `isGoodTz` props and emits `onApply`; RunTracker owns the stats query

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2", "7.1"] },
    { "id": 6, "tasks": ["8.1", "9.1"] },
    { "id": 7, "tasks": ["10.1", "11.1"] },
    { "id": 8, "tasks": ["13.1", "13.2", "13.3"] }
  ]
}
```
