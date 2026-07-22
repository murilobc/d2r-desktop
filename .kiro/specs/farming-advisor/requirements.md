# Requirements Document

## Introduction

The Farming Advisor is a frontend-only, rule-based recommendation system that analyzes the player's historical run, item, and XP data to provide personalized farming guidance. It surfaces a dedicated "Advisor" page in the sidebar, displays a weekly summary on page load, ranks areas by personal efficiency, flags diminishing returns, and offers build-specific Terror Zone recommendations. All computation runs in TypeScript reusing existing Statistics, DetailedRuns, and XP APIs. The feature supports three locales: en-US, pt-BR, and es.

## Glossary

- **Advisor_Page**: The dedicated page accessible from the application sidebar that displays all farming advisor outputs.
- **Advisor_Engine**: The frontend TypeScript module that computes recommendations, rankings, and alerts from existing API data.
- **Area_Ranking**: A sorted list of farming areas ordered by the player's personal efficiency metrics (items/hour, value/hour, XP/hour).
- **Weekly_Summary**: A compact text card shown on Advisor_Page load summarizing the player's farming performance for the past 7 calendar days.
- **Diminishing_Returns_Alert**: A warning displayed when the player has completed 5 or more consecutive runs in the same area with zero item drops.
- **Value_Points**: A numeric score assigned to each item based on its tier (GG=20, High=8, Mid=3, Low=1, Worthless=0) as defined in the item-values module.
- **Terror_Zone_Recommendation**: A suggestion shown when the active Terror Zone has a historical efficiency advantage for the player's current profile.
- **TZ_Tier**: The existing S/A/B/C rating assigned to each Terror Zone in the terror-zones data module.
- **Build_Suggestion**: A farming recommendation tailored to the character class defined on the active profile.
- **Profile**: The user's character configuration including name, class, mode, and magic find value.

## Requirements

### Requirement 1: Advisor Page Navigation

**User Story:** As a player, I want to access the Advisor page from the sidebar, so that I can view personalized farming recommendations.

#### Acceptance Criteria

1. WHEN the user clicks the Advisor entry in the sidebar, THE Advisor_Page SHALL render as the active page content.
2. THE Advisor_Page SHALL be accessible only when a Profile is selected (disabled state otherwise).
3. THE Advisor_Page sidebar entry SHALL display a localized label from the i18n resource bundle for the active locale (en-US, pt-BR, or es).

### Requirement 2: Area Efficiency Ranking

**User Story:** As a player, I want to see my farming areas ranked by personal efficiency, so that I can identify where I perform best.

#### Acceptance Criteria

1. WHEN the Advisor_Page loads, THE Advisor_Engine SHALL compute items per hour, Value_Points per hour, and XP per hour for each area the active Profile has farmed.
2. THE Advisor_Engine SHALL sort areas in descending order by Value_Points per hour as the default ranking.
3. WHEN an area has fewer than 3 completed runs, THE Advisor_Engine SHALL exclude that area from the ranking.
4. THE Advisor_Page SHALL display each ranked area with its items per hour, Value_Points per hour, and XP per hour metrics.
5. WHEN the user selects an alternative sort criterion (items per hour or XP per hour), THE Advisor_Page SHALL re-sort the ranking accordingly.

### Requirement 3: Diminishing Returns Alert

**User Story:** As a player, I want to be alerted when I am overfarming an area, so that I can switch to a more productive location.

#### Acceptance Criteria

1. WHEN the active Profile has 5 or more consecutive completed runs in the same area with zero items logged, THE Advisor_Engine SHALL produce a Diminishing_Returns_Alert for that area.
2. THE Advisor_Page SHALL display the Diminishing_Returns_Alert with the area name and the count of consecutive dry runs.
3. THE Advisor_Page SHALL suggest the top-ranked alternative area from the Area_Ranking as a switch recommendation.
4. WHEN a new run in the flagged area logs at least one item, THE Advisor_Engine SHALL clear the Diminishing_Returns_Alert for that area.

