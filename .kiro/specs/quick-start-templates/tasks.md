# Implementation Plan: Quick-Start Templates

## Overview

Implement a template system for the Run Tracker that lets users save named session configurations and start sessions with one click. The feature follows the existing Tauri command → SQLite pattern: Rust structs in `models.rs`, database functions in `db.rs`, Tauri commands in `commands.rs`, TypeScript types in `types.ts`, API wrappers in `api.ts`, and React components in `src/components/`.

## Tasks

- [x] 1. Backend data layer — models and database migration
  - [x] 1.1 Add Template model structs to `src-tauri/src/models.rs`
    - Add `Template`, `CreateTemplateInput`, and `UpdateTemplateInput` structs as defined in the design
    - Add `templates: Option<Vec<Template>>` field to the existing `ExportData` struct for backward-compatible export/import
    - _Requirements: 1.1, 1.4, 6.1, 6.3_

  - [x] 1.2 Add `migrate_templates` function in `src-tauri/src/db.rs`
    - Create the `templates` table with all columns (id, profile_id, name, area, player_count, route_id, session_goal_type, session_goal_value, tags, last_used_at, created_at, updated_at)
    - Create index `idx_templates_profile` on `profile_id`
    - Create unique index `idx_templates_profile_name` on `(profile_id, name COLLATE NOCASE)`
    - Add FK constraints: `profile_id` → `profiles(id) ON DELETE CASCADE`, `route_id` → `routes(id) ON DELETE SET NULL`
    - Call `migrate_templates` from the existing `init_db` function
    - _Requirements: 6.1, 1.3_

- [x] 2. Backend CRUD — database functions and Tauri commands
  - [x] 2.1 Implement template database functions in `src-tauri/src/db.rs`
    - `db_create_template(conn, input) -> Result<Template, String>`: generate UUID, validate name (1–100 non-whitespace chars), validate player_count (1–8), validate session_goal_value (1–9999 if provided), serialize tags to JSON, insert row, return created template
    - `db_get_templates(conn, profile_id) -> Result<Vec<Template>, String>`: SELECT all templates for profile ordered by `last_used_at DESC NULLS LAST, created_at DESC`
    - `db_update_template(conn, id, input) -> Result<Template, String>`: validate same constraints as create, check unique name excluding self, update row, return updated template
    - `db_delete_template(conn, id) -> Result<(), String>`: DELETE by id, error if not found
    - `db_touch_template(conn, id) -> Result<(), String>`: UPDATE `last_used_at` to current ISO 8601 timestamp
    - Handle duplicate name errors from the UNIQUE index and return a user-friendly error message
    - _Requirements: 1.1, 1.3, 2.2, 3.2, 4.2, 5.2, 7.1, 7.3, 7.4_

  - [x] 2.2 Add template Tauri commands in `src-tauri/src/commands.rs`
    - `create_template(input: CreateTemplateInput) -> Result<Template, String>`
    - `get_templates(profile_id: String) -> Result<Vec<Template>, String>`
    - `update_template(id: String, input: UpdateTemplateInput) -> Result<Template, String>`
    - `delete_template(id: String) -> Result<(), String>`
    - `touch_template(id: String) -> Result<(), String>`
    - Register all 5 commands in the Tauri builder in `lib.rs`
    - _Requirements: 1.1, 1.2, 2.1, 3.2, 4.1, 5.2_

  - [x] 2.3 Extend export/import functions in `src-tauri/src/db.rs`
    - In `export_data`: query all templates and include in `ExportData.templates`
    - In `import_data`: if `templates` field is present, iterate and insert each; skip if ID already exists, increment skipped counter
    - Ensure backward compatibility — importing old data without `templates` field works fine
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 3. Checkpoint — Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend types and API layer
  - [x] 4.1 Add TypeScript types in `src/types.ts`
    - Add `Template` interface with all fields (id, profile_id, name, area, player_count, route_id, session_goal_type, session_goal_value, tags, last_used_at, created_at, updated_at)
    - Add `CreateTemplateInput` interface
    - Add `UpdateTemplateInput` interface
    - _Requirements: 1.1, 4.1_

  - [x] 4.2 Add API functions in `src/api.ts`
    - `createTemplate(input: CreateTemplateInput) → invoke<Template>("create_template", { input })`
    - `getTemplates(profileId: string) → invoke<Template[]>("get_templates", { profileId })`
    - `updateTemplate(id: string, input: UpdateTemplateInput) → invoke<Template>("update_template", { id, input })`
    - `deleteTemplate(id: string) → invoke<void>("delete_template", { id })`
    - `touchTemplate(id: string) → invoke<void>("touch_template", { id })`
    - _Requirements: 1.1, 2.1, 3.2, 4.1, 5.2_

