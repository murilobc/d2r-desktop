# Requirements Document

## Introduction

The Leaderboards feature adds personal competition and progress-tracking to D2R Tracker by surfacing a player's all-time personal bests, month-over-month trends, seasonal archives, and shareable export cards. Everything runs fully offline — no external server is involved. The feature introduces a new **Leaderboards** page alongside the existing Statistics, Comparison, and Achievements pages, and reuses the existing comparison infrastructure for the historical-trend view.

Personal bests are scoped to a single Profile. A Season allows a player to snapshot and archive the current profile's stats at the end of a ladder season and begin accumulating fresh numbers, without destroying any underlying run records.

## Glossary

- **Leaderboard_System**: The front-end page and associated Tauri commands that implement the leaderboards feature.
- **Personal_Best**: The single highest-performing value for a given metric within a Profile, computed on demand from raw run data.
- **Season**: A named archive snapshot of a Profile's aggregate stats at a point in time, stored separately from raw runs. Archived seasons are read-only.
- **Seasonal_Reset**: The act of creating a Season archive for the current period and flagging the Profile so that Personal Best calculations start from the reset date.
- **Monthly_Comparison**: A date-range comparison of the current calendar month versus the previous calendar month, powered by the existing `get_comparison` Tauri command.
- **Share_Card**: A PNG image rendered from a designated DOM element via `html2canvas` and saved to a user-chosen file path via the Tauri `save` dialog and `plugin-fs`.
- **Community_Export**: A structured JSON file exported via the Tauri `save` dialog containing a defined schema for community leaderboard interoperability.
- **Run**: A completed farming run stored in the `runs` table, with `area`, `duration_secs`, `started_at`, `finished_at`, and associated `items`.
- **Profile**: A player character record with `id`, `name`, `class`, `mode`, and `magic_find`.
- **Items_Per_Hour**: The rate computed as `(item_count / duration_secs) × 3600` for a single run or a set of runs, where `duration_secs > 0`.
- **Fastest_Run**: The completed run with the lowest `duration_secs > 0` for a given area and profile within the active season window.
- **Best_Items_In_Run**: The single run with the highest item count for a given profile within the active season window.
- **Best_Items_Per_Hour**: The single run with the highest Items_Per_Hour rate for a given profile within the active season window, excluding runs with `duration_secs = 0`.

---

## Requirements

### Requirement 1: Personal Bests Board

**User Story:** As a D2R player, I want to see my all-time personal best records for speed and farming efficiency, so that I have concrete goals to beat in each session.

#### Acceptance Criteria

1. THE Leaderboard_System SHALL display a Personal Bests board containing exactly the following four metrics per Profile: Fastest_Run per area (the run with the lowest `duration_secs > 0`), Best_Items_In_Run overall (the run with the highest item count), Best_Items_Per_Hour overall (the run with the highest value of `(item_count ÷ duration_secs) × 3600` where `duration_secs > 0`), and Longest_Run (the single run with the highest `duration_secs`).
2. WHEN a Profile has no completed runs, THE Leaderboard_System SHALL display an empty-state message indicating no records are available yet.
3. WHEN a Profile has completed runs, THE Leaderboard_System SHALL compute Personal_Best values from all runs whose `finished_at` is on or after the Profile's active season start date, or from all runs if no Seasonal_Reset has been performed.
4. WHEN two runs produce an identical Personal_Best value for the same metric, THE Leaderboard_System SHALL display the most recently recorded run as the record holder.
5. THE Leaderboard_System SHALL display the date of each Personal_Best record alongside its value.
6. WHEN a new run is completed that surpasses an existing Personal_Best, THE Leaderboard_System SHALL reflect the updated record within 5 seconds of run completion without requiring a full page reload.
7. IF a run has `duration_secs = 0` or `finished_at = null`, THEN THE Leaderboard_System SHALL exclude that run from all Personal_Best calculations.
8. THE Leaderboard_System SHALL scope all Personal_Best records to the currently active Profile.

---

### Requirement 2: Historical Trends (This Month vs Last Month)

