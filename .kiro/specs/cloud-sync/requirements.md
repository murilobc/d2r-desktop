# Requirements Document

## Introduction

Data Sync (Cloud) enables the D2R Tracker desktop application to synchronize user data across multiple machines. The feature supports two sync backends: GitHub Gist (private) for cloud-based sync, and a local folder path (compatible with Dropbox, OneDrive, or any file-syncing service). The sync engine uses a versioned JSON format with per-record timestamps to detect and resolve conflicts using a last-write-wins strategy with field-level merging for non-conflicting changes. The feature is fully optional — the application operates offline without any sync configuration.

## Glossary

- **Sync_Engine**: The TypeScript service (`src/services/cloud-sync.ts`) responsible for push, pull, and merge operations across sync backends
- **Sync_Backend**: A configured destination for synchronized data — either a GitHub Gist or a local folder path
- **Sync_Payload**: A versioned JSON document containing all user data (profiles, runs, items, herald encounters, etc.) with per-record timestamps
- **Credential_Store**: The OS-native keychain (accessed via Tauri) used to securely store sensitive credentials such as GitHub tokens
- **Sync_Status_Indicator**: The UI element in the sidebar footer displaying current sync state, last sync timestamp, and error information
- **Conflict**: A state where the same record has been modified both locally and remotely since the last successful sync
- **Last_Write_Wins**: A conflict resolution strategy where the record with the most recent timestamp is kept for conflicting fields
- **Field_Level_Merge**: A merge strategy where non-conflicting field changes from both local and remote versions are combined into the final record
- **GitHub_Gist_Backend**: A sync backend that stores the Sync_Payload as a file within a private GitHub Gist
- **Local_Folder_Backend**: A sync backend that writes the Sync_Payload as a JSON file to a user-specified local directory
- **Settings_Page**: The existing application settings interface where sync configuration is managed

## Requirements

### Requirement 1: Sync Payload Format

**User Story:** As a user syncing across machines, I want my data stored in a well-defined versioned format with timestamps, so that conflicts can be detected and resolved reliably.

#### Acceptance Criteria

1. THE Sync_Engine SHALL produce a Sync_Payload containing a schema version (positive integer starting at 1), a payload-level timestamp in ISO 8601 UTC format with millisecond precision, and per-record `updated_at` timestamps (also ISO 8601 UTC with millisecond precision) for all entity types (profiles, runs, items, herald encounters, colossal ancient attempts, anni logs, xp entries, keybind profiles, routes, custom areas)
2. WHEN the Sync_Payload schema changes between application versions, THE Sync_Engine SHALL transform a Sync_Payload from the immediately preceding schema version to the current schema version without losing or corrupting any existing record data
3. IF the Sync_Engine reads a Sync_Payload with a schema version higher than the application's current schema version, THEN THE Sync_Engine SHALL refuse to merge the payload and display an error message indicating the user must update the application to a newer version
4. THE Sync_Engine SHALL produce identical field values and structure when a valid Sync_Payload is serialized to JSON and then deserialized back into an object (round-trip integrity), where identical means all field names, values, and types match exactly
5. THE Sync_Engine SHALL validate that a Sync_Payload contains all required top-level fields (schema version, timestamp, and at least one entity-type collection) and that every record within each collection includes a non-empty `id` and a valid ISO 8601 `updated_at` timestamp before accepting it for merge; IF validation fails, THEN THE Sync_Engine SHALL reject the payload and display an error message indicating which validation rule was violated

### Requirement 2: GitHub Gist Sync Backend

**User Story:** As a user with multiple PCs, I want to sync my D2R Tracker data via a private GitHub Gist, so that my data is available on any machine with internet access.

#### Acceptance Criteria

