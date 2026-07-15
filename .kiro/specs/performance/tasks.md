# Implementation Plan: Performance Profiling

## Overview

Optimize the D2R Tracker for large datasets through virtual scrolling, batched queries, lazy loading, loading skeletons, component memoization, and database maintenance tools. Implementation proceeds backend-first (combined stats command, VACUUM), then frontend rendering optimizations (virtual scroll, lazy load, skeletons, memoization), and finally benchmarks.

## Tasks

- [x] 1. Add combined statistics Rust command
  - [x] 1.1 Create `get_stats_combined` Tauri command in `src-tauri/src/commands.rs`
    - Accept `profile_id` and optional `area_filter` parameters
    - Return a `CombinedStats` struct containing `summary: Stats`, `detailed_runs: Vec<DetailedRun>`, and `routes: Vec<Route>`
    - Execute all queries within a single mutex lock to avoid repeated lock acquisition
    - Add composite index `CREATE INDEX IF NOT EXISTS idx_runs_profile_started ON runs(profile_id, started_at DESC)` in `db.rs`
    - Register the new command in `lib.rs`
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Add `getStatsCombined` API function in `src/api.ts`
    - Define `CombinedStats` TypeScript interface in `src/types.ts`
    - Create `getStatsCombined(profileId: string, areaFilter?: string)` that invokes the new command
    - _Requirements: 2.1_

  - [x]* 1.3 Write property test for combined stats response completeness
    - **Property 2: Combined stats response completeness**
    - For any profile with runs, `get_stats_combined` returns non-null summary, detailed_runs, and routes where summary.total_runs equals detailed_runs length
    - **Validates: Requirements 2.1**

- [x] 2. Add VACUUM database command
  - [x] 2.1 Create `vacuum_database` Tauri command in `src-tauri/src/commands.rs`
    - Read DB file size before VACUUM
    - Execute `VACUUM` SQL command
    - Read DB file size after VACUUM
    - Return `VacuumResult { size_before_bytes, size_after_bytes, success }`
    - Register the command in `lib.rs`
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Add `VacuumResult` type and `vacuumDatabase` API function in frontend
    - Add `VacuumResult` interface to `src/types.ts`
    - Add `vacuumDatabase()` function to `src/api.ts`
    - _Requirements: 3.1_

  - [x] 2.3 Add "Database Maintenance" section to Settings page
    - Add new `DatabaseMaintenance` component within `src/pages/Settings.tsx`
    - Show current DB file size (call a new `get_db_size` command or derive from vacuum result)
    - "Compact Database" button triggers `vacuumDatabase()`
    - Display before/after sizes on success
    - Show error message on failure
    - Disable button and show spinner while VACUUM is in progress
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x]* 2.4 Write unit tests for VACUUM settings UI
    - Test button disabled state during operation
    - Test success message with file sizes displayed
    - Test error message on failure
    - _Requirements: 3.3, 3.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement virtual scrolling in History page
  - [x] 4.1 Install `react-window` and `react-window-infinite-loader`
    - Run `npm install react-window react-window-infinite-loader`
    - Run `npm install -D @types/react-window`
    - _Requirements: 1.1_

  - [x] 4.2 Refactor History page to use virtualized infinite scroll
    - Replace the current `filteredRuns.map()` rendering with `FixedSizeList` from react-window
    - Wrap with `InfiniteLoader` from react-window-infinite-loader to auto-fetch as user scrolls near bottom
    - Set row height to 56px (collapsed), overscan count to 10
    - Increase batch size to 100 rows per fetch
    - Remove the "Load More" button
    - Create a memoized `HistoryRow` component with `React.memo`
    - Handle expanded rows (item details) via an overlay or portal positioned absolutely
    - Preserve existing functionality: tier filter, tag filter, area edit, item add/delete, timeline
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x]* 4.3 Write property test for virtual scroller DOM bound
    - **Property 1: Virtual scroller DOM element bound**
    - For any dataset size and scroll position, rendered row elements stay within (visible_rows + 2 × overscan), never exceeding 100
    - **Validates: Requirements 1.1, 1.3**

