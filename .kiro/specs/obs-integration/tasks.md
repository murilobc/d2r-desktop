# Implementation Plan: OBS Integration

## Overview

Add OBS Studio integration to the D2R Tracker desktop app. The feature writes session statistics to a local text file that OBS can read as a Text Source, supporting both plain text and JSON formats. A settings UI allows enabling/disabling OBS mode, choosing the output format, and copying the file path.

## Tasks

- [x] 1. Add write_obs_stats and get_obs_file_path Rust commands
  - [x] 1.1 Add `ObsStatsInput` struct with `#[derive(Debug, Deserialize)]` and `#[serde(rename_all = "camelCase")]` to `src-tauri/src/commands.rs`
  - [x] 1.2 Add `format_plain_text(input: &ObsStatsInput) -> String` helper function that produces labeled lines (Run Count, Session Time, Current Area, Last Items)
  - [x] 1.3 Add `format_json(input: &ObsStatsInput) -> String` helper function that produces a single-line JSON object with fields runCount, sessionTime, currentArea, lastItems
  - [x] 1.4 Add `write_obs_stats` Tauri command that accepts `app_handle: tauri::AppHandle` and `input: ObsStatsInput`, resolves `{app_data_dir}/obs_stats.txt`, creates the directory with `create_dir_all` if missing, writes to a `.tmp` file then renames (with direct-write fallback on rename failure), and returns the file path as `Ok(String)`
  - [x] 1.5 Add `get_obs_file_path` Tauri command that accepts `app_handle: tauri::AppHandle`, resolves and returns the `{app_data_dir}/obs_stats.txt` path without performing any write
  - [x] 1.6 Register both `commands::write_obs_stats` and `commands::get_obs_file_path` in the `invoke_handler` in `src-tauri/src/lib.rs`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Add frontend API wrapper and types
  - [x] 2.1 Add `ObsStatsInput` interface to `src/types.ts` with fields: `runCount: number`, `sessionTime: string`, `currentArea: string`, `lastItems: string[]`, `format: "text" | "json"`
  - [x] 2.2 Add `writeObsStats(input: ObsStatsInput): Promise<string>` function to `src/api.ts` that invokes `write_obs_stats`
  - [x] 2.3 Add `getObsFilePath(): Promise<string>` function to `src/api.ts` that invokes `get_obs_file_path`
  - _Requirements: 2.1_

- [x] 3. Add OBS Settings UI section
  - [x] 3.1 Create `ObsSettings` component in `src/pages/Settings.tsx` following the `SoundSettings` pattern
  - [x] 3.2 Add toggle button to enable/disable OBS mode
  - [x] 3.3 Add dropdown to select output format ("Plain Text" / "JSON")
  - [x] 3.4 Display the full file path (fetched via `getObsFilePath()`) when OBS mode is enabled
  - [x] 3.5 Add "Copy path" button that copies the file path to clipboard
  - [x] 3.6 Persist preferences to localStorage under key `d2r_obs_prefs`
  - [x] 3.7 Export `getObsPrefs()` helper function from `Settings.tsx`
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Integrate OBS write interval in RunTracker
  - [x] 4.1 Import `writeObsStats` and `getObsPrefs` in `RunTracker.tsx`
  - [x] 4.2 Add a `useEffect` with a 1-second `setInterval` that calls `writeObsStats` when session is active and OBS is enabled
  - [x] 4.3 Collect the last 3 items from the current session's items array
  - [x] 4.4 Format `sessionElapsed` as `HH:MM:SS` string
  - [x] 4.5 Clear the interval on unmount, session end, or when OBS mode is toggled off
  - _Requirements: 4.1, 4.2_

- [x] 5. Add tests for OBS formatting and settings
  - [x] 5.1 Add unit tests for `ObsSettings` component
  - [x] 5.2 Add integration test for RunTracker OBS interval
  - [x] 5.3 Add test verifying `write_obs_stats` is NOT called when OBS mode is disabled
  - [x] 5.4 Add test verifying the plain text output format
  - [x] 5.5 Add test verifying the JSON output format
  - _Requirements: 5.1_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"] }
  ]
}
```

## Notes

- The OBS file is written atomically (write to .tmp, then rename) to avoid OBS reading partial content
- Error from writeObsStats is swallowed with `.catch(console.error)` to avoid disrupting the session
- Default preferences: `{ enabled: false, format: "text" }`
