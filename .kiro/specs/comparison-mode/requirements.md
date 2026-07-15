# Requirements Document

## Introduction

Comparison Mode enables users to compare farming efficiency between different areas, sessions, or time periods within the D2R Desktop Tracker. The feature presents side-by-side statistics to answer questions like "Is Ancient Tunnels better than Mephisto for my character?" by computing and displaying metrics such as items per hour, unique items per hour, and average time per run from existing run and item data.

## Glossary

- **Comparison_Engine**: The backend logic (Rust/Tauri command) that computes comparison metrics from existing run and item data for two selected subjects
- **Comparison_View**: The React page that displays side-by-side comparison results and allows users to configure comparison parameters
- **Subject**: One side of a comparison — either an area, a date range, or a session (a contiguous group of runs)
- **Metric**: A computed efficiency value such as items per hour, unique items per hour, or average time per run
- **Minimum_Sample_Size**: The minimum number of completed runs (default: 5) required for a subject before comparison results are considered statistically meaningful
- **Unique_Item**: An item with rarity "Unique", "Set", or "Runeword"
- **Session**: A contiguous block of runs in the same area, separated by runs in other areas or a time gap exceeding 2 hours

## Requirements

### Requirement 1: Area-to-Area Comparison

**User Story:** As a D2R farmer, I want to compare efficiency metrics between two farming areas, so that I can decide which area is more productive for my character.

#### Acceptance Criteria

1. WHEN the user selects two areas from the area selectors, THE Comparison_Engine SHALL compute metrics for each area using all completed runs in the active profile
2. THE Comparison_View SHALL display the following metrics side-by-side for each selected area: total runs, total items found, items per hour, unique items per hour, average time per run, fastest run, and slowest run
3. THE Comparison_View SHALL visually highlight the area with the higher value for items per hour and unique items per hour metrics
4. WHEN one or both selected areas have fewer completed runs than the Minimum_Sample_Size, THE Comparison_View SHALL display a warning indicating insufficient data for reliable comparison

### Requirement 2: Date Range Comparison

**User Story:** As a D2R farmer, I want to compare my efficiency between two different time periods, so that I can track whether my farming has improved over time.

#### Acceptance Criteria

1. WHEN the user selects two date ranges via date pickers, THE Comparison_Engine SHALL compute metrics using only completed runs that fall within each respective date range
2. THE Comparison_View SHALL allow the user to select a start date and end date for each of the two comparison periods
3. IF the user selects a date range that contains zero completed runs, THEN THE Comparison_View SHALL display a message indicating no data exists for the selected period
4. THE Comparison_Engine SHALL include runs where the started_at timestamp falls within the selected date range boundaries (inclusive of start date, exclusive of end date's next day)

### Requirement 3: Comparison Metric Computation

**User Story:** As a D2R farmer, I want accurate efficiency metrics computed from my run data, so that I can make informed decisions about where to farm.

#### Acceptance Criteria

1. THE Comparison_Engine SHALL compute items per hour as: (total items found / total run duration in seconds) multiplied by 3600
2. THE Comparison_Engine SHALL compute unique items per hour as: (total Unique_Items found / total run duration in seconds) multiplied by 3600
3. THE Comparison_Engine SHALL compute average time per run as: total run duration in seconds divided by total number of completed runs
4. THE Comparison_Engine SHALL exclude runs with zero duration from average time per run and items per hour calculations to avoid division by zero
5. THE Comparison_Engine SHALL compute items per run as: total items found divided by total number of completed runs

### Requirement 4: Comparison Mode Navigation and Layout

**User Story:** As a D2R farmer, I want to access the comparison mode from the main navigation, so that I can quickly compare areas without disrupting my workflow.

#### Acceptance Criteria

1. THE Comparison_View SHALL be accessible from the main application navigation as a dedicated page
2. THE Comparison_View SHALL display a comparison type selector allowing the user to choose between area comparison and date range comparison
3. WHEN no comparison has been configured, THE Comparison_View SHALL display an empty state with instructions on how to set up a comparison
4. THE Comparison_View SHALL populate area selectors with areas that have at least one completed run in the active profile

### Requirement 5: Minimum Data Threshold

**User Story:** As a D2R farmer, I want to know when comparison results may be unreliable due to insufficient data, so that I avoid making decisions based on small sample sizes.

#### Acceptance Criteria

1. WHEN a subject has fewer completed runs than the Minimum_Sample_Size, THE Comparison_View SHALL display a warning badge next to the subject indicating the number of runs available versus the minimum recommended
2. THE Comparison_View SHALL still display computed metrics for subjects below the Minimum_Sample_Size alongside the warning
3. THE Comparison_Engine SHALL use a default Minimum_Sample_Size of 5 completed runs

### Requirement 6: Comparison Results Visualization

**User Story:** As a D2R farmer, I want a visual representation of comparison results, so that I can quickly grasp which area or period performed better.

#### Acceptance Criteria

1. THE Comparison_View SHALL display a grouped bar chart comparing key metrics (items per hour, unique items per hour, average time per run) between the two subjects
2. THE Comparison_View SHALL display a percentage difference for each metric indicating how much better or worse Subject A performs relative to Subject B
3. WHEN the percentage difference for a metric exceeds 20%, THE Comparison_View SHALL apply a distinct visual emphasis to indicate a significant difference
4. THE Comparison_View SHALL use the existing Recharts library for chart rendering

### Requirement 7: Error Handling

**User Story:** As a D2R farmer, I want clear feedback when something goes wrong with comparisons, so that I understand any limitations.

#### Acceptance Criteria

1. IF the Comparison_Engine encounters a database error while computing metrics, THEN THE Comparison_View SHALL display an error message describing the failure
2. IF both selected subjects are identical (same area selected twice, or overlapping date ranges), THEN THE Comparison_View SHALL display a notice that comparing identical subjects yields no meaningful insight
3. IF the active profile has zero completed runs, THEN THE Comparison_View SHALL display a message directing the user to complete runs before using comparison mode
