# Requirements Document

## Introduction

The Customizable Overlay Layouts feature allows users to configure the content and arrangement of the in-game overlay window. The current overlay has a fixed layout showing session time, run timer, run count, and controls. Different user types (streamers, solo grinders, casual players) need different information displayed with different visual emphasis. This feature introduces an overlay editor with drag-and-drop widget placement, multiple saveable profiles, and per-widget styling controls.

## Glossary

- **Overlay_Window**: The always-on-top Tauri window (overlay.html) that floats over the D2R game to display session data
- **Overlay_Editor**: A settings panel in the main application window where users visually arrange widgets on a preview canvas
- **Widget**: A self-contained display block that shows a specific piece of session data (e.g., timer, run count, items found)
- **Overlay_Profile**: A named configuration that stores widget layout, positions, sizes, and styling preferences
- **Widget_Size**: The text scale of a widget, categorized as small, medium, or large
- **Preview_Canvas**: A visual representation of the overlay in the editor that reflects the actual overlay dimensions
- **Profile_Manager**: The system responsible for creating, switching, saving, and deleting overlay profiles

## Requirements

### Requirement 1: Widget Library

**User Story:** As a user, I want to choose from a set of available widgets so that I can display only the session data that matters to me.

#### Acceptance Criteria

1. THE Overlay_Editor SHALL provide the following widgets for placement: timer (session elapsed), run timer (current run elapsed), run count (session and total), items found (session count), last item (most recent item name), dry streak (runs since last item), goal progress (runs toward session goal), XP per hour, and route step (current step in active route)
2. WHEN a widget is placed on the Preview_Canvas, THE Overlay_Editor SHALL display the widget with non-empty placeholder text indicating the data type (e.g., a formatted duration for timer widgets, a numeric count for counter widgets, or a sample name for text-based widgets)
3. WHEN a user right-clicks a placed widget and selects the remove option, THE Overlay_Editor SHALL remove that widget from the Preview_Canvas and stop rendering it in the live Overlay_Window
4. THE Overlay_Window SHALL render only the widgets present in the active Overlay_Profile
5. IF a widget depends on data that is not currently available (no active route for route step, or no session goal for goal progress), THEN THE Overlay_Window SHALL display that widget with a placeholder label indicating no data is available instead of hiding the widget
6. THE Overlay_Editor SHALL display the full list of available widgets in a visible panel so the user can identify which widgets are available for placement and which are already placed

### Requirement 2: Drag-and-Drop Widget Placement

**User Story:** As a user, I want to drag widgets onto a canvas and position them freely so that I can arrange the overlay to my preference.

#### Acceptance Criteria

1. WHEN a user drags a widget from the widget library onto the Preview_Canvas, THE Overlay_Editor SHALL display a visual preview of the widget following the cursor during the drag and place the widget at the drop coordinates upon release
2. WHEN a user drags a placed widget to a new position on the Preview_Canvas, THE Overlay_Editor SHALL update the widget position to the new coordinates upon mouse release
3. THE Overlay_Editor SHALL constrain widget positions so that the entire widget bounding box remains within the boundaries of the Preview_Canvas
4. WHEN a user finishes repositioning a widget, THE Overlay_Editor SHALL persist the new position to the active Overlay_Profile
5. IF a user releases a widget drag outside the Preview_Canvas boundaries, THEN THE Overlay_Editor SHALL cancel the placement and return the widget to its original position

### Requirement 3: Widget Sizing

**User Story:** As a user, I want to resize widgets so that I can emphasize the most important stats with larger text.

#### Acceptance Criteria

1. THE Overlay_Editor SHALL allow each widget to be set to one of three Widget_Size values: small, medium, or large, where small renders text at 75% of base size, medium at 100%, and large at 150%
2. WHEN a user changes a widget Widget_Size, THE Preview_Canvas SHALL reflect the new size within 100ms
3. THE Overlay_Window SHALL render each widget at the Widget_Size specified in the active Overlay_Profile
4. THE Overlay_Editor SHALL default new widgets to medium Widget_Size
5. WHEN a user changes a widget Widget_Size, THE Overlay_Editor SHALL persist the new size to the active Overlay_Profile