1. WHEN the user triggers a push operation with a configured GitHub_Gist_Backend, THE Sync_Engine SHALL upload the current Sync_Payload to the configured private Gist using the GitHub Gist API
2. WHEN the user triggers a pull operation with a configured GitHub_Gist_Backend, THE Sync_Engine SHALL download the Sync_Payload from the configured private Gist
3. WHEN no Gist ID is configured and the user initiates the first sync, THE Sync_Engine SHALL create a new private Gist with a single file named `d2r-tracker-sync.json` containing the Sync_Payload and store the returned Gist ID in settings
4. IF the GitHub API returns an authentication error (401 or 403), THEN THE Sync_Engine SHALL display a credential error message and prompt the user to re-enter the token
5. IF the GitHub API request fails due to network timeout (30 seconds), rate limiting (429), or server error (5xx), THEN THE Sync_Engine SHALL display a connectivity error message indicating the failure reason and retain the local data unmodified
6. WHEN a push or pull operation succeeds, THE Sync_Engine SHALL update the last sync timestamp displayed in the Sync_Status_Indicator

### Requirement 3: Local Folder Sync Backend

**User Story:** As a user who prefers not to use GitHub or wants to use an existing file-sync service (Dropbox, OneDrive), I want to export my sync data to a local folder, so that my existing cloud storage handles replication.

#### Acceptance Criteria

1. WHEN the user triggers a push operation with a configured Local_Folder_Backend, THE Sync_Engine SHALL write the current Sync_Payload to a file named `d2r-tracker-sync.json` in the configured folder path using an atomic write strategy (write to a temporary file then rename) so that no partial file is exposed to external sync services
2. WHEN the user triggers a pull operation with a configured Local_Folder_Backend, THE Sync_Engine SHALL read and parse the `d2r-tracker-sync.json` file from the configured folder path and pass the result to the merge operation
3. IF the configured folder path does not exist or is not writable when a push or pull operation is attempted, THEN THE Sync_Engine SHALL display an error message identifying the inaccessible path and retain local data unmodified
4. IF the sync file does not exist in the configured folder during a pull operation, THEN THE Sync_Engine SHALL treat the remote state as empty and perform no merge
5. WHEN the user selects a folder for Local_Folder_Backend configuration, THE Settings_Page SHALL use a Tauri native folder picker dialog
6. WHEN the user confirms a folder selection for Local_Folder_Backend configuration, THE Settings_Page SHALL verify that the selected path exists and is writable before saving the configuration, and display an error message identifying the problem if validation fails
7. WHEN a push operation to the Local_Folder_Backend succeeds, THE Sync_Engine SHALL update the last sync timestamp displayed in the Sync_Status_Indicator

### Requirement 4: Conflict Resolution

**User Story:** As a user editing data on multiple machines, I want conflicts resolved automatically without losing data, so that I can use any machine without worrying about sync order.

#### Acceptance Criteria

1. WHEN the Sync_Engine detects that both local and remote versions of the same record have been modified since the last successful sync, THE Sync_Engine SHALL identify the record as conflicted and apply field-level comparison using each version's `updated_at` timestamp with millisecond precision
2. WHEN two versions of the same record have changes to different fields, THE Sync_Engine SHALL apply Field_Level_Merge to combine non-conflicting changes from both versions, retaining each field's value from the version that last modified it
3. WHEN a record exists locally but not remotely, THE Sync_Engine SHALL include the local record in the merged result
4. WHEN a record exists remotely but not locally and the remote record does not have a `deleted_at` timestamp, THE Sync_Engine SHALL include the remote record in the merged result
5. THE Sync_Engine SHALL treat record deletion as a soft-delete by adding a `deleted_at` timestamp, so that deletions propagate across machines without losing the deletion intent
6. WHEN both local and remote versions modify the same field of the same record, THE Sync_Engine SHALL keep the value with the more recent `updated_at` timestamp
7. IF both local and remote versions of the same field have identical `updated_at` timestamps, THEN THE Sync_Engine SHALL select the version with the lexicographically greater record `id` as the tiebreaker
8. WHEN a record has been modified locally and the remote version carries a `deleted_at` timestamp that is more recent than the local `updated_at`, THE Sync_Engine SHALL apply the deletion; IF the local `updated_at` is more recent than the remote `deleted_at`, THEN THE Sync_Engine SHALL preserve the local modification and clear the deletion

### Requirement 5: Credential Security

