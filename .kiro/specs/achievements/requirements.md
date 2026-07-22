# Requirements Document

## Introduction

This feature adds a per-profile achievement system to the D2R Tracker desktop application. Achievement definitions are stored in SQLite and evaluated in batch at run or session completion. Achievements span four categories: milestone (run counts, item counts, time played), streak (consecutive sessions with activity), per-class (run thresholds per character class), and per-area (run thresholds per area). Unlocked achievements trigger an auto-dismissing toast notification with a sound cue. A dedicated Achievements page displays the full achievement gallery alongside a lifetime statistics dashboard. Each profile earns achievements independently. The feature supports i18n for en-US, pt-BR, and es locales. No external sharing is provided.

## Glossary

- **Achievement_Engine**: The Rust backend module responsible for storing achievement definitions, tracking unlock state per profile, and evaluating unlock conditions against profile statistics.
- **Achievement_Definition**: A record in SQLite describing a single achievement — including its identifier, category, display name, description, icon reference, unlock condition, and threshold value.
- **Achievement_Unlock**: A record in SQLite associating a profile with an Achievement_Definition, including the timestamp of unlock.
- **Achievement_Category**: One of four classification groups for achievements: milestone, streak, per-class, or per-area.
- **Unlock_Toast**: An auto-dismissing notification component displayed in the UI when an achievement is unlocked, visible for 3 to 5 seconds.
- **Lifetime_Stats_Dashboard**: A section on the Achievements page summarizing career-wide statistics for the active profile (total hours, total runs, total items, class breakdown, area breakdown).
- **Profile**: An existing D2R Tracker character profile that owns runs, items, and achievement progress independently.
- **I18n_System**: The existing react-i18next framework providing localized strings for UI text.

## Requirements

### Requirement 1

**User Story:** As a player, I want achievement definitions stored in the database so that new achievements can be added or updated without code changes.

#### Acceptance Criteria

1. THE Achievement_Engine SHALL store all Achievement_Definitions in a dedicated SQLite table containing columns for id, category, name_key, description_key, icon, condition_type, condition_target, and threshold.
2. THE Achievement_Engine SHALL support four Achievement_Category values: milestone, streak, per-class, and per-area.
3. WHEN the application database is initialized or migrated, THE Achievement_Engine SHALL seed a default set of Achievement_Definitions covering all four categories.
4. THE Achievement_Engine SHALL reference translatable string keys (name_key, description_key) in Achievement_Definitions rather than hardcoded display text.

### Requirement 2

**User Story:** As a player, I want achievements evaluated automatically after I finish a run or session, so that I receive unlocks without manual action.

#### Acceptance Criteria

1. WHEN a run is completed (finish_run command returns successfully), THE Achievement_Engine SHALL evaluate all locked Achievement_Definitions for the active Profile against current profile statistics.
2. WHEN an Achievement_Definition condition is met for a Profile that has not previously unlocked that achievement, THE Achievement_Engine SHALL create an Achievement_Unlock record with the current timestamp.
3. THE Achievement_Engine SHALL evaluate achievements in batch — checking all pending definitions in a single pass per trigger event.
4. THE Achievement_Engine SHALL NOT evaluate achievements during run creation, item logging, or other events outside of run/session completion.

### Requirement 3

**User Story:** As a player, I want to see a toast notification when I unlock an achievement, so that I feel rewarded in the moment.

#### Acceptance Criteria

1. WHEN an Achievement_Unlock is created, THE Unlock_Toast SHALL display the achievement name and icon within 500 milliseconds of the unlock event.
2. THE Unlock_Toast SHALL auto-dismiss after a duration between 3 and 5 seconds without requiring user interaction.
3. WHEN the Unlock_Toast is displayed, THE Achievement_Engine SHALL invoke playSound with the argument "milestone".
4. WHEN multiple achievements are unlocked in a single batch evaluation, THE Unlock_Toast SHALL queue notifications and display them sequentially — each toast appearing after the previous one dismisses.
5. THE Unlock_Toast SHALL be dismissible by clicking or pressing Escape before the auto-dismiss timer completes.

### Requirement 4

**User Story:** As a player, I want milestone achievements that reward cumulative activity (run counts, item counts, time played), so that long-term farming effort is recognized.

#### Acceptance Criteria

1. THE Achievement_Engine SHALL define milestone achievements that trigger when a Profile reaches specified total run count thresholds (e.g., 100, 500, 1000, 5000 runs).
2. THE Achievement_Engine SHALL define milestone achievements that trigger when a Profile reaches specified total item count thresholds.
3. THE Achievement_Engine SHALL define milestone achievements that trigger when a Profile reaches specified cumulative play time thresholds.
4. WHEN evaluating milestone achievements, THE Achievement_Engine SHALL compare the Profile lifetime statistic against the Achievement_Definition threshold value.

