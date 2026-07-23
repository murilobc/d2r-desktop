import type { DetailedRun, Profile, XpEntry } from "../types";
import { getItemTier } from "../data/item-values";
import { TERROR_ZONES } from "../data/terror-zones";
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
  annotation: string | null;
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

/**
 * Scans the run history (ordered chronologically) to detect areas
 * where the player has 5+ consecutive runs with zero items from the tail.
 *
 * Returns alerts with the count and a suggested alternative from the ranking.
 */
export function detectDiminishingReturns(
  detailedRuns: DetailedRun[],
  areaRankings: AreaMetrics[]
): DiminishingReturnsAlert[] {
  // 1. Sort runs by started_at ascending (chronological order)
  const sorted = [...detailedRuns].sort(
    (a, b) => new Date(a.run.started_at).getTime() - new Date(b.run.started_at).getTime()
  );

  // 2. Group runs by area, preserving chronological order
  const runsByArea = new Map<string, DetailedRun[]>();
  for (const dr of sorted) {
    const area = dr.run.area;
    const existing = runsByArea.get(area) ?? [];
    existing.push(dr);
    runsByArea.set(area, existing);
  }

  // 3. For each area, count consecutive dry runs from the tail
  const alerts: DiminishingReturnsAlert[] = [];

  for (const [area, runs] of runsByArea.entries()) {
    // Walk backwards from the most recent run to count consecutive dry runs
    let consecutiveDry = 0;
    for (let i = runs.length - 1; i >= 0; i--) {
      if (runs[i].items.length === 0) {
        consecutiveDry++;
      } else {
        break;
      }
    }

    // Requirement 3.4: If most recent run has items, no alert
    // (consecutiveDry would be 0 in that case, so threshold check handles it)

    // Requirement 3.1: Alert when 5+ consecutive dry runs from the tail
    if (consecutiveDry >= 5) {
      // Requirement 3.3: Suggest top-ranked alternative that isn't the flagged area
      const suggestedAlternative =
        areaRankings.find((m) => m.area !== area)?.area ?? null;

      alerts.push({
        area,
        consecutiveDryRuns: consecutiveDry,
        suggestedAlternative,
      });
    }
  }

  return alerts;
}

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
  const areaMap = new Map<
    string,
    { totalRuns: number; totalTimeSecs: number; totalItems: number; totalValuePoints: number }
  >();

  for (const dr of detailedRuns) {
    const area = dr.run.area;
    const existing = areaMap.get(area) ?? {
      totalRuns: 0,
      totalTimeSecs: 0,
      totalItems: 0,
      totalValuePoints: 0,
    };

    existing.totalRuns += 1;
    existing.totalTimeSecs += dr.run.duration_secs;
    existing.totalItems += dr.items.length;

    // Compute value points for each item via getItemTier
    for (const item of dr.items) {
      const tier = getItemTier(item.name, item.rarity);
      existing.totalValuePoints += tier.points;
    }

    areaMap.set(area, existing);
  }

  // 2. Group XP entries by area
  const xpByArea = new Map<string, number>();
  for (const entry of xpEntries) {
    if (entry.area) {
      const current = xpByArea.get(entry.area) ?? 0;
      xpByArea.set(entry.area, current + entry.xp_gained);
    }
  }

  // 3. Build AreaMetrics for each area, compute per-hour rates
  const metrics: AreaMetrics[] = [];

  for (const [area, data] of areaMap.entries()) {
    // Exclude areas with fewer than 3 runs
    if (data.totalRuns < 3) continue;

    const totalXp = xpByArea.get(area) ?? 0;
    const hours = data.totalTimeSecs / 3600;

    // Avoid division by zero
    const itemsPerHour = hours > 0 ? data.totalItems / hours : 0;
    const valuePointsPerHour = hours > 0 ? data.totalValuePoints / hours : 0;
    const xpPerHour = hours > 0 ? totalXp / hours : 0;

    metrics.push({
      area,
      totalRuns: data.totalRuns,
      totalTimeSecs: data.totalTimeSecs,
      totalItems: data.totalItems,
      totalValuePoints: data.totalValuePoints,
      totalXp,
      itemsPerHour,
      valuePointsPerHour,
      xpPerHour,
    });
  }

  // 4. Sort descending by the specified sort key
  metrics.sort((a, b) => b[sortBy] - a[sortBy]);

  return metrics;
}

