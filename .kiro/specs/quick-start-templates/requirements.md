# Requirements Document

## Introduction

Quick-Start Templates allow experienced D2R farmers to save and reuse session configurations for common farming patterns. Instead of manually selecting area, player count, route, goal, and tags each time, users save a named template and start sessions with a single click. Templates are scoped per-profile since different characters farm differently.

## Glossary

- **Template**: A named, reusable session configuration containing area, player count, route, session goal, and tags
- **Template_Manager**: The subsystem responsible for creating, reading, updating, deleting, and ordering templates
- **Run_Tracker**: The existing session tracking UI where users start and monitor farming runs
- **Profile**: An existing character identity (name, class, mode) that owns runs, routes, and templates
- **Session_Goal**: A numeric target for how many runs a user intends to complete in a session
- **Route**: An existing ordered list of areas that defines a farming path

## Requirements

### Requirement 1: Create Template from Current Configuration

**User Story:** As a farmer, I want to save my current session configuration as a named template, so that I can reuse it without re-entering settings.

#### Acceptance Criteria

1. WHEN a user provides a template name and session configuration, THE Template_Manager SHALL persist the template with the following fields: name (maximum 50 characters), area, player count, route (if applicable), session goal, and tags (maximum 10 tags)
2. WHEN a user creates a template, THE Template_Manager SHALL associate the template with the active Profile
3. IF a user provides a template name that already exists for the same Profile (compared case-insensitively), THEN THE Template_Manager SHALL reject the creation and display an error indicating the name is taken
4. WHEN a user creates a template, THE Template_Manager SHALL assign a unique identifier to the template
5. IF no active Profile is set when a user attempts to create a template, THEN THE Template_Manager SHALL reject the creation and display an error indicating that a Profile must be selected first

### Requirement 2: List Templates for Active Profile

**User Story:** As a farmer, I want to see my saved templates for the current character, so that I can quickly pick one to start a session.

#### Acceptance Criteria

1. WHEN the Run_Tracker view is displayed, THE Template_Manager SHALL retrieve and display all templates belonging to the active Profile, showing each template's name, area, and player count
2. THE Template_Manager SHALL display the 3 most recently used templates at the top of the list, ordered by last-used timestamp descending, followed by remaining templates ordered by creation date descending
3. WHEN no templates exist for the active Profile, THE Run_Tracker SHALL display the standard session start controls without a template section
4. IF a template has never been used, THEN THE Template_Manager SHALL place it after the most-recently-used templates and order it by creation date descending

### Requirement 3: One-Click Session Start from Template

**User Story:** As a farmer, I want to select a template and immediately begin a session, so that I reduce daily setup from multiple clicks to one.

#### Acceptance Criteria

1. WHEN a user selects a template, THE Run_Tracker SHALL populate the session configuration with the template's stored area, player count, route, session goal type, session goal value, and tags, and immediately start a new session without requiring additional confirmation
2. WHEN a user starts a session from a template, THE Template_Manager SHALL update the template's last-used timestamp to the current date and time
3. IF templates exist for the active Profile and no session is currently active, THEN THE Run_Tracker SHALL display a "Start from template" control above the regular session start controls
4. IF a user selects a template while a session is already active, THEN THE Run_Tracker SHALL not start a new session and SHALL keep the current session unchanged
5. IF a template's stored route has been deleted, THEN THE Run_Tracker SHALL start the session without route mode enabled and use only the template's stored area

### Requirement 4: Edit Existing Template

**User Story:** As a farmer, I want to update a template's configuration, so that I can adjust settings without recreating it from scratch.

#### Acceptance Criteria

1. WHEN a user edits a template, THE Template_Manager SHALL present the edit form pre-populated with the template's current stored values and allow modification of all stored fields: name, area, player count, route, session goal, and tags
2. IF a user renames a template to a name that already exists for the same Profile, THEN THE Template_Manager SHALL reject the update, display an error indicating the name is taken, and retain the user's in-progress edits so the user can correct the name without re-entering other changes
3. WHEN a template is successfully updated, THE Template_Manager SHALL persist the changes while preserving the template's unique identifier, profile association, and last-used timestamp, and immediately reflect the updated values in the template list without requiring a manual refresh

### Requirement 5: Delete Template

**User Story:** As a farmer, I want to remove templates I no longer use, so that my template list stays manageable.

#### Acceptance Criteria

1. WHEN a user requests deletion of a template, THE Template_Manager SHALL display a confirmation prompt identifying the template by name before performing any removal
2. WHEN a user confirms the deletion, THE Template_Manager SHALL remove the template from persistent storage and update the displayed template list to reflect the removal within 1 second
3. IF a user cancels the deletion confirmation, THEN THE Template_Manager SHALL retain the template unchanged in persistent storage and dismiss the confirmation prompt

### Requirement 6: Template Data Persistence

**User Story:** As a farmer, I want my templates to survive app restarts and updates, so that I never lose my saved configurations.

#### Acceptance Criteria

1. THE Template_Manager SHALL store templates in the SQLite database alongside existing application data
2. WHEN the application starts, THE Template_Manager SHALL load all previously saved templates from the database such that every template field (name, area, player count, notes, tags, and associated profile) matches the values at the time of last save
3. THE Template_Manager SHALL include templates in the existing data export and import operations so that backups and cloud sync cover template data
4. WHEN importing template data, IF a template with the same identifier already exists in the database, THEN THE Template_Manager SHALL skip the duplicate template and increment a skipped counter in the import result
5. IF the Template_Manager fails to read or write template data due to a database error, THEN THE Template_Manager SHALL return an error message indicating the nature of the failure without corrupting existing data

### Requirement 7: Template Field Validation

**User Story:** As a farmer, I want the app to prevent me from saving invalid templates, so that I can always start a session from any template without errors.

#### Acceptance Criteria

1. WHEN a user creates or edits a template, THE Template_Manager SHALL require a template name that contains at least 1 non-whitespace character and does not exceed 100 characters in length
2. WHEN a user creates or edits a template, THE Template_Manager SHALL require the area field to reference an entry present in the built-in AREAS list or in the active Profile's custom areas
3. WHEN a user specifies a player count, THE Template_Manager SHALL accept integer values between 1 and 8 inclusive
4. WHEN a user specifies a session goal, THE Template_Manager SHALL accept integer values between 1 and 9999 inclusive
5. IF a user references a route that has been deleted, THEN THE Template_Manager SHALL clear the route field from the template, display a message indicating the route was removed, and allow the session to start without a route
6. IF any field fails validation during template creation or editing, THEN THE Template_Manager SHALL prevent the save operation and display an error message indicating which field is invalid and why