**User Story:** As a D2R player, I want to compare my stats from this calendar month against last calendar month, so that I can track whether my farming efficiency is improving over time.

#### Acceptance Criteria

1. THE Leaderboard_System SHALL provide a Monthly_Comparison view that invokes the existing `get_comparison` Tauri command with `type: "date_range"`, using the current calendar month as period A and the previous calendar month as period B.
2. THE Leaderboard_System SHALL compute date boundaries using the user's local system clock: period A starts on the first day of the current month at 00:00:00 local time and ends on the first day of the following month at 00:00:00 local time (exclusive upper bound); period B starts on the first day of the previous month at 00:00:00 local time and ends on the first day of the current month at 00:00:00 local time (exclusive upper bound).
3. WHEN the current calendar month has zero runs, THE Leaderboard_System SHALL display a message indicating no data is available for the current month, while still showing last month's metrics if data exists. WHEN the previous calendar month has zero runs, THE Leaderboard_System SHALL display last month's column as empty while still showing current month's metrics.
4. WHEN both the current and previous calendar months have runs, THE Leaderboard_System SHALL display the delta for `items_per_hour`, `items_per_run`, `fastest_run_secs`, and `total_runs` between the two periods as a signed percentage (e.g., "+12.3%" / "-5.1%"); for `fastest_run_secs`, a negative delta indicates improvement and SHALL be rendered in green.
5. THE Leaderboard_System SHALL label the two comparison periods as "This Month" and "Last Month" in the UI.
6. THE Leaderboard_System SHALL display a low-sample warning indicator on any month period that has fewer than 5 runs, using the same `showWarning` threshold logic as the existing Comparison page.
7. IF the `get_comparison` Tauri command returns an error, THEN THE Leaderboard_System SHALL display an inline error message within the Monthly_Comparison section and allow the user to retry.

---

### Requirement 3: Share Card Export (PNG)

**User Story:** As a D2R player, I want to export a shareable image card of my best stats, so that I can post it to Discord or Reddit to show off my progress.

#### Acceptance Criteria

1. WHEN the user activates the Share Card export action, THE Leaderboard_System SHALL render the designated share card DOM element using `html2canvas` version 1.4.1 and produce a PNG image.
2. WHEN `html2canvas` has finished rendering, THE Leaderboard_System SHALL invoke the Tauri `save` dialog filtered to `.png` files to prompt the user for a save location.
3. WHEN the user confirms a save path in the dialog, THE Leaderboard_System SHALL write the PNG bytes to that path using `@tauri-apps/plugin-fs` `writeFile`.
4. IF the user cancels the Tauri `save` dialog without selecting a path, THEN THE Leaderboard_System SHALL abort the export and return to the normal view without displaying an error.
5. IF `html2canvas` or the file write operation fails, THEN THE Leaderboard_System SHALL display an error message within the share card export UI — without dismissing the view — that indicates whether the failure occurred during the render step or the file write step.
6. THE Leaderboard_System SHALL NOT use `Blob` URLs, `<a>` element click simulation, or any browser-based download mechanism for PNG export.
7. THE Share_Card SHALL include the Profile name, class, mode, the four Personal_Best metrics (Fastest_Run, Best_Items_In_Run, Best_Items_Per_Hour, Longest_Run), and the export date formatted as `YYYY-MM-DD`.
8. THE Leaderboard_System SHALL propose a default filename for the save dialog in the format `d2r_leaderboard_{profile_name}_{YYYY-MM-DD}.png`, where characters invalid in filesystem filenames (`/ \ : * ? " < > |`) in `{profile_name}` are replaced with underscores, and `{YYYY-MM-DD}` uses the user's local system clock.

---

### Requirement 4: Community JSON Export

**User Story:** As a D2R player, I want to export my leaderboard stats as a structured JSON file, so that community leaderboard sites can ingest my data in a standard format.

#### Acceptance Criteria

