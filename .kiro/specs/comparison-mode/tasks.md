# Implementation Plan: Comparison Mode

## Overview

This plan implements a Comparison Mode feature for the D2R Desktop Tracker. The feature adds a backend Tauri command (`get_comparison`) that computes efficiency metrics for two subjects (areas or date ranges), and a frontend page with side-by-side metric cards, grouped bar charts, and percentage difference badges. No new database tables are needed — all data is derived from existing `runs` and `items` tables.

## Tasks

- [ ] 1. Backend models and pure computation function
  - [ ] 1.1 Add ComparisonRequest, SubjectMetrics, and ComparisonResult models to `src-tauri/src/models.rs`
    - Add `ComparisonRequest` enum with `Area` and `DateRange` variants using `#[serde(tag = "type")]`
    - Add `SubjectMetrics` struct with all metric fields (total_runs, total_items, total_unique_items, total_duration_secs, items_per_hour, unique_items_per_hour, items_per_run, avg_time_per_run, fastest_run_secs, slowest_run_secs)
    - Add `ComparisonResult` struct with `subject_a` and `subject_b` fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 1.2 Implement pure `compute_subject_metrics` function in `src-tauri/src/commands.rs`
    - Create a pure function `compute_subject_metrics(label: &str, runs: &[(i64, i64, i64)]) -> SubjectMetrics` that takes pre-aggregated per-run data (duration_secs, item_count, unique_count)
    - Compute items_per_hour, unique_items_per_hour, avg_time_per_run, items_per_run excluding zero-duration runs from time-based metrics
    - Compute fastest_run_secs and slowest_run_secs from runs with duration > 0
    - Handle edge cases: zero runs returns all-zero metrics, all zero-duration returns 0 for rate metrics
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.3 Write property tests for `compute_subject_metrics` (Property 4: Items per hour)
    - **Property 4: Items per hour computation**
    - **Validates: Requirements 3.1, 3.4**
    - Use `proptest` crate to generate random vectors of (duration_secs, item_count, unique_count) tuples
    - Assert items_per_hour equals (total_items / total_nonzero_duration) * 3600 for nonzero duration, or 0 when all durations are zero

  - [ ]* 1.4 Write property tests for `compute_subject_metrics` (Property 5: Unique items per hour)
    - **Property 5: Unique items per hour computation**
    - **Validates: Requirements 3.2, 3.4**
    - Assert unique_items_per_hour equals (total_unique_items / total_nonzero_duration) * 3600

  - [ ]* 1.5 Write property tests for `compute_subject_metrics` (Property 6: Average time per run)
    - **Property 6: Average time per run computation**
    - **Validates: Requirements 3.3, 3.4**
    - Assert avg_time_per_run equals sum of nonzero durations divided by count of nonzero-duration runs

  - [ ]* 1.6 Write property tests for `compute_subject_metrics` (Property 7: Items per run)
    - **Property 7: Items per run computation**
    - **Validates: Requirements 3.5**
    - Assert items_per_run equals total_items / total_runs when total_runs > 0, or 0 otherwise

- [ ] 2. Backend `get_comparison` command and registration
  - [ ] 2.1 Implement `get_comparison` Tauri command in `src-tauri/src/commands.rs`
    - Accept `ComparisonRequest` as input via `State<DbState>`
    - For `Area` variant: query runs + items filtered by profile_id and area, compute per-run aggregates via LEFT JOIN
    - For `DateRange` variant: query runs + items filtered by profile_id and date range (started_at >= start AND started_at < end+1day)
    - Call `compute_subject_metrics` for each subject's results
    - Return `ComparisonResult` with both subjects
    - _Requirements: 1.1, 2.1, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 2.2 Register `get_comparison` command in `src-tauri/src/lib.rs`
    - Add `commands::get_comparison` to the `tauri::generate_handler!` macro invocation
    - _Requirements: 4.1_

- [ ] 3. Checkpoint - Backend verification
  - Ensure `cargo check` passes in src-tauri, ask the user if questions arise.

- [ ] 4. Frontend types and API layer
  - [ ] 4.1 Add comparison types to `src/types.ts`
    - Add `ComparisonRequest` interface with discriminated `type` field ("area" | "date_range")
    - Add `SubjectMetrics` interface matching backend struct
    - Add `ComparisonResult` interface with `subject_a` and `subject_b`
    - _Requirements: 1.2, 3.1, 3.2, 3.3_

  - [ ] 4.2 Add `getComparison` API function to `src/api.ts`
    - Add import for `ComparisonRequest` and `ComparisonResult` from types
    - Add `getComparison` function that invokes the `get_comparison` Tauri command
    - _Requirements: 1.1, 2.1_

