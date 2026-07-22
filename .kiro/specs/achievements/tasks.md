# Implementation Plan: Achievements

## Overview

Add a per-profile achievement system with four categories (milestone, streak, per-class, per-area), automatic evaluation on run completion, toast notifications, a gallery page with category filtering, and a lifetime statistics dashboard. Backend in Rust (achievements module + SQLite tables), frontend in React/TypeScript with i18n support for en-US, pt-BR, and es locales.

## Tasks

- [x] 1. Backend: Database schema and models
  - [x] 1.1 Add Rust models for achievements to `src-tauri/src/models.rs`
    - Add `AchievementDefinition`, `AchievementUnlock`, `AchievementProgress`, `LifetimeStats`, `ClassCount`, `AreaCount`, `RarityCount` structs with Serialize/Deserialize derives
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 1.2 Create `src-tauri/src/achievements.rs` module with schema migration and seed data
    - Create `achievement_definitions` table with id, category, name_key, description_key, icon, condition_type, condition_target, threshold, sort_order columns
    - Create `achievement_unlocks` table with id, profile_id, definition_id, unlocked_at columns plus FK constraints and UNIQUE index
    - Add `init_achievements(conn)` function called from `init_db`
    - Seed default definitions covering all four categories: milestone (total_runs: 100, 500, 1000, 5000; total_items: 100, 500, 1000; total_time: 50, 100, 500), streak (streak_days: 3, 7, 14, 30), per-class (class_runs: 500, 1000 for each of 8 classes), per-area (area_runs: 100, 500 for Pit, Chaos Sanctuary, Ancient Tunnels, Cow Level, Travincal, Baal)
    - Register module in `src-tauri/src/lib.rs`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 5.1, 6.1, 6.3, 7.1, 7.3_

- [x] 2. Backend: Evaluation logic and Tauri commands
  - [x] 2.1 Implement `evaluate_achievements` logic in `achievements.rs`
    - Query all locked definitions for the given profile
    - Compute profile stats (total_runs, total_items, total_time) from runs/items tables
    - Compute streak from run completion timestamps using local timezone calendar days
    - Compute per-class run counts using profile class field
    - Compute per-area run counts from runs table area field
    - Check each locked definition threshold and insert unlock records for met conditions
    - Return newly unlocked achievements with joined definition data
    - _Requirements: 2.1, 2.2, 2.3, 4.4, 5.2, 5.3, 5.4, 6.2, 7.2_

  - [x] 2.2 Implement `get_achievement_definitions`, `get_achievement_progress`, and `get_lifetime_stats` functions
    - `get_achievement_definitions`: return all rows from achievement_definitions ordered by sort_order
    - `get_achievement_progress`: for each definition, compute current_value and check unlock state for the given profile
    - `get_lifetime_stats`: aggregate total_time_hours, total_runs, total_items, runs_by_class, runs_by_area, items_by_rarity
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 2.3 Register Tauri commands in `commands.rs` and `lib.rs`
    - Add `evaluate_achievements`, `get_achievement_definitions`, `get_achievement_progress`, `get_lifetime_stats` command functions in `commands.rs` delegating to `achievements.rs`
    - Register all four commands in the `invoke_handler` macro in `lib.rs`
    - _Requirements: 2.1, 10.1, 10.2_

  - [x] 2.4 Write property tests for evaluation logic (Rust unit tests)
    - **Property 2: Milestone Threshold Evaluation** — verify unlock iff stat >= threshold for total_runs, total_items, total_time
    - **Property 3: Streak Calculation Correctness** — verify streak counts consecutive calendar days with runs, resets on gaps
    - **Property 4: Per-Class Evaluation** — verify class_runs unlocks only for matching class
    - **Property 5: Per-Area Evaluation** — verify area_runs unlocks only for matching area
    - **Property 6: Batch Evaluation Completeness** — verify single call returns exactly K unlocks when K conditions met
    - **Property 10: Profile Isolation** — verify evaluation uses only the specified profile's data
    - **Validates: Requirements 2.1, 2.2, 2.3, 4.1, 4.4, 5.1, 5.2, 5.4, 6.1, 6.2, 7.1, 7.2, 10.1, 10.2**

- [x] 3. Checkpoint - Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend: TypeScript types and API bindings
  - [x] 4.1 Add TypeScript interfaces to `src/types.ts`
    - Add `AchievementDefinition`, `AchievementUnlock`, `AchievementProgress`, `LifetimeStats`, `AchievementCategory`, and `ACHIEVEMENT_CATEGORIES` constant
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Add API functions to `src/api.ts`
    - Add `evaluateAchievements(profileId)`, `getAchievementDefinitions()`, `getAchievementProgress(profileId)`, `getLifetimeStats(profileId)` invoke wrappers
    - _Requirements: 2.1, 8.1, 9.1_

