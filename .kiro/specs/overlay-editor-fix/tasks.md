# Implementation Plan: Overlay Editor Fix & Beautification

## Overview

This implementation restructures the Overlay Editor page from a broken single-sidebar layout into a professional 3-column grid matching the project mockup. The work is purely CSS and JSX structure — all functional code (DnD, hooks, state) remains untouched. Tasks proceed from layout restructuring through CSS additions to polish and responsive behavior.

## Tasks

- [x] 1. Restructure OverlayEditor.tsx layout
  - [x] 1.1 Refactor the JSX in `src/pages/OverlayEditor.tsx` to use the new 3-column layout structure
    - Change from single sidebar + main to: header → profile bar → 3-column grid
    - Add `.overlay-editor-header` with h1 title "Overlay Editor" and subtitle paragraph
    - Move `ProfileManager` into `.overlay-editor-profile-bar` div below header
    - Create `.overlay-editor-grid` with three children: `.overlay-editor-left` (WidgetLibrary), `.overlay-editor-center` (PreviewCanvas + canvas settings), `.overlay-editor-right` (PropertyInspector)
    - Place `DimensionControls` and `BackgroundSettings` inside `.overlay-editor-canvas-settings` within center column, below PreviewCanvas
    - Remove the old `.overlay-editor-sidebar` and `.overlay-editor-main` structure
    - Ensure DndContext still wraps the entire layout
    - _Requirements: 1.1, 1.2, 1.3, 1.7_

  - [x] 1.2 Write unit tests verifying the new DOM structure
    - Test that header, profile bar, and 3-column grid render in correct order
    - Test that canvas settings are children of center column
    - _Requirements: 1.1, 1.2, 1.3, 1.7_

- [x] 2. Add core layout CSS to App.css
  - [x] 2.1 Add CSS for the overlay editor page container and grid layout
    - Add `.overlay-editor` as a flex column filling available height
    - Add `.overlay-editor-header` with title/subtitle typography
    - Add `.overlay-editor-error` banner styling
    - Add `.overlay-editor-profile-bar` spacing/margin
    - Add `.overlay-editor-grid` with `grid-template-columns: 200px 1fr 200px` and gap
    - Add `.overlay-editor-left`, `.overlay-editor-center`, `.overlay-editor-right` column styles
    - Add `.overlay-editor-canvas-settings` horizontal flex container with card styling
    - Add `.overlay-editor-no-profile` placeholder styling
    - Use existing CSS variables for all colors/spacing
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 8.1, 8.2, 8.3_

- [x] 3. Add ProfileManager CSS
  - [x] 3.1 Add CSS for the profile manager horizontal bar layout
    - Style `.profile-manager` as horizontal flex container with card background
    - Style `.profile-manager-header` with flex row, title on left, button on right
    - Style `.profile-manager-list` as horizontal flex with overflow-x auto
    - Style `.profile-manager-item` as tab-like elements with border and padding
    - Style `.profile-manager-item--active` with accent border and tinted background
    - Style `.profile-manager-item-content` as flex row with select button and action buttons
    - Style `.profile-manager-item-select-btn` as a clean tab button
    - Style `.profile-manager-new-btn` with success color
    - Style `.profile-manager-input` with standard input styling
    - Style `.profile-manager-create`, `.profile-manager-rename` inline forms
    - Style `.profile-manager-error` as danger-colored text
    - Style `.profile-manager-icon-btn` and `.profile-manager-delete-btn`
    - Style `.profile-manager-active-indicator` with success color
    - Add hover/focus transitions on all interactive elements
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 8.1_

