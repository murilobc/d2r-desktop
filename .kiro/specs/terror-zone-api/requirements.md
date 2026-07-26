# Requirements Document

## Introduction

The Terror Zone API Integration feature automatically fetches the current and upcoming Terror Zone (TZ) data from community APIs (terrorzonetracker.com) for online play, and uses a deterministic UTC-based rotation algorithm for Single Player mode. The feature surfaces the current TZ in the UI, displays a calendar of upcoming zones, integrates with the Run Tracker to auto-suggest the active TZ area, and leverages the player's historical area stats to rank TZ farming value. All HTTP traffic is routed through the Rust Tauri backend, and the last known TZ is persisted to SQLite so the app can recover across restarts without an API round-trip.

## Glossary

- **TZ_Fetcher**: The Rust Tauri command layer responsible for making outbound HTTP requests to the community Terror Zone API and returning the parsed result to the frontend.
- **TZ_Calculator**: The deterministic Rust logic that computes the active and upcoming Terror Zones from a UTC timestamp and the fixed rotation order for Single Player mode.
- **TZ_Store**: The SQLite persistence layer that stores the last known current TZ and the last successful API fetch timestamp.
- **TZ_Scheduler**: The frontend polling controller that manages when to call TZ_Fetcher based on the 10-minute rate limit and hourly boundary detection.
- **TZ_Display**: The React component that renders the current Terror Zone, tier, and countdown to the next rotation.
- **TZ_Calendar**: The React component that displays the upcoming TZ rotation (next 3–5 zones with their scheduled UTC times).
- **TZ_Advisor**: The logic layer (extending the existing advisor engine) that ranks the current TZ against the user's historical area performance and produces a suggestion.
- **Run_Tracker**: The existing run tracking page that records farming sessions by area.
- **TZ_Settings**: The settings panel section controlling polling enable/disable and the "good TZ" notification threshold.
- **Online_Mode**: A profile mode where area selection for runs is live (Ladder or Non-Ladder).
- **SP_Mode**: Single Player profile mode where no live API is available and the TZ is derived deterministically.
- **Rotation_Index**: The integer computed as `floor(UTC_epoch_seconds / 3600) mod len(TERROR_ZONES)` used to determine the active zone.
- **Top_N_Areas**: The user's top N farming areas ranked by items/hour from `get_area_run_stats`, used to determine whether the active TZ is a "preferred" zone.

---

## Requirements

### Requirement 1: Rust HTTP Command for TZ API

**User Story:** As a developer, I want all Terror Zone API calls to go through a Rust Tauri command, so that the app's Content Security Policy is not weakened and all HTTP traffic is centralised in the backend.

#### Acceptance Criteria

1. THE TZ_Fetcher SHALL expose a Tauri command named `fetch_terror_zone` that accepts no parameters and returns a structured TZ response.
2. WHEN `fetch_terror_zone` is invoked, THE TZ_Fetcher SHALL send an HTTP GET request to `https://www.terrorzonetracker.com/api/v1/tz`.
3. WHEN the API responds with a 200 status, THE TZ_Fetcher SHALL parse the JSON body into a `TerrorZoneApiResponse` struct containing `current_zone` (string), `next_zone` (string), and `upcoming` (ordered list of zone name strings).
4. IF the HTTP request fails or the server returns a non-200 status, THEN THE TZ_Fetcher SHALL return a structured error value (not panic) that the frontend can handle gracefully; any JSON content in a non-200 response SHALL be ignored.
5. IF the JSON response from a 200 status cannot be parsed, THEN THE TZ_Fetcher SHALL always return a structured parse-error value with the complete raw response body attached for diagnostics.
6. THE TZ_Fetcher SHALL set a request timeout of 10 seconds on every outbound HTTP call.

---

### Requirement 2: CSP Update

**User Story:** As a developer, I want the Content Security Policy in `tauri.conf.json` to allow connections to the Terror Zone API host, so that Tauri's webview does not block the IPC round-trip that triggers the Rust HTTP call.

#### Acceptance Criteria

1. THE App SHALL include `https://www.terrorzonetracker.com` in the `connect-src` directive of the CSP defined in `tauri.conf.json`.
2. THE App SHALL preserve all existing CSP entries (`ipc:`, `http://ipc.localhost`, `https://github.com`, `https://api.github.com`) when adding the new host.

---

### Requirement 3: Rate-Limited Polling

**User Story:** As a player, I want the app to poll the TZ API at a sensible interval, so that community servers are not abused and my battery and network are not wasted given TZs only change hourly.

#### Acceptance Criteria

