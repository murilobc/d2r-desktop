# DClone API — Requirements

## Overview

Upgrade the Diablo Clone Tracker to fetch live progress data from the diablo2.io public API via a Rust HTTP command (reqwest), persist settings and overrides in SQLite, display a stale-data indicator, and show push notifications when progress crosses a configurable threshold.

---

## Requirements

### 1. HTTP Routing Through Rust

**1.1** All HTTP requests to the diablo2.io API MUST be issued from the Rust backend using reqwest, not from the frontend. The frontend invokes a Tauri command (`poll_dclone_api`) which returns the result.

**1.2** The CSP in `tauri.conf.json` MUST NOT be loosened to allow frontend-to-API connections. The existing restrictive CSP stays intact.

### 2. Region and Mode Mapping

**2.1** Progress records MUST be tracked per `(region, mode)` pair. Supported regions are `Americas`, `Europe`, `Asia`. Supported modes are `Non-Ladder`, `Ladder`, `Hardcore Non-Ladder`, `Hardcore Ladder`.

**2.2** The API returns numeric region codes and mode codes. The Rust command MUST map these to human-readable strings before persisting or returning them.

**2.3** API region codes: `1 = Americas`, `2 = Europe`, `3 = Asia`. API mode codes: `1 = Non-Ladder`, `2 = Ladder`, `3 = Hardcore Non-Ladder`, `4 = Hardcore Ladder`.

### 3. Progress Clamping and Persistence

**3.1** Progress values from the API MUST be parsed as integers and clamped to the range `[1, 6]`. Values outside this range MUST be silently clamped (not rejected).

**3.2** Each `(region, mode)` pair MUST be persisted in the `dclone_progress` table with `region`, `mode`, `progress`, `last_updated`, and `is_manual_override` columns.

**3.3** The `dclone_progress` table primary key MUST be a composite `(region, mode)` to support all 12 combinations (3 regions × 4 modes).

### 4. Auto-Polling Lifecycle

**4.1** When `auto_fetch_enabled = true`, the frontend MUST start a `setInterval` timer that calls `poll_dclone_api` every `poll_interval_minutes × 60 × 1000` ms.

**4.2** The timer MUST be cleared via `clearInterval` when the component unmounts or `auto_fetch_enabled` changes to `false`.

**4.3** The Rust `poll_dclone_api` command MUST enforce a server-side rate limit: it checks `last_poll_at` in `dclone_settings` and returns early (without calling the API) if the last poll was less than 1 minute ago.

**4.4** On successful API response, `dclone_settings.last_poll_at` MUST be updated to the current UTC timestamp.

### 5. Stale Data Indicator

**5.1** A progress entry is considered stale when `Date.now() - new Date(last_updated).getTime() > poll_interval_minutes × 2 × 60 × 1000`.

**5.2** Stale entries MUST display a ⏰ icon with a `title` attribute explaining the entry may not be current.

### 6. Manual Override

**6.1** The user MUST be able to manually set any `(region, mode)` progress value by clicking buttons 1–6. This sets `is_manual_override = true`.

**6.2** When a manual override is active for a `(region, mode)` pair, a "Manual" badge MUST be shown and a "Clear override" button MUST appear.

**6.3** Clicking "Clear override" calls `update_dclone_progress` with `is_manual_override = false`, restoring normal API behavior for that pair.

**6.4** The Rust `poll_dclone_api` command MUST NOT overwrite rows where `is_manual_override = true` with API data.

### 7. Push Notifications

**7.1** When `poll_dclone_api` returns new data, the frontend MUST compare each record's progress against `settings.notify_threshold`.

**7.2** If any record for the user's preferred region and preferred mode reaches or exceeds `notify_threshold`, a desktop push notification MUST be sent via the Tauri notification plugin (or equivalent).

**7.3** The notification MUST NOT fire repeatedly for the same threshold crossing — `last_notified_progress` in `dclone_settings` tracks the last progress value that triggered a notification.

### 8. DClone Settings Persistence

**8.1** All DClone settings MUST be persisted in a `dclone_settings` SQLite table (id=1 singleton row) so they survive app restarts.

**8.2** The settings schema: `auto_fetch_enabled` (bool), `poll_interval_minutes` (5/10/15/30), `notify_threshold` (3–6), `preferred_region`, `preferred_mode`, `last_poll_at` (nullable), `last_notified_progress` (nullable).

**8.3** `get_dclone_settings` MUST return the current settings row (defaulting to `auto_fetch_enabled=true, poll_interval_minutes=5, notify_threshold=5, preferred_region="Americas", preferred_mode="Non-Ladder"` on first run).

**8.4** `update_dclone_settings` MUST validate `poll_interval_minutes ∈ {5, 10, 15, 30}` and `notify_threshold ∈ [3, 6]`.

**8.5** On app load, if localStorage contains legacy keys `d2r-dclone-notify-threshold` or `d2r-dclone-preferred-region`, their values MUST be migrated to `dclone_settings` and the localStorage keys removed.

### 9. Rate Limit Compliance

**9.1** The `poll_dclone_api` command MUST NOT call the diablo2.io API more frequently than once per minute (server-side guard via `last_poll_at`).

**9.2** If the rate limit is active, the command MUST return the current `dclone_progress` rows without making a network request.

### 10. Fallback Display

**10.1** If `poll_dclone_api` fails (network error, non-2xx response), the frontend MUST leave existing progress state unchanged (silent fail — no error banner for polling failures).

**10.2** If `get_dclone_settings` or `get_dclone_progress` fail on initial load, the UI MUST show an error indicator.

### 11. Correctness Properties (PBT — pure logic functions)

The following properties MUST be verified with property-based tests for the two pure functions extracted from the polling logic:

| # | Function | Property |
|---|----------|----------|
| P1 | `clampProgress(n)` | `clampProgress(n) ∈ [1, 6]` for all integer inputs |
| P2 | `mapRegionCode(code)` | Returns one of the 3 known region strings for codes 1–3; returns a fallback string (not panic) for unknown codes |
| P3 | `mapModeCode(code)` | Returns one of the 4 known mode strings for codes 1–4; returns a fallback string (not panic) for unknown codes |
| P4 | `isStale(lastUpdated, pollIntervalMinutes)` | Returns `true` exactly when elapsed time > `pollIntervalMinutes × 2` minutes |
