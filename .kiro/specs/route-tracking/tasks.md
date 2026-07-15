# Implementation Plan: Multi-Area Route Tracking

## Overview

This plan implements multi-area farming route support across the full stack: database schema + migration, Rust models and CRUD commands, frontend types/API wrappers, Route Editor page with drag-and-drop, Route Mode integration in RunTracker, route-aware statistics, and sidebar navigation. Each task builds incrementally on the previous.

## Tasks

- [ ] 1. Database schema and migration
  - [ ] 1.1 Add `routes` table and `runs` migration in `src-tauri/src/db.rs`
    - Add `routes` table creation to `init_db` (id, profile_id, name, areas, created_at, FK to profiles with CASCADE)
    - Add `CREATE INDEX IF NOT EXISTS idx_routes_profile ON routes(profile_id)`
    - Add `migrate_route_columns` function that checks for `route_id` column on `runs` table and adds nullable `route_id TEXT` and `route_step_index INTEGER` columns via ALTER TABLE
    - Add `CREATE INDEX IF NOT EXISTS idx_runs_route ON runs(route_id)`
    - Call the new migration function at the end of `init_db`
    - _Requirements: 1.1, 1.2, 6.2_

- [ ] 2. Rust backend models and commands
  - [ ] 2.1 Add Route models to `src-tauri/src/models.rs`
    - Add `Route` struct (id, profile_id, name, areas: Vec<String>, created_at)
    - Add `CreateRouteInput` struct (profile_id, name, areas: Vec<String>)
    - Add `UpdateRouteInput` struct (name, areas: Vec<String>)
    - Add `RouteStats` struct (route_id, route_name, total_cycles, avg_cycle_time_secs, total_items, items_per_cycle)
    - Add `route_id: Option<String>` and `route_step_index: Option<i64>` fields to existing `Run` struct
    - Add `route_id: Option<String>` and `route_step_index: Option<i64>` fields to `CreateRunInput`
    - _Requirements: 1.1, 6.1, 6.2_

  - [ ] 2.2 Implement route CRUD commands in `src-tauri/src/commands.rs`
    - Implement `create_route`: validate name (non-empty, ≤100 chars) and areas (≥2 entries), generate UUID, serialize areas as JSON, INSERT into routes table
    - Implement `get_routes`: SELECT all routes for profile_id ordered by created_at DESC, deserialize areas JSON
    - Implement `update_route`: validate inputs, verify route exists (return error if not), UPDATE name and areas
    - Implement `delete_route`: verify route exists (return error if not), DELETE from routes table
    - _Requirements: 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 2.3 Implement `get_route_stats` command in `src-tauri/src/commands.rs`
    - Query all completed runs WHERE route_id matches
    - Group runs into cycles by detecting step_index wrap (step_index goes from max back to 0)
    - Only count complete cycles (all steps 0 through N-1 present with completed status)
    - Compute total_cycles, avg_cycle_time_secs, total_items across complete cycles, items_per_cycle
    - Return RouteStats object
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 2.4 Modify `create_run` command to accept route_id and route_step_index
    - Update the INSERT SQL to include route_id and route_step_index columns
    - Update the Run struct construction to include the new fields
    - Ensure backward compatibility: existing calls without route fields still work (fields are Option)
    - _Requirements: 6.1, 6.2_

  - [ ] 2.5 Register new commands in `src-tauri/src/lib.rs`
    - Add `commands::create_route`, `commands::get_routes`, `commands::update_route`, `commands::delete_route`, `commands::get_route_stats` to the `generate_handler!` macro
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.6 Write property tests for route creation and validation (Rust)
    - **Property 1: Route creation round-trip**
    - **Property 2: Route input validation**
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [ ]* 2.7 Write property tests for route listing and update (Rust)
    - **Property 3: Route listing order**
    - **Property 4: Route update round-trip**
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 2.8 Write property test for run route context (Rust)
    - **Property 10: Run stores route context**
    - **Validates: Requirements 6.1**

- [ ] 3. Checkpoint - Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Frontend types and API layer
  - [ ] 4.1 Add Route types to `src/types.ts`
    - Add `Route` interface (id, profile_id, name, areas: string[], created_at)
    - Add `CreateRouteInput` interface (profile_id, name, areas: string[])
    - Add `UpdateRouteInput` interface (name, areas: string[])
    - Add `RouteStats` interface (route_id, route_name, total_cycles, avg_cycle_time_secs, total_items, items_per_cycle)
    - Add optional `route_id?: string` and `route_step_index?: number` to `CreateRunInput`
    - Add optional `route_id: string | null` and `route_step_index: number | null` to `Run` interface
    - _Requirements: 1.1, 6.1, 6.2_

  - [ ] 4.2 Add Route API wrappers to `src/api.ts`
    - Add `createRoute(input: CreateRouteInput)` invoking `create_route`
    - Add `getRoutes(profileId: string)` invoking `get_routes`
    - Add `updateRoute(id: string, input: UpdateRouteInput)` invoking `update_route`
    - Add `deleteRoute(id: string)` invoking `delete_route`
    - Add `getRouteStats(routeId: string)` invoking `get_route_stats`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1_