1. WHEN the user activates the Community Export action, THE Leaderboard_System SHALL invoke the Tauri `save` dialog filtered to `.json` files to prompt the user for a save location.
2. WHEN the user confirms a save path, THE Leaderboard_System SHALL write a UTF-8 JSON file to that path using `@tauri-apps/plugin-fs` `writeFile`.
3. THE Community_Export JSON file SHALL conform to the following schema, with all personal best sub-objects set to `null` when no data exists, numeric fields bounded as noted, and string fields with maximum lengths as noted:
   ```json
   {
     "schema_version": "1.0",
     "exported_at": "<ISO-8601 timestamp>",
     "profile": {
       "name": "<string, max 128 chars>",
       "class": "<string, max 64 chars>",
       "mode": "<string, max 64 chars>",
       "magic_find": "<number 0–65535 | null>"
     },
     "personal_bests": {
       "fastest_run": { "area": "<string>", "duration_secs": "<number 0–86400>", "date": "<ISO-8601 date>" } | null,
       "best_items_in_run": { "area": "<string>", "item_count": "<number 0–9999>", "date": "<ISO-8601 date>" } | null,
       "best_items_per_hour": { "area": "<string>", "items_per_hour": "<number 0–99999>", "date": "<ISO-8601 date>" } | null,
       "longest_session_secs": "<number 0–864000 | null>"
     },
     "season": {
       "name": "<string | null>",
       "start_date": "<ISO-8601 date | null>"
     }
   }
   ```
4. THE Leaderboard_System SHALL serialize all numeric values as JSON numbers (not strings); optional numeric fields with no data SHALL serialize as JSON `null` (not omitted, not zero).
5. IF the user cancels the Tauri `save` dialog, THEN THE Leaderboard_System SHALL abort the export without displaying an error.
6. IF the file write operation fails, THEN THE Leaderboard_System SHALL display an error message within the leaderboard view that remains visible until dismissed by the user.
7. THE Leaderboard_System SHALL propose a default filename in the format `d2r_leaderboard_{profile_name}_{YYYY-MM-DD}.json`, where non-alphanumeric/non-underscore characters in `{profile_name}` are replaced with underscores.
8. THE Leaderboard_System SHALL NOT transmit the exported JSON to any external server or network endpoint.
9. WHEN a Profile has no Personal_Best for a given metric, THE Leaderboard_System SHALL serialize that metric field as `null` rather than omitting the field from the JSON output.

---

### Requirement 5: Seasonal Reset and Archive

**User Story:** As a D2R ladder player, I want to archive my current season's stats and start fresh at the beginning of a new ladder season, so that my personal bests reflect current-season performance without losing historical data.

#### Acceptance Criteria

1. WHEN the user initiates a Seasonal_Reset, THE Leaderboard_System SHALL prompt the user to confirm the action and provide a season name (1–80 characters, unique per Profile) before proceeding.
2. WHEN the user confirms the Seasonal_Reset, THE Leaderboard_System SHALL create a Season archive record containing: the season name, the start and end timestamps, and a snapshot of the Personal_Best values at the moment of archiving.
3. WHEN a Seasonal_Reset completes, THE Leaderboard_System SHALL record a new season start date on the Profile so that subsequent Personal_Best calculations only consider runs on or after that date.
4. THE Leaderboard_System SHALL NOT delete any raw Run records or Item records during a Seasonal_Reset.
5. WHEN the user views the Season archive section, THE Leaderboard_System SHALL display the list of archived Seasons for the active Profile ordered by end date descending, showing season name, date range, and the archived personal best values.
6. WHEN a Profile has no active season (no reset has been performed), THE Leaderboard_System SHALL compute Personal_Best values from all runs regardless of date.
7. IF the user cancels the Seasonal_Reset confirmation dialog, THEN THE Leaderboard_System SHALL abort the reset without modifying any data.
8. IF the Profile already has 50 archived seasons, THEN THE Leaderboard_System SHALL display an error message and prevent creation of additional seasons.
9. IF a Seasonal_Reset operation fails mid-execution (e.g., database error), THEN THE Leaderboard_System SHALL roll back all changes atomically so that the Profile's season start date and the Season archive table remain in their pre-reset state.

---

### Requirement 6: Leaderboards Page Navigation

