# Implementation Plan

## Overview

Fix the Drop Calculator's Probability tab by expanding tc_data.json with comprehensive D2R treasure class data, fixing item TC placement, expanding frontend constants, adding area-based aggregate probability calculation, and adding item search/filter UI. Uses the bug condition methodology: explore the bug → preserve existing behavior → implement fix → validate.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Incomplete TC Data Returns Zero/Error for Valid Combinations
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists in the current tc_data.json
  - **Scoped PBT Approach**: Scope the property to concrete failing cases that should produce valid probabilities but currently don't:
    - `compute_monster_drop_probability("mephisto", "harlequin_crest")` returns 0.0 (Shako qlvl 69 IS reachable from TC78, but placed only in TC84)
    - `compute_monster_drop_probability("diablo", "harlequin_crest")` returns Err("Monster not found: diablo")
    - `compute_monster_drop_probability("baal", "jah_rune")` returns Err("Item not found: jah_rune")
    - `compute_monster_drop_probability("pindleskin", "death's_fathom")` returns Err for both monster and item missing
  - Write property-based test in `src-tauri/src/probability_engine.rs` (test module) using proptest:
    - Define a list of (monster_id, item_id) pairs that SHOULD produce probability > 0 per D2R game rules
    - For each pair, assert: result is Ok AND probability > 0 AND one_in_x > 1.0
    - For pairs with new monsters: assert monster exists in tc_data.monsters
    - For pairs with new items: assert item exists in tc_data.items
  - Also assert frontend coverage: MONSTERS.length >= 10 and ITEMS.length >= 20 (tests can be in `src/pages/DropCalculator.test.tsx`)
  - Run test on UNFIXED code with `cd src-tauri && cargo test bug_condition`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - "Mephisto + Shako returns probability 0 because harlequin_crest is in TC84 not reachable from TC78"
    - "Diablo not found in monsters map"
    - "Jah Rune not found in items map"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Baal/Mephisto/Andariel Calculations Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Step 1 - Observe**: Run the UNFIXED code and record baseline results for all original monster/item pairs:
    - Observe: `compute_monster_drop_probability("baal", "tyrael's_might")` → record exact f64 value
    - Observe: `compute_monster_drop_probability("baal", "harlequin_crest")` → record exact f64 value
    - Observe: `compute_monster_drop_probability("baal", "ber_rune")` → record exact f64 value
    - Observe: `compute_monster_drop_probability("mephisto", "oculus")` → record exact f64 value
    - Observe: `compute_monster_drop_probability("mephisto", "arachnid_mesh")` → record exact f64 value
    - Observe: `compute_monster_drop_probability("andariel", "stone_of_jordan")` → record exact f64 value
    - Observe: `compute_monster_drop_probability("andariel", "vampire_gaze")` → record exact f64 value
  - **Step 2 - Observe modifiers**: Record results with MF/player count variations:
    - Observe: `apply_mf_adjustment(one_in_x, 300, "Unique")` for each original unique item
    - Observe: `adjust_for_player_count(one_in_x, no_drop, total, 8)` for TC87/TC78/TC69
    - Observe: `apply_quest_bonus(per_roll, rolls)` for quest-eligible monsters
    - Observe: `apply_terror_zone(data, "mephisto", "ancient_tunnels", true)` returns "TC87"
    - Observe: `apply_herald_tier(data, "baal", Some(3))` returns ("TC84", 5)
  - **Step 3 - Write property-based tests** in `src-tauri/src/probability_engine.rs` using proptest:
    - Property: For all MF values in [0, 9999], original monster/item pairs produce identical probabilities to recorded baseline
    - Property: For all player counts in [1, 8], original calculations remain monotonically improving (lower 1-in-X)
    - Property: Quest bonus doubles effective rolls and improves probability for eligible monsters
    - Property: Terror zone elevation returns correct TCs for all existing scaling entries
    - Property: Herald tier overrides return correct (tc, rolls) for tiers 1-5
    - Property: Error handling unchanged — invalid MF (>9999), invalid players (0, 9), circular TC refs produce same errors
    - Property: `kills_for_threshold` values are monotonically increasing (50 < 63 < 90 < 99)
  - Run tests on UNFIXED code with `cd src-tauri && cargo test preservation`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for incomplete TC data and missing UI features

  - [x] 3.1 Expand tc_data.json with comprehensive D2R treasure class data
    - Add complete TC hierarchy: TC3 through TC87 with proper sub_tc chains matching D2R game data
    - Add all act bosses: Duriel (TC69), Diablo (TC84), plus ensure Baal/Mephisto/Andariel base_tc values remain unchanged
    - Add super uniques: Pindleskin (TC87), Nihlathak (TC87), Eldritch (TC84), Shenk (TC84), Thresh Socket (TC84), Bonesaw (TC84), Snapchip (TC78), Frozenstein (TC78)
    - Add other farmed monsters: Council Members (TC78), Countess (TC66), Summoner (TC66)
    - Fix item TC placement: harlequin_crest must appear in a TC reachable from TC78 (Mephisto); items placed according to their qlvl and D2R drop tables
    - Add items: high runes (Jah, Lo, Sur, Ohm, Vex, Gul, Ist, Mal, Um, Pul), unique items (Griffon's Eye, Death's Fathom, Death's Web, Crown of Ages, Windforce, Stormshield, War Traveler, Chance Guards, Goldwrap, Tal Rasha's Guardianship, IK Armor), set items, key bases
    - Add `areas` section mapping area IDs to monster compositions for area-based calculation: `{ "chaos_sanctuary": { "monsters": [{"id": "diablo", "weight": 1}, ...], "champion_packs": 3, "unique_packs": 2 } }`
    - Ensure all existing TC87/TC84/TC81/TC78/TC75/TC69 entries retain their current structure (items, weights, sub_tcs, no_drop_weight) — only ADD to them or add new TCs below them
    - _Bug_Condition: isBugCondition(input) where monster not in data OR item not in data OR item in wrong TC_
    - _Expected_Behavior: All legitimate monster/item pairs produce probability > 0 via TC tree traversal_
    - _Preservation: Existing TC87→TC84→TC81→TC78→TC75 chain and TC69→TC75 chain must remain identical; existing item weights and no_drop_weights unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1_

  - [x] 3.2 Add area-based aggregate probability calculation (Rust backend)
    - Extend `TcData` struct in `probability_engine.rs` with `areas: HashMap<String, AreaDef>` field
    - Define `AreaDef` struct: `{ monsters: Vec<AreaMonster>, champion_packs: u8, unique_packs: u8 }`
    - Define `AreaMonster` struct: `{ id: String, weight: u32 }`
    - Implement `compute_area_drop_probability(tc_data, area_id, item_id, mf, players, quest_bonus)` that:
      - Iterates over all monsters in the area with their spawn weights
      - Computes individual monster probabilities using existing `compute_monster_drop_probability`
      - Aggregates: `P(area) = 1 - ∏(1 - P(monster_i))` for a single run through the area
    - Add new Tauri command `calculate_area_drop_probability` in `drop_commands.rs`
    - _Bug_Condition: No area-based calculation existed_
    - _Expected_Behavior: Area selection produces aggregate probability > max(individual monster probs)_
    - _Preservation: Existing calculate_drop_probability command unchanged_
    - _Requirements: 1.5, 2.5_

  - [x] 3.3 Expand frontend MONSTERS and ITEMS constants
    - Update `MONSTERS` array in `src/pages/DropCalculator.tsx` to include all monsters added to tc_data.json, grouped by act:
      - Act 1: Andariel, Countess
      - Act 2: Duriel, Summoner
      - Act 3: Mephisto, Council Members
      - Act 4: Diablo
      - Act 5: Baal, Pindleskin, Nihlathak, Eldritch, Shenk, Thresh Socket, Bonesaw, Snapchip, Frozenstein
    - Update `ITEMS` array to include all items added to tc_data.json with proper rarity tags
    - Update `MONSTER_AREA_MAP` with area mappings for all new monsters
    - Ensure existing 3 monsters and 7 items remain in the arrays with unchanged IDs
    - _Bug_Condition: MONSTERS had 3 entries, ITEMS had 7 entries_
    - _Expected_Behavior: MONSTERS.length >= 10, ITEMS.length >= 20_
    - _Preservation: Existing monster IDs (mephisto, baal, andariel) and item IDs unchanged_
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.1_

  - [x] 3.4 Add item search/filter UI
    - Replace plain `<select>` for items with a searchable component in ProbabilityTab:
      - Text input with `aria-label` for filtering items by name substring
      - Rarity filter buttons (All, Unique, Set, Rune) with `role="radiogroup"` and `aria-pressed`
      - Filtered results displayed as selectable list or filtered dropdown
    - Ensure keyboard navigation (arrow keys, Enter to select, Escape to close)
    - Ensure all interactive elements have proper ARIA attributes
    - _Bug_Condition: No search/filter existed for items_
    - _Expected_Behavior: User can type to filter items and filter by rarity category_
    - _Preservation: Selected item state still drives probability calculation_
    - _Requirements: 1.6, 2.6_

  - [x] 3.5 Add area-based calculation mode to frontend
    - Add "Area" tab/mode to ProbabilityTab alongside existing monster/item mode
    - Area mode UI: area dropdown (from tc_data areas), item selector (reuse search/filter component), MF/player count inputs
    - Call `calculate_area_drop_probability` Tauri command and display:
      - Aggregate per-run probability
      - Per-monster breakdown showing individual contribution
      - Distribution chart for area runs
    - _Bug_Condition: No area-based UI mode existed_
    - _Expected_Behavior: User selects area + item and sees aggregate probability with breakdown_
    - _Preservation: Existing probability tab single-monster mode unchanged_
    - _Requirements: 1.5, 2.5_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Expanded Data Produces Valid Probabilities
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: all test monster/item pairs produce probability > 0
    - Run bug condition exploration test: `cd src-tauri && cargo test bug_condition`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - items are reachable, monsters exist, items exist)
    - Also verify frontend assertions: MONSTERS.length >= 10, ITEMS.length >= 20
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Calculations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests: `cd src-tauri && cargo test preservation`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to existing Baal/Mephisto/Andariel calculations)
    - Confirm all existing test suite passes: `cd src-tauri && cargo test`
    - Confirm all modifier behaviors identical for original monster/item pairs
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full Rust test suite: `cd src-tauri && cargo test`
  - Run full frontend test suite: `npm test`
  - Run TypeScript compilation: `npx tsc --noEmit`
  - Run Rust check: `cd src-tauri && cargo check`
  - Run Vite build: `npx vite build`
  - Ensure all property-based tests pass (both bug condition and preservation)
  - Ensure no regressions in existing test files
  - Ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["3.5"] },
    { "id": 5, "tasks": ["3.6", "3.7"] },
    { "id": 6, "tasks": ["4"] }
  ]
}
```

- Wave 1-2: Bug condition and preservation tests must be written BEFORE any implementation
- Wave 3: tc_data.json expansion is the foundation for all other fix tasks
- Wave 4: Area backend (3.2), frontend constants (3.3), and item search UI (3.4) can run in parallel after data expansion
- Wave 5: Area frontend (3.5) depends on area backend command (3.2) and search component (3.4)
- Wave 6: Verification tasks (3.6, 3.7) run AFTER all implementation
- Wave 7: Final checkpoint ensures everything passes together

## Notes

- The core probability engine algorithms (`compute_item_probability`, `apply_mf_adjustment`, `adjust_for_player_count`, `apply_quest_bonus`) are NOT being modified — this is a data completeness and UI feature gap fix
- The `tc_data.json` file is loaded via `include_str!` at compile time, so changes require a Rust rebuild
- Property-based tests use the `proptest` crate already present in the Rust workspace
- Frontend tests use Vitest (configured in package.json)
- All UI changes must follow accessibility guidelines (ARIA attributes, keyboard navigation)
