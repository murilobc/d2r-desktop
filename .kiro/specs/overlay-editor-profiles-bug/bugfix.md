# Bugfix Requirements Document

## Introduction

The Overlay Editor page in the D2R Tracker desktop app has five interrelated bugs affecting profile persistence, widget management, and preview rendering. When the page loads, it fails to deserialize stored profiles due to a field name mismatch in the `layout_json` column (`"widget_type"` vs expected `"type"`), causing a "missing field 'type'" error and an empty profile list. Because profiles are actually persisted in SQLite but fail to load, attempting to recreate a profile with the same name triggers "Profile name already in use". Additionally, the Widget Library allows the same widget type to be added to the canvas multiple times without deduplication, there is no mechanism to remove a widget directly from the canvas without selecting it first and using the Property Inspector's remove button (which requires the widget to be selected — a broken UX flow when widgets overlap or are unselectable), and the editor preview canvas does not render the overlay controller buttons (Next, Play/Pause, Stop, and Screenshot Detector toggle), preventing the user from seeing or positioning these controls within the editor.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Overlay Editor page loads and stored `layout_json` contains widgets with `"widget_type"` field (from a prior serialization without `#[serde(rename = "type")]`) THEN the system fails to deserialize the stored profiles and displays error "missing field 'type' at line 1 column 127" with an empty profiles list

1.2 WHEN profiles exist in the database but fail to load due to deserialization error, and the user attempts to create a profile with a name that already exists in the database THEN the system returns "Profile name already in use" error while still showing an empty profiles list (profiles are invisible but present)

1.3 WHEN a widget type is already placed on the canvas and the user drags the same widget type from the Widget Library onto the canvas THEN the system adds a duplicate instance of that widget type without any restriction, allowing infinite duplicates

1.4 WHEN the user wants to remove a widget from the canvas THEN the system provides no direct removal mechanism on the canvas itself — removal requires selecting the widget first, then clicking "Remove Widget" in the Property Inspector panel, which may be non-obvious or inaccessible when widgets overlap

1.5 WHEN the Overlay Editor preview canvas is rendered THEN the system does NOT display the overlay controller buttons (Next, Play/Pause, Stop, and Screenshot Detector toggle) that exist in the actual overlay, preventing the user from seeing or positioning these controls in the editor

### Expected Behavior (Correct)

2.1 WHEN the Overlay Editor page loads and stored `layout_json` contains widgets with `"widget_type"` field (legacy format) THEN the system SHALL gracefully handle the legacy field name by accepting both `"type"` and `"widget_type"` during deserialization, OR SHALL migrate the stored JSON to use the correct `"type"` field, displaying all persisted profiles normally

2.2 WHEN profiles are correctly loaded from the database THEN the system SHALL display them in the profile list, preventing the scenario where profiles are invisible but block name reuse

2.3 WHEN a widget type is already placed on the canvas and the user attempts to add the same widget type again THEN the system SHALL prevent the duplicate placement and indicate in the Widget Library that the widget type is already placed (each widget type SHALL be limited to at most one instance on the canvas)

2.4 WHEN a widget is placed on the canvas THEN the system SHALL provide a visible removal affordance (e.g., a delete button or icon) on or near the widget when it is selected, making widget removal discoverable without requiring the user to find the Property Inspector panel

2.5 WHEN the Overlay Editor preview canvas is rendered THEN the system SHALL display the overlay controller buttons (Next, Play/Pause, Stop, and Screenshot Detector toggle) on the canvas at their configured positions, allowing the user to see and reposition them just like any other widget

### Unchanged Behavior (Regression Prevention)

3.1 WHEN profiles with correctly formatted `layout_json` (using `"type"` field) exist in the database THEN the system SHALL CONTINUE TO load and display them normally

3.2 WHEN the user creates a new profile with a unique name THEN the system SHALL CONTINUE TO persist it to the database and display it in the profiles list

3.3 WHEN a widget type that is NOT yet placed on the canvas is dragged from the Widget Library THEN the system SHALL CONTINUE TO add it to the canvas at the drop position

3.4 WHEN a user selects a widget and clicks "Remove Widget" in the Property Inspector THEN the system SHALL CONTINUE TO remove the widget from the layout

3.5 WHEN a widget on the canvas is dragged to a new position THEN the system SHALL CONTINUE TO update the widget's coordinates in the layout state

3.6 WHEN the user switches between profiles THEN the system SHALL CONTINUE TO display the correct layout for the selected profile

3.7 WHEN the overlay controller buttons (Next, Play/Pause, Stop, Screenshot Detector toggle) are rendered in the actual overlay window THEN the system SHALL CONTINUE TO display and function correctly in the overlay regardless of changes to the editor preview
