# Terror Zone API — Tasks

## Task Dependency Graph

```
1.1 Rust pure-logic module (TERROR_ZONES, zone_at, rotation_index, upcoming_zones,
    next_boundary, tier_for_zone, RateLimiter)
 └─► 1.2 Proptest properties P1–P5 in mod.rs
2.1 DB migrations (terror_zone_cache + tz_settings tables)
 └─► 3.1 TerrorZoneApiResponse, TerrorZoneInfo, TzSettings Rust structs
      └─► 3.2 Tauri commands (fetch_terror_zone, get_sp_terror_zone, get_tz_cache,
               get_tz_settings, update_tz_settings)
           └─► 3.3 Register tz module + commands in lib.rs
                └─► ✓ CHECKPOINT 4
                     ├─► 5.1 CSP check
                     ├─► 6.1 TypeScript types (TerrorZoneInfo, TzSettings, etc.)
                     │    └─► 6.2 API functions in api.ts
                     └─► 6.2
                          └─► 7.1 useTerrorZone hook (or inline in component)
                               └─► 8.1 TzSuggestionBanner component
                                    └─► 9.1 TerrorZone.tsx page
                                         └─► 10.1 App.tsx integration
                                              └─► 11.1 RunTracker.tsx integration
                                                   └─► ✓ CHECKPOINT 12
                                                        └─► 13.1–13.3 Frontend tests
                                                             └─► ✓ CHECKPOINT 14
```

---

## Tasks

### Phase 1 — Rust Pure-Logic Module

- [x] 1.1 Write `src-tauri/src/tz/mod.rs`
  - `pub mod commands;` declaration
  - `pub const TERROR_ZONES: [&str; 65]` — all 65 zone names in D2R v3.2 rotation order
  - `pub fn rotation_index(unix_secs: i64) -> usize` — `div_euclid(3600).rem_euclid(65)`
  - `pub fn zone_at(unix_secs: i64) -> &'static str`
  - `pub fn next_boundary(unix_secs: i64) -> i64`
  - `pub fn upcoming_zones(unix_secs: i64, count: usize) -> Vec<(i64, &'static str)>`
  - `pub fn tier_for_zone(zone: &str) -> &'static str` — OnceLock HashMap, default "C"
  - `pub struct RateLimiter` + `impl RateLimiter { fn new, fn should_fetch }`

- [x] 1.2 Write 5 proptest properties in `mod.rs` `#[cfg(test)] mod tests`
  - P1: `prop_zone_membership` — `zone_at(t) ∈ TERROR_ZONES`
  - P2: `prop_same_hour_same_zone` — `zone_at(t) == zone_at(hour_start + offset)` for offset in `[0, 3600)`
  - P3: `prop_boundary_zone_changes` — `zone_at(hour * 3600) != zone_at(hour * 3600 - 1)`
  - P4: `prop_rate_limit_enforcement` — no second dispatch within cooldown window
  - P5: `prop_upcoming_monotonic` — exactly `n` entries with 3600s gaps
  - Use `//` (not `///`) before all `proptest!` macro invocations

### Phase 2 — DB Migrations

- [x] 2.1 Write `migrate_terror_zone(conn: &Connection)` in `db.rs`
  - `CREATE TABLE IF NOT EXISTS terror_zone_cache (id INTEGER PRIMARY KEY CHECK(id = 1), current_zone TEXT NOT NULL, next_zone TEXT NOT NULL, upcoming TEXT NOT NULL, fetched_at TEXT NOT NULL)`
  - `CREATE TABLE IF NOT EXISTS tz_settings (id INTEGER PRIMARY KEY CHECK(id = 1), polling_enabled INTEGER NOT NULL DEFAULT 1, good_tz_tier TEXT NOT NULL DEFAULT 'A')`
  - `INSERT OR IGNORE INTO tz_settings (id, polling_enabled, good_tz_tier) VALUES (1, 1, 'A')`
  - Call from `init_db` after all other migrations

### Phase 3 — Rust Data Models and Commands

- [x] 3.1 Write structs in `src-tauri/src/tz/commands.rs`
  - `TerrorZoneApiResponse { current_zone: String, next_zone: String, upcoming: Vec<String> }`
  - `TerrorZoneInfo { zone_name: String, tier: String, fetched_at: Option<String> }`
  - `TzSettings { polling_enabled: bool, good_tz_tier: String }`

- [x] 3.2 Write Tauri commands in `src-tauri/src/tz/commands.rs`
  - `pub async fn fetch_terror_zone(state: State<'_, DbState>)` — reqwest GET, JSON parse, cache upsert
  - `pub fn get_sp_terror_zone(timestamp_unix: i64)` — pure, calls `tz::zone_at` + `tz::tier_for_zone`
  - `pub fn get_tz_cache(state: State<DbState>)` — SELECT from `terror_zone_cache`
  - `pub fn get_tz_settings(state: State<DbState>)` — SELECT from `tz_settings`, defaults on miss
  - `pub fn update_tz_settings(state: State<DbState>, settings: TzSettings)` — validate tier, UPSERT

