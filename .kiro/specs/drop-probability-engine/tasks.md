# Implementation Plan: Drop Probability Engine

## Overview

Replace the existing DropCalculator page with a Rust-backed probability engine. Implementation proceeds backend-first: create the probability_engine module with TC tree traversal and math, embed static TC data, expose 4 Tauri commands, then build the upgraded 3-tab React frontend with Recharts visualizations (distribution curve, expected-vs-actual, luck gauge). Integrates with the existing SQLite stats system for personalized run estimations.

## Tasks

- [ ] 1. Create probability_engine Rust module with TC data structures
  - [ ] 1.1 Create `src-tauri/src/probability_engine.rs` with data model structs and TC data loading
    - Define `TcData`, `TreasureClass`, `TcItem`, `SubTcRef`, `Monster`, `ItemDef`, `TzScaling`, `HeraldTier` structs with serde Deserialize
    - Implement `load_tc_data()` function using `include_str!("../data/tc_data.json")` and `serde_json::from_str`
    - Use `lazy_static` or `std::sync::OnceLock` for the parsed static data
    - Declare the module in `src-tauri/src/lib.rs`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 1.2 Create placeholder `src-tauri/data/tc_data.json` with schema and sample entries
    - Include sample treasure_classes, monsters, items, terror_zone_scaling, and herald_tiers sections
    - Include at least 3 bosses (Mephisto, Baal, Andariel), representative TC hierarchy (TC87→TC84→TC81), and sample items (Shako, Tyrael's Might, Ber rune)
    - Validate JSON loads correctly via a Rust unit test
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2. Implement core probability computation algorithms
  - [ ] 2.1 Implement TC tree traversal (`compute_item_probability`)
    - Recursive walk from monster's base TC to target item
    - Accumulate probability weights through sub-TC references
    - Include cycle detection via visited set
    - Return `Result<f64, String>` with descriptive errors for missing TCs
    - _Requirements: 1.1, 10.2_

  - [ ] 2.2 Implement MF adjustment and player count formulas
    - `apply_mf_adjustment(base_one_in_x, mf, rarity)` with factor 250 for Unique, 500 for Set, pass-through for Rune
    - `adjust_for_player_count(base_one_in_x, no_drop_weight, total_weight, players)` with D2R NoDrop formula
    - Quest bonus: double effective drop rolls
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ] 2.3 Implement cumulative distribution and luck percentile functions
    - `cumulative_probability(per_kill_prob, kills)` → `1 - (1 - p)^N`
    - `kills_for_threshold(per_kill_prob, threshold)` → `ceil(ln(1-t)/ln(1-p))`
    - `luck_percentile(actual_drops, total_kills, per_kill_prob)` using normal approximation to binomial CDF
    - _Requirements: 3.1, 3.2, 5.4_

  - [ ]* 2.4 Write property tests for MF adjustment monotonicity and rune immunity
    - **Property 1: MF Adjustment Monotonicity and Formula Correctness**
    - **Property 2: Rune MF Immunity**
    - Use `proptest` with MF in 0..9999, verify higher MF always produces lower 1-in-X for Unique/Set
    - Verify rune output always equals input regardless of MF
    - **Validates: Requirements 1.2, 1.5**

  - [ ]* 2.5 Write property tests for player count and quest bonus
    - **Property 3: Player Count Monotonicity**
    - **Property 4: Quest Bonus Improvement**
    - Use `proptest` with player counts 1..8, verify monotonically better drop chance
    - Verify quest bonus always improves probability for eligible bosses
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 2.6 Write property tests for TC traversal and cumulative distribution
    - **Property 5: TC Tree Traversal Validity**
    - **Property 6: Cumulative Distribution and Threshold Consistency**
    - Verify reachable items produce probability in (0, 1], unreachable items return 0.0
    - Verify `cumulative_probability(p, kills_for_threshold(p, t)) >= t` for all valid inputs
    - **Validates: Requirements 1.1, 3.1, 3.2**

