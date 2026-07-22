# Implementation Plan: Runeword Planner

## Overview

This plan implements the Runeword Planner feature end-to-end: static game data, Rust backend (SQLite tables + Tauri commands), pure TypeScript logic modules (eligibility engine, cube engine), React UI components, integration with existing item log system, cloud sync extension, and i18n support. Each task builds incrementally so the feature is wirable at each checkpoint.

## Tasks

- [ ] 1. Create static game data files
  - [ ] 1.1 Create `src/data/runes.ts` with all 33 rune definitions
    - Define `RuneDefinition` interface with `name`, `level`, `upgradeRatio`, `requiresGem`
    - Export `RUNE_DEFINITIONS` array (El=1 through Zod=33) with correct upgrade ratios (3:1 for levels 1–10, 3:1 for 11–20, 2:1 for 21–33)
    - Export `RUNE_ORDER` string array for display ordering
    - _Requirements: 7.1, 6.2_

  - [ ] 1.2 Create `src/data/runewords.ts` with all ~99 runeword recipes
    - Define `RunewordRecipe` interface with `name`, `runes`, `bases`, `sockets`
    - Export `RUNEWORD_RECIPES` array covering all runewords including the 5 Reign of the Warlock additions (Authority, Coven, Void, Vigilance, Ritual)
    - Ensure `runes` arrays have length matching `sockets` count for each recipe
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 1.3 Write unit tests for static data integrity
    - Verify all 33 runes present with levels 1-33 in order
    - Verify all ~99 runeword recipes present
    - Verify socket count matches rune array length for each recipe
    - Verify the 5 RotW runewords are included
    - Verify all runes referenced in recipes exist in `RUNE_DEFINITIONS`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 2. Implement pure logic modules
  - [ ] 2.1 Create `src/lib/eligibility-engine.ts`
    - Export `RuneInventory` type as `Record<string, number>`
    - Export `EligibilityResult` interface with `runeword`, `craftable`, `percentComplete`, `missingRunes`
    - Implement `calculateEligibility(inventory, recipes)` — compare inventory against all recipes, mark craftable if all runes met (accounting for duplicates)
    - Implement `calculateProgress(inventory, recipe)` — compute percent complete, missing runes list with needed/have counts
    - _Requirements: 4.1, 4.2, 4.3, 5.2, 5.3, 5.4_

  - [ ]* 2.2 Write property test for eligibility classification (Property 4)
    - **Property 4: Eligibility classification correctness**
    - For arbitrary inventory states and any runeword recipe, assert craftable iff every rune's inventory count ≥ occurrences in recipe
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 2.3 Write property test for progress calculation (Property 5)
    - **Property 5: Progress calculation accuracy**
    - For arbitrary inventory and recipe, assert percentComplete = (sum of min(have, needed) / sum of needed) × 100
    - Assert missingRunes contains exactly those runes where have < needed
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [ ] 2.4 Create `src/lib/cube-engine.ts`
    - Export `UpgradeStep` and `UpgradePath` interfaces
    - Implement `calculateUpgradePath(targetRune, inventory)` — compute tier-by-tier rune requirements using correct ratios (3:1 for El-Sol, 2:1 for Pul-Zod), account for existing inventory runes, mark `alreadyOwned` if target is in inventory
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.5 Write property test for cube upgrade path (Property 6)
    - **Property 6: Cube upgrade path correctness**
    - For any target rune above level 1 with empty inventory, assert correct ratios at each tier and consistent quantities
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 2.6 Write property test for inventory reduces cube cost (Property 7)
    - **Property 7: Inventory reduces cube path cost (metamorphic)**
    - For any target rune and non-empty inventory containing a rune in the path, assert totalBaseRunes ≤ totalBaseRunes with empty inventory
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 6.4**

