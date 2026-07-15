# Requirements Document

## Introduction

This feature enables streamers to display live session stats from the D2R Desktop Tracker in OBS Studio by writing current session state to a text file. OBS reads the file as a Text (GDI+) source, providing a zero-configuration overlay of run statistics. The feature includes a Rust backend command for file writing, a frontend interval that triggers writes every second during active sessions, configurable output format (plain text or JSON), and a Settings page section for enabling/disabling the feature and displaying the file path.

## Glossary

- **OBS_Writer**: The Rust backend command responsible for writing session stats to disk
- **OBS_Settings**: The UI section in the Settings page for configuring OBS integration
- **Session_State**: The active session data including run count, elapsed time, items found, and current area
- **Stats_File**: The text file written to the app data directory that OBS reads as a source
- **Format_Formatter**: The module responsible for converting session state into the configured output format (plain text or JSON)

## Requirements

### Requirement 1: Write Session Stats to File

**User Story:** As a streamer, I want the app to write my current session stats to a text file, so that OBS can display them as a live overlay.

#### Acceptance Criteria

1. WHEN a session is active and OBS mode is enabled, THE OBS_Writer SHALL write the current Session_State to the Stats_File every 1 second
2. WHEN a session ends or OBS mode is disabled, THE OBS_Writer SHALL stop writing to the Stats_File
3. WHEN a write is triggered, THE OBS_Writer SHALL perform the file write asynchronously without blocking the UI thread
4. THE Stats_File SHALL be located at the Tauri app data directory path: `{app_data_dir}/obs_stats.txt`
5. IF a file write fails, THEN THE OBS_Writer SHALL log the error and continue operation without crashing the application

### Requirement 2: File Content and Format

**User Story:** As a streamer, I want to choose between plain text and JSON output, so that I can use the format that best fits my OBS setup.

#### Acceptance Criteria

1. WHEN the format is set to plain text, THE Format_Formatter SHALL produce output containing run count, session time, last 3 items found, and current area as human-readable labeled lines
2. WHEN the format is set to JSON, THE Format_Formatter SHALL produce valid JSON containing run count, session time, last 3 items found, and current area as structured fields
3. THE Format_Formatter SHALL include these fields in every output: run count (integer), session time (formatted string), last 3 items found (list of item names), and current area (string)
4. WHEN fewer than 3 items have been found, THE Format_Formatter SHALL include only the available items without padding or placeholder values

### Requirement 3: OBS Settings UI

**User Story:** As a streamer, I want a settings section to enable OBS mode and see the file path, so that I can easily configure OBS to read the file.

#### Acceptance Criteria

1. THE OBS_Settings SHALL provide a toggle to enable or disable OBS mode
2. THE OBS_Settings SHALL provide a dropdown to select the output format (plain text or JSON)
3. WHEN OBS mode is enabled, THE OBS_Settings SHALL display the full file path of the Stats_File
4. THE OBS_Settings SHALL provide a button to copy the file path to the clipboard
5. THE OBS_Settings SHALL persist the enabled state and format selection to localStorage
6. WHEN the Settings page loads, THE OBS_Settings SHALL restore the previously saved configuration

### Requirement 4: Session Integration

**User Story:** As a streamer, I want OBS stats to update automatically when my session is running, so that I do not need to manually trigger updates.

#### Acceptance Criteria

1. WHEN a session starts and OBS mode is enabled, THE OBS_Writer SHALL begin the 1-second write interval automatically
2. WHEN a session is paused, THE OBS_Writer SHALL continue displaying the last known state without clearing the file
3. WHEN a new run starts (split), THE OBS_Writer SHALL reflect the updated run count and reset run-specific data in the next write cycle
4. WHEN an item is found during a session, THE OBS_Writer SHALL include it in the items list on the next write cycle

### Requirement 5: Performance and Reliability

**User Story:** As a user, I want OBS file writing to have no noticeable performance impact on the application, so that my farming session remains smooth.

#### Acceptance Criteria

1. THE OBS_Writer SHALL perform all file I/O operations asynchronously using Rust's standard async file operations
2. THE OBS_Writer SHALL write the complete file content atomically by writing to a temporary file and renaming, preventing OBS from reading partial content
3. WHEN OBS mode is disabled, THE OBS_Writer SHALL consume zero system resources for file writing