- [ ] 3. Implement Terror Zone and Herald TC modifications
  - [ ] 3.1 Implement Terror Zone TC elevation logic
    - Look up TZ scaling table for the area
    - Replace base TC with elevated TZ TC when `terror_zone: true`
    - Validate elevated alvl >= base alvl
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 3.2 Implement Herald tier TC modification logic
    - Look up Herald tier table (1–5) for TC and drop_rolls overrides
    - Apply tier-specific values when `herald_tier` is Some
    - _Requirements: 7.1, 7.2_

  - [ ]* 3.3 Write property tests for TZ and Herald invariants
    - **Property 10: Terror Zone Elevation Invariant**
    - **Property 11: Herald Tier TC Monotonicity**
    - Verify TZ always elevates or maintains TC level
    - Verify higher Herald tiers have >= TC and >= drop_rolls
    - **Validates: Requirements 6.1, 6.2, 7.1**

- [ ] 4. Expose Tauri commands for the probability engine
  - [ ] 4.1 Create `calculate_drop_probability` and `calculate_cumulative_distribution` commands
    - Define `DropProbabilityInput` and `DropProbabilityResult` structs
    - Define `CumulativeDistInput` and `DistributionPoint` structs
    - Validate inputs (MF range, player count range, known monster/item IDs)
    - Wire TC traversal + MF + player count + quest bonus + TZ + Herald into final result
    - Compute kills_for_50, kills_for_63, kills_for_90, kills_for_99 thresholds
    - Register commands in `src-tauri/src/lib.rs`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 10.1, 10.2, 10.3_

  - [ ] 4.2 Create `get_area_run_stats` and `calculate_luck_percentile` commands
    - Define `AreaRunStats`, `ItemCount`, `LuckPercentileInput`, `LuckPercentileResult` structs
    - `get_area_run_stats`: query existing SQLite DB for profile's run history in an area
    - `calculate_luck_percentile`: compute percentile, expected drops, deviation, sigma
    - Register commands in `src-tauri/src/lib.rs`
    - _Requirements: 4.1, 5.1, 5.4_

  - [ ]* 4.3 Write property tests for luck percentile and input validation
    - **Property 9: Luck Percentile Bounded and Monotonic**
    - **Property 12: Input Validation Boundary**
    - Verify percentile always in [0, 100] and non-decreasing with actual_drops
    - Verify invalid MF/monster/item returns Err, valid inputs return Ok
    - **Validates: Requirements 5.4, 10.1, 10.3**

- [ ] 5. Checkpoint - Ensure Rust backend compiles and tests pass
  - Run `cd src-tauri && cargo check` and `cargo test`
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add frontend API bindings for probability commands
  - [ ] 6.1 Add TypeScript interfaces and invoke wrappers in `src/api.ts`
    - Define `DropProbabilityInput`, `DropProbabilityResult`, `CumulativeDistInput`, `DistributionPoint`, `AreaRunStats`, `LuckPercentileInput`, `LuckPercentileResult` interfaces
    - Create `calculateDropProbability`, `calculateCumulativeDistribution`, `getAreaRunStats`, `calculateLuckPercentile` functions
    - _Requirements: 1.1, 3.1, 4.1, 5.4_

