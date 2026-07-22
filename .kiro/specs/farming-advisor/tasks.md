# Implementation Plan: Farming Advisor

## Overview

Implement a frontend-only Farming Advisor page that analyzes the player's historical run, item, and XP data to produce personalized farming recommendations. The feature consists of a pure TypeScript computation module (`advisor-engine.ts`) and a React page with 5 sub-components, reusing existing APIs. All text is i18n-ready for en-US, pt-BR, and es locales.

## Tasks

- [ ] 1. Create advisor engine module with core data models and computation functions
  - [ ] 1.1 Create `src/advisor/advisor-engine.ts` with type definitions and `computeAreaRankings`
    - Define interfaces: `AreaMetrics`, `RankingSortKey`, `DiminishingReturnsAlert`, `WeeklySummary`, `TZRecommendation`, `BuildSuggestion`, `AdvisorResult`
    - Implement `computeAreaRankings(detailedRuns, xpEntries, sortBy)`:
      - Group runs by area, sum duration/items/XP, compute value points via `getItemTier`
      - Compute per-hour rates (items/hr, valuePoints/hr, XP/hr)
      - Exclude areas with fewer than 3 runs
      - Sort descending by the specified sort key
    - Import `getItemTier` from `../data/item-values`
    - _Requirements: 2.1, 2.2, 2.3, 8.3_

  - [ ] 1.2 Implement `computeWeeklySummary` in `advisor-engine.ts`
    - Filter runs to those within the past 7 calendar days from a reference date
    - Return null if no runs exist in the window
    - Compute: totalRuns, avgItemsPerHour, totalValuePoints, bestArea with percentage above average
    - _Requirements: 4.1, 4.2_

  - [ ] 1.3 Implement `detectDiminishingReturns` in `advisor-engine.ts`
    - Sort runs chronologically, track consecutive dry runs (zero items) per area from the tail
    - Produce alert when 5+ consecutive dry runs detected for an area
    - Suggest top-ranked alternative from areaRankings that isn't the flagged area
    - Clear alert if most recent run in the area has items
    - _Requirements: 3.1, 3.3, 3.4_

  - [ ] 1.4 Implement `computeTZRecommendation` in `advisor-engine.ts`
    - Accept active TZ info, detailed runs, and global average valuePointsPerHour
    - Return null if no active TZ
    - Look up TZ tier from terror-zones data
    - Compute TZ-specific valuePointsPerHour from historical runs
    - Set isRecommended when percentage advantage >= 10%
    - Return tier-only result when no personal runs exist
    - Import from `../data/terror-zones`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.4_

  - [ ] 1.5 Implement `computeBuildSuggestions` in `advisor-engine.ts`
    - Read profile class, filter areas performing above overall average
    - For Sorceress: annotate top-3 qualifying areas with "no cold immunes" if TZ notes match
    - Attach TZ notes for areas matching active TZ
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 2. Write property-based tests for advisor engine
  - [ ]* 2.1 Write property test: Area efficiency metrics computation
    - **Property 1: Area efficiency metrics are correctly computed**
    - For any set of runs with positive duration, verify itemsPerHour = totalItems / (totalTimeSecs / 3600), valuePointsPerHour = totalValuePoints / (totalTimeSecs / 3600), xpPerHour = totalXp / (totalTimeSecs / 3600)
    - **Validates: Requirements 2.1**

  - [ ]* 2.2 Write property test: Rankings sorted descending
    - **Property 2: Area rankings are sorted descending by the chosen criterion**
    - For any non-empty ranking output and any sort key, element[i] >= element[i+1] for the sort key
    - **Validates: Requirements 2.2, 2.5**

  - [ ]* 2.3 Write property test: Minimum run threshold
    - **Property 3: Areas with fewer than 3 runs are excluded from rankings**
    - For any set of runs, every area in output has totalRuns >= 3
    - **Validates: Requirements 2.3**

  - [ ]* 2.4 Write property test: Diminishing returns trigger
    - **Property 4: Diminishing returns alert triggers correctly**
    - Alert produced iff most recent 5+ consecutive runs in area all have zero items
    - **Validates: Requirements 3.1, 3.4**

  - [ ]* 2.5 Write property test: Alternative excludes flagged area
    - **Property 5: Alternative area suggestion excludes the flagged area**
    - suggestedAlternative is the highest-ranked area that is not the alert's area
    - **Validates: Requirements 3.3**

  - [ ]* 2.6 Write property test: Weekly window filtering
    - **Property 6: Weekly summary only includes runs from the 7-day window**
    - Every included run is within the 7-day window; every run within the window is included
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.7 Write property test: TZ recommendation threshold
    - **Property 7: Terror Zone recommendation threshold**
    - isRecommended = true iff (tzVPH - globalAvg) / globalAvg >= 0.10
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 2.8 Write property test: Build filtering prioritizes above-average areas
    - **Property 8: Build-specific filtering prioritizes above-average areas**
    - Every area in build suggestions has valuePointsPerHour >= overall average
    - **Validates: Requirements 6.2**

  - [ ]* 2.9 Write property test: Sorceress cold-immune annotation
    - **Property 9: Sorceress cold-immune annotation on qualifying top-3 areas**
    - For Sorceress profile, top-3 areas with matching "No cold immunes" TZ note get annotation
    - **Validates: Requirements 6.3**

  - [ ]* 2.10 Write property test: Weekly summary aggregates consistency
    - **Property 10: Weekly summary aggregates are mathematically consistent**
    - totalValuePoints = sum of all item value points in window; avgItemsPerHour = totalItems / totalHours
    - **Validates: Requirements 4.2, 8.3**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add i18n keys for the Advisor page
  - [ ] 4.1 Add `advisor.*` translation keys to all 3 locale files
    - Add keys to `src/i18n/locales/en-US.json`: page title, section headings, alert messages, empty states, column headers, sort options, TZ recommendation text, build suggestion labels
    - Add corresponding keys to `src/i18n/locales/pt-BR.json`
    - Add corresponding keys to `src/i18n/locales/es.json`
    - _Requirements: 7.1, 7.2_

