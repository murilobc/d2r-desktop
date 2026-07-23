import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeAreaRankings, computeBuildSuggestions, computeWeeklySummary, computeTZRecommendation, detectDiminishingReturns, type RankingSortKey } from "./advisor-engine";
import type { AreaMetrics } from "./advisor-engine";
import { getItemTier } from "../data/item-values";
import { TERROR_ZONES } from "../data/terror-zones";
import type { TerrorZoneInfo } from "../data/terror-zones";
import type { DetailedRun, Run, Item, XpEntry, Profile } from "../types";

/**
 * Helper: build a DetailedRun with the given area and item count.
 * Runs are given sequential timestamps to ensure chronological ordering.
 */
function buildDetailedRun(
  area: string,
  itemCount: number,
  index: number
): DetailedRun {
  const startedAt = new Date(2024, 0, 1, 0, index).toISOString();
  const run: Run = {
    id: `run-${index}`,
    profile_id: "profile-1",
    area,
    duration_secs: 120,
    started_at: startedAt,
    finished_at: new Date(
      new Date(startedAt).getTime() + 120_000
    ).toISOString(),
    status: "finished",
    notes: null,
    player_count: null,
    route_id: null,
    route_step_index: null,
    tags: null,
  };

  const items: Item[] = Array.from({ length: itemCount }, (_, i) => ({
    id: `item-${index}-${i}`,
    run_id: run.id,
    profile_id: "profile-1",
    name: "El Rune",
    item_type: "Rune",
    rarity: "Rune",
    found_at: startedAt,
    notes: null,
  }));

  return { run, items };
}

/**
 * Helper: build an AreaMetrics entry for use in areaRankings.
 */
function buildAreaMetrics(area: string, valuePointsPerHour: number): AreaMetrics {
  return {
    area,
    totalRuns: 10,
    totalTimeSecs: 3600,
    totalItems: 20,
    totalValuePoints: valuePointsPerHour,
    totalXp: 1000,
    itemsPerHour: 20,
    valuePointsPerHour,
    xpPerHour: 1000,
  };
}