### Requirement 4: Overlay Profile Management

**User Story:** As a user, I want to save multiple overlay profiles so that I can quickly switch between layouts for different activities (streaming, solo grinding, casual play).

#### Acceptance Criteria

1. THE Profile_Manager SHALL allow users to create a new Overlay_Profile with a user-specified name between 1 and 50 characters in length, and SHALL enforce that no two profiles share the same name
2. THE Profile_Manager SHALL allow users to rename an existing Overlay_Profile, subject to the same 1-to-50-character length constraint and name uniqueness rule as creation
3. THE Profile_Manager SHALL allow users to delete an Overlay_Profile that is not the last remaining profile; IF the deleted profile is the currently active profile, THEN THE Profile_Manager SHALL activate the first remaining profile in the list
4. WHEN a user switches the active Overlay_Profile, THE Overlay_Window SHALL update its layout to match the newly active profile within 200ms
5. THE Profile_Manager SHALL persist all Overlay_Profiles to the SQLite database so that profiles survive application restarts
6. THE Profile_Manager SHALL provide at least three default Overlay_Profiles named "Compact", "Streamer", and "Detailed"
7. IF the user attempts to create or rename a profile with a name that already exists, THEN THE Profile_Manager SHALL reject the operation and display an error message indicating the name is already in use
8. THE Profile_Manager SHALL allow a maximum of 20 Overlay_Profiles; IF the user attempts to create a profile when 20 already exist, THEN THE Profile_Manager SHALL reject the creation and display an error message indicating the maximum has been reached

### Requirement 5: Widget Opacity Control

**User Story:** As a user, I want to adjust the opacity of individual widgets so that less important stats can be visually de-emphasized without removing them.

#### Acceptance Criteria

1. THE Overlay_Editor SHALL provide an opacity slider for each placed widget with a range from 0.1 to 1.0 in increments of 0.01
2. WHEN a user adjusts a widget opacity slider, THE Preview_Canvas SHALL reflect the new opacity value within 100ms
3. THE Overlay_Window SHALL render each widget at the opacity specified in the active Overlay_Profile
4. THE Overlay_Editor SHALL default new widget opacity to 1.0
5. WHEN a user finishes adjusting a widget opacity slider, THE Overlay_Editor SHALL persist the new opacity value to the active Overlay_Profile
6. IF a stored widget opacity value is outside the range 0.1 to 1.0, THEN THE Overlay_Editor SHALL clamp the value to the nearest bound (0.1 or 1.0) when loading the profile

### Requirement 6: Overlay Background Customization

**User Story:** As a user, I want to customize the overlay background color and opacity so that it blends well with my game and stream setup.

#### Acceptance Criteria