### Requirement 5

**User Story:** As a player, I want streak achievements that reward consecutive sessions with activity, so that daily consistency is recognized.

#### Acceptance Criteria

1. THE Achievement_Engine SHALL define streak achievements that trigger when a Profile completes runs in a specified number of consecutive calendar days.
2. WHEN evaluating streak achievements, THE Achievement_Engine SHALL calculate the current consecutive-day streak for the Profile based on run completion timestamps.
3. THE Achievement_Engine SHALL define a calendar day boundary using the local system timezone of the user.
4. IF a Profile has no completed runs for a calendar day, THEN THE Achievement_Engine SHALL reset the consecutive-day streak counter to zero for subsequent evaluations.

### Requirement 6

**User Story:** As a player, I want per-class achievements that reward dedication to a specific character class, so that mastery of a single class is recognized.

#### Acceptance Criteria

1. THE Achievement_Engine SHALL define per-class achievements that trigger when a Profile associated with a specific character class reaches a run count threshold (e.g., 1000 runs with Sorceress).
2. WHEN evaluating per-class achievements, THE Achievement_Engine SHALL use the class field of the active Profile to match against the Achievement_Definition condition_target.
3. THE Achievement_Engine SHALL provide per-class achievements for each of the eight character classes defined in the application (Amazon, Necromancer, Barbarian, Sorceress, Paladin, Druid, Assassin, Warlock).

### Requirement 7

**User Story:** As a player, I want per-area achievements that reward running a specific area many times, so that dedication to a farming spot is recognized.

#### Acceptance Criteria

1. THE Achievement_Engine SHALL define per-area achievements that trigger when a Profile reaches a run count threshold in a specific area (e.g., 500 runs in Pit).
2. WHEN evaluating per-area achievements, THE Achievement_Engine SHALL count completed runs filtered by the area field matching the Achievement_Definition condition_target.
3. THE Achievement_Engine SHALL provide per-area achievements for commonly farmed areas including Pit, Chaos Sanctuary, Ancient Tunnels, Cow Level, Travincal, and Baal.

### Requirement 8

**User Story:** As a player, I want to view all achievements and my unlock progress on a dedicated Achievements page, so that I can track what I have earned and what remains.

#### Acceptance Criteria

1. WHEN a user navigates to the Achievements page, THE Achievement_Engine SHALL display all Achievement_Definitions grouped by Achievement_Category.
2. THE Achievements page SHALL visually distinguish unlocked achievements from locked achievements for the active Profile.
3. WHEN an achievement is unlocked, THE Achievements page SHALL display the unlock timestamp alongside the achievement.
4. THE Achievements page SHALL display progress indicators for locked achievements showing current value versus the required threshold (e.g., "342 / 500 runs").
5. THE Achievements page SHALL allow filtering achievements by Achievement_Category.

### Requirement 9

**User Story:** As a player, I want a lifetime statistics dashboard on the Achievements page, so that I can see a career summary of my farming activity.

#### Acceptance Criteria

1. THE Lifetime_Stats_Dashboard SHALL display total play time in hours for the active Profile.
2. THE Lifetime_Stats_Dashboard SHALL display total completed run count for the active Profile.
3. THE Lifetime_Stats_Dashboard SHALL display total items found for the active Profile.
4. THE Lifetime_Stats_Dashboard SHALL display a breakdown of runs by character class for the active Profile.
5. THE Lifetime_Stats_Dashboard SHALL display a breakdown of runs by area for the active Profile.
6. THE Lifetime_Stats_Dashboard SHALL display items found grouped by rarity for the active Profile.

### Requirement 10

**User Story:** As a player, I want achievements to be per-profile so that each character earns progress independently.

#### Acceptance Criteria

1. THE Achievement_Engine SHALL store Achievement_Unlock records scoped to a specific Profile identifier.
2. WHEN evaluating achievements, THE Achievement_Engine SHALL use statistics from only the active Profile — not aggregated across profiles.
3. WHEN a user switches the active Profile, THE Achievements page SHALL display the unlock state and progress for the newly selected Profile.
4. WHEN a Profile is deleted, THE Achievement_Engine SHALL delete all associated Achievement_Unlock records.

### Requirement 11

**User Story:** As a user, I want achievement names and descriptions displayed in my selected language, so that the achievement system respects my locale preference.

#### Acceptance Criteria

1. WHEN rendering achievement names and descriptions, THE I18n_System SHALL resolve the name_key and description_key from the Achievement_Definition through the active locale Translation_File.
2. THE I18n_System SHALL provide translations for all achievement name_key and description_key values in en-US, pt-BR, and es locales.
3. WHEN a translation key for an achievement is missing, THE I18n_System SHALL fall back to the English (en-US) translation.
