# Requirements Document

## Introduction

The DClone API Integration feature replaces the fully manual Diablo Clone progress tracking workflow in the D2R Tracker desktop app with live, automatically-fetched data from the diablo2.io public API. Currently, users must manually click 1–6 buttons per region to update progress. This feature polls the API on a configurable interval, persists data to SQLite for offline resilience, surfaces a stale-data indicator when the API is unreachable, fires OS-level push notifications when progress crosses a user-defined threshold, and preserves the ability for users to manually override any region's value.

All outbound HTTP requests are routed through a Rust Tauri command because the Tauri WebView CSP restricts direct `fetch` calls to external origins.

## Glossary

- **Poller**: The Rust background task responsible for scheduling and executing HTTP requests to the diablo2.io API.
- **DClone_API**: The public endpoint at `https://diablo2.io/api/dclone` that returns Diablo Clone progress records.
- **API_Record**: A single JSON object returned by the DClone_API with fields `{ id, region, mode, progress, updated }`.
- **Region_Code**: The numeric region identifier used by the DClone_API: `"1"` = Americas, `"2"` = Europe, `"3"` = Asia.
- **Mode_Code**: The numeric ladder/mode identifier used by the DClone_API: `"1"` = Non-Ladder, `"2"` = Ladder, `"3"` = Hardcore Non-Ladder, `"4"` = Hardcore Ladder.
- **Region_Name**: The human-readable region string used internally: `"Americas"`, `"Europe"`, or `"Asia"`.
- **DCloneProgress**: The existing SQLite-persisted record `{ region: String, mode: String, progress: u8, last_updated: String, is_manual_override: bool }`.
- **Poll_Interval**: The number of minutes between successive DClone_API requests. Valid range: 5–30 minutes inclusive. Default: 5 minutes.
- **Stale_Threshold**: The duration after which data is considered stale, computed as `Poll_Interval × 2`.
- **Manual_Override**: A user-set progress value that takes precedence over API-fetched values. Indicated by `is_manual_override = true` on the DCloneProgress record.
- **Notify_Threshold**: The progress level (3–6) at or above which the Notifier fires an OS notification for the user's preferred region.
- **Notifier**: The Rust component that issues OS-level push notifications via `tauri-plugin-notification`.
- **Stale_Indicator**: A visual UI element shown when the most recent data for a region/mode is older than the Stale_Threshold.
- **App_Settings**: The persistent settings record stored in SQLite replacing the current localStorage-based notification settings.
- **DClone_Settings**: The subset of App_Settings governing auto-fetch behavior: `{ auto_fetch_enabled, poll_interval_minutes, notify_threshold, preferred_region }`.

---

## Requirements

### Requirement 1: Rust Polling Command

**User Story:** As a developer, I want all DClone_API HTTP requests routed through a Rust Tauri command, so that the WebView CSP is never relaxed and external network access remains auditable.

#### Acceptance Criteria

1. THE Poller SHALL send all HTTP requests to `https://diablo2.io/api/dclone` using the `reqwest` crate within a Tauri command, never from JavaScript `fetch`.
2. WHEN the DClone_API returns HTTP 200, THE Poller SHALL parse the response body as a JSON array of API_Record objects.
3. IF the DClone_API returns HTTP 200 but the response body is not valid JSON, THEN THE Poller SHALL return an error result without updating any DCloneProgress records.
4. IF the DClone_API returns a non-200 HTTP status code, THEN THE Poller SHALL return an error result without updating any DCloneProgress records.
5. IF the DClone_API is unreachable due to a network error, THEN THE Poller SHALL return an error result without updating any DCloneProgress records.
6. THE Poller SHALL enforce a minimum Poll_Interval of 5 minutes by rejecting any poll request issued within 5 minutes of the previous successful request.
7. THE Tauri application SHALL include `https://diablo2.io` in the `connect-src` directive of the Content Security Policy.

---

### Requirement 2: Region and Mode Code Mapping

**User Story:** As a developer, I want Region_Codes and Mode_Codes from the API mapped to their canonical string representations, so that the app stores and displays consistent human-readable values.

#### Acceptance Criteria