- [ ] 5. Frontend utility helpers
  - [ ] 5.1 Create `src/utils/comparison.ts` with helper functions
    - Implement `percentageDiff(a: number, b: number): number | null` — returns ((a-b)/b)*100, or null when b is 0
    - Implement `isWinner(valueA: number, valueB: number, higherIsBetter: boolean): "a" | "b" | "tie"` — determines which subject wins
    - Implement `showWarning(totalRuns: number, minSampleSize?: number): boolean` — returns true when totalRuns < minSampleSize (default 5)
    - Implement `formatPercentageDiff(diff: number | null): string` — formats as "+12.3%" / "-5.1%" / "N/A"
    - Implement `isSignificant(diff: number | null, threshold?: number): boolean` — returns true when |diff| > threshold (default 20)
    - _Requirements: 1.3, 1.4, 5.1, 6.2, 6.3_

  - [ ]* 5.2 Write property tests for frontend utility helpers (Property 8: Winner highlighting)
    - **Property 8: Winner highlighting correctness**
    - **Validates: Requirements 1.3**
    - Use `fast-check` to generate random pairs of numbers, assert isWinner selects the higher value for higherIsBetter=true, lower for higherIsBetter=false, "tie" for equal values

  - [ ]* 5.3 Write property tests for frontend utility helpers (Property 9: Minimum sample size warning)
    - **Property 9: Minimum sample size warning**
    - **Validates: Requirements 1.4, 5.1**
    - Assert showWarning returns true iff totalRuns < 5

  - [ ]* 5.4 Write property tests for frontend utility helpers (Property 11: Percentage difference)
    - **Property 11: Percentage difference computation**
    - **Validates: Requirements 6.2**
    - Assert percentageDiff(a, b) equals ((a-b)/b)*100 when b≠0, null when b=0

  - [ ]* 5.5 Write property tests for frontend utility helpers (Property 12: Significance threshold)
    - **Property 12: Significance threshold emphasis**
    - **Validates: Requirements 6.3**
    - Assert isSignificant returns true iff |diff| > 20

- [ ] 6. Comparison page component
  - [ ] 6.1 Create `src/pages/Comparison.tsx` with comparison type selector and area selectors
    - Implement page shell with comparison type toggle (Area vs Date Range tabs)
    - For area mode: two dropdown selectors populated with areas that have ≥1 completed run (fetched via `getDetailedRuns` or `getStats` to get available areas)
    - For date range mode: two pairs of date input pickers (start/end for each period)
    - Add a "Compare" button that is disabled until valid selections are made
    - Frontend validation: both areas selected, dates valid (start ≤ end), disable button if invalid
    - Display empty state with instructions when no comparison is configured
    - Display notice when identical subjects are selected
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.2, 7.3_

  - [ ] 6.2 Add metrics cards with winner highlighting and percentage badges
    - Display side-by-side metric cards showing all SubjectMetrics fields (total runs, total items, items/hour, unique items/hour, avg time/run, fastest, slowest)
    - Highlight the winner (higher items_per_hour, higher unique_items_per_hour) with a visual indicator (green border/background)
    - Show percentage difference badges on each metric using `percentageDiff` helper
    - Apply distinct visual emphasis (bold, color) when percentage difference > 20%
    - Show minimum sample size warning badge when either subject has < 5 runs
    - Display "No data" message when a subject has zero runs
    - _Requirements: 1.2, 1.3, 1.4, 2.3, 5.1, 5.2, 6.2, 6.3_

  - [ ] 6.3 Add Recharts grouped bar chart for comparison visualization
    - Use Recharts `BarChart` with grouped bars comparing items_per_hour, unique_items_per_hour, and avg_time_per_run between subjects
    - Style consistently with existing Statistics page (use same color palette, tooltip styles)
    - Use `ResponsiveContainer` for responsive sizing
    - _Requirements: 6.1, 6.4_

  - [ ] 6.4 Add error handling and loading states
    - Show loading indicator while comparison API call is in progress
    - Display error message toast/banner if API call fails
    - Handle zero completed runs in profile with appropriate empty state message
    - _Requirements: 7.1, 7.3_

- [ ] 7. Sidebar navigation integration
  - [ ] 7.1 Integrate Comparison page into `src/App.tsx`
    - Add `"comparison"` to the `Page` type union
    - Import the `Comparison` component
    - Add a sidebar nav button (⚔️ Compare) after Statistics, disabled when no profile selected
    - Add case in `renderPage()` switch to render `<Comparison profile={selectedProfile} />`
    - _Requirements: 4.1_

- [ ] 8. Checkpoint - Full integration verification
  - Ensure all tests pass (`npm test`), TypeScript compiles (`npx tsc --noEmit`), Rust checks pass (`cd src-tauri && cargo check`), and Vite builds (`npx vite build`). Ask the user if questions arise.

- [ ]* 9. Integration tests
  - [ ]* 9.1 Write integration test for `get_comparison` command
    - Create runs via existing test infrastructure, finish them, then call `get_comparison` and verify returned metrics match expected values
    - Test both area comparison and date range comparison paths
    - Test edge case: zero completed runs returns all-zero metrics
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.3, 7.3_

  - [ ]* 9.2 Write unit tests for Comparison.tsx rendering
    - Test empty state is displayed when no comparison configured
    - Test area selectors are populated correctly
    - Test metric cards display all required fields
    - Test warning badge appears for subjects with < 5 runs
    - _Requirements: 4.3, 4.4, 1.2, 5.1_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend `compute_subject_metrics` function is extracted as pure logic to enable property-based testing without DB dependencies
- Recharts is already installed in the project — no new dependencies needed for charting
- The `proptest` crate will need to be added as a dev-dependency in `src-tauri/Cargo.toml`
- The `fast-check` package will need to be added as a dev-dependency in `package.json`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "4.2", "5.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "1.6", "2.1", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["9.1", "9.2"] }
  ]
}
```