- [x] 5. Frontend components — TemplateList and TemplateForm
  - [x] 5.1 Create `src/components/TemplateList.tsx`
    - Accepts `profileId`, `onStartFromTemplate` callback, and `sessionActive` prop
    - Calls `getTemplates(profileId)` on mount and when profileId changes
    - Renders up to 3 most-recently-used templates prominently, then remaining templates
    - Each template card shows: name, area, player count
    - Clicking a card calls `touchTemplate(id)` then `onStartFromTemplate(template)`
    - Edit (pencil icon) and Delete (trash icon) buttons on each card
    - Hidden when `sessionActive` is true or no templates exist
    - Delete shows a confirmation dialog identifying the template by name before calling `deleteTemplate(id)`
    - Ensure all interactive elements are keyboard-accessible (role, tabIndex, onKeyDown)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.3, 3.4, 5.1, 5.2, 5.3_

  - [x] 5.2 Create `src/components/TemplateForm.tsx`
    - Modal component for creating and editing templates
    - Props: `mode` ("create" | "edit"), `initialValues` (optional pre-populated template), `profileId`, `onSave`, `onCancel`
    - Fields: name (text, max 100), area (dropdown from AREAS + custom areas), player count (dropdown 1–8), route (dropdown, optional), goal type (dropdown: none/runs/time), goal value (number 1–9999, conditional on goal type), tags (multi-select, max 10)
    - Real-time client-side validation with per-field error messages
    - On submit: calls `createTemplate` or `updateTemplate` depending on mode
    - On duplicate name error from backend: shows inline error on name field without clearing other fields
    - Save button disabled until all required fields are valid
    - _Requirements: 1.1, 1.3, 1.5, 4.1, 4.2, 4.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 5.3 Integrate templates into the RunTracker page
    - Import and render `TemplateList` above the existing session start controls
    - When `onStartFromTemplate` fires: populate session config (area, player count, route, goal, tags) and immediately start the session
    - If template's `route_id` is null (deleted route), start session without route mode
    - Show "Save as Template" button in the session config area; opens `TemplateForm` in create mode with current config values pre-populated
    - Disable template creation if no active profile is set
    - _Requirements: 1.2, 1.5, 3.1, 3.4, 3.5_

- [x] 6. Checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Property-based tests and unit tests
  - [x] 7.1 Write property test for template name uniqueness per profile
    - **Property 1: Template name uniqueness per profile**
    - Generate random profile IDs and pairs of template names; verify case-insensitive collision is detected
    - **Validates: Requirements 1.3, 4.2**

  - [x] 7.2 Write property test for template creation round-trip
    - **Property 2: Template creation round-trip**
    - Generate random valid `CreateTemplateInput` values; verify retrieved template matches all input fields
    - **Validates: Requirements 1.1, 6.2**

  - [x] 7.3 Write property test for invalid name rejection
    - **Property 3: Invalid names are rejected**
    - Generate empty strings, whitespace-only strings, and strings >100 chars; verify error returned and no side effects
    - **Validates: Requirements 7.1**

  - [x] 7.4 Write property test for player count bounds
    - **Property 4: Player count bounds**
    - Generate integers outside [1, 8]; verify error returned
    - **Validates: Requirements 7.3**

  - [x] 7.5 Write property test for session goal bounds
    - **Property 5: Session goal bounds**
    - Generate integers outside [1, 9999]; verify error returned
    - **Validates: Requirements 7.4**

  - [x] 7.6 Write property test for delete removes exactly one
    - **Property 6: Delete removes exactly one template**
    - Generate random list of templates and a deletion target; verify list shrinks by 1 and others remain unchanged
    - **Validates: Requirements 5.2**

  - [x] 7.7 Write property test for touch preserves fields
    - **Property 7: Touch updates only last_used_at**
    - Generate random template and touch it; verify only `last_used_at` changes
    - **Validates: Requirements 3.2**

  - [x] 7.8 Write property test for template ordering
    - **Property 8: Template ordering — MRU first, then creation date**
    - Generate set of templates with varying `last_used_at`; verify correct sort order
    - **Validates: Requirements 2.2, 2.4**

  - [x] 7.9 Write property test for export/import round-trip
    - **Property 9: Export/import round-trip preserves templates**
    - Generate random set of templates; verify export then import produces identical data
    - **Validates: Requirements 6.3, 6.4**

  - [x] 7.10 Write unit tests for TemplateList component
    - Test empty state (no templates) renders nothing
    - Test MRU section renders top 3 recently used templates
    - Test clicking a template card triggers one-click start flow
    - Test delete confirmation dialog shows template name
    - Test component hidden when session is active
    - _Requirements: 2.1, 2.2, 2.3, 3.3, 3.4, 5.1_

  - [x] 7.11 Write unit tests for TemplateForm component
    - Test form pre-populates with existing template values in edit mode
    - Test validation errors display for invalid name, player count, goal value
    - Test duplicate name error from backend shows inline on name field
    - Test save button disabled with invalid fields
    - Test route dropdown excludes deleted routes
    - _Requirements: 4.1, 4.2, 7.1, 7.3, 7.4, 7.6_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design's Correctness Properties section
- Unit tests validate specific UI behaviors and edge cases
- The Rust backend handles all validation (single source of truth); the frontend shows validation feedback from backend error responses
- Tags are stored as a JSON array string in SQLite, matching the existing `runs.tags` pattern
- Template ordering uses `last_used_at DESC NULLS LAST, created_at DESC` to show MRU templates first

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "4.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["5.1", "5.2"] },
    { "id": 5, "tasks": ["5.3"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10", "7.11"] }
  ]
}
```