- [ ] 5. Route Editor page
  - [ ] 5.1 Install `@dnd-kit/core` and `@dnd-kit/sortable` dependencies
    - Run `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
    - _Requirements: 3.4_

  - [ ] 5.2 Create `src/pages/RouteEditor.tsx` with route CRUD UI
    - Implement route list showing existing routes for the profile with edit/delete buttons
    - Implement create/edit form with name input and area sequence builder
    - Area picker: select from combined AREAS + custom areas list, add to sequence
    - Remove button on each area in the sequence
    - Disable save button when name is empty or areas < 2
    - Call createRoute/updateRoute/deleteRoute API functions
    - Implement edit mode that populates form with existing route data
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

  - [ ] 5.3 Add drag-and-drop reordering with `@dnd-kit` to Route Editor
    - Wrap area sequence list in DndContext + SortableContext
    - Implement SortableItem component for each area in the sequence
    - Handle `onDragEnd` to reorder the areas array
    - Provide keyboard-accessible drag handles
    - _Requirements: 3.4_

  - [ ]* 5.4 Write property test for save button validation state
    - **Property 5: Save button validation state**
    - **Validates: Requirements 3.7**

- [ ] 6. Route Mode integration in RunTracker
  - [ ] 6.1 Add Route Mode toggle and route selector to RunTracker session start
    - Add `routeMode` boolean state with toggle switch in start session config
    - When enabled, show route dropdown populated from `getRoutes(profile.id)`
    - Store `selectedRoute` state
    - Default behavior remains single-area when Route Mode is off
    - _Requirements: 4.1, 4.2, 4.7_

  - [ ] 6.2 Implement Route Mode step advancement logic in RunTracker
    - Add `currentStepIndex` (number) and `cycleCount` (number) state
    - On session start in Route Mode: set area to `selectedRoute.areas[0]`, set currentStepIndex to 0
    - Modify `splitRun()`: in route mode, advance step index with `(currentStepIndex + 1) % route.areas.length`, update area, increment cycleCount when wrapping
    - Pass `route_id` and `route_step_index` to `createRun()` when in route mode
    - Display step indicator: "Step X/Y: AreaName" during active route session
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 6.1_

  - [ ]* 6.3 Write property test for route step advancement with wrap
    - **Property 6: Route Mode step advancement with wrap**
    - **Validates: Requirements 4.3, 4.4, 4.5**

  - [ ]* 6.4 Write unit tests for RunTracker route mode
    - Test Route Mode toggle shows/hides route dropdown
    - Test step indicator display format
    - Test single-area mode still works when route mode is off
    - _Requirements: 4.1, 4.2, 4.6, 4.7_

- [ ] 7. Checkpoint - Route Mode verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Route Statistics
  - [ ] 8.1 Add route statistics section to `src/pages/Statistics.tsx`
    - Add a "Route Statistics" section below existing stats
    - Add route selector dropdown (populated from getRoutes)
    - When a route is selected, call getRouteStats and display: total cycles, average cycle time, items per cycle
    - Handle empty state when no routes exist or no completed cycles
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 8.2 Write property tests for cycle time and items per cycle computation
    - **Property 7: Cycle time computation**
    - **Property 8: Partial cycle exclusion**
    - **Property 9: Items per cycle computation**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [ ]* 8.3 Write property test for run grouping by route
    - **Property 11: Run grouping by route**
    - **Validates: Requirements 6.3**

- [ ] 9. Sidebar navigation and wiring
  - [ ] 9.1 Add Route Editor to sidebar navigation in `src/App.tsx`
    - Add "routes" to the Page type union
    - Import RouteEditor component
    - Add navigation button with 🗺️ emoji (between Run Tracker and History)
    - Disable when no profile is selected (same pattern as other profile-dependent pages)
    - Add case in `renderPage()` switch to render `<RouteEditor profile={selectedProfile} />`
    - _Requirements: 3.1, 3.5_

- [ ] 10. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `@dnd-kit` library provides accessible drag-and-drop with keyboard support
- Backend follows existing patterns: `Result<T, String>`, `rusqlite::params!`, `Uuid::new_v4()`, `Utc::now().to_rfc3339()`
- Frontend follows existing patterns: `invoke<T>()`, component props with Profile, useState/useRef for state

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.4"] },
    { "id": 3, "tasks": ["2.3", "2.5"] },
    { "id": 4, "tasks": ["2.6", "2.7", "2.8", "4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1"] },
    { "id": 6, "tasks": ["5.2", "6.1"] },
    { "id": 7, "tasks": ["5.3", "5.4", "6.2"] },
    { "id": 8, "tasks": ["6.3", "6.4", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "9.1"] }
  ]
}
```