**User Story:** As a D2R player, I want to access the Leaderboards feature from the main navigation, so that I can reach it as easily as Statistics or Achievements.

#### Acceptance Criteria

1. THE Leaderboard_System SHALL be accessible from the main application navigation as a top-level page entry labelled "Leaderboards".
2. WHEN a user navigates to the Leaderboards page, THE Leaderboard_System SHALL load and display the Personal Bests board for the currently active Profile.
3. WHEN the active Profile changes while the Leaderboards page is open, THE Leaderboard_System SHALL reload all leaderboard data to reflect the newly selected Profile.
4. THE Leaderboard_System SHALL display all four sections — Personal Bests, Monthly Comparison, Seasonal Archive, and Export — within the same page, organized with clear visual separation.

---

### Requirement 7: Personal Best Calculation Correctness Properties

**User Story:** As a developer, I want the personal best calculation logic to be verified against its mathematical invariants, so that records are always accurate regardless of run data shape.

#### Acceptance Criteria

1. FOR ALL non-empty sets of completed runs with `duration_secs > 0`, the Fastest_Run computed by THE Leaderboard_System SHALL equal the run with the minimum `duration_secs` value in the set.
2. FOR ALL non-empty sets of completed runs, the Best_Items_In_Run computed by THE Leaderboard_System SHALL equal the run with the maximum item count in the set.
3. FOR ALL non-empty sets of completed runs with `duration_secs > 0`, the Best_Items_Per_Hour computed by THE Leaderboard_System SHALL equal the run with the maximum value of `(item_count / duration_secs) × 3600` in the set.
4. FOR ALL sets of runs where all runs have `duration_secs = 0`, THE Leaderboard_System SHALL return no record for Fastest_Run and no record for Best_Items_Per_Hour.
5. FOR ALL sets of runs, adding a run that does not improve any metric SHALL NOT change any existing Personal_Best value.
6. FOR ALL sets of runs, the Personal_Best value for any metric SHALL be a member of the set of input run values (i.e., it must correspond to an actual run, not an interpolated value).

---

### Requirement 8: Seasonal Archive Data Preservation Invariants

**User Story:** As a developer, I want the seasonal reset logic to preserve all raw run data, so that players never lose farming history when starting a new season.

#### Acceptance Criteria

1. FOR ALL Seasonal_Reset operations, the total count of Run records in the database after the reset SHALL equal the total count before the reset.
2. FOR ALL Seasonal_Reset operations, the total count of Item records in the database after the reset SHALL equal the total count before the reset.
3. FOR ALL Seasonal_Reset operations, the Season archive record SHALL contain Personal_Best values that are a subset of the Personal_Best values computable from the runs existing at the time of the reset.
4. WHEN a Seasonal_Reset is performed and then a new Seasonal_Reset is performed immediately after (with zero new runs), THE Leaderboard_System SHALL produce a second Season archive with no Personal_Best records (empty bests), while the first archive SHALL remain unchanged.
5. FOR ALL archived Seasons, the season start date SHALL be less than or equal to the season end date.

---

### Requirement 9: Community Export Schema Correctness

**User Story:** As a developer, I want the Community Export JSON schema to be structurally valid and consistent across any profile state, so that community tools can reliably parse it.

#### Acceptance Criteria

1. FOR ALL Profile states (with runs, without runs, with active season, without active season), the Community_Export produced by THE Leaderboard_System SHALL be parseable as valid JSON.
2. FOR ALL valid Community_Export JSON documents, re-serializing the parsed object SHALL produce a document with identical field values (round-trip property).
3. THE Community_Export JSON SHALL always contain the `schema_version`, `exported_at`, `profile`, `personal_bests`, and `season` top-level keys regardless of whether Personal_Best records exist.
4. WHEN a Profile has no Personal_Best for a given metric, THE Leaderboard_System SHALL serialize that metric field as `null` in the Community_Export JSON.
5. FOR ALL Community_Export documents, all numeric fields SHALL deserialize as JSON numbers and all date fields SHALL deserialize as strings parseable by `Date.parse()`.
