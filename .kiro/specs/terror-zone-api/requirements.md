# Terror Zone API — Requirements

## Overview

Add a Terror Zone page to D2R Tracker that shows the currently active terror zone, upcoming zones for the next several hours, a personal performance comparison for the current zone, and a settings panel. Data can come from a live API fetch (routed through Rust) or from a deterministic single-player (SP) rotation calculation that requires no network access.

---

## Requirements

### 1. Rust HTTP Command

**1.1** A Tauri command `fetch_terror_zone` MUST issue an HTTP GET request to the terrorzonetracker.com API from the Rust backend using reqwest. The frontend MUST NOT make direct HTTP calls to external APIs.

**1.2** On a successful response, the command MUST parse the JSON, extract `current_zone` and an `upcoming` array, upsert the result into the `terror_zone_cache` table, and return a `TerrorZoneApiResponse`.

**1.3** On a non-2xx response or network error, the command MUST return an `Err(String)` with a descriptive message.

### 2. CSP

**2.1** The Content Security Policy in `tauri.conf.json` MUST NOT be widened to allow direct frontend-to-API connections. All external HTTP goes through Rust.

### 3. Rate-Limited Polling

**3.1** The frontend MUST NOT call `fetch_terror_zone` more often than once every 10 minutes. This 10-minute cooldown is tracked in a `lastFetchAt` React state variable (epoch ms). A value of `0` bypasses the rate limit (initial load or hour-boundary trigger).

**3.2** The polling loop MUST run a `setInterval` every 60 seconds that checks the elapsed time against the 10-minute cooldown before dispatching a fetch.

**3.3** On each new UTC hour boundary (detected when `secsUntilNextHour >= 3599` in the countdown timer), `lastFetchAt` MUST be reset to `0` so the next polling tick triggers an immediate fresh fetch.

**3.4** When polling is disabled (`settings.polling_enabled = false`), the polling `useEffect` MUST NOT start and any running timer MUST be cleared.

### 4. SQLite Persistence

**4.1** A `terror_zone_cache` table MUST store the most recent API response (singleton row, `id = 1`): `current_zone`, `next_zone`, `upcoming` (JSON array string), `fetched_at`.

**4.2** A `tz_settings` table MUST store user preferences (singleton row, `id = 1`): `polling_enabled` (bool), `good_tz_tier` (S/A/B/C).

**4.3** Both tables MUST be created with `CREATE TABLE IF NOT EXISTS` so they are safe to apply to existing databases.

**4.4** A `get_tz_cache` command MUST return the cached `TerrorZoneInfo` (with tier computed from zone name) or `null` if no cache row exists.

### 5. SP Deterministic Calculation

**5.1** A `get_sp_terror_zone(timestamp_unix: i64)` command MUST compute the active zone purely from the UTC timestamp, using the 65-zone rotation array and the formula `index = (timestamp_unix / 3600) mod 65`.

**5.2** The SP computation MUST use Euclidean division (`div_euclid`) so it handles negative timestamps correctly (relevant for testing).

**5.3** When `fetch_terror_zone` fails or polling is disabled, the frontend MUST fall back to `get_sp_terror_zone` for display.

### 6. TZ Display Component

**6.1** The TerrorZone page MUST display the active zone name and its tier badge (S/A/B/C) in the "Current Terror Zone" section.

**6.2** A countdown showing approximately how many minutes remain until the next hourly rotation MUST be displayed (updated every 60 seconds).

**6.3** If the fetched tier is A or S (or at/above `settings.good_tz_tier`), a "✓ Recommended" label MUST appear alongside the zone name.

### 7. TZ Calendar (Upcoming Zones)

**7.1** The page MUST display a table of 3–5 upcoming zones with their tier badge and their UTC start time.

**7.2** Upcoming zone data MUST come from the API response's `upcoming` array when polling is enabled and a fetch has succeeded. When that data is unavailable (polling disabled or fetch failed), the frontend MAY display SP-calculated placeholders.

**7.3** UTC start times MUST be formatted as `HH:MM UTC`.

### 8. Run Tracker Auto-Suggest (TzSuggestionBanner)

**8.1** When the active terror zone tier meets or exceeds `settings.good_tz_tier`, a `TzSuggestionBanner` component MUST suggest starting a run in the active zone.

**8.2** The banner MUST be dismissible (hidden after the user clicks dismiss, until the zone changes).

**8.3** The banner MUST NOT appear when `tzInfo` is null or the tier is below `good_tz_tier`.

### 9. Best-for-TZ Recommendation

**9.1** The "Your TZ Performance" section MUST compare the player's personal items/hour in the current zone (from `get_area_run_stats`) against their overall items/hour (from `get_stats_combined`).

**9.2** When the player has ≥ 3 runs in the current zone AND `zoneItemsPerHour >= avgItemsPerHour × 1.1`, the zone MUST be marked as "Recommended" with a ✓ indicator.

**9.3** When fewer than 3 runs have been recorded for the zone, a message indicating insufficient data MUST be shown instead.

### 10. TZ Settings

**10.1** The Settings section MUST allow toggling `polling_enabled` on/off.

**10.2** The Settings section MUST allow selecting `good_tz_tier` from S/A/B/C.

**10.3** Settings changes MUST be persisted immediately via `update_tz_settings`. On failure, the previous settings MUST be restored and an error message MUST be shown.

**10.4** `update_tz_settings` MUST validate that `good_tz_tier` is one of `S`, `A`, `B`, `C`.

### 11. Navigation

**11.1** The TerrorZone page MUST be reachable from the main navigation in `App.tsx`.

### 12. RunTracker Integration

**12.1** The Run Tracker page SHOULD show the current terror zone name when the user is selecting an area, so they can easily pick the active TZ as their run area.

### 13. Correctness Properties (proptest)

The following properties MUST be verified with proptest property-based tests in `src-tauri/src/tz/mod.rs`:

| # | Property |
|---|----------|
| P1 | `zone_at(t)` always returns a value contained in `TERROR_ZONES` |
| P2 | Any two timestamps within the same UTC hour produce the same zone name |
| P3 | Every hourly boundary produces a zone change (adjacent hours have different zones) |
| P4 | `RateLimiter` never allows a second dispatch within the cooldown window |
| P5 | `upcoming_zones(t, n)` returns exactly `n` entries with strictly increasing times (1-hour gaps) |