**User Story:** As a security-conscious user, I want my GitHub token stored in the OS keychain rather than in application storage, so that my credentials are protected by the operating system's security model.

#### Acceptance Criteria

1. WHEN the user provides a GitHub personal access token, THE Credential_Store SHALL validate that the token is a non-empty string of 1 to 255 characters before saving it to the OS-native keychain via a Tauri Rust command
2. WHEN a sync operation requires the GitHub token, THE Credential_Store SHALL retrieve the token from the OS keychain within the Rust backend and perform the GitHub API call from Rust without returning the raw token value to the frontend JavaScript context
3. WHEN the user removes their sync configuration, THE Credential_Store SHALL delete the stored token from the OS keychain and confirm deletion by displaying a success message in the Settings_Page
4. THE Settings_Page SHALL mask the GitHub token input field using password-type masking (dot characters) by default and provide a toggle button that switches between masked and plaintext display
5. IF the OS keychain is unavailable or returns an access error, THEN THE Credential_Store SHALL display an error message indicating the keychain failure reason and refuse to store credentials in alternative locations such as localStorage, files, or application config
6. IF the user submits an empty or whitespace-only token value, THEN THE Settings_Page SHALL display a validation error message and SHALL NOT invoke the Credential_Store save operation

### Requirement 6: Sync UI and Status

**User Story:** As a user, I want to see the current sync status at a glance and trigger sync manually, so that I know my data is up to date and can force a sync when needed.

#### Acceptance Criteria

1. THE Sync_Status_Indicator SHALL display in the sidebar footer showing one of the following states: "Not configured", "Synced" with last sync timestamp formatted as relative time (e.g., "2 min ago", "1 hour ago"), "Syncing..." during active operations, or "Error" with an error description truncated to 80 characters maximum
2. WHEN the user clicks the manual sync button, THE Sync_Engine SHALL perform a full pull-merge-push cycle and THE Sync_Status_Indicator SHALL transition to the "Syncing..." state within 200ms of the click
3. WHEN a sync operation is in progress, THE Sync_Status_Indicator SHALL display a loading state and the manual sync button SHALL be disabled to prevent concurrent sync requests
4. IF the sync operation does not complete within 30 seconds, THEN THE Sync_Engine SHALL abort the operation and THE Sync_Status_Indicator SHALL display a timeout error
5. WHEN a sync error occurs, THE Sync_Status_Indicator SHALL display the error message until the next successful sync or until the user clicks a dismiss button rendered adjacent to the error text
6. IF the user clicks the manual sync button while sync is in the "Not configured" state, THEN THE Sync_Status_Indicator SHALL display an error message indicating that sync configuration is required and the sync operation SHALL NOT be attempted
7. THE Sync_Status_Indicator SHALL be focusable via keyboard Tab navigation, include an aria-label describing the current sync state and timestamp, and the manual sync button SHALL be operable via Enter and Space keys

### Requirement 7: Auto-Sync on App Close

**User Story:** As a user, I want the app to automatically sync my data when I close it, so that my latest session is always backed up without manual intervention.

#### Acceptance Criteria

1. WHERE the auto-sync setting is enabled, WHEN the application window is closing, THE Sync_Engine SHALL push all unsynchronized session data (runs, items, and profile changes created since the last successful sync) to the remote store before the application process terminates
2. THE Settings_Page SHALL provide a toggle for enabling or disabling auto-sync on close (default: disabled)
3. IF the auto-sync operation fails or is abandoned during app close, THEN THE Sync_Engine SHALL log the error to the application log file, preserve all local data unchanged, and allow the application to close without requiring user interaction
4. WHERE auto-sync is enabled, WHEN the push operation has not completed within 10 seconds of initiation, THE Sync_Engine SHALL cancel the operation, leave local data intact for sync on next launch, and allow the application to terminate
5. WHERE auto-sync is enabled, WHEN the push operation is in progress during app close, THE application SHALL display a non-interactive syncing indicator to inform the user that synchronization is underway

### Requirement 8: Offline-First Operation

