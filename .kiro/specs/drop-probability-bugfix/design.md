# Drop Probability Bugfix Design

## Overview

The Drop Calculator's Probability tab is non-functional for most monster/item combinations because `tc_data.json` contains only a skeleton dataset (3 monsters, 8 items, 6 treasure classes). The fix expands the data to comprehensively cover D2R's treasure class hierarchy, adds missing monsters and items to both the backend data and frontend constants, introduces area-based aggregate probability calculation, and adds item filtering/search to the UI. The core probability engine algorithms remain unchanged — this is a data completeness and UI feature gap, not an algorithmic bug.

## Glossary

- **Bug_Condition (C)**: The condition where a user selects a monster/item combination that should produce a valid probability but either returns 0 (item falsely unreachable) or the monster/item doesn't exist in the data at all
- **Property (P)**: For any monster/item pair where the item is legitimately reachable through the monster's TC chain, the system calculates and displays a probability > 0
- **Preservation**: Existing Baal calculations, TC tree traversal algorithm, MF application, player count adjustment, quest bonus, terror zone, herald tier modifiers, distribution charts, and error handling must remain unchanged
- **tc_data.json**: The backend data file (`src-tauri/data/tc_data.json`) containing treasure class definitions, monster entries, and item entries — compiled into the binary via `include_str!`
- **TC (Treasure Class)**: A hierarchical grouping system where each TC contains direct items with weights, references to sub-TCs, and a NoDrop weight. Monsters reference a base_tc as their drop table root.
- **MONSTERS / ITEMS**: Frontend constants in `src/pages/DropCalculator.tsx` that populate the dropdown selectors in the Probability and Comparison tabs
- **probability_engine.rs**: The Rust module (`src-tauri/src/probability_engine.rs`) that loads tc_data.json and provides TC tree traversal, MF adjustment, player count, and cumulative probability functions

## Bug Details

### Bug Condition

The bug manifests when a user selects any monster/item combination where either: (a) the monster is not one of the 3 hardcoded entries, (b) the item is not one of the 7 hardcoded entries, or (c) the item exists in the data but is placed in TCs unreachable from the selected monster's base_tc due to incomplete TC hierarchy. The `calculate_drop_probability` command returns either "Monster not found", "Item not found", or probability = 0 (falsely reporting the item cannot drop).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { monster_id: string, item_id: string }
  OUTPUT: boolean
  
  LET monsterExists = tc_data.monsters.contains(input.monster_id)
  LET itemExists = tc_data.items.contains(input.item_id)
  LET itemReachable = IF monsterExists AND itemExists THEN
    tc_tree_traversal(monster.base_tc, input.item_id) > 0
  ELSE false
  
  LET shouldBeReachable = d2r_game_rules_say_item_drops_from_monster(
    input.monster_id, input.item_id
  )
  
  RETURN (NOT monsterExists AND monster_exists_in_d2r(input.monster_id))
         OR (NOT itemExists AND item_exists_in_d2r(input.item_id))
         OR (monsterExists AND itemExists AND NOT itemReachable AND shouldBeReachable)