1. WHEN an API_Record with `region = "1"` is received, THE Poller SHALL map it to Region_Name `"Americas"`.
2. WHEN an API_Record with `region = "2"` is received, THE Poller SHALL map it to Region_Name `"Europe"`.
3. WHEN an API_Record with `region = "3"` is received, THE Poller SHALL map it to Region_Name `"Asia"`.
4. WHEN an API_Record with `mode = "1"` is received, THE Poller SHALL map it to mode string `"Non-Ladder"`.
5. WHEN an API_Record with `mode = "2"` is received, THE Poller SHALL map it to mode string `"Ladder"`.
6. WHEN an API_Record with `mode = "3"` is received, THE Poller SHALL map it to mode string `"Hardcore Non-Ladder"`.
7. WHEN an API_Record with `mode = "4"` is received, THE Poller SHALL map it to mode string `"Hardcore Ladder"`.
8. IF an API_Record contains a `region` value outside `"1"`–`"3"`, THEN THE Poller SHALL skip that record and log a warning; records with parseable but invalid codes SHALL be skipped on a best-effort basis.
9. IF an API_Record contains a `mode` value outside `"1"`–`"4"`, THEN THE Poller SHALL skip that record and log a warning; records with parseable but invalid codes SHALL be skipped on a best-effort basis.
10. THE Poller SHALL enforce that each Region_Code maps to exactly one canonical Region_Name and each Mode_Code maps to exactly one canonical mode string (one-to-one mapping invariant).
11. FOR ALL valid Region_Code values in `{"1", "2", "3"}`, THE Poller SHALL produce a Region_Name that round-trips back to the original Region_Code when re-encoded (round-trip property).

---

### Requirement 3: Progress Value Validation and Persistence

**User Story:** As a developer, I want API progress values clamped to the valid 1–6 range and persisted to SQLite, so that the UI never displays out-of-range values and data survives app restarts.

#### Acceptance Criteria

1. WHEN a valid API_Record is processed, THE Poller SHALL clamp the `progress` field to the inclusive range [1, 6] before writing to the database.
2. WHEN a valid API_Record is processed and the corresponding DCloneProgress record does not have `is_manual_override = true`, THE Poller SHALL upsert the DCloneProgress record with the new `progress` and `last_updated` values.
3. IF a database write fails during an upsert, THEN THE Poller SHALL log the failure and continue processing the remaining API_Records in the same poll response.
4. WHEN a valid API_Record is processed and the corresponding DCloneProgress record has `is_manual_override = true`, THE Poller SHALL leave that record unchanged.
5. THE Database SHALL persist all DCloneProgress records including `region`, `mode`, `progress`, `last_updated`, and `is_manual_override` fields to SQLite.
6. WHEN the application starts, THE Database SHALL load persisted DCloneProgress records so the last known state is available before the first successful API poll.
7. FOR ALL API-provided progress values `v`, THE Poller SHALL produce a stored value `p` such that `1 ≤ p ≤ 6` (progress clamping property).

---

### Requirement 4: Auto-Polling Lifecycle

**User Story:** As a user, I want the app to automatically poll the DClone_API at my configured interval while the app is running, so that progress bars update without any manual action.

#### Acceptance Criteria

1. WHEN `auto_fetch_enabled` is `true` and the app is running, THE Poller SHALL execute a poll at the configured Poll_Interval.
2. WHEN `auto_fetch_enabled` is set to `false`, THE Poller SHALL stop issuing new poll requests immediately.
3. WHEN `auto_fetch_enabled` is set to `true` after having been `false`, THE Poller SHALL resume polling at the configured Poll_Interval.
4. WHEN the Poll_Interval setting is changed while polling is active, THE Poller SHALL apply the new interval starting from the next scheduled poll.
5. THE Poller SHALL accept a Poll_Interval value only within the range [5, 30] minutes inclusive; values outside this range SHALL be rejected with an error.

---

### Requirement 5: Stale Data Detection and Indicator

**User Story:** As a user, I want to see a visual "stale" indicator next to a region when its data is outdated, so that I know the displayed progress may not reflect current live conditions.

#### Acceptance Criteria