- [ ] 3. Checkpoint - Core logic verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Rust backend (SQLite tables + Tauri commands)
  - [ ] 4.1 Add database migration for `rune_inventory` and `runeword_targets` tables
    - Add CREATE TABLE statements to `src-tauri/src/db.rs` initialization
    - `rune_inventory`: composite PK `(profile_id, rune_name)`, integer count with DEFAULT 0, FK to profiles with CASCADE
    - `runeword_targets`: TEXT PK `id`, FK profile_id with CASCADE, runeword_name TEXT, created_at TEXT
    - Add indexes on `profile_id` for both tables
    - _Requirements: 1.6, 5.5_

  - [ ] 4.2 Implement rune inventory Tauri commands in `src-tauri/src/commands.rs`
    - Add `RuneCount` and `RunewordTarget` structs with Serialize derive
    - Implement `get_rune_inventory(profile_id)` — SELECT all rows for profile, return Vec<RuneCount>
    - Implement `update_rune_count(profile_id, rune_name, delta)` — upsert with `INSERT OR REPLACE`, clamp count to min 0 via `MAX(0, count + delta)`
    - Implement `set_rune_count(profile_id, rune_name, count)` — direct set with validation (count ≥ 0, valid rune name)
    - Validate rune_name against known 33 runes, return error for invalid names
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

  - [ ] 4.3 Implement runeword target Tauri commands
    - Implement `get_runeword_targets(profile_id)` — SELECT targets for profile
    - Implement `add_runeword_target(profile_id, runeword_name)` — INSERT with UUID, validate runeword_name exists in recipe list
    - Implement `remove_runeword_target(id)` — DELETE by id
    - _Requirements: 5.1, 5.5_

  - [ ] 4.4 Register new commands in Tauri app builder
    - Add all 6 new commands to the `invoke_handler` in `src-tauri/src/main.rs`
    - _Requirements: 1.6, 5.5_

  - [ ]* 4.5 Write Rust unit tests for rune inventory commands
    - Test increment/decrement clamping at zero
    - Test invalid rune name rejection
    - Test upsert behavior (first insert vs update)
    - _Requirements: 1.3, 1.4, 1.5_

- [ ] 5. Checkpoint - Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add TypeScript types and API bindings
  - [ ] 6.1 Add `RuneCount` and `RunewordTarget` types to `src/types.ts`
    - Add interfaces matching Rust structs: `RuneCount { profile_id, rune_name, count }`, `RunewordTarget { id, profile_id, runeword_name, created_at }`
    - _Requirements: 1.1, 5.1_

  - [ ] 6.2 Add API functions to `src/api.ts`
    - Add `getRuneInventory(profileId)` → invoke `get_rune_inventory`
    - Add `updateRuneCount(profileId, runeName, delta)` → invoke `update_rune_count`
    - Add `setRuneCount(profileId, runeName, count)` → invoke `set_rune_count`
    - Add `getRunewordTargets(profileId)` → invoke `get_runeword_targets`
    - Add `addRunewordTarget(profileId, runewordName)` → invoke `add_runeword_target`
    - Add `removeRunewordTarget(id)` → invoke `remove_runeword_target`
    - _Requirements: 1.1, 5.1_

- [ ] 7. Implement React UI components
  - [ ] 7.1 Create `src/components/RuneGrid.tsx`
    - Display all 33 runes in responsive grid ordered by level
    - Show rune name and current count per cell
    - Provide +/- buttons for manual adjustment
    - Visually distinguish zero-count runes (dimmed/muted styling)
    - Ensure buttons have proper accessibility attributes (role, tabIndex, onKeyDown)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 7.2 Create `src/components/EligibilityList.tsx`
    - Consume inventory and recipes, call `calculateEligibility`
    - Display craftable runewords in a filterable/searchable list
    - Show base types and socket count for each runeword
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ] 7.3 Create `src/components/ProgressView.tsx`
    - Show target runewords with completion percentage bar
    - Display per-rune breakdown (needed vs owned) for each target
    - Highlight missing runes visually
    - Provide add/remove target controls
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ] 7.4 Create `src/components/CubeCalculator.tsx`
    - Provide rune selector dropdown for target rune
    - Call `calculateUpgradePath` and display step-by-step breakdown
    - Show intermediate rune quantities at each tier
    - Indicate "no upgrades needed" when target rune already owned
    - Account for current inventory in calculations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 7.5 Create `src/pages/RunewordPlanner.tsx` page component
    - Accept `profile` prop, load inventory and targets on mount via API
    - Orchestrate state: inventory, targets, selected cube target
    - Compose RuneGrid, EligibilityList, ProgressView, CubeCalculator in organized layout
    - Re-fetch inventory on increment/decrement to trigger recalculation in child components
    - _Requirements: 8.2, 8.4, 8.5_