END FUNCTION
```

### Examples

- **Mephisto + Harlequin Crest**: Currently returns probability 0 because `harlequin_crest` is placed in TC84 which is above Mephisto's TC78. In reality, Mephisto (TC78) CAN drop Shako because Shako's qlvl 69 is within TC78's reach — the TC hierarchy just doesn't model it correctly.
- **Diablo + Griffon's Eye**: Returns "Monster not found" because Diablo is not in the 3-monster dataset at all, despite being a primary farming target.
- **Baal + Jah Rune**: Returns "Item not found" because Jah Rune isn't in the 7-item dataset, despite being one of the most sought-after drops.
- **Pindleskin + Death's Fathom**: Both monster and item are absent from the data entirely.
- **Area-based (Chaos Sanctuary)**: No mechanism exists to aggregate probabilities across normal/champion/unique monsters in an area.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The TC tree traversal algorithm in `compute_item_probability` must continue to recursively resolve sub-TCs with weight-based probability calculation
- MF diminishing returns formula: `effective_mf = (mf * factor) / (mf + factor)` with factor 250 (Unique) / 500 (Set) must remain the same
- Player count NoDrop reduction using the existing power formula must remain the same
- Quest bonus doubling of effective rolls must remain the same
- Terror zone TC elevation lookup must remain the same
- Herald tier TC/roll override must remain the same
- Cumulative distribution calculation `1 - (1-p)^N` must remain the same
- Kill threshold calculation `ceil(ln(1-threshold) / ln(1-p))` must remain the same
- Error handling for invalid inputs (MF > 9999, players < 1 or > 8, circular TC refs) must remain the same
- Distribution chart rendering and luck gauge display must remain the same

**Scope:**
All inputs that do NOT involve newly-added monsters, items, or the new area-based calculation mode should be completely unaffected by this fix. This includes:
- Existing Baal/Mephisto/Andariel calculations with their current items
- All modifier applications (MF, player count, quest bonus, TZ, herald)
- Chart rendering and run estimate display
- Error messages for invalid parameter ranges

## Hypothesized Root Cause

Based on the bug description, the root causes are:

1. **Incomplete tc_data.json**: The data file is a proof-of-concept skeleton with only 6 TCs (TC87, TC84, TC81, TC78, TC75, TC69), 3 monsters (Baal, Mephisto, Andariel), and 8 items. Real D2R has 30+ commonly farmed monsters, 50+ sought-after items, and a deep TC hierarchy from TC3 to TC87.

2. **Items placed incorrectly in TC hierarchy**: Even for the 3 existing monsters, items are placed at TC levels that don't match D2R game data. For example, Harlequin Crest (qlvl 69) should be reachable from TC78 (Mephisto) but is only placed in TC84.

3. **Hardcoded frontend MONSTERS/ITEMS arrays**: The `DropCalculator.tsx` file has `MONSTERS` (3 entries) and `ITEMS` (7 entries) as `const` arrays, making it impossible for users to select any other monster or item regardless of backend data.

4. **No area-based aggregation**: The system only supports single-monster probability lookups. There is no backend command or frontend UI for calculating aggregate per-run probability across all monsters in a farming area.

5. **No item filtering/search UI**: With an expanded item list (50+ entries), the plain `<select>` dropdown becomes unusable without text search or rarity filtering.

## Correctness Properties

Property 1: Bug Condition - Expanded Data Produces Valid Probabilities

_For any_ monster/item pair where the item is legitimately reachable through the monster's TC chain according to D2R game rules, the fixed system SHALL return a probability > 0 with correct 1-in-X odds derived from the TC tree traversal algorithm applied to the expanded tc_data.json.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Existing Calculations Unchanged

_For any_ input using the original 3 monsters (baal, mephisto, andariel) with the original 7 items and any combination of MF (0-9999), player count (1-8), quest bonus, terror zone, and herald tier, the fixed system SHALL produce the same probability result as the original system, preserving all existing calculation behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src-tauri/data/tc_data.json`

**Specific Changes**:
1. **Expand treasure_classes**: Add complete TC hierarchy from TC3 through TC87 with proper item placement matching D2R game data. Each TC should contain the correct items at correct weights and reference appropriate sub-TCs.

2. **Expand monsters**: Add all act bosses (Duriel, Diablo), super uniques (Pindleskin, Nihlathak, Eldritch, Shenk, Thresh Socket, Bonesaw, Snapchip, Frozenstein), Council Members, Countess, and other commonly farmed monsters with correct base_tc, drop_rolls, area, and quest_bonus_eligible fields.

3. **Expand items**: Add all popular unique items (Griffon's Eye, Death's Fathom, Death's Web, Crown of Ages, Windforce, etc.), set items (Tal Rasha's pieces, IK pieces), high runes (Jah, Lo, Sur, Ohm, Vex, Gul, Ist, Mal, Um), and key bases.

4. **Fix item TC placement**: Ensure items appear in the correct TCs matching D2R's actual drop tables. Harlequin Crest should be reachable from TC78 (Mephisto's base_tc).

5. **Add area monster mapping**: Add an `areas` section mapping area names to their constituent monster types (normal, champion, unique) with spawn weights for area-based aggregate calculation.

---

**File**: `src/pages/DropCalculator.tsx`

**Function**: MONSTERS and ITEMS constants, ProbabilityTab component

**Specific Changes**:
1. **Expand MONSTERS constant**: Add all monsters matching the expanded tc_data.json entries, grouped by act with proper names.

2. **Expand ITEMS constant**: Add all items matching the expanded tc_data.json, with rarity tags for filtering.

3. **Add item search/filter UI**: Replace the plain `<select>` for items with a searchable input (text filter + rarity filter buttons). Keep the component accessible with proper ARIA attributes.

4. **Add area-based calculation mode**: Add an "Area" calculation mode to ProbabilityTab that lets users select an area and target item, then displays aggregate per-run probability considering all monster types in that area.

5. **Expand MONSTER_AREA_MAP**: Add area mappings for all new monsters to enable run estimate lookups.

---

**File**: `src-tauri/src/drop_commands.rs`

**Specific Changes**:
1. **Add area probability command**: Create a new Tauri command `calculate_area_drop_probability` that accepts an area ID and item ID, iterates over all monsters in that area, computes individual probabilities, and aggregates them into a per-run probability.

---

**File**: `src-tauri/src/probability_engine.rs`

**Specific Changes**:
1. **Add area data model**: Extend `TcData` struct with an `areas` field mapping area IDs to area definitions (list of monster references with spawn counts/weights).

