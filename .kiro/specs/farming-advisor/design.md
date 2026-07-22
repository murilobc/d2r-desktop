# Design Document: Farming Advisor

## Overview

The Farming Advisor is a frontend-only feature that introduces a new Advisor page and a pure TypeScript computation module (the Advisor Engine). It reuses existing Tauri commands via `getStatsCombined`, `getDetailedRuns`, and `getXpEntries` to gather data, then produces recommendations entirely in the browser. No new Rust commands are added.

## Architecture

The Farming Advisor is a frontend-only feature that introduces a new Advisor page and a pure TypeScript computation module (the Advisor Engine). It reuses existing Tauri commands via `getStatsCombined`, `getDetailedRuns`, and `getXpEntries` to gather data, then produces recommendations entirely in the browser. No new Rust commands are added.

```
┌─────────────────────────────────────────────────────────┐
│  App.tsx (Sidebar + Page Router)                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  AdvisorPage.tsx (React component)                 │ │
│  │  ├── WeeklySummaryCard                             │ │
│  │  ├── TerrorZoneRecommendation                     │ │
│  │  ├── DiminishingReturnsAlert                      │ │
│  │  ├── AreaRankingTable (sortable)                   │ │
│  │  └── BuildSuggestions                              │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                              │
│                          ▼                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  advisor-engine.ts (Pure computation module)       │ │
│  │  ├── computeAreaRankings()                         │ │
│  │  ├── computeWeeklySummary()                        │ │
│  │  ├── detectDiminishingReturns()                    │ │
│  │  ├── computeTZRecommendation()                     │ │
│  │  └── computeBuildSuggestions()                      │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                              │
│              ┌───────────┼───────────┐                  │
│              ▼           ▼           ▼                  │
│     item-values.ts  terror-zones.ts  i18n/formatters.ts │
│                          │                              │
│              ┌───────────┼───────────┐                  │
│              ▼           ▼           ▼                  │
│   getStatsCombined  getDetailedRuns  getXpEntries       │
│         (existing Tauri commands)                       │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Advisor Engine (`src/advisor/advisor-engine.ts`)

A pure TypeScript module with no side effects. All functions accept data as parameters and return computed results. This separation enables unit testing without mocking Tauri APIs.

### 2. Advisor Page (`src/pages/Advisor.tsx`)

A React page component that:
- Fetches data via existing API functions on mount
- Passes data to the advisor engine
- Renders sub-components with the computed results
- Supports locale-aware formatting via i18n formatters

### 3. Sub-Components

- `WeeklySummaryCard` — compact card at top of page
- `TerrorZoneRecommendation` — TZ-specific recommendation card
- `DiminishingReturnsAlert` — warning banner with switch suggestion
- `AreaRankingTable` — sortable table of area metrics
- `BuildSuggestions` — class-specific annotations and suggestions

## Data Models

```typescript
// src/advisor/advisor-engine.ts

import type { DetailedRun, Profile, XpEntry } from "../types";
import type { TerrorZoneInfo } from "../data/terror-zones";

/** Computed metrics for a single farming area */
export interface AreaMetrics {
  area: string;
  totalRuns: number;
  totalTimeSecs: number;
  totalItems: number;
  totalValuePoints: number;
  totalXp: number;
  itemsPerHour: number;
  valuePointsPerHour: number;
  xpPerHour: number;
}

/** Sort criterion for the area ranking table */
export type RankingSortKey = "valuePointsPerHour" | "itemsPerHour" | "xpPerHour";

/** A diminishing returns alert for a specific area */
export interface DiminishingReturnsAlert {
  area: string;
  consecutiveDryRuns: number;
  suggestedAlternative: string | null;
}

/** The weekly summary for the past 7 calendar days */
export interface WeeklySummary {
  totalRuns: number;
  avgItemsPerHour: number;
  totalValuePoints: number;
  bestArea: string | null;
  bestAreaPercentageAboveAvg: number;
}

/** Terror Zone recommendation result */
export interface TZRecommendation {
  zoneName: string;
  tier: "S" | "A" | "B" | "C";
  hasPersonalData: boolean;
  valuePointsPerHour: number | null;
  globalAvgValuePointsPerHour: number | null;
  percentageAdvantage: number | null;
  isRecommended: boolean;
}

/** Build-specific suggestion for an area */
export interface BuildSuggestion {
  area: string;
  annotation: string | null; // e.g., "no cold immunes"
  tzNote: string | null;
}

/** Full advisor output combining all computations */
export interface AdvisorResult {
  areaRankings: AreaMetrics[];
  weeklySummary: WeeklySummary | null;
  diminishingReturns: DiminishingReturnsAlert[];
  tzRecommendation: TZRecommendation | null;
  buildSuggestions: BuildSuggestion[];
}
```

## Core Functions

### `computeAreaRankings`

```typescript
/**
 * Computes efficiency metrics per area and returns them sorted
 * in descending order by the specified sort key.
 *
 * Areas with fewer than 3 completed runs are excluded.
 */
