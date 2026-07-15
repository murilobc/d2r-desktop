# Implementation Plan: Cloud Sync

## Overview

This plan implements cross-machine data synchronization for D2R Tracker using a pull → merge → push architecture. The Rust backend handles secure I/O (keychain, GitHub API, atomic file writes) while the TypeScript sync engine orchestrates merge logic. Implementation follows a dependency-driven order: Rust commands first, then sync engine core (payload/merge/serialization), then UI components, then integration wiring.

## Tasks

- [x] 1. Rust backend: dependencies and sync module scaffold
  - [x] 1.1 Add `reqwest` and `keyring` dependencies to Cargo.toml and create `src-tauri/src/sync.rs` module
    - Add `reqwest = { version = "0.12", features = ["json", "rustls-tls"] }` and `keyring = "3"` to `[dependencies]` in `src-tauri/Cargo.toml`
    - Create `src-tauri/src/sync.rs` with module-level doc comment and placeholder structs for `GistPullResult`, `GistPushResult`, `TestResult`
    - Register the new module in `src-tauri/src/lib.rs`
    - _Requirements: 2.1, 5.1_

- [x] 2. Rust backend: keychain commands
  - [x] 2.1 Implement `save_sync_token`, `get_sync_token`, and `delete_sync_token` Tauri commands
    - Use `keyring` crate with service name `"d2r-tracker"` and key `"github_token"`
    - `save_sync_token(service: String, token: String)` — validate non-empty, 1–255 chars, store in OS keychain
    - `get_sync_token(service: String)` — retrieve from keychain, return `Option<String>`
    - `delete_sync_token(service: String)` — remove entry from keychain
    - Return descriptive error messages when keychain is unavailable
    - Register all three commands in the Tauri command builder in `lib.rs`
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 3. Rust backend: GitHub Gist API commands
  - [x] 3.1 Implement `github_gist_pull` command
    - Retrieve token from keychain internally (never return token to JS)
    - If `gist_id` is provided, GET `https://api.github.com/gists/{id}` with auth header
    - Parse response to extract `d2r-tracker-sync.json` file content
    - Return `Option<GistPullResult>` with payload string and gist metadata
    - Handle 401/403 (auth error), 404 (not found), 429 (rate limit), 5xx (server error), and timeout (30s)
    - _Requirements: 2.2, 2.4, 2.5_

  - [x] 3.2 Implement `github_gist_push` command
    - Retrieve token from keychain internally
    - If `gist_id` is `None`, create a new private gist via POST with file `d2r-tracker-sync.json`
    - If `gist_id` is `Some`, update existing gist via PATCH
    - Return `GistPushResult` containing the gist ID (important for first-sync scenario)
    - Handle same error codes as pull
    - _Requirements: 2.1, 2.3, 2.6_

  - [x] 3.3 Implement `github_gist_test` command
    - Retrieve token from keychain, make a lightweight GET to `https://api.github.com/user` to validate token
    - Return `TestResult { success: bool, error: Option<String> }`
    - 10-second timeout for test connection
    - _Requirements: 9.5, 9.7_