- [x] 3.3 Register `tz` module and commands in `src-tauri/src/lib.rs`
  - `pub mod tz;` declaration
  - Add to `invoke_handler!`:
    - `tz::commands::fetch_terror_zone`
    - `tz::commands::get_sp_terror_zone`
    - `tz::commands::get_tz_cache`
    - `tz::commands::get_tz_settings`
    - `tz::commands::update_tz_settings`

### Phase 4 — Checkpoint

- [x] 4. Rust compilation check — `cargo check` passes with zero warnings

### Phase 5 — CSP Verification

- [x] 5.1 Confirm `tauri.conf.json` CSP does not allow connections to terrorzonetracker.com
  - HTTP issued from Rust; CSP stays restrictive

### Phase 6 — TypeScript Types and API Functions

- [x] 6.1 Add TypeScript types to `src/types.ts`
  - `TerrorZoneApiResponse { current_zone, next_zone, upcoming }`
  - `TerrorZoneInfo { zone_name, tier, fetched_at }`
  - `TzSettings { polling_enabled, good_tz_tier }`
  - `UpcomingZoneEntry { zone_name, tier, utc_start_secs }`

- [x] 6.2 Add API functions to `src/api.ts`
  - `fetchTerrorZone()` → `invoke<TerrorZoneApiResponse>("fetch_terror_zone")`
  - `getSpTerrorZone(timestampUnix)` → `invoke<TerrorZoneInfo>("get_sp_terror_zone", { timestampUnix: Math.floor(...) })`
  - `getTzCache()` → `invoke<TerrorZoneInfo | null>("get_tz_cache")`
  - `getTzSettings()` → `invoke<TzSettings>("get_tz_settings")`
  - `updateTzSettings(settings)` → `invoke<TzSettings>("update_tz_settings", { settings })`

### Phase 7 — useTerrorZone Hook

- [x] 7.1 Implement state and effects (inline in `TerrorZone.tsx` or extracted to `src/hooks/useTerrorZone.ts`)
  - State: `tzInfo`, `upcoming`, `countdown`, `settings`, `settingsError`, `lastFetchAt`, `advisorData`
  - `loadInitial`: `getTzSettings` + `getTzCache` → fallback to `getSpTerrorZone`
  - Countdown `useEffect`: 60s interval, detect hour boundary (reset `lastFetchAt = 0`)
  - Polling `useEffect`: 60s interval, respect 10-min cooldown via `lastFetchAt`
  - Advisor `useEffect`: `getAreaRunStats` + `getStatsCombined` when `tzInfo` changes

### Phase 8 — TzSuggestionBanner Component

- [x] 8.1 Write `src/components/TzSuggestionBanner.tsx`
  - Props: `tzInfo: TerrorZoneInfo | null`, `settings: TzSettings`, `onDismiss: () => void`
  - Render only when `tzInfo?.tier` >= `settings.good_tz_tier`
  - Show zone name, tier badge, dismiss button
  - Keyboard accessible: `role="alert"` or appropriate ARIA

### Phase 9 — TerrorZone.tsx Page

- [x] 9.1 Write `src/pages/TerrorZone.tsx`
  - Section 1: Current TZ — zone name, TierBadge, "✓ Recommended" label, countdown, fetch timestamp
  - Section 2: Your TZ Performance — compare `zoneItemsPerHour` vs `avgItemsPerHour`; empty state < 3 runs
  - Section 3: Upcoming Zones — table with Zone / Tier / Active At (formatted as HH:MM UTC)
  - Section 4: Settings — polling toggle, good_tz_tier select, error alert
  - `TierBadge` local component with tier colors: S=#e94560, A=#ff8c00, B=#4ecdc4, C=#888
  - `formatUtcTime(utcSecs)` helper

### Phase 10 — App.tsx Integration

- [x] 10.1 Add TerrorZone page to `App.tsx`
  - Import `TerrorZone` from `./pages/TerrorZone`
  - Add nav item "⚡ Terror Zone"
  - Add route/case rendering the component

### Phase 11 — RunTracker Integration

- [x] 11.1 Update `RunTracker.tsx` to show active TZ
  - Display current zone name near the area selector
  - Optionally pre-select "Terror Zone" area when a high-tier TZ is active

### Phase 12 — Checkpoint

- [x] 12. All Rust and TypeScript checks pass
  - `cargo check` — zero warnings
  - `npx tsc --noEmit` — zero errors

### Phase 13 — Frontend Tests

- [x] 13.1 Unit tests for `TerrorZone.tsx`
  - Loading state renders correctly
  - Settings toggle persists and restores on error
  - Countdown display updates

- [x] 13.2 Unit tests for `TzSuggestionBanner`
  - Hidden when `tzInfo` is null
  - Hidden when tier is below threshold
  - Visible and dismissible when tier meets threshold

- [x] 13.3 Test `formatUtcTime` helper
  - `formatUtcTime(0)` → `"00:00 UTC"`
  - `formatUtcTime(3600)` → `"01:00 UTC"`
  - Handles single-digit hours/minutes with leading zero

### Phase 14 — Final Checkpoint

- [x] 14. All checks pass
  - `npm test` — all tests green
  - `npx tsc --noEmit` — zero TS errors
  - `cargo check` — zero Rust warnings
  - `npx vite build` — build succeeds
