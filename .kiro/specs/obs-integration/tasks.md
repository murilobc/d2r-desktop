# Tasks

## Task 1: Add write_obs_stats and get_obs_file_path Rust commands
- [x] Add `ObsStatsInput` struct with `#[derive(Debug, Deserialize)]` and `#[serde(rename_all = "camelCase")]` to `src-tauri/src/commands.rs`
- [x] Add `format_plain_text(input: &ObsStatsInput) -> String` helper function that produces labeled lines (Run Count, Session Time, Current Area, Last Items)
- [x] Add `format_json(input: &ObsStatsInput) -> String` helper function that produces a single-line JSON object with fields runCount, sessionTime, currentArea, lastItems
- [x] Add `write_obs_stats` Tauri command that accepts `app_handle: tauri::AppHandle` and `input: ObsStatsInput`, resolves `{app_data_dir}/obs_stats.txt`, creates the directory with `create_dir_all` if missing, writes to a `.tmp` file then renames (with direct-write fallback on rename failure), and returns the file path as `Ok(String)`
- [x] Add `get_obs_file_path` Tauri command that accepts `app_handle: tauri::AppHandle`, resolves and returns the `{app_data_dir}/obs_stats.txt` path without performing any write
- [x] Register both `commands::write_obs_stats` and `commands::get_obs_file_path` in the `invoke_handler` in `src-tauri/src/lib.rs`

## Task 2: Add frontend API wrapper and types [depends on: Task 1]
- [x] Add `ObsStatsInput` interface to `src/types.ts` with fields: `runCount: number`, `sessionTime: string`, `currentArea: string`, `lastItems: string[]`, `format: "text" | "json"`
- [x] Add `writeObsStats(input: ObsStatsInput): Promise<string>` function to `src/api.ts` that invokes `write_obs_stats`
- [x] Add `getObsFilePath(): Promise<string>` function to `src/api.ts` that invokes `get_obs_file_path`

## Task 3: Add OBS Settings UI section [depends on: Task 2]
- [x] Create `ObsSettings` component in `src/pages/Settings.tsx` following the `SoundSettings` pattern with its own settings section
- [x] Add toggle button to enable/disable OBS mode
- [x] Add dropdown to select output format ("Plain Text" / "JSON")
- [x] Display the full file path (fetched via `getObsFilePath()`) when OBS mode is enabled
- [x] Add "Copy path" button that copies the file path to clipboard using `navigator.clipboard.writeText()`
- [x] Persist preferences to localStorage under key `d2r_obs_prefs` with default `{ enabled: false, format: "text" }`
- [x] Export `getObsPrefs()` helper function from `Settings.tsx` for RunTracker to read current OBS preferences
- [x] Render `<ObsSettings />` in the Settings page after `<SoundSettings />`

## Task 4: Integrate OBS write interval in RunTracker [depends on: Task 2, Task 3]
- [x] Import `writeObsStats` from `src/api.ts` and `getObsPrefs` from Settings in `RunTracker.tsx`
- [x] Add a `useEffect` with a 1-second `setInterval` that calls `writeObsStats` when `sessionActive` is true and OBS prefs `enabled` is true
- [x] Collect the last 3 items from the current session's `items` state array (most recent first)
- [x] Format `sessionElapsed` (tenths) as `HH:MM:SS` string for the `sessionTime` field
- [x] Read `obsFormat` from localStorage prefs and pass it as the `format` field
- [x] Swallow errors from `writeObsStats` with `.catch(console.error)` to avoid disrupting the session
- [x] Clear the interval on unmount, session end, or when OBS mode is toggled off

## Task 5: Add tests for OBS formatting and settings [depends on: Task 3, Task 4]
- [x] Add unit tests for the `ObsSettings` component: verify toggle persists state to localStorage, format dropdown updates preference, copy button calls clipboard API
- [x] Add integration test for RunTracker OBS interval: mock `invoke` to verify `write_obs_stats` is called with correct payload shape when session is active and OBS is enabled
- [x] Add test verifying `write_obs_stats` is NOT called when OBS mode is disabled
- [x] Add test verifying the plain text output format expectation (labeled lines with correct field names)
- [x] Add test verifying the JSON output format expectation (valid JSON with correct field types)