- [ ] 8. Wire navigation and lazy loading
  - [ ] 8.1 Add lazy import and route for RunewordPlanner in `src/App.tsx`
    - Add `const RunewordPlanner = lazy(() => import("./pages/RunewordPlanner"))` 
    - Add "Runes" entry to sidebar navigation
    - Render RunewordPlanner within Suspense with PageSkeleton fallback
    - Pass active profile prop
    - _Requirements: 8.1, 8.2, 8.3, 3.5_

- [ ] 9. Checkpoint - UI rendering verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement auto-increment/decrement integration with item log
  - [ ] 10.1 Add rune auto-sync logic to item creation and deletion flows
    - When `createItem` is called with `item_type: "Rune"` and `rarity: "Rune"`, parse rune name by stripping " Rune" suffix and call `updateRuneCount(profileId, runeName, 1)`
    - When `deleteItem` is called for a rune item, call `updateRuneCount(profileId, runeName, -1)`
    - Wire this into the RunewordPlanner page or a shared hook so inventory updates in real-time
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 10.2 Write property test for rune name parsing (Property 2)
    - **Property 2: Rune name parsing correctness**
    - For any valid rune name, appending " Rune" and stripping the suffix produces the original name
    - For any string not matching "{Name} Rune" pattern, parser returns no match
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 2.3**

  - [ ]* 10.3 Write property test for auto-sync (Property 3)
    - **Property 3: Auto-sync with item log**
    - For any rune item logged, inventory increments by 1; for deletion, decrements by 1 (clamped at 0)
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 10.4 Write property test for inventory operations (Property 1)
    - **Property 1: Inventory operations preserve invariants**
    - For any sequence of increment/decrement operations, final count = initial + sum(deltas) clamped to min 0
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 1.3, 1.4, 1.5**

- [ ] 11. Extend cloud sync for rune data
  - [ ] 11.1 Add rune inventory and runeword targets to sync payload
    - Extend `SyncPayload` interface with `rune_inventory` and `runeword_targets` arrays
    - Add export logic: query rune_inventory and runeword_targets tables during push
    - Add import logic: upsert rune_inventory and runeword_targets during pull
    - Use composite key `{profile_id}:{rune_name}` for rune_inventory sync IDs
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 11.2 Write property test for sync serialization round-trip (Property 9)
    - **Property 9: Sync serialization round-trip**
    - For any valid rune inventory data set, serialize → deserialize produces identical data
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 9.4**

- [ ] 12. Add internationalization support
  - [ ] 12.1 Add i18n keys for runeword planner to all 3 locale files
    - Add keys to `src/i18n/locales/en-US.json`, `pt-BR.json`, and `es.json`
    - Cover all static UI labels: page title, grid headers, buttons (+/-), section titles, empty states, tooltips
    - Keep rune names and runeword names in English (proper nouns)
    - Use `useTranslation` hook in all components for dynamic text
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 13. Final checkpoint - Full feature verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases
- Static data (runes.ts, runewords.ts) is created first since both logic modules and UI depend on it
- Backend is implemented before frontend to enable real API calls during UI development
- The auto-increment integration (task 10) is placed after UI to avoid coupling concerns during initial development

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.4", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5", "2.6", "4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "4.5", "6.1"] },
    { "id": 4, "tasks": ["6.2"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 6, "tasks": ["7.5", "8.1"] },
    { "id": 7, "tasks": ["10.1", "11.1", "12.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4", "11.2"] }
  ]
}
```