- [ ] 7. Implement the upgraded DropCalculator page with 3-tab layout
  - [ ] 7.1 Refactor `src/pages/DropCalculator.tsx` with 3-tab structure
    - Retain existing AreaTab component (area browser with filters, area detail)
    - Add "Probability" and "Comparison" tabs to the tab navigation
    - Update tab state to support `"areas" | "probability" | "comparison"`
    - Retain all existing area browser functionality (filters, TC85, boss, detail panel)
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 7.2 Implement ProbabilityTab component
    - MonsterSelect dropdown (filterable list from TC data)
    - ItemSelect dropdown (filterable, shows rarity)
    - ConfigPanel: MF input (0–9999 validated), player count select (1–8), quest bonus toggle, TZ toggle, Herald tier select
    - ProbabilityResult display: 1-in-X format, effective MF, MF-applied indicator
    - Call `calculateDropProbability` on config change
    - Input validation with error messages for out-of-range MF
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.1_

  - [ ] 7.3 Implement DistributionChart with Recharts AreaChart
    - Call `calculateCumulativeDistribution` with computed probability
    - Render Recharts AreaChart with kills on X-axis, cumulative probability on Y-axis
    - Add threshold marker lines at 50%, 63%, 90%, 99%
    - Add tooltip showing exact kills and probability on hover
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 7.4 Implement RunEstimate section
    - Call `getAreaRunStats` to get average run duration
    - Compute runs-to-find using kills_for_63 / kills_per_run
    - Display estimated runs and estimated time (hours:minutes)
    - Show "no data" prompt if user has no historical runs for the area
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 7.5 Implement ComparisonTab with expected-vs-actual chart
    - Query historical item counts and total kills for the selected monster/item
    - Render Recharts LineChart overlaying expected cumulative drops (N × p) vs actual drops
    - Display textual luck summary (e.g., "Found 2 but expected ~1.3 in 500 runs")
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 7.6 Implement LuckGauge percentile display
    - Call `calculateLuckPercentile` with actual drops, total kills, per-kill probability
    - Render radial gauge showing percentile (0–100) with color coding (red/yellow/green)
    - Display deviation and sigma values
    - _Requirements: 5.4_

- [ ] 8. Add i18n translation keys for the drop probability page
  - [ ] 8.1 Add translation keys to `src/i18n/locales/en-US.json`, `pt-BR.json`, and `es.json`
    - Add keys for all new labels: tab names, input labels, tooltips, error messages, chart labels, luck descriptions
    - Use existing i18n formatters for numeric probability values (locale-aware number formatting)
    - Replace all hardcoded strings in new components with `t()` calls
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 9. Checkpoint - Ensure frontend compiles and tests pass
  - Run `npx tsc --noEmit` and `npm test`
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Write frontend component tests
  - [ ]* 10.1 Write Vitest tests for ProbabilityTab
    - Test input validation (MF range, player count)
    - Test that calculation is triggered on config change (mock invoke)
    - Test error display for invalid monster/item combinations
    - _Requirements: 10.1, 1.1_

  - [ ]* 10.2 Write Vitest tests for ComparisonTab and LuckGauge
    - Test chart data preparation from mock API responses
    - Test luck summary text generation
    - Test gauge renders correct percentile value
    - _Requirements: 5.2, 5.4_

  - [ ]* 10.3 Write property tests for frontend probability formatting
    - **Property 7: Run and Time Estimation Correctness**
    - **Property 8: Expected Drops Linearity**
    - Use `fast-check` to verify run estimates are always positive finite numbers for valid inputs
    - Verify expected drops scale linearly with kill count
    - **Validates: Requirements 4.1, 4.2, 5.2**

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Run `npm test` to verify no regressions
  - Run `npx tsc --noEmit` to verify TypeScript compilation
  - Run `cd src-tauri && cargo check && cargo test` to verify Rust compilation and tests
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (12 total)
- Unit tests validate specific examples and edge cases
- The existing AreaTab is retained as-is — only the outer tab structure changes
- TC data JSON will need to be populated with full D2R v3.2 RotW data before production use; the placeholder in task 1.2 enables development and testing
- Recharts is already in the project dependencies (used by Statistics page)
- `proptest` is already in `src-tauri/Cargo.toml` dev-dependencies
- `fast-check` is already available for frontend property tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.6", "3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3", "4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "6.1"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.5"] },
    { "id": 7, "tasks": ["7.3", "7.4", "7.6", "8.1"] },
    { "id": 8, "tasks": ["10.1", "10.2", "10.3"] }
  ]
}
```
