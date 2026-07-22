# Requirements Document

## Introduction

The Drop Probability Engine replaces the existing DropCalculator page with an upgraded, unified drop probability system. The core computation (treasure class tree traversal and probability math) runs in Rust via Tauri commands, with TC data embedded as static compiled data in the Rust binary. The frontend provides rich Recharts visualizations including probability distribution curves, expected-vs-actual overlays, and a luck percentile gauge. The engine integrates with existing farming history data to provide "runs until likely drop" estimations and expected-vs-actual comparisons.

## Glossary

- **Probability_Engine**: The Rust backend module that performs treasure class tree traversal and drop probability calculations, exposed via Tauri commands
- **Drop_Calculator_Page**: The React frontend page that replaces the existing DropCalculator, providing input controls and visualizations for drop probability analysis
- **TC_Data**: Treasure Class data from D2R game files (TreasureClassEx equivalent) embedded as static compiled data in the Rust binary
- **MF_Adjustment**: Magic Find percentage modifier that increases the probability of finding Unique and Set items but does not affect Rune drops
- **Player_Count**: The /players setting (1–8) that affects no-drop probability and effective drop rates
- **Quest_Bonus**: The doubled drop rolls granted on first kill of certain act bosses (Andariel bug, etc.)
- **Area_Level**: The monster level of a given area in Hell difficulty, which determines the maximum Treasure Class that can drop
- **TC_Tree**: The hierarchical structure of Treasure Classes where each node can reference sub-TCs or item groups with weighted probabilities
- **Luck_Percentile**: A statistical measure showing where a player's actual drop results fall on a normal distribution compared to expected probability
- **Terror_Zone**: Reign of the Warlock (RotW) feature that elevates an area's monster levels and modifies its effective Treasure Class
- **Herald_Drop**: Special drop mechanic from Herald of the Warlock encounters with tier-specific TC modifications
- **Run_Speed**: The average duration of a farming run for a given area, derived from the user's historical run data

## Requirements

### Requirement 1: Per-Kill Probability Calculation

**User Story:** As a farmer, I want to see the exact probability of an item dropping from a specific monster given my current setup, so that I can make informed decisions about where to farm.

#### Acceptance Criteria

1. WHEN a user selects a monster and item combination, THE Probability_Engine SHALL compute the per-kill drop probability by traversing the TC_Tree from the monster's base TC to the target item.
2. WHEN a user specifies a Magic Find percentage between 0 and 9999, THE Probability_Engine SHALL apply MF_Adjustment using the formula: Effective MF = (MF × Factor) / (MF + Factor), where Factor is 250 for Unique items and 500 for Set items.
3. WHEN a user specifies a Player_Count between 1 and 8, THE Probability_Engine SHALL adjust the no-drop probability according to the standard D2R no-drop formula.
4. WHEN a user enables Quest_Bonus for a supported boss, THE Probability_Engine SHALL double the effective drop rolls in the probability calculation.
5. WHEN the target item rarity is Rune, THE Probability_Engine SHALL return the base probability without applying any MF_Adjustment.
6. THE Probability_Engine SHALL return probability results as a rational fraction (1 in X) with precision to at least 6 significant digits.

### Requirement 2: Static TC Data Embedding

**User Story:** As a developer, I want TC data compiled into the Rust binary, so that the app requires no external data files or network requests for probability calculations.

#### Acceptance Criteria

1. THE Probability_Engine SHALL embed TC_Data as static compiled data in the Rust binary using include_str! or serde deserialization at build time.
2. THE TC_Data SHALL include all D2R v3.2 Reign of the Warlock treasure class entries, item groups, and their weighted probabilities.
3. THE TC_Data SHALL include monster-to-TC mappings for all bosses, super uniques, and area monster types available in Hell difficulty.
4. THE Probability_Engine SHALL complete a single per-kill probability calculation within 10 milliseconds on the user's machine.

### Requirement 3: Probability Distribution Visualization

**User Story:** As a farmer, I want to see a visual probability curve for a target item, so that I can understand the distribution of expected outcomes over multiple runs.

#### Acceptance Criteria

1. WHEN a probability calculation completes, THE Drop_Calculator_Page SHALL render a probability distribution curve using Recharts showing the cumulative probability of finding at least one target item over N kills.
2. THE Drop_Calculator_Page SHALL display the number of kills required for 50%, 63% (1 - 1/e), 90%, and 99% confidence thresholds on the distribution curve.
3. WHEN a user hovers over the distribution curve, THE Drop_Calculator_Page SHALL display a tooltip showing the exact cumulative probability and kill count at the cursor position.

### Requirement 4: Runs Until Likely Drop Estimation