export function computeAreaRankings(
  detailedRuns: DetailedRun[],
  xpEntries: XpEntry[],
  sortBy: RankingSortKey = "valuePointsPerHour"
): AreaMetrics[] {
  // 1. Group runs by area
  // 2. For each area, sum duration, items, compute value points via getItemTier
  // 3. Merge XP data by area from xpEntries
  // 4. Compute per-hour rates: metric / (totalTimeSecs / 3600)
  // 5. Filter out areas with totalRuns < 3
  // 6. Sort descending by sortBy key
  // 7. Return sorted AreaMetrics[]
}
```

### `detectDiminishingReturns`

```typescript
/**
 * Scans the run history (ordered chronologically) to detect areas
 * where the player has 5+ consecutive runs with zero items.
 *
 * Returns alerts with the count and a suggested alternative from the ranking.
 */
export function detectDiminishingReturns(
  detailedRuns: DetailedRun[],
  areaRankings: AreaMetrics[]
): DiminishingReturnsAlert[] {
  // 1. Sort runs by started_at ascending
  // 2. Walk the sorted runs, tracking consecutive dry runs per area
  // 3. For each area that reaches 5+ consecutive dry runs (counting from tail):
  //    - Find the top-ranked area from areaRankings that is NOT the flagged area
  //    - Produce a DiminishingReturnsAlert
  // 4. If the most recent run in a flagged area has items, do NOT alert
}
```

### `computeWeeklySummary`

```typescript
/**
 * Computes a summary of farming performance over the past 7 calendar days.
 * Returns null if zero runs exist in the window.
 */
export function computeWeeklySummary(
  detailedRuns: DetailedRun[],
  referenceDate?: Date
): WeeklySummary | null {
  // 1. Determine the 7-day window: [referenceDate - 7 days, referenceDate]
  // 2. Filter detailedRuns to those with started_at within the window
  // 3. If empty, return null
  // 4. Compute: totalRuns, total time, total items, total value points
  // 5. Compute avgItemsPerHour = totalItems / (totalTimeSecs / 3600)
  // 6. Compute per-area items/hr, find best area
  // 7. Compute percentage above overall average for the best area
  // 8. Return WeeklySummary
}
```

### `computeTZRecommendation`

```typescript
/**
 * Evaluates whether the currently active Terror Zone is worth farming
 * based on the player's historical performance.
 */
export function computeTZRecommendation(
  activeTZ: TerrorZoneInfo | null,
  detailedRuns: DetailedRun[],
  globalAvgValuePointsPerHour: number
): TZRecommendation | null {
  // 1. If activeTZ is null, return null
  // 2. Look up the TZ tier from the TerrorZoneInfo
  // 3. Filter detailedRuns to those in the TZ's areas
  // 4. If no runs exist, return { hasPersonalData: false, tier, ... }
  // 5. Compute TZ-specific valuePointsPerHour
  // 6. Compute percentageAdvantage = (tzVPH - globalAvg) / globalAvg * 100
  // 7. isRecommended = percentageAdvantage >= 10
  // 8. Return TZRecommendation
}
```

### `computeBuildSuggestions`

```typescript
/**
 * Produces class-specific annotations for the top-ranked areas.
 */
export function computeBuildSuggestions(
  profile: Profile,
  areaRankings: AreaMetrics[],
  activeTZ: TerrorZoneInfo | null
): BuildSuggestion[] {
  // 1. Read profile.class
  // 2. Compute overall average across all ranked areas
  // 3. Filter to areas that perform above the overall average
  // 4. For Sorceress: check if area has "No cold immunes" in TZ notes
  //    and annotate top-3 qualifying areas
  // 5. Attach TZ notes if the area matches the active TZ
  // 6. Return BuildSuggestion[]
}
```

## Data Flow

1. **Page mount**: `AdvisorPage` calls `getStatsCombined(profileId)` and `getXpEntries(profileId)`
2. **Engine invocation**: The fetched `DetailedRun[]`, `XpEntry[]`, and `Profile` are passed to advisor engine functions
3. **TZ lookup**: Active TZ is read from `loadCurrentTZ()` and matched against `TERROR_ZONES`
4. **Rendering**: Engine results are passed to sub-components which format numbers using `formatNumber()` from the i18n formatters module
5. **User interaction**: Changing the sort criterion calls `computeAreaRankings` with a different `sortBy` parameter (memoized via `useMemo`)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No profile selected | Sidebar entry disabled, page inaccessible |
| Zero runs for profile | Show empty state message for all sections |
| Zero runs in 7-day window | WeeklySummary shows "insufficient data" message |
| No active Terror Zone | TZ recommendation section hidden |
| No runs in active TZ | Show TZ tier only, no personal comparison |
| Area with < 3 runs | Excluded from rankings (no error shown) |
| API fetch failure | Show error toast, render stale data if cached |

## Integration Points

- **Sidebar (App.tsx)**: Add `"advisor"` to the `Page` union type; add nav button with `disabled={!selectedProfile}`
- **i18n locales**: Add translation keys under `advisor.*` namespace in all 3 locale files
- **item-values.ts**: Import `getItemTier` and `TIERS` for value point computation
- **terror-zones.ts**: Import `TERROR_ZONES`, `loadCurrentTZ`, `TerrorZoneInfo`
- **i18n/formatters.ts**: Import `formatNumber` for locale-aware number display

## File Structure

```
src/
├── advisor/
│   ├── advisor-engine.ts          # Pure computation module
│   └── advisor-engine.test.ts     # Unit + property tests
├── pages/
│   └── Advisor.tsx                # Page component
├── components/
│   ├── WeeklySummaryCard.tsx
│   ├── TerrorZoneRecommendation.tsx
│   ├── DiminishingReturnsAlert.tsx
│   ├── AreaRankingTable.tsx
│   └── BuildSuggestions.tsx
└── i18n/locales/
    ├── en-US.json                 # Add advisor.* keys
    ├── pt-BR.json                 # Add advisor.* keys
    └── es.json                    # Add advisor.* keys
