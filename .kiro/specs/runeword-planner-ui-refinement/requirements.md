# Requirements Document

## Introduction

Refine the Runeword Planner page UI to match the original SVG prototype more closely. The prototype uses a side-by-side layout (Rune Inventory on the left, Available Runewords on the right) with compact rune cells, improving space utilization and readability. Additionally, add per-rune reset functionality and direct number input for rune counts to improve usability when managing large quantities.

## Glossary

- **Rune_Inventory_Panel**: The left panel (approximately 380px wide) displaying the grid of all 33 rune cells with their current counts
- **Runeword_List_Panel**: The right panel (approximately 420px wide) displaying the list of available and craftable runewords with their eligibility status
- **Rune_Cell**: A compact rectangular element (approximately 50px wide, 40px tall) displaying a rune name and its count within the Rune_Inventory_Panel
- **High_Rune**: A rune at level 21 or above (Pul through Zod) that receives special visual distinction
- **Reset_Control**: A button on a Rune_Cell that sets that rune's count to zero
- **Count_Input**: An editable text field within a Rune_Cell that allows the user to type a numeric value directly
- **Planner_Page**: The Runeword Planner page containing all four sections (Rune_Inventory_Panel, Runeword_List_Panel, Progress Tracking, Cube Calculator)

## Requirements

### Requirement 1: Side-by-Side Layout

**User Story:** As a player, I want the Rune Inventory and Available Runewords panels to be displayed side by side at the top of the page, so that I can see my runes and eligible runewords simultaneously without scrolling.

#### Acceptance Criteria

1. THE Planner_Page SHALL display the Rune_Inventory_Panel and Runeword_List_Panel side by side in a horizontal row as the first content below the page header, with the Rune_Inventory_Panel on the left and the Runeword_List_Panel on the right, each occupying approximately equal width of the available content area
2. THE Planner_Page SHALL display the Progress Tracking section spanning the full width of the content area, positioned immediately below the side-by-side row
3. THE Planner_Page SHALL display the Cube Calculator section spanning the full width of the content area, positioned immediately below the Progress Tracking section
4. WHEN the viewport width is less than 700px, THE Planner_Page SHALL stack the Rune_Inventory_Panel above the Runeword_List_Panel vertically, each spanning the full content width
5. THE Planner_Page SHALL separate the side-by-side panels and each subsequent full-width section with a consistent vertical gap between 12px and 20px

### Requirement 2: Compact Rune Cells

**User Story:** As a player, I want the rune cells to be compact and arranged in dense rows, so that I can see all 33 runes at a glance without excessive scrolling.

#### Acceptance Criteria

1. THE Rune_Inventory_Panel SHALL render Rune_Cells with dimensions between 45px and 55px width and between 35px and 45px height
2. THE Rune_Inventory_Panel SHALL arrange Rune_Cells in a fixed grid of 6 cells per row, resulting in 6 rows of 6 cells followed by a final partial row containing the remaining 3 cells
3. WHEN a Rune_Cell has a count of zero, THE Rune_Inventory_Panel SHALL display that Rune_Cell at an opacity of 0.35
4. THE Rune_Cell SHALL display only the rune name on the first line and the count on the second line, with no increment or decrement controls rendered within the cell
5. THE Rune_Inventory_Panel SHALL display all 33 Rune_Cells within the visible area of the panel without requiring vertical scrolling

### Requirement 3: High Rune Visual Distinction

**User Story:** As a player, I want high runes (Pul and above) to be visually distinct from lower runes, so that I can quickly identify my valuable rune inventory.

#### Acceptance Criteria

1. WHILE a rune's level is 21 or above (Pul through Zod), THE Rune_Cell SHALL display a border using the CSS variable --accent at 40% opacity, regardless of the rune's count value
2. WHILE a rune's level is 21 to 29 (Pul through Sur) and its count is greater than zero, THE Rune_Cell SHALL display the count value using the CSS variable --success
3. WHILE a rune's level is 30 or above (Ber through Zod) and its count is greater than zero, THE Rune_Cell SHALL display the count value using the CSS variable --unique
4. WHILE a rune's level is below 21 (El through Lem), THE Rune_Cell SHALL display the default border color (--border) and default count text color (--text)