1. THE TZ_Scheduler SHALL poll the TZ API at most once every 10 minutes while the TZ page is visible.
2. WHEN a poll returns a successful response, THE TZ_Scheduler SHALL record the timestamp of that successful fetch.
3. WHEN a poll is due and fewer than 10 minutes have elapsed since the last successful fetch, THE TZ_Scheduler SHALL drop the request; WHEN exactly 10 minutes have elapsed, THE TZ_Scheduler SHALL allow the poll.
4. WHEN the user navigates to the TZ page for the first time in a session and no successful fetch has been recorded, THE TZ_Scheduler SHALL trigger an immediate poll.
5. WHEN the app detects that the current UTC hour has turned over (a new TZ is now active), THE TZ_Scheduler SHALL trigger an immediate poll regardless of the 10-minute cooldown.
6. IF API polling is disabled in TZ_Settings, THEN THE TZ_Scheduler SHALL not issue any outbound requests.

---

### Requirement 4: SQLite Persistence

**User Story:** As a player, I want the last known Terror Zone to be saved to disk, so that the app can display the correct zone immediately on restart without waiting for an API response.

#### Acceptance Criteria

1. THE TZ_Store SHALL persist the current zone name, next zone name, and the UTC timestamp of the last successful fetch to a dedicated SQLite table named `terror_zone_cache`.
2. WHEN `fetch_terror_zone` returns a successful result, THE TZ_Store SHALL upsert the result into `terror_zone_cache`.
3. WHEN the app starts and no API fetch has yet completed, THE TZ_Store SHALL return the most recently persisted row from `terror_zone_cache` to the frontend as the initial TZ state.
4. IF `terror_zone_cache` is empty on startup, THEN THE TZ_Store SHALL return a null/empty result so the frontend can fall back to the SP calculator.

---

### Requirement 5: Single Player Deterministic Calculation

**User Story:** As a Single Player farmer, I want the app to show the correct Terror Zone based on the fixed game rotation, so that I can plan my sessions without an internet connection.

#### Acceptance Criteria

1. WHILE the active profile's mode is Single Player, THE TZ_Calculator SHALL compute the active zone using the formula: `rotation_index = floor(UTC_epoch_seconds / 3600) mod len(TERROR_ZONES)`.
2. THE TZ_Calculator SHALL expose a Tauri command named `get_sp_terror_zone` that accepts a UTC timestamp (Unix seconds as i64) and returns the zone name at that index.
3. FOR ALL valid UTC timestamps `T1` and `T2` where `floor(T1 / 3600) == floor(T2 / 3600)`, THE TZ_Calculator SHALL return the same zone name (same UTC hour → same zone).
4. FOR ALL valid UTC timestamps `T` where `floor(T / 3600) mod len(TERROR_ZONES) == k`, THE TZ_Calculator SHALL return `TERROR_ZONES[k]` (deterministic mapping).
5. THE TZ_Calculator SHALL compute the upcoming 5 zones by applying the formula with rotation indices `k+1` through `k+5`, each spaced 1 hour apart from the current boundary.

---

### Requirement 6: TZ Display Component

**User Story:** As a player, I want to see the currently active Terror Zone prominently in the app, so that I can decide whether to adjust my farming route.

#### Acceptance Criteria

1. THE TZ_Display SHALL show the current zone name, its tier badge (S/A/B/C), and a countdown in minutes to the next hourly UTC boundary.
2. WHEN the current mode is Online_Mode and polling is enabled, THE TZ_Display SHALL show the zone name sourced from the last successful API fetch or the SQLite cache.
3. WHEN the current mode is SP_Mode, THE TZ_Display SHALL show the zone name computed by TZ_Calculator for the current UTC time.
4. WHEN the countdown reaches zero, THE TZ_Display SHALL update the displayed zone to the next zone without requiring a manual page refresh.
5. IF no zone data is available (empty cache and no API response yet), THEN THE TZ_Display SHALL show a loading indicator; WHEN zone data becomes available, including at the exact moment a zone transition is detected, THE TZ_Display SHALL display the zone data and remove the loading indicator.
6. THE TZ_Display SHALL update the countdown every 60 seconds.

---

### Requirement 7: TZ Calendar (Upcoming Rotations)

**User Story:** As a player, I want to see the next 3–5 upcoming Terror Zones with their scheduled UTC start times, so that I can plan which hour to be online for a preferred zone.

#### Acceptance Criteria

1. THE TZ_Calendar SHALL display the next 3 to 5 upcoming zones in chronological order (earliest first).
2. EACH entry in THE TZ_Calendar SHALL show the zone name, tier badge, and the UTC clock time at which that zone becomes active (e.g., "18:00 UTC").
3. WHEN the current mode is Online_Mode, THE TZ_Calendar SHALL use the `upcoming` field from the last successful API response, supplemented by TZ_Calculator if the API provides fewer than 3 entries.
4. WHEN the current mode is SP_Mode, THE TZ_Calendar SHALL derive all upcoming entries from TZ_Calculator.
5. THE TZ_Calendar SHALL always display upcoming zones in strictly ascending order of scheduled start time.