```

## Testing Strategy

The advisor engine is a pure computation module with no I/O, making it ideal for property-based testing. The testing approach uses two complementary layers:

- **Property-based tests** (fast-check): Validate universal invariants of the computation functions across randomly generated run data, item lists, and profile configurations. Minimum 100 iterations per property.
- **Example-based unit tests** (vitest): Cover UI rendering, navigation behavior, i18n label rendering, and specific edge cases (zero runs, no active TZ, etc.).

All advisor engine functions accept data as parameters and return plain objects, so tests run without Tauri mocks. UI component tests use React Testing Library with mocked advisor engine results.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Area efficiency metrics are correctly computed

*For any* set of DetailedRuns where an area has at least one run with positive duration, the computed `itemsPerHour` SHALL equal `totalItems / (totalTimeSecs / 3600)`, `valuePointsPerHour` SHALL equal `totalValuePoints / (totalTimeSecs / 3600)`, and `xpPerHour` SHALL equal `totalXp / (totalTimeSecs / 3600)`.

**Validates: Requirements 2.1**

### Property 2: Area rankings are sorted descending by the chosen criterion

*For any* non-empty area ranking output and any sort key, each element at index `i` SHALL have a value for that sort key greater than or equal to the element at index `i + 1`.

**Validates: Requirements 2.2, 2.5**

### Property 3: Areas with fewer than 3 runs are excluded from rankings

*For any* set of DetailedRuns, every area that appears in the ranking output SHALL have a `totalRuns` count of 3 or more.

**Validates: Requirements 2.3**

### Property 4: Diminishing returns alert triggers correctly

*For any* chronologically ordered sequence of DetailedRuns, the engine SHALL produce a DiminishingReturnsAlert for an area if and only if the most recent 5 or more consecutive runs in that area all have zero items logged.

**Validates: Requirements 3.1, 3.4**

### Property 5: Alternative area suggestion excludes the flagged area

*For any* DiminishingReturnsAlert and a non-empty area ranking, the `suggestedAlternative` SHALL be the highest-ranked area in the ranking that is not equal to the alert's `area`.

**Validates: Requirements 3.3**

### Property 6: Weekly summary only includes runs from the 7-day window

*For any* set of DetailedRuns and a reference date, every run included in the weekly summary computation SHALL have a `started_at` timestamp within the 7 calendar days preceding the reference date, and every run within that window SHALL be included.

**Validates: Requirements 4.1, 4.2**

### Property 7: Terror Zone recommendation threshold

*For any* profile data where the active Terror Zone has historical runs, the engine SHALL set `isRecommended = true` if and only if `(tzValuePointsPerHour - globalAvgValuePointsPerHour) / globalAvgValuePointsPerHour >= 0.10`.

**Validates: Requirements 5.1, 5.2**

### Property 8: Build-specific filtering prioritizes above-average areas

*For any* area ranking and profile class, every area in the build suggestions output SHALL have a `valuePointsPerHour` that is greater than or equal to the profile's overall average `valuePointsPerHour` across all ranked areas.

**Validates: Requirements 6.2**

### Property 9: Sorceress cold-immune annotation on qualifying top-3 areas

*For any* area ranking where the profile class is "Sorceress", if a top-3 area has a matching Terror Zone entry with notes containing "No cold immunes" (case-insensitive), then the build suggestion for that area SHALL include a "no cold immunes" annotation.

**Validates: Requirements 6.3**

### Property 10: Weekly summary aggregates are mathematically consistent

*For any* non-empty set of runs within the 7-day window, `totalValuePoints` SHALL equal the sum of value points (via `getItemTier`) of all items across all included runs, and `avgItemsPerHour` SHALL equal the total items divided by total hours across all included runs.

**Validates: Requirements 4.2, 8.3**