### Requirement 4: Per-Rune Reset Control

**User Story:** As a player, I want to reset an individual rune's count to zero with a single action, so that I can quickly correct mistakes without decrementing one by one.

#### Acceptance Criteria

1. WHEN the user focuses or hovers over a Rune_Cell with a count greater than zero, THE Rune_Inventory_Panel SHALL reveal the Reset_Control for that specific rune within 150 milliseconds
2. WHEN the user activates the Reset_Control, THE Rune_Inventory_Panel SHALL set that rune's count to zero without requiring a confirmation step
3. WHILE a Rune_Cell's count is zero, THE Reset_Control for that rune SHALL be hidden
4. WHEN focus or pointer leaves a Rune_Cell and its Reset_Control, THE Rune_Inventory_Panel SHALL hide the Reset_Control for that rune within 150 milliseconds
5. THE Reset_Control SHALL be accessible via keyboard navigation using Tab order within the Rune_Cell and SHALL have an aria-label that includes the rune name and the word "reset" (e.g., "Reset El")
6. WHEN the user activates the Reset_Control, THE Rune_Inventory_Panel SHALL update the displayed count to zero immediately, matching the behavior of the existing decrement control

### Requirement 5: Direct Number Input for Rune Count

**User Story:** As a player, I want to type a rune count directly instead of clicking +/- buttons repeatedly, so that I can efficiently set counts when I have many of a specific rune.

#### Acceptance Criteria

1. WHEN the user clicks or focuses on the count display in a Rune_Cell, THE Rune_Cell SHALL transform the count display into an editable Count_Input field pre-filled with the current count value and with all text selected
2. THE Count_Input SHALL accept only non-negative integer values in the range 0 to 99
3. WHEN the user confirms the Count_Input value (by pressing Enter or moving focus away from the field), THE Rune_Inventory_Panel SHALL update the rune count to the entered value
4. IF the user confirms the Count_Input with an empty value or a value that is non-integer, negative, or greater than 99, THEN THE Rune_Inventory_Panel SHALL reject the input and revert the Count_Input display to the previous valid count
5. WHEN the Count_Input is active, THE Rune_Cell SHALL display a 2px solid border using the application's accent color to indicate which rune is being edited
6. WHEN the user presses the Escape key while the Count_Input is active, THE Rune_Cell SHALL discard any changes and revert to displaying the previous valid count as static text
7. THE Count_Input field SHALL be rendered as a text input with a maximum width of 3 characters (matching the 0–99 range) and SHALL NOT cause the Rune_Cell to change size or shift adjacent cells in the grid

### Requirement 6: Interaction Controls Visibility

**User Story:** As a player, I want the +/- buttons and reset control to appear only when I interact with a rune cell, so that the grid remains compact and uncluttered by default.

#### Acceptance Criteria

1. THE Rune_Cell SHALL hide the increment, decrement, and Reset_Control buttons by default using visually hidden positioning (not `display:none`) so that screen readers can still announce the controls
2. WHEN the user hovers over or focuses on a Rune_Cell, THE Rune_Cell SHALL reveal the increment, decrement, and Reset_Control buttons as an overlay positioned outside the cell boundaries so that the cell dimensions (50×40px) remain unchanged
3. WHEN the user moves focus or hover away from a Rune_Cell, THE Rune_Cell SHALL hide the control buttons after a delay of 300ms to prevent accidental dismissal during pointer repositioning
4. WHEN a keyboard user moves focus into a Rune_Cell, THE Rune_Cell SHALL place the increment, decrement, and Reset_Control buttons in sequential tab order so that each button is reachable via the Tab key without requiring pointer interaction
5. IF the controls overlay would extend beyond the visible viewport edge, THEN THE Rune_Cell SHALL reposition the overlay to remain fully visible within the viewport
