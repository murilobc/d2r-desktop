# Requirements Document

## Introduction

Performance profiling and optimization for the D2R Tracker desktop application. This feature addresses smooth scrolling in the History page for large datasets (10k+ runs), faster Statistics page load times through batched queries, database maintenance via SQLite VACUUM, lazy-loaded pages, loading skeleton placeholders, and memoization of expensive React components.

## Glossary

- **History_Page**: The page component that displays a scrollable list of completed runs with expandable details and item logs
- **Statistics_Page**: The page component that displays aggregated run statistics, charts, and per-area breakdowns
- **Settings_Page**: The page component containing user preferences and configuration options
- **Virtual_Scroller**: A windowed list component that only renders DOM elements for rows currently visible in the viewport, fetching additional data as the user scrolls
- **Combined_Stats_Command**: A single Tauri IPC command that returns all statistics data (summary stats, detailed runs, routes) in one round-trip
- **Loading_Skeleton**: An animated shimmer placeholder that mirrors the shape of the final content layout while data is being fetched
- **VACUUM_Command**: A SQLite maintenance operation that reclaims unused disk space and compacts the database file
- **Lazy_Loading**: Deferred loading of page components using React.lazy and Suspense so they are fetched only when navigated to

## Requirements

### Requirement 1

**User Story:** As a player with thousands of runs logged, I want the History page to scroll smoothly without lag, so that I can browse my run history efficiently regardless of dataset size.

#### Acceptance Criteria

1. WHEN the History_Page mounts, THE Virtual_Scroller SHALL render only the DOM elements for rows visible in the viewport plus a configurable overscan buffer
2. WHEN the user scrolls within the History_Page and approaches the end of loaded data, THE Virtual_Scroller SHALL automatically fetch the next batch of runs from the backend without user interaction
3. WHILE the Virtual_Scroller is active with 10,000 or more loaded runs, THE History_Page SHALL maintain fewer than 100 DOM elements for run rows at any point in time
4. WHEN a run row becomes visible in the viewport, THE Virtual_Scroller SHALL display the run area, duration, tags, date, and item count without additional API calls for that row's basic data
5. WHEN a user expands a virtualized run row, THE History_Page SHALL load and display the items for that run

### Requirement 2

**User Story:** As a player, I want the Statistics page to load quickly even with 50,000+ runs, so that I can check my farming efficiency without waiting.

#### Acceptance Criteria

1. WHEN the Statistics_Page mounts, THE Combined_Stats_Command SHALL return summary stats, detailed runs, and route list in a single IPC round-trip
2. WHEN the Combined_Stats_Command executes against a dataset of 50,000 runs, THE Combined_Stats_Command SHALL return results within 1000 milliseconds
3. WHEN the Statistics_Page receives data from the Combined_Stats_Command, THE Statistics_Page SHALL compute derived metrics (items per hour, rarity distribution, run timeline) using memoized calculations that only recompute when input data changes

### Requirement 3

**User Story:** As a long-term user, I want to compact my SQLite database manually, so that I can reclaim disk space after deleting old data.

#### Acceptance Criteria

1. WHEN a user triggers the VACUUM action from the Settings_Page, THE system SHALL execute the SQLite VACUUM command on the application database
2. WHEN the VACUUM operation completes successfully, THE Settings_Page SHALL display a success message with the database file size before and after compaction
3. IF the VACUUM operation fails, THEN THE Settings_Page SHALL display an error message describing the failure reason
4. WHILE the VACUUM operation is in progress, THE Settings_Page SHALL display a progress indicator and disable the VACUUM button to prevent concurrent executions

### Requirement 4

**User Story:** As a user, I want the app to start quickly and only load pages I navigate to, so that the initial load feels responsive.

#### Acceptance Criteria

1. THE application SHALL use Lazy_Loading for all page components except the initially displayed Profiles page
2. WHEN navigating to a lazy-loaded page for the first time, THE application SHALL display a Loading_Skeleton while the page chunk is being fetched
3. WHEN async data is being fetched on any page, THE page SHALL display Loading_Skeleton placeholders that match the shape of the expected content (stat cards, tables, charts)
4. THE Loading_Skeleton components SHALL use animated shimmer effects that mirror the dimensions of stat cards, table rows, and chart containers

### Requirement 5

**User Story:** As a user, I want the application UI to remain responsive during normal use, so that interactions feel instant without unnecessary re-renders.

#### Acceptance Criteria

1. THE application SHALL wrap expensive list-rendering components with React.memo to prevent re-renders when props have not changed
2. THE application SHALL use useMemo for computed values derived from large datasets (filtered runs, aggregated statistics, chart data transformations)
3. WHEN a parent component re-renders, THE memoized child components SHALL not re-render if their props remain referentially equal

### Requirement 6

**User Story:** As a developer, I want Rust-side query benchmarks for large datasets, so that I can verify query performance meets targets and catch regressions.

#### Acceptance Criteria

1. THE benchmark suite SHALL measure query execution time for the Combined_Stats_Command against datasets of 10,000, 50,000, and 100,000 rows
2. THE benchmark suite SHALL measure query execution time for paginated run retrieval against datasets of 10,000, 50,000, and 100,000 rows
3. WHEN benchmarks are executed, THE benchmark suite SHALL output timing results that can be compared across runs to detect performance regressions
