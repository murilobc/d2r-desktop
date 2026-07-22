# Requirements Document

## Introduction

The Runeword Planner & Rune Inventory feature adds a dedicated "Runes" tab to the D2R Desktop application that tracks the user's rune stock across profiles and calculates which runewords are available or partially complete. It integrates with the existing item logging system to auto-update counts when runes are found during farming runs, and provides a cube upgrade calculator to help plan rune-up paths. The feature covers all 33 D2R runes (El through Zod) and all ~99 runewords including the 5 Reign of the Warlock additions.

## Glossary

- **Rune_Inventory**: A per-profile collection tracking the quantity of each of the 33 runes the user currently holds in their stash
- **Runeword_Recipe**: A static data record defining which runes (and in what quantity) are required to create a specific runeword
- **Eligibility_Engine**: The computation module that compares the current Rune_Inventory against all Runeword_Recipes to determine which runewords can be created
- **Rune_Grid**: The UI panel displaying all 33 runes in a grid layout with per-rune count indicators
- **Progress_View**: A UI section showing selected target runewords with percent completion and highlighting of missing runes
- **Cube_Calculator**: A computation module that determines how many lower-tier runes are needed to upgrade (via Horadric Cube recipes) to a target rune
- **Rune_Level**: The numeric tier of a rune from 1 (El) to 33 (Zod), determining its position in the upgrade hierarchy
- **Profile**: An existing application entity representing a single D2R character with its own farming data
- **Item_Log_Event**: The existing system event triggered when a user logs a found item during a farming run
- **Runeword_Planner_Page**: The dedicated page accessible from the sidebar navigation under the "Runes" tab

## Requirements

### Requirement 1: Rune Inventory Storage

**User Story:** As a player, I want my rune counts tracked per profile so that I know exactly how many of each rune I have in my stash.

#### Acceptance Criteria

1. THE Rune_Inventory SHALL store an integer count for each of the 33 runes (El through Zod) per Profile
2. THE Rune_Inventory SHALL initialize all rune counts to zero when a new Profile is created
3. WHEN the user manually increments a rune count, THE Rune_Inventory SHALL increase that rune count by one
4. WHEN the user manually decrements a rune count, THE Rune_Inventory SHALL decrease that rune count by one
5. THE Rune_Inventory SHALL enforce a minimum count of zero for each rune
6. THE Rune_Inventory SHALL persist rune counts in the SQLite database so that data survives application restarts

### Requirement 2: Auto-Increment on Item Logging

**User Story:** As a player, I want my rune inventory to update automatically when I log a rune drop during a farming run, so that I do not have to update counts in two places.

#### Acceptance Criteria

1. WHEN an Item_Log_Event occurs with item_type "Rune" and rarity "Rune", THE Rune_Inventory SHALL increment the count for the corresponding rune by one
2. WHEN a logged rune item is deleted from the items list, THE Rune_Inventory SHALL decrement the count for the corresponding rune by one
3. THE Rune_Inventory SHALL match the rune name from the Item_Log_Event to the correct rune by stripping the " Rune" suffix from the item name

### Requirement 3: Rune Grid Display

**User Story:** As a player, I want to see all 33 runes in a visual grid with their counts so that I can quickly assess my rune collection at a glance.

#### Acceptance Criteria

1. THE Rune_Grid SHALL display all 33 runes ordered by Rune_Level from El (1) to Zod (33)
2. THE Rune_Grid SHALL show the current count next to each rune name
3. THE Rune_Grid SHALL provide increment and decrement buttons for each rune to allow manual adjustment
4. WHEN a rune count is zero, THE Rune_Grid SHALL visually distinguish that rune from runes with positive counts
5. THE Rune_Grid SHALL be accessible from a dedicated "Runes" tab in the application sidebar navigation

### Requirement 4: Runeword Eligibility Calculation

**User Story:** As a player, I want to see which runewords I can make right now with my current rune stock, so that I can decide what to craft.

#### Acceptance Criteria

1. THE Eligibility_Engine SHALL compare the current Rune_Inventory counts against all Runeword_Recipes
2. WHEN the Rune_Inventory contains sufficient runes for a Runeword_Recipe, THE Eligibility_Engine SHALL mark that runeword as "craftable"
3. THE Eligibility_Engine SHALL account for runewords that require multiple copies of the same rune
4. WHEN the Rune_Inventory changes, THE Eligibility_Engine SHALL recalculate eligibility without requiring a page refresh
5. THE Eligibility_Engine SHALL cover all runewords in the database including the 5 Reign of the Warlock runewords (Authority, Coven, Void, Vigilance, Ritual)