1. THE Overlay_Editor SHALL provide a color picker for the Overlay_Window background color that accepts hexadecimal color values
2. THE Overlay_Editor SHALL provide an opacity slider for the Overlay_Window background with a range from 0.0 to 1.0 in increments of 0.05
3. WHEN a user changes the background color or opacity, THE Preview_Canvas SHALL reflect the change within 100ms
4. THE Overlay_Window SHALL apply the background color and opacity specified in the active Overlay_Profile
5. THE Overlay_Editor SHALL default the background color to black (#000000) with an opacity of 0.85

### Requirement 7: Live Preview Synchronization

**User Story:** As a user, I want to see my changes reflected in the live overlay immediately so that I can adjust the layout without guessing how it will look in-game.

#### Acceptance Criteria

1. WHEN a user modifies any widget property (position, Widget_Size, opacity) or background setting in the Overlay_Editor, THE Overlay_Window SHALL update to reflect the change within 100ms
2. WHILE the Overlay_Editor is open, THE Preview_Canvas SHALL display the overlay layout as a proportionally scaled representation matching the aspect ratio of the actual Overlay_Window
3. WHEN a user resizes the Overlay_Window via the editor dimensions control, THE Preview_Canvas SHALL update its aspect ratio to match the new dimensions within 100ms
4. IF the Overlay_Window is not open when a user modifies a widget property in the Overlay_Editor, THEN THE Overlay_Editor SHALL persist the change to the active Overlay_Profile and apply it when the Overlay_Window is next opened

### Requirement 8: Profile Serialization

**User Story:** As a developer, I want overlay profiles stored in a structured format so that they can be reliably loaded and validated across application versions.

#### Acceptance Criteria

1. THE Profile_Manager SHALL serialize each Overlay_Profile as a JSON string containing the following required fields: profile name, widget list (each with widget type, x position, y position, Widget_Size, and opacity), background color, background opacity, and overlay dimensions (width and height)
2. WHEN the application loads an Overlay_Profile from the database, THE Profile_Manager SHALL deserialize the JSON and confirm that all required fields are present and that each field value conforms to its defined type and range (positions within overlay dimensions, Widget_Size is one of small/medium/large, opacity values within their specified ranges, dimensions within 200x100 to 800x600)
3. IF a stored Overlay_Profile contains fields that are missing, of wrong type, or outside their valid ranges, THEN THE Profile_Manager SHALL discard the corrupted profile, activate the default "Compact" profile, and log a warning message indicating which profile failed validation
4. THE Profile_Manager SHALL produce an identical Overlay_Profile when a valid profile is serialized to JSON and then deserialized, with all field values preserved exactly
5. IF the serialized JSON contains fields not recognized by the current application version, THEN THE Profile_Manager SHALL ignore the unrecognized fields and load the profile using only the recognized required fields

### Requirement 9: Overlay Window Resizability

**User Story:** As a user, I want to control the overlay window dimensions so that I can make it larger for more widgets or smaller for minimal distraction.

#### Acceptance Criteria

1. THE Overlay_Editor SHALL provide width and height controls for the Overlay_Window with a minimum of 200x100 pixels, a maximum of 800x600 pixels, adjustable in 1-pixel increments, and a default of 400x300 pixels for new Overlay_Profiles
2. WHEN a user changes the overlay dimensions in the editor, THE Overlay_Window SHALL resize to the specified dimensions and THE Overlay_Editor SHALL constrain any widgets that fall outside the new boundaries to remain within the resized area
3. THE Profile_Manager SHALL store overlay dimensions as part of each Overlay_Profile
4. THE Overlay_Window SHALL remain non-resizable by direct window dragging to prevent accidental resizing during gameplay
5. IF a user enters a width or height value outside the allowed range, THEN THE Overlay_Editor SHALL clamp the value to the nearest boundary (minimum or maximum) and display the clamped value in the control

### Requirement 10: Default Profile Migration

**User Story:** As an existing user, I want my current overlay to continue working after the update so that upgrading does not disrupt my workflow.

#### Acceptance Criteria

1. WHEN the application starts and no Overlay_Profiles exist in the database, THE Profile_Manager SHALL create the three default profiles ("Compact", "Streamer", "Detailed") and set "Compact" as the active profile
2. THE "Compact" default profile SHALL contain the following widgets at medium Widget_Size: session timer, run timer, run count, and area
3. THE "Streamer" default profile SHALL contain the following widgets: session timer, run timer, run count, area, last item, and items found
4. THE "Detailed" default profile SHALL contain the following widgets: session timer, run timer, run count, area, items found, last item, dry streak, goal progress, and XP per hour
5. WHEN the application starts and no Overlay_Profiles exist in the database but a previously saved Overlay_Window position is present in the system, THE Profile_Manager SHALL apply that saved window position to the newly created active profile so that the overlay appears at the same screen location as before the upgrade