/**
 * Computes a summary of farming performance over the past 7 calendar days.
 * Returns null if zero runs exist in the window.
 */
export function computeWeeklySummary(
  detailedRuns: DetailedRun[],
  referenceDate?: Date
): WeeklySummary | null {
  const ref = referenceDate ?? new Date();
  const windowStart = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Filter runs to those within the 7-day window
  const windowRuns = detailedRuns.filter((dr) => {
    const startedAt = new Date(dr.run.started_at);
    return startedAt >= windowStart && startedAt <= ref;
  });

  // 2. Return null if no runs in window
  if (windowRuns.length === 0) return null;

  // 3. Compute totals
  let totalTimeSecs = 0;
  let totalItems = 0;
  let totalValuePoints = 0;

  // Per-area tracking for best area computation
  const areaData = new Map<string, { items: number; timeSecs: number }>();

  for (const dr of windowRuns) {
    totalTimeSecs += dr.run.duration_secs;
    totalItems += dr.items.length;

    for (const item of dr.items) {
      const tier = getItemTier(item.name, item.rarity);
      totalValuePoints += tier.points;
    }

    // Track per-area stats
    const area = dr.run.area;
    const existing = areaData.get(area) ?? { items: 0, timeSecs: 0 };
    existing.items += dr.items.length;
    existing.timeSecs += dr.run.duration_secs;
    areaData.set(area, existing);
  }

  // 4. Compute avgItemsPerHour
  const totalHours = totalTimeSecs / 3600;
  const avgItemsPerHour = totalHours > 0 ? totalItems / totalHours : 0;

  // 5. Find best area (highest items/hr) and compute percentage above overall average
  let bestArea: string | null = null;
  let bestAreaPercentageAboveAvg = 0;
  let bestAreaItemsPerHour = 0;

  for (const [area, data] of areaData.entries()) {
    const areaHours = data.timeSecs / 3600;
    const areaItemsPerHour = areaHours > 0 ? data.items / areaHours : 0;

    if (areaItemsPerHour > bestAreaItemsPerHour) {
      bestAreaItemsPerHour = areaItemsPerHour;
      bestArea = area;
    }
  }

  // Compute percentage above average for best area
  if (bestArea !== null && avgItemsPerHour > 0) {
    bestAreaPercentageAboveAvg =
      ((bestAreaItemsPerHour - avgItemsPerHour) / avgItemsPerHour) * 100;
  }

  return {
    totalRuns: windowRuns.length,
    avgItemsPerHour,
    totalValuePoints,
    bestArea,
    bestAreaPercentageAboveAvg,
  };
}

/**
 * Finds the Terror Zone entry matching a given area name and returns its notes.
 */
function getTZNotesForArea(area: string): string | null {
  const tz = TERROR_ZONES.find(
    (t) => t.name === area || t.areas.includes(area)
  );
  return tz ? tz.notes : null;
}

/**
 * Produces class-specific annotations for the top-ranked areas.
 * Filters to areas performing above the overall average, annotates
 * Sorceress top-3 with "no cold immunes" when TZ notes match,
 * and attaches TZ notes for areas in the active Terror Zone.
 */
