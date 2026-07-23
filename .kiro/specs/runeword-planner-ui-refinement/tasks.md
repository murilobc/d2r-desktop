# Implementation Plan: Runeword Planner UI Refinement

## Overview

Refine the Runeword Planner page to match the SVG prototype by introducing compact rune cells with tier styling, overlay controls, click-to-edit input, and a side-by-side CSS grid layout. Pure utility modules are implemented and tested first, followed by the new RuneCell component, RuneGrid refactoring, and finally page layout changes.

## Tasks

- [x] 1. Implement pure utility modules
  - [x] 1.1 Create rune tier classification utility (`src/lib/rune-tier.ts`)
    - Export `RuneTier` type, `RuneCellStyle` interface, and `classifyRuneCell` function
    - Implement tier logic: normal (level < 21), mid-high (21–29), ultra-high (≥ 30)
    - Return `borderClass`, `countColorClass`, and `isZero` based on level and count
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.2 Write property test for tier classification (`src/lib/rune-tier.property.test.ts`)
    - **Property 1: Tier classification is consistent with rune level and count**
    - Generate random (level: 1–33, count: 0–99) pairs
    - Verify borderClass contains "high" iff level >= 21
    - Verify countColorClass contains "success" iff level 21–29 and count > 0
    - Verify countColorClass contains "unique" iff level >= 30 and count > 0
    - Verify countColorClass is empty when count === 0 or level < 21
    - Verify isZero is true iff count === 0
    - **Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.4**

  - [x] 1.3 Create input validation utility (`src/lib/rune-input-validation.ts`)
    - Export `validateRuneCountInput(value: string): number | null`
    - Accept non-negative integers 0–99, reject empty, non-numeric, negative, decimal, > 99
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 1.4 Write property test for input validation (`src/lib/rune-input-validation.property.test.ts`)
    - **Property 5: Input validation accepts valid integers and rejects invalid strings**
    - Generate arbitrary strings: valid integers in [0, 99], empty, decimals, negatives, large numbers, non-numeric
    - Verify `validateRuneCountInput` returns correct number or null
    - **Validates: Requirements 5.2, 5.3, 5.4**

- [x] 2. Checkpoint - Ensure utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement RuneCell component
  - [x] 3.1 Create RuneCell component (`src/components/RuneCell.tsx`)
    - Implement `RuneCellProps` interface with `runeName`, `runeLevel`, `count`, `onIncrement`, `onDecrement`, `onSetCount`, `onReset`
    - Render compact cell (rune name + count only) with no inline controls by default
    - Apply tier styling using `classifyRuneCell` — accent border for high runes, success/unique count colors
    - Apply opacity 0.35 class when count is zero
    - Implement hover/focus state to reveal overlay controls (+, −, reset) outside cell bounds
    - Hide reset button when count is zero
    - Implement click-to-edit: clicking count transforms to input field, pre-filled with current value, text selected
    - Validate input on Enter/blur via `validateRuneCountInput`, call `onSetCount` if valid, revert if invalid
    - Discard edit on Escape without calling `onSetCount`
    - Apply 2px accent border when input is active
    - Set aria-labels: "Increment {rune}", "Decrement {rune}", "Reset {rune}" on controls
    - Input max-width 3 characters, no cell size change during edit
    - _Requirements: 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4_

  - [x] 3.2 Write property tests for RuneCell behavior (`src/components/RuneCell.property.test.tsx`)
    - **Property 2: Reset visibility and behavior** — verify reset hidden when count === 0, shown when count > 0
    - **Property 3: Reset control accessibility labels** — verify aria-label contains rune name and "Reset"
    - **Property 4: Click-to-edit initializes with current count** — verify input pre-fill matches count
    - **Property 6: Escape key discards edits** — verify Escape reverts value and does not call onSetCount
    - **Validates: Requirements 4.2, 4.3, 4.5, 4.6, 5.1, 5.6**

  - [x] 3.3 Write unit tests for RuneCell (`src/components/RuneCell.test.tsx`)
    - Test overlay appears on hover within 150ms and hides after 300ms delay
    - Test keyboard Tab order through cell controls
    - Test accent border applied during edit mode
    - Test input does not cause cell size change (snapshot or computed style check)
    - _Requirements: 4.1, 4.4, 5.5, 5.7, 6.2, 6.3, 6.4_

- [x] 4. Refactor RuneGrid to use RuneCell
  - [x] 4.1 Refactor RuneGrid component (`src/components/RuneGrid.tsx`)
    - Update `RuneGridProps` to include `onSetCount` and `onReset` callbacks
    - Replace inline cell markup with `<RuneCell>` sub-component
    - Pass `runeLevel` from `RUNE_DEFINITIONS` lookup to each cell
    - Set grid container to `grid-template-columns: repeat(6, 1fr)`
    - Remove old inline +/− button markup (now handled by RuneCell overlay)
    - Ensure all 33 cells render without vertical scrolling in the panel
    - _Requirements: 2.2, 2.4, 2.5_

  - [x] 4.2 Write unit tests for RuneGrid (`src/components/RuneGrid.test.tsx`)
    - Verify 33 RuneCell components are rendered
    - Verify 6-column grid layout (CSS class or computed style)
    - Verify props are correctly passed through to RuneCell
    - _Requirements: 2.2, 2.5_

- [x] 5. Checkpoint - Ensure component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update page layout and styles
  - [x] 6.1 Update App.css with compact cell and layout styles (`src/App.css`)
    - Add `.rune-cell` compact dimensions (50×40px), no inline controls
    - Add `.rune-cell--zero` opacity 0.35 styling
    - Add `.rune-cell--high` accent border at 40% opacity
    - Add `.rune-cell__count--success` and `.rune-cell__count--unique` color classes
    - Add `.rune-cell__controls-overlay` absolute positioned outside cell bounds
    - Add `.rune-cell--editing` 2px solid accent border
    - Add `.rune-cell__input` max-width 3ch, no cell reflow
    - Add page-level CSS grid with named areas: `inventory | eligibility` top row, `progress` and `cube` full-width rows below
    - Add responsive media query: stack to single column at < 700px
    - Add consistent gap (12–20px) between grid sections
    - Add overlay reposition logic for viewport edge overflow
    - Add 150ms show / 300ms hide transition for overlay visibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.4, 5.5, 5.7, 6.1, 6.2, 6.3, 6.5_

  - [x] 6.2 Wire `onSetCount` and `onReset` handlers in the Runeword Planner page (`src/App.tsx` or page component)
    - Add `handleSetCount` that calls `setRuneCount` API then reloads inventory
    - Add `handleReset` that calls `handleSetCount(runeName, 0)`
    - Pass new handlers as props to RuneGrid
    - _Requirements: 4.2, 4.6, 5.3_

- [x] 7. Final checkpoint - Full verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples, timing, and edge cases
- The `setRuneCount` API function already exists in `src/api.ts` — no new API code needed
- `RUNE_DEFINITIONS` with level data already exists in `src/data/runes.ts` — no new data file needed
- The project uses `fast-check` v4.9.0 with `vitest` — property test files follow the `.property.test.ts` convention in `src/lib/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "6.1"] },
    { "id": 5, "tasks": ["6.2"] }
  ]
}
```