### Requirement 4: Weekly Summary Card

**User Story:** As a player, I want a quick overview of my farming week on page load, so that I can track my progress at a glance.

#### Acceptance Criteria

1. WHEN the Advisor_Page loads, THE Advisor_Engine SHALL compute summary statistics for all runs completed by the active Profile within the past 7 calendar days.
2. THE Weekly_Summary SHALL include: total runs completed, average items per hour, total Value_Points earned, and the best-performing area name with its percentage above the Profile's overall average items per hour.
3. THE Advisor_Page SHALL render the Weekly_Summary as a compact text card at the top of the page.
4. IF the active Profile has zero runs in the past 7 days, THEN THE Advisor_Page SHALL display a message indicating insufficient data for a weekly summary.

### Requirement 5: Terror Zone Recommendation

**User Story:** As a player, I want to know if the active Terror Zone is efficient for my character, so that I can decide whether to farm it.

#### Acceptance Criteria

1. WHEN the Advisor_Page loads and a Terror Zone is currently active, THE Advisor_Engine SHALL compare the active Terror Zone's historical Value_Points per hour for the Profile against the Profile's global average Value_Points per hour.
2. WHEN the active Terror Zone Value_Points per hour exceeds the Profile's global average by 10 percent or more, THE Advisor_Page SHALL display a positive Terror_Zone_Recommendation with the percentage advantage.
3. THE Terror_Zone_Recommendation SHALL display the TZ_Tier (S, A, B, or C) from the terror-zones data alongside the recommendation.
4. IF the Profile has no historical runs in the active Terror Zone, THEN THE Advisor_Page SHALL display the TZ_Tier rating only without a personal efficiency comparison.

### Requirement 6: Build-Specific Suggestions

**User Story:** As a player, I want farming suggestions tailored to my character class, so that I receive relevant area recommendations.

#### Acceptance Criteria

1. WHEN the Advisor_Page loads, THE Advisor_Engine SHALL read the class field from the active Profile.
2. THE Advisor_Engine SHALL filter Area_Ranking suggestions to prioritize areas where the Profile's class historically performs above the Profile's overall average.
3. WHEN an area in the top 3 of the Area_Ranking has no cold-immune monsters and the Profile class is Sorceress, THE Advisor_Page SHALL annotate that area with a "no cold immunes" indicator.
4. THE Advisor_Engine SHALL use Terror Zone notes from the terror-zones data module to surface class-relevant context in recommendations.

### Requirement 7: Internationalization Support

**User Story:** As a player, I want the Advisor page displayed in my chosen language, so that I can read recommendations comfortably.

#### Acceptance Criteria

1. THE Advisor_Page SHALL render all static text (labels, headings, alert messages) using translation keys from the i18n resource bundles.
2. THE Advisor_Page SHALL support en-US, pt-BR, and es locales.
3. WHEN the application locale changes, THE Advisor_Page SHALL re-render all text content in the newly selected locale without requiring a page reload.
4. THE Advisor_Engine SHALL format numeric values (items per hour, percentages) using the locale-appropriate number formatter from the i18n formatters module.

### Requirement 8: Data Source and Computation Constraints

**User Story:** As a developer, I want the advisor to reuse existing APIs without new Rust commands, so that implementation stays within the frontend layer.

#### Acceptance Criteria

1. THE Advisor_Engine SHALL compute all recommendations using data retrieved from the existing getStatsCombined, getDetailedRuns, and getXpEntries API functions.
2. THE Advisor_Engine SHALL execute all computations in the frontend TypeScript layer without invoking new Tauri commands.
3. THE Advisor_Engine SHALL assign Value_Points to items using the getItemTier function from the item-values data module with tier points: GG=20, High=8, Mid=3, Low=1, Worthless=0.
4. THE Advisor_Engine SHALL read Terror Zone tier ratings from the TERROR_ZONES constant in the terror-zones data module.