describe("Property 5: Alternative area suggestion excludes the flagged area", () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any DiminishingReturnsAlert and a non-empty area ranking,
   * suggestedAlternative is the highest-ranked area that is not equal to
   * the alert's area. If no other areas exist in rankings,
   * suggestedAlternative is null.
   */
  it("suggestedAlternative is the highest-ranked area that is NOT the flagged area", () => {
    fc.assert(
      fc.property(
        // Generate a flagged area name
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        // Generate 1-5 alternative area names (distinct from the flagged area)
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ),
        // Generate the number of consecutive dry runs (5-15) to trigger alert
        fc.integer({ min: 5, max: 15 }),
        (flaggedArea, otherAreas, dryRunCount) => {
          // Ensure other areas are distinct from the flagged area and from each other
          const uniqueOthers = [...new Set(otherAreas.filter((a) => a !== flaggedArea))];
          if (uniqueOthers.length === 0) return; // skip if no valid alternatives

          // Build runs: all dry (zero items) for the flagged area
          let runIndex = 0;
          const detailedRuns: DetailedRun[] = [];
          for (let i = 0; i < dryRunCount; i++) {
            detailedRuns.push(buildDetailedRun(flaggedArea, 0, runIndex++));
          }

          // Build area rankings: flagged area first (highest), then alternatives in order
          const areaRankings: AreaMetrics[] = [
            buildAreaMetrics(flaggedArea, 1000),
            ...uniqueOthers.map((area, i) =>
              buildAreaMetrics(area, 900 - i * 100)
            ),
          ];

          const alerts = detectDiminishingReturns(detailedRuns, areaRankings);

          // Should have exactly one alert for the flagged area
          expect(alerts.length).toBe(1);
          const alert = alerts[0];
          expect(alert.area).toBe(flaggedArea);

          // suggestedAlternative must NOT be the flagged area
          expect(alert.suggestedAlternative).not.toBe(flaggedArea);

          // suggestedAlternative must be the first (highest-ranked) area
          // in areaRankings that isn't the flagged area
          const expectedAlternative =
            areaRankings.find((m) => m.area !== flaggedArea)?.area ?? null;
          expect(alert.suggestedAlternative).toBe(expectedAlternative);

          // Verify it's specifically the first alternative
          expect(alert.suggestedAlternative).toBe(uniqueOthers[0]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("suggestedAlternative is null when no other areas exist in rankings", () => {
    fc.assert(
      fc.property(
        // Generate a flagged area name
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        // Generate dry run count (5-15)
        fc.integer({ min: 5, max: 15 }),
        (flaggedArea, dryRunCount) => {
          // Build runs: all dry for the flagged area
          const detailedRuns: DetailedRun[] = [];
          for (let i = 0; i < dryRunCount; i++) {
            detailedRuns.push(buildDetailedRun(flaggedArea, 0, i));
          }

          // Area rankings only contain the flagged area itself
          const areaRankings: AreaMetrics[] = [
            buildAreaMetrics(flaggedArea, 1000),
          ];

          const alerts = detectDiminishingReturns(detailedRuns, areaRankings);

          expect(alerts.length).toBe(1);
          expect(alerts[0].area).toBe(flaggedArea);
          expect(alerts[0].suggestedAlternative).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("suggestedAlternative picks the highest-ranked alternative regardless of ranking position", () => {
    fc.assert(
      fc.property(
        // Generate rankings with 3-6 distinct areas, with the flagged area at various positions
        fc.integer({ min: 3, max: 6 }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 5, max: 10 }),
        (numAreas, flaggedIndex, dryRunCount) => {
          const actualNumAreas = Math.max(3, numAreas);
          const actualFlaggedIndex = flaggedIndex % actualNumAreas;

          // Generate distinct area names
          const areas = Array.from(
            { length: actualNumAreas },
            (_, i) => `Area_${i}`
          );
          const flaggedArea = areas[actualFlaggedIndex];

          // Build area rankings in descending order (index 0 = highest ranked)
          const areaRankings: AreaMetrics[] = areas.map((area, i) =>
            buildAreaMetrics(area, 1000 - i * 100)
          );

          // Build dry runs for the flagged area
          const detailedRuns: DetailedRun[] = [];
          for (let i = 0; i < dryRunCount; i++) {
            detailedRuns.push(buildDetailedRun(flaggedArea, 0, i));
          }

          const alerts = detectDiminishingReturns(detailedRuns, areaRankings);

          expect(alerts.length).toBe(1);
          const alert = alerts[0];
          expect(alert.area).toBe(flaggedArea);

          // The expected alternative is the first area in rankings that isn't flagged
          const expectedAlternative =
            areaRankings.find((m) => m.area !== flaggedArea)?.area ?? null;
          expect(alert.suggestedAlternative).toBe(expectedAlternative);
          expect(alert.suggestedAlternative).not.toBe(flaggedArea);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ===== GENERATORS FOR PROPERTY 2 =====

/** Generate an area name from a small pool to ensure grouping */
const areaArb = fc.constantFrom(
  "Ancient Tunnels",
  "Chaos Sanctuary",
  "Pit",
  "Cow Level",
  "Travincal",
  "Mephisto",
  "Baal"
);

/** Generate a valid rarity string */
const rarityArb = fc.constantFrom(
  "Normal",
  "Magic",
  "Rare",
  "Set",
  "Unique",
  "Runeword",
  "Rune",
  "Charm"
);

/** Generate a valid item name (using known items for consistent tier lookup) */
const itemNameArb = fc.constantFrom(
  "Harlequin Crest",
  "War Traveler",
  "Skin of the Vipermagi",
  "Spirit",
  "Ber Rune",
  "Jah Rune",
  "Annihilus",
  "Tal Rasha's Guardianship",
  "Unknown Item"
);

/** Generate a valid ISO 8601 timestamp */
const isoTimestampArb = fc
  .integer({
    min: new Date("2020-01-01T00:00:00.000Z").getTime(),
    max: new Date("2025-12-31T23:59:59.999Z").getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

/** Generate a valid Item */
const rankingItemArb: fc.Arbitrary<Item> = fc.record({
  id: fc.uuid(),
  run_id: fc.uuid(),
  profile_id: fc.uuid(),
  name: itemNameArb,
  item_type: fc.constantFrom("Weapon", "Armor", "Helmet", "Ring", "Charm", "Rune"),
  rarity: rarityArb,
  found_at: isoTimestampArb,
  notes: fc.constant(null),
});

/** Generate a valid Run with positive duration */
const rankingRunArb = (area: fc.Arbitrary<string>): fc.Arbitrary<Run> =>
  fc.record({
    id: fc.uuid(),
    profile_id: fc.uuid(),
    area: area,
    duration_secs: fc.integer({ min: 30, max: 7200 }),
    started_at: isoTimestampArb,
    finished_at: fc.oneof(isoTimestampArb, fc.constant(null)),
    status: fc.constant("completed"),
    notes: fc.constant(null),
    player_count: fc.constant(null),
    route_id: fc.constant(null),
    route_step_index: fc.constant(null),
    tags: fc.constant(null),
  });

/** Generate a DetailedRun */
const rankingDetailedRunArb = (area: fc.Arbitrary<string>): fc.Arbitrary<DetailedRun> =>
  fc.record({
    run: rankingRunArb(area),
    items: fc.array(rankingItemArb, { minLength: 0, maxLength: 5 }),
  });

/** Generate an XpEntry */
const rankingXpEntryArb: fc.Arbitrary<XpEntry> = fc.record({
  id: fc.uuid(),
  profile_id: fc.uuid(),
  run_id: fc.oneof(fc.uuid(), fc.constant(null)),
  level: fc.integer({ min: 1, max: 99 }),
  xp_gained: fc.integer({ min: 0, max: 1000000 }),
  duration_secs: fc.integer({ min: 30, max: 7200 }),
  area: fc.oneof(areaArb, fc.constant(null)),
  notes: fc.constant(null),
  recorded_at: isoTimestampArb,
});

/** Generate a RankingSortKey */
const sortKeyArb: fc.Arbitrary<RankingSortKey> = fc.constantFrom(
  "valuePointsPerHour",
  "itemsPerHour",
  "xpPerHour"
);

/**
 * Generate a set of DetailedRuns that guarantees at least one area
 * has >= 3 runs (so we get non-empty output).
 */
const detailedRunsWithEnoughDataArb = fc
  .tuple(areaArb, fc.integer({ min: 3, max: 8 }))
  .chain(([guaranteedArea, count]) =>
    fc.tuple(
      fc.array(rankingDetailedRunArb(fc.constant(guaranteedArea)), {
        minLength: count,
        maxLength: count,
      }),
      fc.array(rankingDetailedRunArb(areaArb), { minLength: 0, maxLength: 15 })
    ).map(([guaranteed, random]) => [...guaranteed, ...random])
  );

// ===== PROPERTY 2 TEST =====

describe("Property 2: Area rankings are sorted descending by the chosen criterion", () => {
  /**
   * **Validates: Requirements 2.2, 2.5**
   *
   * For any non-empty ranking output and any sort key,
   * element[i][sortKey] >= element[i+1][sortKey].
   */
  it("rankings are sorted descending by the chosen sort key", () => {
    fc.assert(
      fc.property(
        detailedRunsWithEnoughDataArb,
        fc.array(rankingXpEntryArb, { minLength: 0, maxLength: 20 }),
        sortKeyArb,
        (detailedRuns, xpEntries, sortBy) => {
          const rankings = computeAreaRankings(detailedRuns, xpEntries, sortBy);

          // Only check if we have at least 2 elements to compare
          if (rankings.length < 2) return;

          for (let i = 0; i < rankings.length - 1; i++) {
            expect(rankings[i][sortBy]).toBeGreaterThanOrEqual(
              rankings[i + 1][sortBy]
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe("Property 1: Area efficiency metrics are correctly computed", () => {
  /**
   * **Validates: Requirements 2.1**
   *
   * For any set of runs with positive duration, verify:
   * - itemsPerHour = totalItems / (totalTimeSecs / 3600)
   * - valuePointsPerHour = totalValuePoints / (totalTimeSecs / 3600)
   * - xpPerHour = totalXp / (totalTimeSecs / 3600)
   */

  const TEST_AREA = "Ancient Tunnels";
  const TEST_PROFILE_ID = "test-profile-id";

  const itemNameArb = fc.constantFrom(
    "Harlequin Crest",
    "Shako",
    "Ber Rune",
    "Jah Rune",
    "Spirit",
    "Unknown Item"
  );

  const rarityArb = fc.constantFrom(
    "Unique",
    "Set",
    "Rare",
    "Magic",
    "Rune",
    "Runeword",
    "Normal"
  );

  const itemArb: fc.Arbitrary<Item> = fc.record({
    id: fc.uuid(),
    run_id: fc.constant("run-id"),
    profile_id: fc.constant(TEST_PROFILE_ID),
    name: itemNameArb,
    item_type: fc.constantFrom("Weapon", "Armor", "Helmet", "Rune"),
    rarity: rarityArb,
    found_at: fc.constant("2024-01-15T10:00:00Z"),
    notes: fc.constant(null),
  });

  const detailedRunArb: fc.Arbitrary<DetailedRun> = fc.record({
    run: fc.record({
      id: fc.uuid(),
      profile_id: fc.constant(TEST_PROFILE_ID),
      area: fc.constant(TEST_AREA),
      duration_secs: fc.integer({ min: 60, max: 7200 }),
      started_at: fc.constant("2024-01-15T10:00:00Z"),
      finished_at: fc.constant("2024-01-15T11:00:00Z"),
      status: fc.constant("completed"),
      notes: fc.constant(null),
      player_count: fc.constant(null),
      route_id: fc.constant(null),
      route_step_index: fc.constant(null),
      tags: fc.constant(null),
    }),
    items: fc.array(itemArb, { minLength: 0, maxLength: 5 }),
  });

  const xpEntryArb: fc.Arbitrary<XpEntry> = fc.record({
    id: fc.uuid(),
    profile_id: fc.constant(TEST_PROFILE_ID),
    run_id: fc.constant(null),
    level: fc.integer({ min: 1, max: 99 }),
    xp_gained: fc.integer({ min: 0, max: 1000000 }),
    duration_secs: fc.integer({ min: 60, max: 7200 }),
    area: fc.constant(TEST_AREA),
    notes: fc.constant(null),
    recorded_at: fc.constant("2024-01-15T10:00:00Z"),
  });

  it("itemsPerHour, valuePointsPerHour, and xpPerHour match the mathematical formula", () => {
    fc.assert(
      fc.property(
        fc.array(detailedRunArb, { minLength: 3, maxLength: 10 }),
        fc.array(xpEntryArb, { minLength: 0, maxLength: 10 }),
        (runs, xpEntries) => {
          const rankings = computeAreaRankings(runs, xpEntries);

          // The area should be included since we have >= 3 runs
          const areaMetric = rankings.find((m) => m.area === TEST_AREA);
          expect(areaMetric).toBeDefined();
          if (!areaMetric) return;

          // Independently compute expected totals
          let expectedTotalTimeSecs = 0;
          let expectedTotalItems = 0;
          let expectedTotalValuePoints = 0;

          for (const dr of runs) {
            expectedTotalTimeSecs += dr.run.duration_secs;
            expectedTotalItems += dr.items.length;
            for (const item of dr.items) {
              const tier = getItemTier(item.name, item.rarity);
              expectedTotalValuePoints += tier.points;
            }
          }

          let expectedTotalXp = 0;
          for (const entry of xpEntries) {
            if (entry.area === TEST_AREA) {
              expectedTotalXp += entry.xp_gained;
            }
          }

          const hours = expectedTotalTimeSecs / 3600;

          // hours > 0 is guaranteed since duration_secs min is 60 and we have >= 3 runs
          const expectedItemsPerHour = expectedTotalItems / hours;
          const expectedValuePointsPerHour = expectedTotalValuePoints / hours;
          const expectedXpPerHour = expectedTotalXp / hours;

          expect(areaMetric.itemsPerHour).toBeCloseTo(expectedItemsPerHour, 10);
          expect(areaMetric.valuePointsPerHour).toBeCloseTo(expectedValuePointsPerHour, 10);
          expect(areaMetric.xpPerHour).toBeCloseTo(expectedXpPerHour, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe("Property 6: Weekly summary only includes runs from the 7-day window", () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any set of DetailedRuns and a reference date, every run included in
   * the weekly summary computation SHALL have a started_at timestamp within
   * the 7 calendar days preceding the reference date, and every run within
   * that window SHALL be included.
   */

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  /** Generate a reference date (fixed within a reasonable range) */
  const referenceDateArb = fc
    .integer({
      min: new Date("2023-01-15T00:00:00Z").getTime(),
      max: new Date("2025-06-01T00:00:00Z").getTime(),
    })
    .map((ms) => new Date(ms));

  /**
   * Generate a DetailedRun with a specific timestamp.
   * Uses minimal structure — the weekly summary only cares about
   * run.started_at, run.duration_secs, and items for counting.
   */
  function makeDetailedRun(startedAtMs: number, index: number): fc.Arbitrary<DetailedRun> {
    return fc.record({
      run: fc.record({
        id: fc.constant(`run-${index}`),
        profile_id: fc.constant("profile-1"),
        area: fc.constantFrom("Ancient Tunnels", "Chaos Sanctuary", "Pit", "Travincal"),
        duration_secs: fc.integer({ min: 60, max: 3600 }),
        started_at: fc.constant(new Date(startedAtMs).toISOString()),
        finished_at: fc.constant(new Date(startedAtMs + 120_000).toISOString()),
        status: fc.constant("completed"),
        notes: fc.constant(null),
        player_count: fc.constant(null),
        route_id: fc.constant(null),
        route_step_index: fc.constant(null),
        tags: fc.constant(null),
      }),
      items: fc.array(
        fc.record({
          id: fc.uuid(),
          run_id: fc.constant(`run-${index}`),
          profile_id: fc.constant("profile-1"),
          name: fc.constantFrom("El Rune", "Harlequin Crest", "Unknown Item"),
          item_type: fc.constantFrom("Rune", "Armor", "Other"),
          rarity: fc.constantFrom("Rune", "Unique", "Normal"),
          found_at: fc.constant(new Date(startedAtMs).toISOString()),
          notes: fc.constant(null),
        }),
        { minLength: 0, maxLength: 3 }
      ),
    });
  }

  /**
   * Generate runs with timestamps both inside and outside the 7-day window
   * relative to a reference date.
   */
  const runsAndRefArb = referenceDateArb.chain((refDate) => {
    const refMs = refDate.getTime();
    const windowStartMs = refMs - 7 * MS_PER_DAY;

    // Generate timestamps inside the window: [windowStart, refDate]
    const insideTimestampArb = fc.integer({ min: windowStartMs, max: refMs });

    // Generate timestamps outside the window (before or after)
    const outsideTimestampArb = fc.oneof(
      // Before window (1-30 days before window start)
      fc.integer({ min: windowStartMs - 30 * MS_PER_DAY, max: windowStartMs - 1 }),
      // After reference date (1-30 days after)
      fc.integer({ min: refMs + 1, max: refMs + 30 * MS_PER_DAY })
    );

    return fc.tuple(
      fc.constant(refDate),
      fc.array(insideTimestampArb, { minLength: 0, maxLength: 8 }),
      fc.array(outsideTimestampArb, { minLength: 0, maxLength: 8 })
    );
  });

  it("totalRuns equals the count of runs within the 7-day window", () => {
    fc.assert(
      fc.property(runsAndRefArb, ([refDate, insideTimestamps, outsideTimestamps]) => {
        // Build DetailedRuns from both inside and outside timestamps
        let idx = 0;
        const allRunArbParts: fc.Arbitrary<DetailedRun>[] = [];

        for (const ts of insideTimestamps) {
          allRunArbParts.push(makeDetailedRun(ts, idx++));
        }
        for (const ts of outsideTimestamps) {
          allRunArbParts.push(makeDetailedRun(ts, idx++));
        }

        // Since we need to resolve the arbitraries, we'll build runs directly
        const refMs = refDate.getTime();
        const windowStartMs = refMs - 7 * MS_PER_DAY;

        const allRuns: DetailedRun[] = [];
        let runIdx = 0;

        for (const ts of insideTimestamps) {
          allRuns.push({
            run: {
              id: `run-${runIdx}`,
              profile_id: "profile-1",
              area: "Ancient Tunnels",
              duration_secs: 120,
              started_at: new Date(ts).toISOString(),
              finished_at: new Date(ts + 120_000).toISOString(),
              status: "completed",
              notes: null,
              player_count: null,
              route_id: null,
              route_step_index: null,
              tags: null,
            },
            items: [
              {
                id: `item-${runIdx}`,
                run_id: `run-${runIdx}`,
                profile_id: "profile-1",
                name: "El Rune",
                item_type: "Rune",
                rarity: "Rune",
                found_at: new Date(ts).toISOString(),
                notes: null,
              },
            ],
          });
          runIdx++;
        }

        for (const ts of outsideTimestamps) {
          allRuns.push({
            run: {
              id: `run-${runIdx}`,
              profile_id: "profile-1",
              area: "Chaos Sanctuary",
              duration_secs: 120,
              started_at: new Date(ts).toISOString(),
              finished_at: new Date(ts + 120_000).toISOString(),
              status: "completed",
              notes: null,
              player_count: null,
              route_id: null,
              route_step_index: null,
              tags: null,
            },
            items: [
              {
                id: `item-${runIdx}`,
                run_id: `run-${runIdx}`,
                profile_id: "profile-1",
                name: "El Rune",
                item_type: "Rune",
                rarity: "Rune",
                found_at: new Date(ts).toISOString(),
                notes: null,
              },
            ],
          });
          runIdx++;
        }

        const result = computeWeeklySummary(allRuns, refDate);

        // Independently filter runs that should be in the window
        const expectedWindowRuns = allRuns.filter((dr) => {
          const startedAt = new Date(dr.run.started_at).getTime();
          return startedAt >= windowStartMs && startedAt <= refMs;
        });

        if (expectedWindowRuns.length === 0) {
          // No runs in window => result should be null
          expect(result).toBeNull();
        } else {
          // Should not be null and totalRuns matches expected count
          expect(result).not.toBeNull();
          expect(result!.totalRuns).toBe(expectedWindowRuns.length);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("every run inside the window is included and no run outside is counted", () => {
    fc.assert(
      fc.property(
        referenceDateArb,
        // Number of inside runs (1-6)
        fc.integer({ min: 1, max: 6 }),
        // Number of outside runs (1-6)
        fc.integer({ min: 1, max: 6 }),
        (refDate, insideCount, outsideCount) => {
          const refMs = refDate.getTime();
          const windowStartMs = refMs - 7 * MS_PER_DAY;

          // Place inside runs evenly within the window
          const insideRuns: DetailedRun[] = [];
          for (let i = 0; i < insideCount; i++) {
            const fraction = insideCount === 1 ? 0.5 : i / (insideCount - 1);
            const ts = windowStartMs + Math.floor(fraction * 7 * MS_PER_DAY);
            insideRuns.push({
              run: {
                id: `inside-${i}`,
                profile_id: "profile-1",
                area: "Pit",
                duration_secs: 180,
                started_at: new Date(ts).toISOString(),
                finished_at: new Date(ts + 180_000).toISOString(),
                status: "completed",
                notes: null,
                player_count: null,
                route_id: null,
                route_step_index: null,
                tags: null,
              },
              items: [],
            });
          }

          // Place outside runs before window start
          const outsideRuns: DetailedRun[] = [];
          for (let i = 0; i < outsideCount; i++) {
            const ts = windowStartMs - (i + 1) * MS_PER_DAY;
            outsideRuns.push({
              run: {
                id: `outside-${i}`,
                profile_id: "profile-1",
                area: "Travincal",
                duration_secs: 180,
                started_at: new Date(ts).toISOString(),
                finished_at: new Date(ts + 180_000).toISOString(),
                status: "completed",
                notes: null,
                player_count: null,
                route_id: null,
                route_step_index: null,
                tags: null,
              },
              items: [],
            });
          }

          const allRuns = [...insideRuns, ...outsideRuns];
          const result = computeWeeklySummary(allRuns, refDate);

          // We have inside runs, so result should not be null
          expect(result).not.toBeNull();
          // totalRuns should equal only the inside runs count
          expect(result!.totalRuns).toBe(insideCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("result is null when all runs are outside the 7-day window", () => {
    fc.assert(
      fc.property(
        referenceDateArb,
        fc.integer({ min: 1, max: 8 }),
        (refDate, outsideCount) => {
          const refMs = refDate.getTime();
          const windowStartMs = refMs - 7 * MS_PER_DAY;

          // All runs placed before the window
          const outsideRuns: DetailedRun[] = [];
          for (let i = 0; i < outsideCount; i++) {
            const ts = windowStartMs - (i + 1) * MS_PER_DAY;
            outsideRuns.push({
              run: {
                id: `outside-${i}`,
                profile_id: "profile-1",
                area: "Pit",
                duration_secs: 120,
                started_at: new Date(ts).toISOString(),
                finished_at: new Date(ts + 120_000).toISOString(),
                status: "completed",
                notes: null,
                player_count: null,
                route_id: null,
                route_step_index: null,
                tags: null,
              },
              items: [
                {
                  id: `item-outside-${i}`,
                  run_id: `outside-${i}`,
                  profile_id: "profile-1",
                  name: "El Rune",
                  item_type: "Rune",
                  rarity: "Rune",
                  found_at: new Date(ts).toISOString(),
                  notes: null,
                },
              ],
            });
          }

          const result = computeWeeklySummary(outsideRuns, refDate);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe("Property 10: Weekly summary aggregates are mathematically consistent", () => {
  /**
   * **Validates: Requirements 4.2, 8.3**
   *
   * For any non-empty set of runs within the 7-day window,
   * totalValuePoints SHALL equal the sum of value points (via getItemTier)
   * of all items across all included runs, and avgItemsPerHour SHALL equal
   * the total items divided by total hours across all included runs.
   */

  const referenceDate = new Date("2024-06-15T12:00:00Z");
  const windowStartMs = referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000;

  /** Generate a timestamp within the 7-day window */
  const withinWindowTimestampArb = fc
    .integer({ min: windowStartMs, max: referenceDate.getTime() })
    .map((ms) => new Date(ms).toISOString());

  /** Known item names and their matching rarities for deterministic tier lookup */
  const itemSpecArb = fc.constantFrom(
    { name: "Harlequin Crest", rarity: "Unique" },
    { name: "Ber Rune", rarity: "Rune" },
    { name: "Spirit", rarity: "Runeword" },
    { name: "Annihilus", rarity: "Charm" },
    { name: "El Rune", rarity: "Rune" },
    { name: "Skin of the Vipermagi", rarity: "Unique" },
    { name: "Tal Rasha's Guardianship", rarity: "Set" },
    { name: "Jah Rune", rarity: "Rune" },
    { name: "War Traveler", rarity: "Unique" },
    { name: "Unknown Item", rarity: "Normal" }
  );

  /** Generate a valid Item with known name/rarity for predictable points */
  const windowItemArb: fc.Arbitrary<Item> = itemSpecArb.chain((spec) =>
    fc.record({
      id: fc.uuid(),
      run_id: fc.constant("run-id"),
      profile_id: fc.constant("profile-1"),
      name: fc.constant(spec.name),
      item_type: fc.constantFrom("Weapon", "Armor", "Helmet", "Rune", "Charm"),
      rarity: fc.constant(spec.rarity),
      found_at: withinWindowTimestampArb,
      notes: fc.constant(null),
    })
  );

  /** Generate a DetailedRun with started_at within the 7-day window */
  const windowDetailedRunArb: fc.Arbitrary<DetailedRun> = fc
    .tuple(
      withinWindowTimestampArb,
      fc.integer({ min: 60, max: 7200 }),
      fc.array(windowItemArb, { minLength: 0, maxLength: 8 }),
      fc.constantFrom(
        "Ancient Tunnels",
        "Chaos Sanctuary",
        "Pit",
        "Cow Level",
        "Travincal"
      )
    )
    .map(([startedAt, durationSecs, items, area]) => {
      const run: Run = {
        id: `run-${Math.random().toString(36).slice(2)}`,
        profile_id: "profile-1",
        area,
        duration_secs: durationSecs,
        started_at: startedAt,
        finished_at: new Date(
          new Date(startedAt).getTime() + durationSecs * 1000
        ).toISOString(),
        status: "completed",
        notes: null,
        player_count: null,
        route_id: null,
        route_step_index: null,
        tags: null,
      };
      return { run, items };
    });

  it("totalValuePoints equals sum of getItemTier points for all items in window runs", () => {
    fc.assert(
      fc.property(
        fc.array(windowDetailedRunArb, { minLength: 1, maxLength: 15 }),
        (detailedRuns) => {
          const result = computeWeeklySummary(detailedRuns, referenceDate);

          // All runs are within the window, so result should not be null
          expect(result).not.toBeNull();
          if (!result) return;

          // Independently compute expected totalValuePoints
          let expectedTotalValuePoints = 0;
          for (const dr of detailedRuns) {
            for (const item of dr.items) {
              const tier = getItemTier(item.name, item.rarity);
              expectedTotalValuePoints += tier.points;
            }
          }

          expect(result.totalValuePoints).toBe(expectedTotalValuePoints);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("avgItemsPerHour equals totalItems / totalHours for all runs in window", () => {
    fc.assert(
      fc.property(
        fc.array(windowDetailedRunArb, { minLength: 1, maxLength: 15 }),
        (detailedRuns) => {
          const result = computeWeeklySummary(detailedRuns, referenceDate);

          expect(result).not.toBeNull();
          if (!result) return;

          // Independently compute expected avgItemsPerHour
          let totalItems = 0;
          let totalTimeSecs = 0;
          for (const dr of detailedRuns) {
            totalItems += dr.items.length;
            totalTimeSecs += dr.run.duration_secs;
          }

          const totalHours = totalTimeSecs / 3600;
          const expectedAvgItemsPerHour =
            totalHours > 0 ? totalItems / totalHours : 0;

          // Use floating point tolerance
          expect(result.avgItemsPerHour).toBeCloseTo(
            expectedAvgItemsPerHour,
            10
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ===== PROPERTY 7: TZ RECOMMENDATION THRESHOLD =====

describe("Property 7: Terror Zone recommendation threshold", () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any profile data where the active Terror Zone has historical runs,
   * isRecommended = true iff (tzVPH - globalAvg) / globalAvg >= 0.10
   *
   * When no runs exist in TZ areas:
   * hasPersonalData = false and isRecommended = false
   */

  /** Generate a TZ tier */
  const tzTierArb: fc.Arbitrary<"S" | "A" | "B" | "C"> = fc.constantFrom("S", "A", "B", "C");

  /** Generate a non-TZ area name */
  const nonTzAreaArb = fc.constantFrom(
    "Non-TZ Area 1",
    "Non-TZ Area 2",
    "Non-TZ Area 3"
  );

  /** Generate a TerrorZoneInfo with 1-3 areas */
  const terrorZoneInfoArb: fc.Arbitrary<TerrorZoneInfo> = fc.record({
    name: fc.constant("Test Terror Zone"),
    areas: fc.subarray(["TZ Area Alpha", "TZ Area Beta", "TZ Area Gamma"], { minLength: 1, maxLength: 3 }),
    tier: tzTierArb,
    notes: fc.constant("Test notes"),
  });

  /** Generate a known item name + rarity pair for deterministic value points */
  const knownItemArb: fc.Arbitrary<{ name: string; rarity: string }> = fc.constantFrom(
    { name: "Harlequin Crest", rarity: "Unique" },     // high = 8 points
    { name: "Ber Rune", rarity: "Rune" },              // gg = 20 points
    { name: "Spirit", rarity: "Runeword" },            // mid = 3 points
    { name: "El Rune", rarity: "Rune" },               // worthless = 0 points
    { name: "Annihilus", rarity: "Charm" },             // gg = 20 points
    { name: "Skin of the Vipermagi", rarity: "Unique" } // mid = 3 points
  );

  /** Generate a DetailedRun in a specific area with known items */
  const detailedRunInAreaArb = (areaArb: fc.Arbitrary<string>): fc.Arbitrary<DetailedRun> =>
    fc.tuple(
      areaArb,
      fc.integer({ min: 60, max: 3600 }),
      fc.array(knownItemArb, { minLength: 0, maxLength: 5 }),
      fc.uuid()
    ).map(([area, durationSecs, itemDefs, runId]) => {
      const startedAt = "2024-06-15T10:00:00Z";
      const run: Run = {
        id: runId,
        profile_id: "profile-1",
        area,
        duration_secs: durationSecs,
        started_at: startedAt,
        finished_at: new Date(new Date(startedAt).getTime() + durationSecs * 1000).toISOString(),
        status: "completed",
        notes: null,
        player_count: null,
        route_id: null,
        route_step_index: null,
        tags: null,
      };

      const items: Item[] = itemDefs.map((itemDef, i) => ({
        id: `item-${runId}-${i}`,
        run_id: runId,
        profile_id: "profile-1",
        name: itemDef.name,
        item_type: "Armor",
        rarity: itemDef.rarity,
        found_at: startedAt,
        notes: null,
      }));

      return { run, items };
    });

  it("isRecommended = true iff (tzVPH - globalAvg) / globalAvg >= 0.10 when personal data exists", () => {
    fc.assert(
      fc.property(
        terrorZoneInfoArb.chain((tz) => {
          // Generate runs specifically in this TZ's areas
          const tzAreaForRuns = fc.constantFrom(...tz.areas);
          return fc.tuple(
            fc.constant(tz),
            fc.array(detailedRunInAreaArb(tzAreaForRuns), { minLength: 1, maxLength: 8 }),
            fc.array(detailedRunInAreaArb(nonTzAreaArb), { minLength: 0, maxLength: 5 }),
            fc.double({ min: 0.1, max: 10000, noNaN: true })
          );
        }),
        ([activeTZ, tzRuns, nonTzRuns, globalAvg]) => {
          const allRuns = [...tzRuns, ...nonTzRuns];

          const result = computeTZRecommendation(activeTZ, allRuns, globalAvg);

          // Result should not be null since we have an active TZ
          expect(result).not.toBeNull();
          if (!result) return;

          // Should have personal data since we generated runs in TZ areas
          expect(result.hasPersonalData).toBe(true);

          // Independently compute the TZ's valuePointsPerHour
          const tzAreas = new Set(activeTZ.areas);
          const matchingRuns = allRuns.filter((dr) => tzAreas.has(dr.run.area));

          let totalTimeSecs = 0;
          let totalValuePoints = 0;
          for (const dr of matchingRuns) {
            totalTimeSecs += dr.run.duration_secs;
            for (const item of dr.items) {
              const tier = getItemTier(item.name, item.rarity);
              totalValuePoints += tier.points;
            }
          }

          const totalHours = totalTimeSecs / 3600;
          const expectedTzVPH = totalHours > 0 ? totalValuePoints / totalHours : 0;

          // Compute expected percentage advantage
          const expectedPercentageAdvantage =
            globalAvg > 0 ? ((expectedTzVPH - globalAvg) / globalAvg) * 100 : 0;

          // Verify isRecommended matches the threshold logic
          const expectedIsRecommended = expectedPercentageAdvantage >= 10;
          expect(result.isRecommended).toBe(expectedIsRecommended);

          // Verify percentage advantage is close to expected
          expect(result.percentageAdvantage).toBeCloseTo(expectedPercentageAdvantage, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("hasPersonalData = false and isRecommended = false when no runs exist in TZ areas", () => {
    fc.assert(
      fc.property(
        terrorZoneInfoArb,
        // Only generate runs in non-TZ areas
        fc.array(detailedRunInAreaArb(nonTzAreaArb), { minLength: 0, maxLength: 5 }),
        fc.double({ min: 0.1, max: 10000, noNaN: true }),
        (activeTZ, nonTzRuns, globalAvg) => {
          const result = computeTZRecommendation(activeTZ, nonTzRuns, globalAvg);

          expect(result).not.toBeNull();
          if (!result) return;

          // No runs in TZ areas means no personal data
          expect(result.hasPersonalData).toBe(false);
          // Must not be recommended without personal data
          expect(result.isRecommended).toBe(false);
          // No VPH data available
          expect(result.valuePointsPerHour).toBeNull();
          expect(result.percentageAdvantage).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 8: Build-specific filtering prioritizes above-average areas", () => {
  /**
   * **Validates: Requirements 6.2**
   *
   * For any area ranking and profile class, every area in the build suggestions
   * output has a valuePointsPerHour >= the overall average valuePointsPerHour
   * across all ranked areas.
   */

  /** Generate a Profile with a valid D2R class */
  const profileArb: fc.Arbitrary<Profile> = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    class: fc.constantFrom(
      "Amazon",
      "Necromancer",
      "Barbarian",
      "Sorceress",
      "Paladin",
      "Druid",
      "Assassin"
    ),
    mode: fc.constantFrom("Ladder", "Non-Ladder", "Single Player"),
    magic_find: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 500 })),
    created_at: fc.constant("2024-01-01T00:00:00Z"),
    updated_at: fc.constant("2024-01-01T00:00:00Z"),
  });

  /** Generate an AreaMetrics entry with a specific area name and varying VPH */
  const areaMetricsArb = (areaName: string): fc.Arbitrary<AreaMetrics> =>
    fc.record({
      area: fc.constant(areaName),
      totalRuns: fc.integer({ min: 3, max: 100 }),
      totalTimeSecs: fc.integer({ min: 360, max: 36000 }),
      totalItems: fc.integer({ min: 0, max: 500 }),
      totalValuePoints: fc.integer({ min: 0, max: 10000 }),
      totalXp: fc.integer({ min: 0, max: 1000000 }),
      itemsPerHour: fc.double({ min: 0, max: 200, noNaN: true }),
      valuePointsPerHour: fc.double({ min: 0.1, max: 5000, noNaN: true }),
      xpPerHour: fc.double({ min: 0, max: 1000000, noNaN: true }),
    });

  /** Generate a list of AreaMetrics with distinct area names and varying VPH values */
  const areaRankingsArb: fc.Arbitrary<AreaMetrics[]> = fc
    .integer({ min: 2, max: 8 })
    .chain((count) => {
      const areaNames = Array.from({ length: count }, (_, i) => `Area_${i}`);
      return fc.tuple(
        ...areaNames.map((name) => areaMetricsArb(name))
      ) as fc.Arbitrary<AreaMetrics[]>;
    });

  /** Optionally generate a TerrorZoneInfo or null */
  const activeTZArb: fc.Arbitrary<TerrorZoneInfo | null> = fc.oneof(
    fc.constant(null),
    fc.record({
      name: fc.constantFrom("Chaos Sanctuary", "Pit", "Ancient Tunnels", "Cow Level"),
      areas: fc.constant(["Area_0", "Area_1"] as string[]),
      tier: fc.constantFrom("S" as const, "A" as const, "B" as const, "C" as const),
      notes: fc.constantFrom("Best for XP and items", "No cold immunes, great for Blizzard Sorc", "High density"),
    })
  );

  it("every area in build suggestions has valuePointsPerHour >= overall average", () => {
    fc.assert(
      fc.property(
        profileArb,
        areaRankingsArb,
        activeTZArb,
        (profile, areaRankings, activeTZ) => {
          const suggestions = computeBuildSuggestions(profile, areaRankings, activeTZ);

          // If no rankings, no suggestions expected
          if (areaRankings.length === 0) {
            expect(suggestions).toHaveLength(0);
            return;
          }

          // Compute overall average valuePointsPerHour
          const totalVPH = areaRankings.reduce((sum, a) => sum + a.valuePointsPerHour, 0);
          const overallAvg = totalVPH / areaRankings.length;

          // Every suggestion area must have VPH >= overall average
          for (const suggestion of suggestions) {
            const metrics = areaRankings.find((m) => m.area === suggestion.area);
            expect(metrics).toBeDefined();
            expect(metrics!.valuePointsPerHour).toBeGreaterThanOrEqual(overallAvg);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("all above-average areas are included in build suggestions", () => {
    fc.assert(
      fc.property(
        profileArb,
        areaRankingsArb,
        activeTZArb,
        (profile, areaRankings, activeTZ) => {
          const suggestions = computeBuildSuggestions(profile, areaRankings, activeTZ);

          if (areaRankings.length === 0) return;

          // Compute overall average
          const totalVPH = areaRankings.reduce((sum, a) => sum + a.valuePointsPerHour, 0);
          const overallAvg = totalVPH / areaRankings.length;

          // Every area that is above average should appear in suggestions
          const aboveAvgAreas = areaRankings.filter(
            (a) => a.valuePointsPerHour >= overallAvg
          );
          const suggestionAreaNames = new Set(suggestions.map((s) => s.area));

          for (const area of aboveAvgAreas) {
            expect(suggestionAreaNames.has(area.area)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe("Property 9: Sorceress cold-immune annotation on qualifying top-3 areas", () => {
  /**
   * **Validates: Requirements 6.3**
   *
   * For any area ranking where the profile class is "Sorceress",
   * if a top-3 area (above average) has a matching Terror Zone entry with notes
   * containing "No cold immunes" (case-insensitive), then the build suggestion
   * for that area SHALL include a "no cold immunes" annotation.
   *
   * Additionally:
   * - Areas WITHOUT "No cold immunes" in their TZ notes don't get annotated
   * - At most 3 areas get the annotation (even if more qualify)
   */

  // Find all areas from TERROR_ZONES that have "No cold immunes" in their notes
  const coldImmuneFreeTZs = TERROR_ZONES.filter(
    (tz) => tz.notes.toLowerCase().includes("no cold immunes")
  );
  // Areas that match: use both the TZ name and sub-areas
  const coldImmuneFreeAreas = coldImmuneFreeTZs.flatMap((tz) => [tz.name, ...tz.areas]);
  // Deduplicate
  const uniqueColdImmuneFreeAreas = [...new Set(coldImmuneFreeAreas)];

  // Areas that do NOT have "no cold immunes" in their notes
  const nonColdImmuneFreeTZs = TERROR_ZONES.filter(
    (tz) => !tz.notes.toLowerCase().includes("no cold immunes")
  );
  const nonColdImmuneFreeAreas = nonColdImmuneFreeTZs.flatMap((tz) => [tz.name, ...tz.areas]);
  const uniqueNonColdImmuneFreeAreas = [...new Set(nonColdImmuneFreeAreas.filter(
    (a) => !uniqueColdImmuneFreeAreas.includes(a)
  ))];

  /** Build a Sorceress profile */
  function buildSorceressProfile(): Profile {
    return {
      id: "sorc-profile-1",
      name: "Blizzard Sorc",
      class: "Sorceress",
      mode: "Softcore",
      magic_find: 300,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
  }

  it("top-3 qualifying areas with 'No cold immunes' TZ notes get annotation", () => {
    fc.assert(
      fc.property(
        // Generate VPH values for cold-immune-free areas (above average guaranteed by high values)
        fc.array(
          fc.integer({ min: 500, max: 2000 }),
          { minLength: 1, maxLength: Math.min(uniqueColdImmuneFreeAreas.length, 5) }
        ),
        // Generate VPH values for non-cold-immune-free areas (below average with low values)
        fc.array(
          fc.integer({ min: 10, max: 50 }),
          { minLength: 0, maxLength: Math.min(uniqueNonColdImmuneFreeAreas.length, 5) }
        ),
        (coldFreeVPHs, nonColdVPHs) => {
          // Build area rankings: cold-immune-free areas with high VPH, others with low VPH
          const areaRankings: AreaMetrics[] = [];

          // Add cold-immune-free areas (high VPH, above average)
          for (let i = 0; i < coldFreeVPHs.length; i++) {
            areaRankings.push(buildAreaMetrics(uniqueColdImmuneFreeAreas[i], coldFreeVPHs[i]));
          }

          // Add non-cold-immune-free areas (low VPH, below average)
          for (let i = 0; i < nonColdVPHs.length; i++) {
            areaRankings.push(buildAreaMetrics(uniqueNonColdImmuneFreeAreas[i], nonColdVPHs[i]));
          }

          // Sort descending by VPH (as computeAreaRankings would)
          areaRankings.sort((a, b) => b.valuePointsPerHour - a.valuePointsPerHour);

          const profile = buildSorceressProfile();
          const suggestions = computeBuildSuggestions(profile, areaRankings, null);

          // Compute overall average to determine above-average areas
          const totalVPH = areaRankings.reduce((sum, a) => sum + a.valuePointsPerHour, 0);
          const overallAvg = totalVPH / areaRankings.length;

          // Get qualifying cold-immune-free areas (above average + has "no cold immunes" note)
          const qualifyingColdFreeAreas = areaRankings
            .filter((a) => a.valuePointsPerHour >= overallAvg)
            .filter((a) => {
              const tz = TERROR_ZONES.find(
                (t) => t.name === a.area || t.areas.includes(a.area)
              );
              return tz?.notes.toLowerCase().includes("no cold immunes");
            });

          // Verify annotated areas get "no cold immunes"
          const annotatedSuggestions = suggestions.filter(
            (s) => s.annotation === "no cold immunes"
          );

          // Up to 3 qualifying areas should be annotated
          const expectedAnnotatedCount = Math.min(qualifyingColdFreeAreas.length, 3);
          expect(annotatedSuggestions).toHaveLength(expectedAnnotatedCount);

          // Each annotated suggestion should correspond to a qualifying cold-immune-free area
          for (const suggestion of annotatedSuggestions) {
            const tz = TERROR_ZONES.find(
              (t) => t.name === suggestion.area || t.areas.includes(suggestion.area)
            );
            expect(tz).toBeDefined();
            expect(tz!.notes.toLowerCase()).toContain("no cold immunes");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("areas without 'No cold immunes' TZ notes do NOT get annotated", () => {
    fc.assert(
      fc.property(
        // Generate VPH values for non-cold-immune-free areas (all above average)
        fc.array(
          fc.integer({ min: 500, max: 2000 }),
          { minLength: 2, maxLength: Math.min(uniqueNonColdImmuneFreeAreas.length, 5) }
        ),
        (vphs) => {
          // Build rankings with only non-cold-immune-free areas
          const areaRankings: AreaMetrics[] = vphs.map((vph, i) =>
            buildAreaMetrics(uniqueNonColdImmuneFreeAreas[i], vph)
          );

          // Sort descending by VPH
          areaRankings.sort((a, b) => b.valuePointsPerHour - a.valuePointsPerHour);

          const profile = buildSorceressProfile();
          const suggestions = computeBuildSuggestions(profile, areaRankings, null);

          // No suggestions should have a "no cold immunes" annotation
          for (const suggestion of suggestions) {
            expect(suggestion.annotation).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("at most 3 areas get the annotation even if more qualify", () => {
    fc.assert(
      fc.property(
        // Generate VPH values for many cold-immune-free areas — all high to be above average
        fc.array(
          fc.integer({ min: 800, max: 2000 }),
          { minLength: Math.min(uniqueColdImmuneFreeAreas.length, 4), maxLength: Math.min(uniqueColdImmuneFreeAreas.length, 5) }
        ),
        (vphs) => {
          // Need at least 4 cold-immune-free areas to test the cap
          // If we don't have enough real areas with "no cold immunes", skip
          if (vphs.length <= 3) return;

          // Build rankings where all areas are cold-immune-free and above average
          const areaRankings: AreaMetrics[] = vphs.map((vph, i) =>
            buildAreaMetrics(uniqueColdImmuneFreeAreas[i], vph)
          );

          // Sort descending by VPH
          areaRankings.sort((a, b) => b.valuePointsPerHour - a.valuePointsPerHour);

          const profile = buildSorceressProfile();
          const suggestions = computeBuildSuggestions(profile, areaRankings, null);

          // Count annotated suggestions
          const annotatedSuggestions = suggestions.filter(
            (s) => s.annotation === "no cold immunes"
          );

          // At most 3 should be annotated
          expect(annotatedSuggestions.length).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