1. WHEN the current time strictly exceeds `last_updated + (Poll_Interval × 2)` for a DCloneProgress record, THE DCloneTracker_Page SHALL render a stale indicator for that region/mode.
2. WHEN a fresh API response updates a DCloneProgress record, THE DCloneTracker_Page SHALL remove the stale indicator for that region/mode.
3. WHEN the app starts with persisted data whose `last_updated` timestamp is older than the Stale_Threshold, THE DCloneTracker_Page SHALL show the stale indicator immediately on render.
4. IF `auto_fetch_enabled` is `false`, THE DCloneTracker_Page SHALL show the stale indicator for any record not updated within the Stale_Threshold regardless of polling state.
5. FOR ALL DCloneProgress records, given a `last_updated` timestamp `t` and Poll_Interval `p`, THE DCloneTracker_Page SHALL mark the record stale if and only if `now() - t > p × 2` (strictly greater than; stale detection property).
6. IF the stale indicator cannot be rendered due to a UI failure, THEN THE DCloneTracker_Page SHALL continue displaying the last known progress value for that region/mode.

---

### Requirement 6: Manual Override

**User Story:** As a user, I want to manually set a region's progress value that overrides API data, so that I can correct the tracker when the API lags behind community reports.

#### Acceptance Criteria

1. WHEN a user sets a progress value via the manual controls, THE DCloneTracker_Page SHALL set `is_manual_override = true` on the corresponding DCloneProgress record immediately.
2. WHILE `is_manual_override = true` for a DCloneProgress record, THE Poller SHALL not overwrite that record's `progress` value during API polling.
3. WHEN a user explicitly clears a manual override via a dedicated clear/reset control, THE DCloneTracker_Page SHALL set `is_manual_override = false` and the next API poll SHALL be allowed to update that record.
4. THE DCloneTracker_Page SHALL display a visual badge or label indicating that a region's value is under manual override; the badge SHALL remain visible until the next successful API poll overwrites the value after the override is cleared.
5. THE Tauri command `update_dclone_progress` SHALL accept an `is_manual_override` parameter and persist the value to the DCloneProgress record in SQLite.

---

### Requirement 7: Push Notifications

**User Story:** As a user, I want an OS push notification when my preferred region's DClone progress reaches or exceeds my configured threshold, so that I can react immediately without watching the app.

#### Acceptance Criteria

1. WHEN an API poll updates a DCloneProgress record for the user's `preferred_region` and the new `progress` value is greater than or equal to `notify_threshold`, THE Notifier SHALL issue an OS notification via `tauri-plugin-notification`.
2. WHEN a manual override sets a progress value for the user's `preferred_region` that is greater than or equal to `notify_threshold`, THE Notifier SHALL issue an OS notification.
3. THE Notifier SHALL include the region name, mode, current progress value, and the progress label (e.g., "Terrorizing") in the notification body.
4. IF the previous notification for the same region and mode was issued for the same progress value, THEN THE Notifier SHALL not issue a duplicate notification.
5. WHEN `auto_fetch_enabled` is `false`, THE Notifier SHALL still fire notifications triggered by manual overrides that meet the threshold condition.
6. THE Notifier SHALL fire notifications for mode `"Softcore Non-Ladder"` by default; WHERE the user selects a different preferred mode, THE Notifier SHALL fire for that mode instead.

---

### Requirement 8: DClone Settings Persistence

**User Story:** As a user, I want my DClone notification and polling settings saved to the app database rather than localStorage, so that settings persist reliably across app reinstalls and profile changes.

#### Acceptance Criteria

1. THE App_Settings SHALL persist `auto_fetch_enabled`, `poll_interval_minutes`, `notify_threshold`, and `preferred_region` to SQLite.
2. WHEN the application first launches after this feature is deployed and existing localStorage keys `d2r-dclone-notify-threshold` and `d2r-dclone-preferred-region` are present, THE App_Settings SHALL migrate those values into SQLite and remove the localStorage entries; on subsequent launches, localStorage entries SHALL be ignored even if they reappear.
3. WHEN DClone_Settings are saved, THE App_Settings SHALL validate that `poll_interval_minutes` is in [5, 30] and `notify_threshold` is in [3, 6]; invalid values SHALL be rejected with an error message.
4. WHEN the application starts, THE App_Settings SHALL load DClone_Settings from SQLite before the first poll is scheduled.
5. THE DCloneTracker_Page SHALL expose controls for `auto_fetch_enabled` (toggle), `poll_interval_minutes` (select: 5, 10, 15, 30), `notify_threshold` (select: 3–6), and `preferred_region` (select: Americas, Europe, Asia).