- [x] 5. Frontend: Toast notification system
  - [x] 5.1 Create `src/hooks/useAchievementToasts.ts` hook
    - Maintain FIFO queue of `AchievementUnlock` items
    - Expose `enqueue(unlocks: AchievementUnlock[])`, `currentToast`, `dismiss()` interface
    - Auto-advance to next queued toast after 300ms gap when current toast dismissed
    - Auto-dismiss active toast after 4 seconds
    - _Requirements: 3.2, 3.4, 3.5_

  - [x] 5.2 Create `src/components/UnlockToast.tsx` component
    - Render achievement name (resolved via `useTranslation`) and icon
    - Play "milestone" sound via Audio element on mount
    - Support click and Escape key to dismiss manually
    - Accessible: role="alert", aria-live="polite"
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 5.3 Write unit tests for useAchievementToasts hook
    - **Property 7: Toast Queue Sequential Display** — verify FIFO ordering and one-at-a-time display
    - Test auto-dismiss timer behavior
    - Test manual dismiss advances queue
    - **Validates: Requirements 3.2, 3.4, 3.5**

- [x] 6. Frontend: Achievements page
  - [x] 6.1 Create `src/pages/Achievements.tsx` page component
    - Category filter tabs: All / Milestone / Streak / Per-Class / Per-Area
    - Achievement gallery grid showing all definitions with locked/unlocked visual states
    - Progress bars for locked achievements (current_value / threshold)
    - Unlock timestamp display for unlocked achievements
    - Lifetime stats dashboard section (total hours, runs, items, class breakdown, area breakdown, rarity breakdown)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 6.2 Write unit tests for Achievements page
    - **Property 1: Category Validation** — verify only valid categories accepted in filter
    - **Property 9: Category Filter Correctness** — verify filtered view shows only matching category
    - **Property 8: Progress Indicator Accuracy** — verify current_value and threshold displayed faithfully
    - Test profile switching shows correct unlock state
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.5, 10.3**

- [x] 7. Frontend: Integration and wiring
  - [x] 7.1 Integrate achievement evaluation into run completion flow
    - In the RunTracker page (or wherever `finishRun` is called), call `evaluateAchievements(profileId)` after successful `finishRun`
    - Feed returned unlocks into the toast queue via `useAchievementToasts`
    - Mount `UnlockToast` component at the App level so it persists across page navigation
    - _Requirements: 2.1, 2.4, 3.1, 3.4_

  - [x] 7.2 Add Achievements page to navigation
    - Add "achievements" to the `Page` type union in `App.tsx`
    - Add lazy import for Achievements page
    - Add sidebar navigation button with icon (🏆) and i18n label
    - Add route case in `renderPage` requiring `selectedProfile`
    - _Requirements: 8.1, 10.3_

- [x] 8. I18n: Achievement translation keys
  - [x] 8.1 Add achievement i18n keys to all three locale files
    - Add `achievements.names.*` and `achievements.descriptions.*` keys to `src/i18n/locales/en-US.json`
    - Add corresponding keys to `src/i18n/locales/pt-BR.json` and `src/i18n/locales/es.json`
    - Add sidebar label key for the achievements page
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 8.2 Write property test for i18n key resolution
    - **Property 11: I18n Key Resolution** — verify every definition's name_key resolves in all three locales, with fallback to en-US
    - **Validates: Requirements 11.1, 11.3**

- [x] 9. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Profile deletion cascade and edge cases
  - [x] 10.1 Verify FK CASCADE handles profile deletion
    - Ensure `achievement_unlocks` table FK `ON DELETE CASCADE` removes unlocks when a profile is deleted
    - Verify in existing `delete_profile` command flow — no additional code needed if FK is correct, otherwise add explicit cleanup
    - _Requirements: 10.4_

  - [x] 10.2 Write integration test for profile deletion cascade
    - Test that deleting a profile removes all associated unlock records
    - Test that achievements page shows empty state for new profile
    - **Validates: Requirements 10.4**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend evaluation logic is the most complex piece — streak calculation and batch evaluation should be validated thoroughly
- Sound file `milestone.mp3` needs to be added to `public/` or `src/assets/` directory

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "4.2"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["5.1", "6.1", "8.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.2", "8.2"] },
    { "id": 6, "tasks": ["7.1", "7.2"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2"] }
  ]
}
```
