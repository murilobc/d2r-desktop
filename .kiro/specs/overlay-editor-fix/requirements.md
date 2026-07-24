# Requirements Document

## Introduction

The Overlay Editor page in the D2R Tracker desktop app has all functional components implemented but is visually broken due to missing CSS and an incorrect layout structure. This spec defines the requirements for restructuring the page layout to match the project mockup and adding comprehensive CSS for all overlay editor components. No backend or functional logic changes are needed — this is purely a layout/styling fix.

## Glossary

- **Overlay_Editor**: The page component at `src/pages/OverlayEditor.tsx` that allows users to customize their overlay layout
- **Widget_Library**: The left panel component listing draggable widget types
- **Preview_Canvas**: The central droppable area where widgets are positioned visually
- **Property_Inspector**: The right panel showing editable properties for the currently selected widget
- **Profile_Bar**: The horizontal bar displaying overlay profiles as selectable tabs
- **Canvas_Settings**: The panel below the canvas containing dimension and background controls
- **Profile_Manager**: The component managing profile creation, selection, renaming, and deletion

## Requirements

### Requirement 1: Page Layout Structure

**User Story:** As a user, I want the Overlay Editor to have a clear visual layout with distinct panels, so that I can easily find and use each editing tool.

#### Acceptance Criteria

1. THE Overlay_Editor SHALL render a page header with title "Overlay Editor" and descriptive subtitle
2. THE Overlay_Editor SHALL render a horizontal Profile_Bar below the header
3. THE Overlay_Editor SHALL render a 3-column grid below the Profile_Bar with the Widget_Library on the left, Preview_Canvas in the center, and Property_Inspector on the right
4. THE left column SHALL have a fixed width of 200px
5. THE right column SHALL have a fixed width of 200px
6. THE center column SHALL expand to fill remaining horizontal space
7. THE Canvas_Settings panel SHALL render below the Preview_Canvas within the center column

### Requirement 2: Profile Bar Styling

**User Story:** As a user, I want to see my overlay profiles displayed as horizontal tabs, so that I can quickly switch between different overlay layouts.

#### Acceptance Criteria

1. THE Profile_Manager SHALL display profiles in a horizontal row as tab-like items
2. WHEN a profile is active, THE Profile_Manager SHALL highlight that profile's tab with an accent border color and subtle background tint
3. WHEN a user hovers over an inactive profile tab, THE Profile_Manager SHALL provide visual hover feedback
4. THE Profile_Manager SHALL display a "New Profile" button aligned to the right of the profile tabs
5. WHEN profile creation is active, THE Profile_Manager SHALL show an inline input field within the horizontal bar

### Requirement 3: Widget Library Panel Styling

**User Story:** As a user, I want the widget library to be clearly separated in its own panel with proper visual hierarchy, so that I can easily identify available widgets.

#### Acceptance Criteria

1. THE Widget_Library SHALL render within a card container with the project's standard card background, border, and border-radius
2. THE Widget_Library SHALL fill the full height of the left column
3. THE Widget_Library panel SHALL maintain its existing drag functionality without visual regression

### Requirement 4: Preview Canvas Styling

**User Story:** As a user, I want the preview canvas to visually represent the overlay area with clear boundaries and proper widget rendering, so that I can see exactly how my overlay will look.

#### Acceptance Criteria

1. THE Preview_Canvas SHALL be centered horizontally and vertically within the center column
2. THE Preview_Canvas SHALL display a dashed border using the success accent color to indicate the overlay bounds
3. THE Preview_Canvas SHALL render the configured background color and opacity as a visible background layer
4. WHEN a widget is selected on the canvas, THE Preview_Canvas SHALL highlight that widget with a distinct selection indicator
5. WHEN a widget is being dragged over the canvas, THE Preview_Canvas SHALL change its border style to indicate it is a valid drop target
6. THE Preview_Canvas SHALL display a dimension label indicating the current canvas size

### Requirement 5: Property Inspector Styling

**User Story:** As a user, I want the property inspector to clearly show widget editing controls when a widget is selected, so that I can adjust widget properties.

#### Acceptance Criteria

1. THE Property_Inspector SHALL render within a card container matching the project's standard card styling
2. WHEN no widget is selected, THE Property_Inspector SHALL display a placeholder message instructing the user to select a widget
3. WHEN a widget is selected, THE Property_Inspector SHALL display the widget type name as a title with accent color
4. THE Property_Inspector SHALL style form controls (radio buttons, sliders, buttons) consistently with the project's existing form patterns
5. THE Property_Inspector removal button SHALL use the danger color and standard button styling

### Requirement 6: Canvas Settings Panel Styling

**User Story:** As a user, I want the canvas settings (dimensions and background) clearly grouped below the preview, so that I can adjust the overlay size and appearance.

#### Acceptance Criteria

1. THE Canvas_Settings panel SHALL render as a card below the Preview_Canvas
2. THE Canvas_Settings SHALL arrange DimensionControls and BackgroundSettings side by side in a horizontal flex layout
3. THE DimensionControls SHALL display width and height inputs with proper labels, input styling, and range hints
4. THE BackgroundSettings SHALL display a color picker, hex text input, and opacity slider with proper labels
5. ALL form inputs within Canvas_Settings SHALL use the project's standard input styling (dark background, border, rounded corners)

### Requirement 7: Interactive State Feedback

**User Story:** As a user, I want visual feedback when I hover, click, or focus on interactive elements, so that the interface feels responsive and professional.

#### Acceptance Criteria

1. WHEN a user hovers over a clickable element, THE Overlay_Editor SHALL display a hover state within 50ms using CSS transitions
2. WHEN a user focuses an interactive element via keyboard, THE Overlay_Editor SHALL display a visible focus indicator
3. ALL transitions in the Overlay_Editor SHALL use smooth CSS transitions (150ms–200ms duration)
4. WHEN a profile tab is clicked, THE Profile_Manager SHALL immediately update the active visual state

### Requirement 8: Visual Consistency

**User Story:** As a user, I want the Overlay Editor to look consistent with the rest of the application, so that the app feels cohesive.

#### Acceptance Criteria

1. THE Overlay_Editor SHALL use exclusively the project's defined CSS variables for all colors, backgrounds, and borders
2. THE Overlay_Editor SHALL use consistent spacing (0.5rem–1rem padding, 0.4rem–1rem gaps) matching other pages
3. THE Overlay_Editor SHALL use the project's standard border-radius values (8px for panels, 6px for items, 4px for inputs)
4. ALL text in the Overlay_Editor SHALL use the project's typography hierarchy (--text for primary, --text-muted for labels/hints)

### Requirement 9: Drag-and-Drop Preservation

**User Story:** As a user, I want drag-and-drop to continue working after the layout restructure, so that I can still add and reposition widgets on the canvas.

#### Acceptance Criteria

1. WHEN a widget is dragged from the Widget_Library and dropped on the Preview_Canvas, THE Overlay_Editor SHALL add the widget to the active profile layout
2. WHEN a widget on the canvas is dragged to a new position, THE Overlay_Editor SHALL update the widget's coordinates in the layout state
3. THE restructured layout SHALL not break the DndContext collision detection or droppable area identification

### Requirement 10: Responsive Behavior

**User Story:** As a user, I want the editor to remain usable at different window sizes, so that I can use it without the layout breaking.

#### Acceptance Criteria

1. WHILE the window width is less than 800px, THE Overlay_Editor grid SHALL collapse into a single-column stacked layout
2. THE Overlay_Editor SHALL not produce horizontal scrollbars at any window width above 600px
3. THE Profile_Bar SHALL allow horizontal scrolling when profiles overflow the available width