---

### Requirement 9: Rate Limit Compliance

**User Story:** As a responsible API consumer, I want the Poller to enforce the minimum poll interval at all times, so that the app never exceeds the diablo2.io rate limit regardless of user configuration or concurrent triggers.

#### Acceptance Criteria

1. THE Poller SHALL record the timestamp of each successful API request.
2. IF a poll is triggered and the elapsed time since the last successful request is less than 5 minutes, THEN THE Poller SHALL defer the request until the 5-minute minimum has elapsed.
3. THE Poller SHALL enforce the 5-minute minimum interval independently of the user-configured Poll_Interval, such that even if Poll_Interval is set to 5 minutes, back-to-back triggers cannot produce two requests within the minimum window.
4. FOR ALL pairs of consecutive successful API requests with timestamps `t1` and `t2`, THE Poller SHALL guarantee `t2 - t1 ≥ 300 seconds` (rate limit property).

---

### Requirement 10: Fallback and Last-Known-State Display

**User Story:** As a user, I want the app to display the last known DClone progress when the API is unavailable, so that I always see some data rather than an empty or broken state.

#### Acceptance Criteria

1. IF a poll request fails due to a network error or non-200 response, THEN THE DCloneTracker_Page SHALL continue displaying the last persisted DCloneProgress values for all regions.
2. IF a poll request fails, THEN THE DCloneTracker_Page SHALL display the stale indicator for any record whose `last_updated` exceeds the Stale_Threshold.
3. THE DCloneTracker_Page SHALL never render an empty progress state while persisted DCloneProgress records exist in the database.
4. WHEN a previously failed poll subsequently succeeds, THE DCloneTracker_Page SHALL update progress values and remove stale indicators for refreshed records.

---

## Correctness Properties

The following properties are suitable for property-based testing in Rust (using `proptest`) and cover the core logic components.

### Property 1: Region Code Round-Trip

For all valid Region_Code values in `{"1", "2", "3"}`, encoding to Region_Name and back to Region_Code is a bijection.

```
∀ code ∈ {"1", "2", "3"}: region_name_to_code(code_to_region_name(code)) == code
```

Covers: Requirement 2, AC 10

### Property 2: Mode Code Round-Trip

For all valid Mode_Code values in `{"1", "2", "3", "4"}`, encoding to mode string and back is a bijection.

```
∀ code ∈ {"1", "2", "3", "4"}: mode_string_to_code(code_to_mode_string(code)) == code
```

Covers: Requirement 2, AC 4–7

### Property 3: Progress Clamping Invariant

For all integer inputs `v`, the clamped progress value is always in [1, 6].

```
∀ v: i64, clamp_progress(v) ∈ [1, 6]
```

Covers: Requirement 3, AC 1, 6

### Property 4: Stale Detection Consistency

For all combinations of `last_updated` timestamp and `poll_interval_minutes`, the staleness predicate is true if and only if the age of the record exceeds `poll_interval_minutes × 2` minutes.

```
∀ last_updated: DateTime, poll_interval: u32 ∈ [5,30], now: DateTime:
  is_stale(last_updated, poll_interval, now) ⟺ (now - last_updated) > Duration::minutes(poll_interval * 2)
```

Covers: Requirement 5, AC 5

### Property 5: Rate Limit Enforcement

For any sequence of poll trigger timestamps, no two consecutive timestamps in the list of timestamps that actually produced HTTP requests are less than 300 seconds apart.

```
∀ triggers: Vec<DateTime>, let executed = filter_by_rate_limit(triggers, min_interval=300):
  ∀ consecutive (t1, t2) in executed: t2 - t1 ≥ 300 seconds
```

Covers: Requirement 9, AC 4