export function computeBuildSuggestions(
  profile: Profile,
  areaRankings: AreaMetrics[],
  activeTZ: TerrorZoneInfo | null
): BuildSuggestion[] {
  if (areaRankings.length === 0) return [];

  // 1. Compute overall average valuePointsPerHour across all ranked areas
  const totalVPH = areaRankings.reduce((sum, a) => sum + a.valuePointsPerHour, 0);
  const overallAvg = totalVPH / areaRankings.length;

  // 2. Filter to areas that perform above the overall average
  const aboveAverage = areaRankings.filter((a) => a.valuePointsPerHour >= overallAvg);

  // 3. For Sorceress: identify top-3 qualifying areas with "no cold immunes" in TZ notes
  const isSorceress = profile.class.toLowerCase() === "sorceress";
  const coldImmuneAnnotated = new Set<string>();

  if (isSorceress) {
    let annotatedCount = 0;
    for (const area of aboveAverage) {
      if (annotatedCount >= 3) break;
      const notes = getTZNotesForArea(area.area);
      if (notes?.toLowerCase().includes("no cold immunes")) {
        coldImmuneAnnotated.add(area.area);
        annotatedCount++;
      }
    }
  }

  // 5. Build suggestions with annotations and TZ notes
  const suggestions: BuildSuggestion[] = aboveAverage.map((area) => {
    // Annotation: "no cold immunes" for Sorceress qualifying areas
    const annotation = coldImmuneAnnotated.has(area.area) ? "no cold immunes" : null;

    // Attach TZ notes if the area matches the active TZ
    let tzNote: string | null = null;
    if (activeTZ) {
      const matchesActiveTZ =
        activeTZ.name === area.area || activeTZ.areas.includes(area.area);
      if (matchesActiveTZ) {
        tzNote = activeTZ.notes;
      }
    }

    return { area: area.area, annotation, tzNote };
  });

  return suggestions;
}

/**
 * Evaluates whether the currently active Terror Zone is worth farming
 * based on the player's historical performance.
 *
 * Returns null if no active TZ is provided.
 * Returns a tier-only result (hasPersonalData: false) when the player
 * has no historical runs in the active TZ areas.
 * Otherwise computes TZ-specific valuePointsPerHour and compares it
 * against the global average to determine if the TZ is recommended
 * (>= 10% advantage).
 */
export function computeTZRecommendation(
  activeTZ: TerrorZoneInfo | null,
  detailedRuns: DetailedRun[],
  globalAvgValuePointsPerHour: number
): TZRecommendation | null {
  // 1. If activeTZ is null, return null
  if (activeTZ === null) return null;

  // 2. Look up the TZ tier from the TerrorZoneInfo
  const tier = activeTZ.tier;

  // 3. Filter detailedRuns to those in the TZ's areas
  const tzAreas = new Set(activeTZ.areas);
  const tzRuns = detailedRuns.filter((dr) => tzAreas.has(dr.run.area));

  // 4. If no runs exist, return tier-only result
  if (tzRuns.length === 0) {
    return {
      zoneName: activeTZ.name,
      tier,
      hasPersonalData: false,
      valuePointsPerHour: null,
      globalAvgValuePointsPerHour: null,
      percentageAdvantage: null,
      isRecommended: false,
    };
  }

  // 5. Compute TZ-specific valuePointsPerHour
  let totalTimeSecs = 0;
  let totalValuePoints = 0;

  for (const dr of tzRuns) {
    totalTimeSecs += dr.run.duration_secs;
    for (const item of dr.items) {
      const itemTier = getItemTier(item.name, item.rarity);
      totalValuePoints += itemTier.points;
    }
  }

  const totalHours = totalTimeSecs / 3600;
  const tzValuePointsPerHour = totalHours > 0 ? totalValuePoints / totalHours : 0;

  // 6. Compute percentageAdvantage = (tzVPH - globalAvg) / globalAvg * 100
  const percentageAdvantage =
    globalAvgValuePointsPerHour > 0
      ? ((tzValuePointsPerHour - globalAvgValuePointsPerHour) / globalAvgValuePointsPerHour) * 100
      : 0;

  // 7. isRecommended = percentageAdvantage >= 10
  const isRecommended = percentageAdvantage >= 10;

  // 8. Return TZRecommendation
  return {
    zoneName: activeTZ.name,
    tier,
    hasPersonalData: true,
    valuePointsPerHour: tzValuePointsPerHour,
    globalAvgValuePointsPerHour,
    percentageAdvantage,
    isRecommended,
  };
}