### Requirement 5: Runeword Progress Tracking

**User Story:** As a player, I want to select target runewords and see how close I am to completing them, so that I can prioritize my farming.

#### Acceptance Criteria

1. THE Progress_View SHALL allow the user to select one or more runewords as targets
2. WHEN a target runeword is selected, THE Progress_View SHALL display the percentage of required runes the user currently possesses
3. THE Progress_View SHALL highlight which specific runes are missing for each target runeword
4. THE Progress_View SHALL display the count needed versus count owned for each rune in the recipe
5. THE Progress_View SHALL persist selected target runewords per Profile so that selections survive application restarts
6. WHEN the Rune_Inventory changes, THE Progress_View SHALL update the completion percentage in real time

### Requirement 6: Cube Upgrade Calculator

**User Story:** As a player, I want to know how many lower runes I need to cube up to a target rune, so that I can plan my upgrade paths.

#### Acceptance Criteria

1. WHEN the user selects a target rune, THE Cube_Calculator SHALL compute the total number of lower-tier runes needed to reach that rune via Horadric Cube upgrade recipes
2. THE Cube_Calculator SHALL apply the correct upgrade ratios: 3-to-1 for runes El through Thul, 3-to-1 plus a gem for runes Amn through Sol to Amn (standard), and 2-to-1 plus a gem for runes Pul through Zod
3. THE Cube_Calculator SHALL display the upgrade path as a breakdown showing intermediate rune quantities at each tier
4. THE Cube_Calculator SHALL account for runes already in the Rune_Inventory when computing remaining runes needed
5. IF the user already possesses the target rune, THEN THE Cube_Calculator SHALL indicate that no upgrades are necessary

### Requirement 7: Runeword Recipe Data

**User Story:** As a player, I want the app to contain accurate runeword recipe data so that eligibility and progress calculations are correct.

#### Acceptance Criteria

1. THE Runeword_Recipe data SHALL include the exact rune sequence for each of the ~99 runewords in the database
2. THE Runeword_Recipe data SHALL include the valid base item types (weapon, armor, shield, helmet) for each runeword
3. THE Runeword_Recipe data SHALL include the required number of sockets for each runeword
4. THE Runeword_Recipe data SHALL include all 5 Reign of the Warlock runewords: Authority, Coven, Void, Vigilance, Ritual

### Requirement 8: Navigation and Page Structure

**User Story:** As a player, I want the Runeword Planner on its own dedicated page separate from the items page, so that rune tracking has its own focused workspace.

#### Acceptance Criteria

1. THE Runeword_Planner_Page SHALL be accessible from a "Runes" entry in the sidebar navigation
2. THE Runeword_Planner_Page SHALL be separate from the existing items/history pages
3. THE Runeword_Planner_Page SHALL load lazily following the existing application pattern for page loading
4. THE Runeword_Planner_Page SHALL display the Rune_Grid, the craftable runewords list, the Progress_View, and the Cube_Calculator in an organized layout
5. THE Runeword_Planner_Page SHALL operate within the context of the currently active Profile

### Requirement 9: Cloud Sync Compatibility

**User Story:** As a player who uses multiple machines, I want my rune inventory data to sync across devices through the existing cloud sync system.

#### Acceptance Criteria

1. THE Rune_Inventory data SHALL be included in the existing export/import data format
2. WHEN a cloud sync push occurs, THE Rune_Inventory data SHALL be included in the sync payload
3. WHEN a cloud sync pull occurs, THE Rune_Inventory data SHALL be restored from the sync payload
4. THE Rune_Inventory sync SHALL preserve per-profile rune counts accurately

### Requirement 10: Internationalization Support

**User Story:** As a non-English-speaking player, I want the Runeword Planner UI labels and messages translated into my language.

#### Acceptance Criteria

1. THE Runeword_Planner_Page SHALL use translation keys for all static UI labels, buttons, and messages via the existing react-i18next system
2. THE Runeword_Planner_Page SHALL provide translations for en-US, pt-BR, and es locales
3. THE Runeword_Planner_Page SHALL keep rune names and runeword names in their original English form (these are proper nouns in the game)