- [x] 4. Add PreviewCanvas CSS
  - [x] 4.1 Add CSS for the preview canvas container and canvas area
    - Style `.preview-canvas-container` with flex centering and padding
    - Style `.preview-canvas` with dashed border using `var(--success)` color
    - Style `.preview-canvas-deselect` for the transparent click-to-deselect layer
    - Add a dimension label (update PreviewCanvas.tsx to show `{width}×{height}` label)
    - Ensure canvas background opacity renders correctly via existing inline styles
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 4.2 Write property test for canvas background rendering
    - **Property 1: Canvas background reflects configured values**
    - **Validates: Requirements 4.3**

  - [x] 4.3 Write property test for widget selection indicator
    - **Property 2: Selected widget gets visual distinction**
    - **Validates: Requirements 4.4**

- [x] 5. Add PropertyInspector CSS
  - [x] 5.1 Add CSS for the property inspector panel
    - Style `.property-inspector` as card container with padding
    - Style `.property-inspector--empty` with centered placeholder
    - Style `.property-inspector-title` with accent color
    - Style `.property-inspector-placeholder` with muted text
    - Style `.property-inspector-field` with vertical spacing
    - Style `.property-inspector-label` with muted color and small font
    - Style `.property-inspector-size-group` as horizontal flex radio group
    - Style `.property-inspector-size-option` and `.property-inspector-size-label` with toggle button appearance
    - Style `.property-inspector-slider` range input
    - Style `.property-inspector-remove-btn` with danger styling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1_

  - [x] 5.2 Write property test for widget type label display
    - **Property 5: Property Inspector shows correct widget type label**
    - **Validates: Requirements 5.3**

- [x] 6. Add BackgroundSettings and DimensionControls CSS
  - [x] 6.1 Add CSS for background settings and dimension controls
    - Style `.background-settings` with flex layout
    - Style `.background-settings-title` and `.background-settings-label`
    - Style `.background-settings-color-row` with color picker and text input side by side
    - Style `.background-settings-color-picker` as small square swatch
    - Style `.background-settings-color-text` as narrow text input
    - Style `.background-settings-opacity-row` and `.background-settings-opacity-slider`
    - Style `.background-settings-opacity-value` as inline label
    - Style `.dimension-controls` with flex layout
    - Style `.dimension-controls-title` and `.dimension-controls-label`
    - Style `.dimension-controls-input-row` with input and hint
    - Style `.dimension-controls-input` as number input with standard styling
    - Style `.dimension-controls-hint` as muted small text
    - All inputs use `--bg-dark` background, `--border` border, 4px border-radius
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1_

- [x] 7. Checkpoint - Verify layout and DnD still work
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npx tsc --noEmit` to check TypeScript
  - Run `npx vite build` to verify build succeeds
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 8. Add responsive CSS and interactive polish
  - [x] 8.1 Add responsive breakpoint and interactive state CSS
    - Add `@media (max-width: 800px)` rule that changes grid to single column
    - Ensure no horizontal scrollbars above 600px width
    - Add `overflow-x: auto` on profile bar for overflow handling
    - Verify all interactive elements have `transition: 150ms ease` for border-color, background, opacity
    - Add `:focus-visible` outlines on all interactive elements
    - _Requirements: 7.1, 7.2, 7.3, 10.1, 10.2, 10.3_

- [x] 9. Write property tests for DnD preservation
  - [x] 9.1 Write property test for drag-drop from library
    - **Property 3: Drag-drop from library adds widget to layout**
    - **Validates: Requirements 9.1**
  - [x] 9.2 Write property test for widget repositioning
    - **Property 4: Widget repositioning updates coordinates**
    - **Validates: Requirements 9.2**

- [x] 10. Final checkpoint - Verify all tests and build
  - Ensure all tests pass, ask the user if questions arise.
  - Run full verification: `npm test`, `npx tsc --noEmit`, `npx vite build`
  - _Requirements: All_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["5.1", "5.2"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["7"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["9.1", "9.2"] },
    { "id": 9, "tasks": ["10"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This is a CSS + layout restructuring task — no backend/Rust changes needed
- All functional code (DnD hooks, state management, profile CRUD) remains unchanged
- The PreviewCanvas gets a minor TSX addition (dimension label) but no logic changes
- Property tests validate that DnD still works correctly after the restructure