- [ ] 5. Implement Advisor page and sub-components
  - [ ] 5.1 Create `src/components/WeeklySummaryCard.tsx`
    - Render compact card with total runs, avg items/hr, total value points, best area with percentage
    - Show "insufficient data" message when summary is null
    - Use i18n keys for all labels, `formatNumber` for numeric values
    - _Requirements: 4.2, 4.3, 4.4, 7.1, 7.4_

  - [ ] 5.2 Create `src/components/TerrorZoneRecommendation.tsx`
    - Show positive recommendation with percentage advantage and TZ tier badge
    - Show tier-only display when no personal data exists
    - Hide section entirely when no active TZ
    - Use i18n keys and locale-aware number formatting
    - _Requirements: 5.2, 5.3, 5.4, 7.1, 7.4_

  - [ ] 5.3 Create `src/components/DiminishingReturnsAlert.tsx`
    - Render warning banner with area name, dry run count, and suggested alternative
    - Support multiple simultaneous alerts
    - Use i18n keys for alert text
    - _Requirements: 3.2, 3.3, 7.1_

  - [ ] 5.4 Create `src/components/AreaRankingTable.tsx`
    - Render sortable table with area name, items/hr, valuePoints/hr, XP/hr columns
    - Allow clicking column headers to change sort criterion
    - Call `computeAreaRankings` with updated sortBy on sort change (memoized)
    - Use `formatNumber` for all metric values
    - _Requirements: 2.4, 2.5, 7.1, 7.4_

  - [ ] 5.5 Create `src/components/BuildSuggestions.tsx`
    - Render class-specific area recommendations with annotations
    - Show "no cold immunes" badge for Sorceress-relevant areas
    - Display TZ notes when applicable
    - Use i18n keys for labels and annotations
    - _Requirements: 6.2, 6.3, 6.4, 7.1_

  - [ ] 5.6 Create `src/pages/Advisor.tsx` page component
    - Fetch data on mount via `getStatsCombined` and `getXpEntries`
    - Pass data through advisor engine functions
    - Compose sub-components: WeeklySummaryCard, TerrorZoneRecommendation, DiminishingReturnsAlert, AreaRankingTable, BuildSuggestions
    - Handle loading state with skeleton, error state with toast
    - _Requirements: 1.1, 8.1, 8.2_

- [ ] 6. Integrate Advisor page into application navigation
  - [ ] 6.1 Add Advisor route to `src/App.tsx`
    - Add `"advisor"` to the `Page` union type
    - Add sidebar navigation button with i18n label
    - Disable when no profile is selected
    - Lazy-load `Advisor.tsx` with `React.lazy`
    - Render `Advisor` page in the page switch
    - _Requirements: 1.1, 1.2, 1.3, 7.3_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Write unit tests for Advisor page and components
  - [ ]* 8.1 Write unit tests for `Advisor.tsx` page
    - Test loading skeleton shown while data fetches
    - Test empty state when profile has zero runs
    - Test correct sub-components render with mock engine output
    - Mock `getStatsCombined`, `getXpEntries` API calls
    - _Requirements: 1.1, 4.4, 8.1_

  - [ ]* 8.2 Write unit tests for sub-components
    - Test `WeeklySummaryCard` renders all metrics and handles null summary
    - Test `AreaRankingTable` sort interaction changes column highlight
    - Test `DiminishingReturnsAlert` renders area name and dry run count
    - Test `TerrorZoneRecommendation` shows/hides based on data
    - Test `BuildSuggestions` renders annotations for Sorceress
    - _Requirements: 2.4, 3.2, 4.3, 5.2, 6.3_

  - [ ]* 8.3 Write unit tests for navigation and i18n integration
    - Test sidebar entry disabled when no profile selected
    - Test sidebar label renders in all 3 locales
    - Test locale switch re-renders text without reload
    - _Requirements: 1.2, 1.3, 7.2, 7.3_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Run `npm test` to verify no regressions
  - Run `npx tsc --noEmit` to verify TypeScript compilation
  - Run `npx vite build` to verify bundling
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The advisor engine is pure computation (no I/O), enabling property-based tests without mocks
- Property tests use `fast-check` (already installed) with vitest
- All numeric formatting uses `formatNumber` from `src/i18n/formatters.ts` for locale awareness
- Existing APIs (`getStatsCombined`, `getDetailedRuns`, `getXpEntries`) are reused — no new Rust commands
- `item-values.ts` and `terror-zones.ts` are existing data modules imported directly

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "4.1"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 4, "tasks": ["5.6", "6.1"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3"] }
  ]
}
```