- [x] 4. Rust backend: local file commands
  - [x] 4.1 Implement `local_file_pull`, `local_file_push`, and `local_folder_validate` commands
    - `local_file_pull(folder_path: String)` — read `d2r-tracker-sync.json` from folder, return `Option<String>` (None if file doesn't exist)
    - `local_file_push(folder_path: String, payload: String)` — atomic write: write to `.d2r-tracker-sync.json.tmp` then rename to `d2r-tracker-sync.json`
    - `local_folder_validate(folder_path: String)` — check folder exists and is writable, return `bool`
    - Return OS-level error messages for inaccessible paths
    - Register all commands in Tauri command builder
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 5. Checkpoint - Verify Rust backend compiles
  - Ensure all tests pass, ask the user if questions arise.
  - Run `cd src-tauri && cargo check` to verify all new commands compile correctly

- [x] 6. TypeScript: sync types and API wrappers
  - [x] 6.1 Define sync-related TypeScript types in `src/services/cloud-sync.types.ts`
    - Define `SyncPayload`, `SyncRecord<T>`, `SyncConfig`, `SyncResult`, `SyncStatus`, `SyncState`, `TestConnectionResult`, `CloudSyncConfig` interfaces
    - Define per-entity `*Data` types (ProfileData, RunData, ItemData, etc.) mirroring existing types without `id`
    - Export `SYNC_CONFIG_KEY = "d2r_sync_config"` constant
    - _Requirements: 1.1, 10.4, 10.6_

  - [x] 6.2 Add Tauri invoke wrappers for sync commands in `src/api.ts`
    - Add wrapper functions: `saveSyncToken`, `getSyncToken`, `deleteSyncToken`, `githubGistPull`, `githubGistPush`, `githubGistTest`, `localFilePull`, `localFilePush`, `localFolderValidate`
    - Use proper TypeScript types for parameters and return values
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 5.1_

- [x] 7. TypeScript: sync engine — serialization
  - [x] 7.1 Implement lexicographic JSON serialization and payload construction in `src/services/cloud-sync.serialization.ts`
    - Implement `serializePayload(payload: SyncPayload): string` — recursively sort all object keys lexicographically at every nesting level
    - Implement `deserializePayload(json: string): SyncPayload` — parse and validate structure
    - Implement `buildPayloadFromDb(): Promise<SyncPayload>` — query all entity tables via existing API, wrap records in `SyncRecord<T>` with `updated_at` and `deleted_at`
    - Null-valued optional fields serialize as JSON `null` (not omitted)
    - _Requirements: 1.1, 1.4, 10.1, 10.4, 10.6_

  - [x]* 7.2 Write property test: Payload structure completeness (Property 1)
    - **Property 1: Payload structure completeness**
    - Generate random valid database states, serialize to SyncPayload, verify schema_version is positive integer, payload timestamp is valid ISO 8601 UTC with ms, every record has non-empty `id` and valid `updated_at`
    - **Validates: Requirements 1.1**

  - [x]* 7.3 Write property test: Serialization round-trip (Property 3)
    - **Property 3: Serialization round-trip**
    - Generate random SyncPayloads with null optional fields, serialize to JSON then deserialize, verify all fields identical including null keys preserved
    - **Validates: Requirements 1.4, 10.4, 10.6**

  - [x]* 7.4 Write property test: Lexicographic key ordering (Property 12)
    - **Property 12: Lexicographic key ordering**
    - Generate random SyncPayloads, serialize, parse JSON and verify all object keys at every nesting level are in alphabetical order
    - **Validates: Requirements 10.1**

- [x] 8. TypeScript: sync engine — validation
  - [x] 8.1 Implement payload validation in `src/services/cloud-sync.validation.ts`
    - Implement `validatePayload(payload: unknown): { valid: boolean; error?: string }` — check schema_version exists and is positive int, timestamp exists and is valid ISO 8601, each collection has records with non-empty `id` and valid `updated_at`
    - Implement `validateToken(token: string): { valid: boolean; error?: string }` — reject empty, whitespace-only, or >255 chars
    - Ignore unrecognized fields (don't reject, don't persist)
    - Return specific error messages identifying which rule failed
    - _Requirements: 1.5, 5.1, 5.6, 10.2, 10.5_

  - [x]* 8.2 Write property test: Payload validation rejects invalid input (Property 4)
    - **Property 4: Payload validation rejects invalid input**
    - Generate payloads missing schema_version, missing timestamp, with empty record ids, with invalid timestamps — verify validation rejects each with specific error
    - **Validates: Requirements 1.5, 10.2**

  - [x]* 8.3 Write property test: Token validation (Property 11)
    - **Property 11: Token validation**
    - Generate empty strings, whitespace-only strings, strings >255 chars (must reject); generate non-empty non-whitespace strings 1–255 chars (must accept)
    - **Validates: Requirements 5.1, 5.6**

  - [x]* 8.4 Write property test: Ignore unrecognized fields (Property 13)
    - **Property 13: Ignore unrecognized fields**
    - Generate valid SyncPayloads, inject extra fields at various levels, verify deserialization succeeds, extra fields not persisted, recognized data intact
    - **Validates: Requirements 10.5**

- [x] 9. TypeScript: sync engine — merge logic
  - [x] 9.1 Implement the merge function in `src/services/cloud-sync.merge.ts`
    - Implement `merge(local: SyncPayload, remote: SyncPayload, lastSyncTimestamp: string | null): SyncPayload`
    - Per-collection merge: build maps by id, handle local-only, remote-only, and both-sides cases
    - Field-level merge for conflicted records: compare `updated_at`, keep later value per field
    - Tiebreaker for identical timestamps: lexicographically greater `id` wins
    - Deletion conflict resolution: compare `deleted_at` vs `updated_at`
    - Propagate deletion for records only on one side with `deleted_at`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x]* 9.2 Write property test: Conflict detection correctness (Property 5)
    - **Property 5: Conflict detection correctness**
    - Generate record pairs with same id, varying `updated_at` relative to `lastSyncTimestamp`, verify conflict detected iff both sides modified after last sync
    - **Validates: Requirements 4.1**

  - [x]* 9.3 Write property test: Field-level merge for non-conflicting changes (Property 6)
    - **Property 6: Field-level merge for non-conflicting changes**
    - Generate two record versions with changes to disjoint field sets, verify merged result has each changed field from its modifier, unchanged fields preserved
    - **Validates: Requirements 4.2**

  - [x]* 9.4 Write property test: One-sided records preserved (Property 7)
    - **Property 7: One-sided records preserved**
    - Generate records existing only in local or only in remote (without `deleted_at`), verify they appear unchanged in merged result
    - **Validates: Requirements 4.3, 4.4**

  - [x]* 9.5 Write property test: Last-write-wins for same-field conflicts (Property 8)
    - **Property 8: Last-write-wins for same-field conflicts**
    - Generate two record versions modifying the same field with different `updated_at`, verify merged field value comes from the more recent version
    - **Validates: Requirements 4.6**

  - [x]* 9.6 Write property test: Identical timestamp tiebreaker (Property 9)
    - **Property 9: Identical timestamp tiebreaker**
    - Generate conflicting records with identical `updated_at`, verify merged result uses values from the record with lexicographically greater `id`
    - **Validates: Requirements 4.7**

  - [x]* 9.7 Write property test: Deletion vs modification conflict resolution (Property 10)
    - **Property 10: Deletion vs modification conflict resolution**
    - Generate records with local modifications and remote `deleted_at` (and vice versa), vary relative timestamps, verify correct resolution per spec
    - **Validates: Requirements 4.5, 4.8**