**User Story:** As a user without sync configured, I want the application to function identically to how it does today, so that sync is purely additive and never degrades the core experience.

#### Acceptance Criteria

1. IF no sync backend is configured, THEN THE Application SHALL allow all local operations (creating, reading, updating, and deleting profiles, runs, items, herald encounters, routes, and settings) without displaying any sync-related errors
2. IF the configured sync backend is unreachable, THEN THE Application SHALL allow all local operations (creating, reading, updating, and deleting profiles, runs, items, herald encounters, routes, and settings) without blocking the UI or displaying errors outside the Sync_Status_Indicator
3. IF sync is not configured, THEN THE Sync_Status_Indicator SHALL display "Not configured" without any error styling
4. THE Sync_Engine SHALL store all data locally in SQLite as the primary data store, treating sync as a secondary replication mechanism
5. IF a sync operation fails while the user is performing local operations, THEN THE Application SHALL complete the local operation successfully and indicate the sync failure only in the Sync_Status_Indicator
6. IF the configured sync backend is unreachable at application startup, THEN THE Application SHALL complete startup and reach a usable state within the same time as when no sync backend is configured (no more than 2 seconds additional delay)

### Requirement 9: Sync Settings Configuration

**User Story:** As a user, I want a dedicated sync settings section where I can choose my backend, enter credentials, and configure sync behavior, so that setup is straightforward and contained.

#### Acceptance Criteria

1. THE Settings_Page SHALL provide a "Cloud Sync" section with backend selection (Off, GitHub Gist, Local Folder) that persists the selected configuration across app restarts
2. WHEN the user selects "GitHub Gist" as the backend, THE Settings_Page SHALL display a masked input field for GitHub personal access token and an optional text field for Gist ID
3. WHEN the user selects "Local Folder" as the backend, THE Settings_Page SHALL display a folder picker using the Tauri native dialog and show the selected folder path
4. WHEN the user changes the sync backend from one type to another, THE Settings_Page SHALL display a confirmation dialog before applying; IF the user declines the confirmation, THEN THE Settings_Page SHALL retain the previously selected backend with no changes applied
5. THE Settings_Page SHALL provide a "Test Connection" button that verifies the configured backend is reachable and the provided credentials are valid, without performing a full sync, within a timeout of 10 seconds
6. WHEN the "Test Connection" succeeds, THE Settings_Page SHALL display a success message for 5 seconds
7. IF the "Test Connection" fails or times out, THEN THE Settings_Page SHALL display an error message indicating the reason for failure (e.g., invalid token, unreachable endpoint, folder not found)
8. IF the user attempts to save the GitHub Gist backend with an empty personal access token field, THEN THE Settings_Page SHALL prevent saving and indicate that the token is required

### Requirement 10: Sync Payload Serialization and Deserialization

**User Story:** As a developer, I want well-defined serialization for the sync format, so that data integrity is maintained across sync cycles.

#### Acceptance Criteria

1. THE Sync_Engine SHALL serialize the Sync_Payload to JSON using lexicographic (alphabetical) key ordering at every nesting level for deterministic output
2. THE Sync_Engine SHALL validate the Sync_Payload structure on deserialization by verifying the presence of the schema version field, the payload-level timestamp, and that each entity collection contains only records with all required fields matching the expected types as defined by the schema version, and SHALL reject payloads that fail any of these checks
3. WHEN the Sync_Engine encounters a malformed Sync_Payload during pull, THE Sync_Engine SHALL display an error message indicating which structural rule or field failed validation and SHALL retain local data unmodified
4. THE Sync_Engine SHALL produce field-by-field identical records (including null values for optional fields) when a valid database state is serialized to a Sync_Payload and then deserialized and written back (round-trip property)
5. WHEN the Sync_Engine deserializes a Sync_Payload containing fields not recognized by the current schema version, THE Sync_Engine SHALL ignore the unrecognized fields without treating the payload as malformed and without persisting those fields locally
6. THE Sync_Engine SHALL serialize null-valued optional fields as JSON `null` rather than omitting the key, so that round-trip equivalence is preserved for all optional fields
