# Requirements Document

## Introduction

This feature enables users to define multi-area farming routes (ordered sequences of areas like Mephisto → Pindleskin → Andariel), use those routes in the Run Tracker to automatically advance through route steps on each split, and view route-level statistics showing efficiency per complete cycle. The feature adds a `routes` table to the SQLite database, Rust CRUD commands following existing patterns, a route editor UI with drag-to-reorder, a "Route Mode" toggle in the Run Tracker, and route-aware statistics. Single-area mode remains fully functional as the default behavior.

## Glossary

- **Route**: An ordered sequence of areas that defines a farming path. Stored as a named entity with a JSON array of area strings.
- **Route_Manager**: The Rust backend module responsible for CRUD operations on routes.
- **Route_Editor**: The frontend UI component for creating, editing, reordering, and deleting routes.
- **Route_Runner**: The Run Tracker logic that manages route state during an active session, tracking the current step and auto-advancing on split.
- **Route_Step**: A single area within a route, identified by its zero-based index in the route's area sequence.
- **Route_Cycle**: One complete traversal through all steps in a route from first to last area.
- **Route_Statistics**: Computed metrics for route performance including total cycle time and items found per cycle.
- **Run_Tracker**: The existing session management component that handles run timing, splits, and item tracking.

## Requirements

### Requirement 1: Route Data Storage

**User Story:** As a user, I want my farming routes saved to the database, so that they persist across app restarts and can be reused across sessions.

#### Acceptance Criteria

1. THE Route_Manager SHALL store routes in a `routes` table with columns: id (TEXT PRIMARY KEY), profile_id (TEXT NOT NULL), name (TEXT NOT NULL), areas (TEXT NOT NULL storing a JSON array), and created_at (TEXT NOT NULL)
2. THE Route_Manager SHALL enforce a foreign key relationship between routes.profile_id and profiles.id with CASCADE delete
3. WHEN a route is created, THE Route_Manager SHALL generate a UUID v4 for the id and record the current timestamp for created_at
4. THE Route_Manager SHALL require the areas array to contain at least 2 area entries
5. THE Route_Manager SHALL limit route names to a maximum of 100 characters and reject empty names

### Requirement 2: Route CRUD Operations

**User Story:** As a user, I want to create, view, edit, and delete routes, so that I can manage my farming paths.

#### Acceptance Criteria

1. WHEN a valid create request is received, THE Route_Manager SHALL insert the route and return the complete route object
2. WHEN routes are requested for a profile, THE Route_Manager SHALL return all routes for that profile ordered by created_at descending
3. WHEN an update request is received, THE Route_Manager SHALL update the route name and areas array for the specified route id
4. WHEN a delete request is received, THE Route_Manager SHALL remove the route from the database
5. IF a route with the specified id does not exist during update or delete, THEN THE Route_Manager SHALL return a descriptive error

### Requirement 3: Route Editor UI

**User Story:** As a user, I want a visual editor to build and reorder my farming routes, so that I can easily customize my area sequence.

#### Acceptance Criteria

1. THE Route_Editor SHALL display a form with a name input field and an area selection list for creating a new route
2. THE Route_Editor SHALL allow adding areas from the combined list of built-in areas and custom areas to the route sequence
3. THE Route_Editor SHALL allow removing individual areas from the route sequence
4. THE Route_Editor SHALL support drag-and-drop reordering of areas within the route sequence
5. THE Route_Editor SHALL display existing routes for the current profile in a list with edit and delete actions
6. WHEN editing an existing route, THE Route_Editor SHALL populate the form with the route's current name and area sequence
7. THE Route_Editor SHALL disable the save button when the route name is empty or the area sequence contains fewer than 2 areas

### Requirement 4: Route Mode in Run Tracker

**User Story:** As a user, I want to activate a route in the Run Tracker, so that it guides me through my farming sequence and auto-advances on split.

#### Acceptance Criteria

1. THE Run_Tracker SHALL provide a "Route Mode" toggle in the session start configuration
2. WHEN Route Mode is enabled, THE Run_Tracker SHALL display a route selection dropdown populated with routes for the current profile
3. WHEN a session starts in Route Mode, THE Run_Tracker SHALL set the current area to the first area in the selected route
4. WHEN a split occurs in Route Mode, THE Route_Runner SHALL advance to the next Route_Step and update the current area
5. WHEN the last Route_Step is completed (split on final area), THE Route_Runner SHALL wrap back to the first Route_Step, beginning a new Route_Cycle
6. WHILE in Route Mode, THE Run_Tracker SHALL display the current step indicator showing position within the route (e.g., "Step 2/4: Pindleskin")
7. THE Run_Tracker SHALL allow the user to start a session without Route Mode, using single-area selection as the default behavior

### Requirement 5: Route-Level Statistics

**User Story:** As a user, I want to see statistics for complete route cycles, so that I can measure my farming efficiency across multi-area runs.

#### Acceptance Criteria

1. WHEN a Route_Cycle completes, THE Route_Statistics SHALL calculate the total cycle time as the sum of individual run durations within that cycle
2. THE Route_Statistics SHALL calculate items found per complete Route_Cycle by counting items across all runs within that cycle
3. THE Route_Statistics SHALL display average cycle time across all completed cycles for a given route
4. THE Route_Statistics SHALL display total completed cycles count for a given route
5. WHEN a session ends mid-cycle (incomplete route traversal), THE Route_Statistics SHALL exclude that partial cycle from per-cycle averages

### Requirement 6: Route Identification on Runs

**User Story:** As a user, I want runs to remember which route they belonged to, so that history and statistics can group them correctly.

#### Acceptance Criteria

1. WHEN a run is created in Route Mode, THE Route_Runner SHALL store the route_id and the step_index on the run record
2. THE Run_Tracker SHALL add nullable columns route_id (TEXT) and route_step_index (INTEGER) to the runs table via migration
3. WHEN displaying run history, THE Run_Tracker SHALL group consecutive runs that share the same route_id and form a complete or partial cycle
4. IF a route is deleted, THEN runs referencing that route SHALL retain their route_id value for historical reference without enforcing a foreign key constraint on the deleted route