- [x] 5. Implement lazy-loaded pages with loading skeletons
  - [x] 5.1 Create reusable Skeleton components
    - Create `src/components/Skeleton.tsx` with variants: `card`, `table-row`, `chart`, `text`, `page`
    - Add shimmer animation CSS to `App.css` using `background-size` animation
    - Create page-specific skeleton compositions: `StatsSkeleton`, `HistorySkeleton`, `SettingsSkeleton`
    - _Requirements: 4.3, 4.4_

  - [x] 5.2 Convert page imports to React.lazy in App.tsx
    - Replace all eager page imports (except `Profiles`) with `React.lazy(() => import(...))`
    - Wrap the `renderPage()` output with `<Suspense fallback={<PageSkeleton />}>`
    - Handle RunTracker's persistent mount: lazy-load initially but keep mounted after first load
    - Ensure each page's default export is compatible with React.lazy
    - _Requirements: 4.1, 4.2_

  - [x] 5.3 Add loading skeletons for async data fetches within pages
    - In Statistics page: show `StatsSkeleton` while `getStatsCombined` is pending
    - In History page: show row skeleton placeholders for unloaded virtual list items
    - In other pages with async data: replace "Loading..." text with appropriate skeleton
    - _Requirements: 4.3_

- [x] 6. Refactor Statistics page to use combined stats command
  - [x] 6.1 Update Statistics.tsx to call `getStatsCombined`
    - Replace the separate `getStats()`, `getDetailedRuns()`, `getRoutes()` calls with single `getStatsCombined()`
    - Destructure the combined response into existing state variables
    - Update the area filter to pass `areaFilter` parameter to the combined command
    - Wrap `filteredStats` useMemo with proper dependency arrays
    - _Requirements: 2.1, 2.3_

  - [x]* 6.2 Write unit tests for Statistics page with combined stats
    - Mock `getStatsCombined` and verify single call on mount
    - Verify area filter triggers new combined call
    - Verify loading skeleton shown while data is pending
    - _Requirements: 2.1_

- [x] 7. Memoize expensive components
  - [x] 7.1 Identify and wrap expensive components with React.memo
    - Wrap chart components in Statistics page with `React.memo`
    - Wrap stat card grid items with `React.memo`
    - Wrap `HistoryRow` (already done in step 4.2, verify)
    - Wrap `TZPerformance` component with `React.memo`
    - _Requirements: 5.1, 5.3_

  - [x] 7.2 Audit and optimize useMemo usage
    - Ensure all `useMemo` calls in Statistics have correct dependency arrays
    - Add `useMemo` to `availableAreas`, `sessions`, `runNumbers` computations in History
    - Verify `useCallback` for event handlers passed to memoized children
    - _Requirements: 5.2_

  - [x]* 7.3 Write property test for memoization referential stability
    - **Property 3: Memoization referential stability**
    - For any memoized computation, same inputs produce same output reference across renders
    - **Validates: Requirements 2.3, 5.1, 5.2, 5.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Add Rust-side query benchmarks
  - [x] 9.1 Set up criterion benchmarks
    - Add `criterion` to `[dev-dependencies]` in `src-tauri/Cargo.toml`
    - Create `src-tauri/benches/query_bench.rs`
    - Configure `[[bench]]` section in Cargo.toml
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.2 Implement benchmark functions
    - Create `setup_db(row_count)` helper that seeds an in-memory SQLite DB with N runs + items
    - Benchmark `get_stats_combined` at 10k, 50k, 100k rows
    - Benchmark `get_runs_paginated` at 10k, 50k, 100k rows
    - Output timing results via criterion's standard reporter
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Run `npm test` to verify no regressions in existing 174 tests
  - Run `npx tsc --noEmit` to verify TypeScript compilation
  - Run `cd src-tauri && cargo check` to verify Rust compilation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The existing 174 tests must continue passing — no regressions
- `react-window` is a lightweight ~6KB library, minimal bundle impact
- The RunTracker page stays mounted for session state preservation even with lazy loading
- Benchmarks (task 9) are dev-only and don't affect production builds
- Property tests use `proptest` (already in Cargo.toml dev-deps) for Rust-side and `vitest` for frontend