---

### Requirement 8: Run Tracker Auto-Suggest Integration

**User Story:** As a player, I want the Run Tracker to automatically suggest the active Terror Zone area when it matches one of my preferred farming zones, so that I can start a TZ run with one click.

#### Acceptance Criteria

1. WHEN the Run Tracker area selector is rendered and a current TZ is active, THE Run_Tracker SHALL display a highlighted suggestion banner showing the active TZ zone name and tier.
2. WHEN the user clicks the TZ suggestion banner, THE Run_Tracker SHALL pre-fill the area selector with the active TZ zone name.
3. WHEN the active TZ zone name matches one of the user's Top_N_Areas (N = 5, measured by items/hour from `get_area_run_stats`), THE Run_Tracker SHALL visually distinguish the suggestion (e.g., a "⭐ Good TZ" label); THE Run_Tracker SHALL only apply this distinction for zones that are present in the user's top 5 farmed areas with at least 3 recorded runs.
4. WHEN no TZ data is available, THE Run_Tracker SHALL not render the suggestion banner.
5. THE Run_Tracker SHALL determine Top_N_Areas by calling `get_area_run_stats` for the active profile; areas with fewer than 3 recorded runs SHALL be excluded from the ranking.

---

### Requirement 9: "Best for This TZ" Recommendation

**User Story:** As a player, I want to see how my historical performance in the current Terror Zone compares to my overall farming average, so that I can make an informed decision about whether to farm the TZ.

#### Acceptance Criteria

1. WHEN a current TZ is active and the user has at least 3 runs in the TZ's associated areas, THE TZ_Advisor SHALL display the user's items/hour for that zone alongside the profile-wide average items/hour.
2. WHEN the TZ zone's items/hour is at least 10% above the profile-wide average, THE TZ_Advisor SHALL display a "Recommended" label.
3. WHEN the user has fewer than 3 runs in the TZ's areas, THE TZ_Advisor SHALL display the zone's tier (S/A/B/C) as a proxy recommendation with a note that personal data is insufficient.
4. THE TZ_Advisor SHALL call the existing `get_area_run_stats` Tauri command to retrieve per-area run data; it SHALL NOT duplicate the stats computation.
5. WHEN no TZ is active, THE TZ_Advisor SHALL not render the recommendation section; WHEN a TZ is active but the user has no run data for that zone, THE TZ_Advisor SHALL render the section showing the tier as a proxy (per AC 3).

---

### Requirement 10: TZ Settings

**User Story:** As a player, I want to control whether the app polls the TZ API and configure at what tier the app should notify me of a good TZ, so that I can tailor the feature to my play style.

#### Acceptance Criteria

1. THE TZ_Settings SHALL provide a toggle to enable or disable API polling; the default state is enabled.
2. THE TZ_Settings SHALL provide a tier threshold selector (S, A, B, C) for "good TZ" notifications; the default threshold is A.
3. WHEN API polling is disabled, THE TZ_Settings SHALL display a note indicating that SP calculation will be used instead.
4. THE TZ_Settings SHALL persist the polling toggle and tier threshold to SQLite via the existing app settings storage mechanism; IF the database write fails, THEN THE TZ_Settings SHALL retain the in-memory setting change and display a warning to the user that the preference was not saved.
5. WHEN the polling toggle is changed, THE TZ_Scheduler SHALL immediately apply the new setting without requiring an app restart.

---

### Requirement 11: Correctness Properties

**User Story:** As a developer, I want key algorithmic components covered by property-based tests, so that edge cases like hourly boundaries and rate-limit enforcement are verified across arbitrary inputs.

#### Acceptance Criteria

1. FOR ALL valid UTC Unix timestamps `T`, THE TZ_Calculator SHALL return a zone name that is a member of the `TERROR_ZONES` list (no out-of-bounds result).
2. FOR ALL pairs of UTC timestamps `(T1, T2)` where `floor(T1 / 3600) == floor(T2 / 3600)`, THE TZ_Calculator SHALL return the same zone name (same-hour determinism).
3. FOR ALL UTC timestamps `T` at an exact hourly boundary (i.e., `T mod 3600 == 0`), THE TZ_Calculator applied to `T - 1` SHALL return a different zone than when applied to `T` (boundary detection — zone changes on the hour).
4. FOR ALL sequences of fetch attempts `[t0, t1, t2, …]` where every consecutive pair satisfies `t_i+1 - t_i < 600` seconds, THE TZ_Scheduler SHALL drop all requests after the first one, issuing only a single outbound request for the entire sequence (rate limit enforcement — subsequent requests within 10 minutes are dropped, not queued).
5. FOR ALL upcoming zone lists produced by TZ_Calculator with a start index `k` and count `n`, the scheduled times SHALL be strictly monotonically increasing by exactly 3600 seconds per entry (chronological ordering invariant).