**User Story:** As a farmer, I want to know how many real-time runs I need to do before I'm likely to find a target item, so that I can plan my farming sessions.

#### Acceptance Criteria

1. WHEN a probability calculation completes and the user has historical run data for the selected area, THE Drop_Calculator_Page SHALL compute a "runs until likely drop" estimate using the user's average Run_Speed from the statistics system.
2. WHEN computing the estimation, THE Drop_Calculator_Page SHALL display the estimated number of runs and the estimated real time (hours and minutes) to reach 63% cumulative probability.
3. IF the user has no historical run data for the selected area, THEN THE Drop_Calculator_Page SHALL display the runs-to-find estimate without a time estimate and prompt the user to farm the area to generate time data.

### Requirement 5: Expected vs Actual Comparison

**User Story:** As a farmer, I want to compare my actual drop results against the mathematically expected outcomes, so that I can see if I'm running lucky or unlucky.

#### Acceptance Criteria

1. WHEN a user selects a monster and item combination with existing farming data, THE Drop_Calculator_Page SHALL query the statistics system for the actual count of that item found and total kills performed.
2. THE Drop_Calculator_Page SHALL render an expected-vs-actual overlay chart using Recharts, plotting the expected cumulative drops against the actual cumulative drops over the user's kill history.
3. THE Drop_Calculator_Page SHALL display a textual summary comparing actual drops to expected drops (e.g., "Found 2× but expected ~1.3× in 500 runs — running above average").
4. WHEN actual drops deviate from expected, THE Drop_Calculator_Page SHALL display a Luck_Percentile gauge showing where the user's results fall on the probability distribution (0th to 100th percentile).

### Requirement 6: Terror Zone TC Modifications

**User Story:** As a farmer, I want the probability engine to account for Terror Zone level scaling, so that I get accurate drop rates when farming terrorized areas.

#### Acceptance Criteria

1. WHEN a user selects an area that is designated as a Terror_Zone, THE Probability_Engine SHALL recalculate the effective Area_Level and resulting TC based on Terror Zone scaling rules.
2. WHEN computing drop probability for a terrorized area, THE Probability_Engine SHALL use the elevated TC that corresponds to the Terror Zone monster level rather than the base area TC.
3. THE TC_Data SHALL include Terror Zone level scaling tables for all eligible areas in D2R v3.2 RotW.

### Requirement 7: Herald Drop TC Modifications

**User Story:** As a farmer, I want the probability engine to handle Herald encounter drops correctly, so that I can evaluate Herald farming viability.

#### Acceptance Criteria

1. WHEN a user selects a Herald encounter as the drop source, THE Probability_Engine SHALL apply the tier-specific TC modifications for Herald_Drop calculations.
2. THE TC_Data SHALL include Herald encounter TC tables for all tiers (1 through 5) as defined in D2R v3.2 RotW.

### Requirement 8: Page Replacement and Navigation

**User Story:** As a user, I want the new drop probability page to replace the old drop calculator seamlessly, so that I have a single upgraded experience.

#### Acceptance Criteria

1. THE Drop_Calculator_Page SHALL replace the existing DropCalculator page at the same navigation route.
2. THE Drop_Calculator_Page SHALL retain the existing area browser functionality (area level, TC, notable drops, tips) from the current DropCalculator.
3. THE Drop_Calculator_Page SHALL support tab-based navigation between area browsing, probability calculation, and expected-vs-actual comparison sections.

### Requirement 9: Internationalization

**User Story:** As a non-English-speaking user, I want the drop probability page to support my locale, so that I can understand all labels and descriptions.

#### Acceptance Criteria

1. THE Drop_Calculator_Page SHALL use i18n translation keys for all user-visible text including labels, descriptions, tooltips, and error messages.
2. THE Drop_Calculator_Page SHALL support the three configured locales: en-US, pt-BR, and es.
3. WHEN displaying numeric probability values, THE Drop_Calculator_Page SHALL format numbers according to the active locale using the existing i18n formatters.

### Requirement 10: Input Validation and Error Handling

**User Story:** As a user, I want clear feedback when I provide invalid inputs, so that I understand how to use the calculator correctly.

#### Acceptance Criteria

1. IF a user provides a Magic Find value outside the range 0 to 9999, THEN THE Drop_Calculator_Page SHALL display a validation error and prevent the calculation from executing.
2. IF the Probability_Engine encounters a TC_Tree traversal error (missing TC reference or circular dependency), THEN THE Probability_Engine SHALL return a descriptive error message to the frontend without crashing.
3. IF the Probability_Engine receives an unknown monster or item identifier, THEN THE Probability_Engine SHALL return an error indicating the identifier is not found in TC_Data.