2. **Add area aggregate function**: Implement `compute_area_drop_probability` that sums probabilities across all monster types in an area, accounting for champion/unique pack spawn rates.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that attempt to calculate drop probabilities for monster/item combinations that should work but don't. Run these tests on the UNFIXED code to observe failures and confirm the data is incomplete.

**Test Cases**:
1. **Mephisto + Shako Test**: Call `compute_monster_drop_probability("mephisto", "harlequin_crest")` — will return 0 on unfixed code because TC84 is above TC78 in current data (will fail on unfixed code)
2. **Missing Monster Test**: Call `compute_monster_drop_probability("diablo", "harlequin_crest")` — will return "Monster not found" error (will fail on unfixed code)
3. **Missing Item Test**: Call `compute_monster_drop_probability("baal", "jah_rune")` — will return "Item not found" error (will fail on unfixed code)
4. **Frontend Coverage Test**: Assert that MONSTERS.length > 3 and ITEMS.length > 7 (will fail on unfixed code)

**Expected Counterexamples**:
- `compute_monster_drop_probability("mephisto", "harlequin_crest")` returns 0.0 instead of a positive probability
- `compute_monster_drop_probability("diablo", "griffon's_eye")` returns Err("Monster not found: diablo")
- Possible causes: incomplete tc_data.json, items placed in wrong TCs, missing monster/item entries

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL (monster_id, item_id) WHERE isBugCondition(monster_id, item_id) DO
  result := calculate_drop_probability_fixed(monster_id, item_id, default_params)
  ASSERT result.probability > 0
  ASSERT result.one_in_x > 1.0
  ASSERT result.kills_for_50 > 0
  ASSERT result.kills_for_63 > result.kills_for_50
  ASSERT result.kills_for_90 > result.kills_for_63
  ASSERT result.kills_for_99 > result.kills_for_90
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  LET original_monsters = ["baal", "mephisto", "andariel"]
  LET original_items = ["tyrael's_might", "harlequin_crest", "ber_rune", 
                         "stone_of_jordan", "oculus", "arachnid_mesh", "vampire_gaze"]
  FOR ALL m IN original_monsters, i IN original_items DO
    FOR ALL mf IN [0, 100, 300, 500, 9999], players IN [1..8] DO
      ASSERT calculate_original(m, i, mf, players) = calculate_fixed(m, i, mf, players)
    END FOR
  END FOR
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of MF values, player counts, and modifier settings automatically
- It catches edge cases in the probability calculations that manual tests might miss
- It provides strong guarantees that the existing Baal/Mephisto/Andariel calculations are unchanged across the full parameter space

**Test Plan**: Observe behavior on UNFIXED code first for all 3 original monsters with all 7 original items across various MF and player count settings, then write property-based tests capturing that exact behavior on the fixed code.

**Test Cases**:
1. **Baal Calculation Preservation**: For all original items reachable from Baal (TC87), verify probability values match the original code across MF range [0, 9999] and player counts [1, 8]
2. **Mephisto Calculation Preservation**: For items in TC78 subtree (oculus, arachnid_mesh, vampire_gaze), verify probabilities match original across all parameter combinations
3. **Andariel Calculation Preservation**: For items in TC69 subtree (stone_of_jordan, vampire_gaze), verify probabilities match original
4. **Modifier Preservation**: Verify quest bonus, terror zone elevation, and herald tier overrides produce identical results for original monster/item pairs
5. **Error Handling Preservation**: Verify that invalid inputs (MF > 9999, players 0/9, circular TCs) still produce the same error messages

### Unit Tests

- Test that each newly added monster has a valid base_tc that exists in treasure_classes
- Test that each newly added item appears in at least one TC's items array
- Test specific known drop probabilities against reference values (e.g., Shako from Mephisto ≈ 1:1764)
- Test area aggregate calculation produces probability > individual monster probability
- Test item search/filter correctly narrows the displayed list

### Property-Based Tests

- Generate random (monster_id, item_id) pairs from the expanded data and verify: if probability > 0, then all kill thresholds are positive and monotonically increasing (kills_for_50 < kills_for_63 < kills_for_90 < kills_for_99)
- Generate random MF values [0, 9999] for original monster/item pairs and verify results match baseline snapshot
- Generate random player counts [1, 8] for original pairs and verify NoDrop adjustment produces monotonically decreasing 1-in-X values
- Generate random area selections and verify area probability >= max(individual monster probabilities in that area)

### Integration Tests

- Test full flow: select expanded monster → select expanded item → verify probability displays in UI
- Test area-based mode: select area → select item → verify aggregate probability displays with per-monster breakdown
- Test item search: type partial item name → verify dropdown filters correctly
- Test rarity filter: select "Rune" filter → verify only runes shown in dropdown
- Test that distribution chart renders correctly for newly-added monster/item combinations