- [x] 10. TypeScript: sync engine — orchestrator
  - [x] 10.1 Implement the main sync engine service in `src/services/cloud-sync.ts`
    - Implement `SyncEngine` class with `triggerSync()`, `getStatus()`, `testConnection()`, `pushOnClose()` methods
    - `triggerSync()`: load config from localStorage → pull remote → validate → merge → push merged → update lastSyncTimestamp → update status
    - Handle schema version mismatch (refuse merge if remote version > current)
    - 30-second timeout for full sync cycle
    - Export singleton instance
    - Integrate with serialization, validation, and merge modules
    - _Requirements: 1.3, 2.6, 3.7, 6.2, 6.3, 6.4, 8.4, 8.5_

  - [x]* 10.2 Write property test: Schema migration preserves data (Property 2)
    - **Property 2: Schema migration preserves data**
    - Generate valid SyncPayloads at schema version N-1, apply migration function, verify all original records present with unchanged field values
    - **Validates: Requirements 1.2**

- [x] 11. Checkpoint - Verify sync engine logic
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm test` to verify all TypeScript tests pass

- [x] 12. UI: Cloud Sync Settings component
  - [x] 12.1 Implement `CloudSyncSettings` section in Settings page
    - Add a "Cloud Sync" section within `src/pages/Settings.tsx` (or extract to `src/components/CloudSyncSettings.tsx` and import)
    - Backend selector: Off / GitHub Gist / Local Folder — persisted to localStorage as `d2r_sync_config`
    - GitHub Gist mode: masked token input with show/hide toggle, optional Gist ID text field
    - Local Folder mode: folder picker using `@tauri-apps/plugin-dialog`, display selected path, validate on selection
    - "Test Connection" button: calls `testConnection()`, shows success for 5s or error with reason
    - Auto-sync on close toggle (default: disabled)
    - Confirmation dialog when switching backends
    - Prevent save with empty token for GitHub backend
    - _Requirements: 5.4, 5.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x]* 12.2 Write unit tests for CloudSyncSettings
    - Test correct rendering per backend selection
    - Test input masking toggle
    - Test confirmation dialog on backend change
    - Test validation prevents empty token save
    - Test folder picker invocation
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.8_

- [x] 13. UI: Sync Status Indicator component
  - [x] 13.1 Implement `SyncStatusIndicator` component in `src/components/SyncStatusIndicator.tsx`
    - Display current sync state: "Not configured", "Synced X ago", "Syncing...", or "Error: [message]" (truncated to 80 chars)
    - Manual sync button — disabled during active sync, triggers `triggerSync()`
    - Dismiss button for error state
    - Error message when clicking sync in "Not configured" state
    - Relative time formatting for last sync timestamp
    - Keyboard accessible: focusable via Tab, aria-label with state and timestamp, button operable via Enter/Space
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7_

  - [x]* 13.2 Write unit tests for SyncStatusIndicator
    - Test each state rendering (not configured, synced, syncing, error)
    - Test button disabled during sync
    - Test keyboard accessibility (aria-label, Tab focus, Enter/Space)
    - Test error dismiss
    - _Requirements: 6.1, 6.3, 6.5, 6.7_

- [x] 14. Integration: wire sync into App
  - [x] 14.1 Mount `SyncStatusIndicator` in sidebar footer and wire auto-sync on close
    - Import and mount `SyncStatusIndicator` in `src/App.tsx` sidebar footer area (below current profile display)
    - Wire Tauri window close event listener to call `syncEngine.pushOnClose()` when auto-sync is enabled
    - Implement 10-second timeout for close-time sync; allow app to terminate regardless of outcome
    - Log errors during auto-sync without showing UI (app is closing)
    - Show non-interactive syncing indicator during close-time push
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.6_

- [x] 15. Final checkpoint - Full verification
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm test` to verify all frontend tests pass
  - Run `cd src-tauri && cargo check` to verify Rust compiles
  - Run `npx tsc --noEmit` to verify TypeScript types
  - Run `npx vite build` to verify build succeeds

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases using `vitest`
- The Rust backend never exposes the GitHub token to the JS context — all API calls happen in Rust
- `fast-check` must be added as a dev dependency (`npm install -D fast-check`) before running property tests
- All property tests go in `src/services/cloud-sync.property.test.ts`
- Existing `src/pages/Settings.test.tsx` will be extended for CloudSyncSettings unit tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "6.1"] },
    { "id": 3, "tasks": ["6.2", "7.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "7.4", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "10.1"] },
    { "id": 7, "tasks": ["10.2", "12.1", "13.1"] },
    { "id": 8, "tasks": ["12.2", "13.2", "14.1"] }
  ]
}
```
