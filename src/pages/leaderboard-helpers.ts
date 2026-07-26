/**
 * Pure helper functions for the Leaderboards feature.
 * No I/O, no React imports, no side effects.
 * All functions are fully tested with fast-check property tests.
 */

import type { Run, Profile, PersonalBests, Season } from "../types";

/** A run augmented with its associated item count (supplied by the Rust command). */
export interface RunWithItemCount extends Run {
  item_count: number;
}

/** Community export JSON schema (requirement 4.3). */
export interface CommunityExport {
  schema_version: "1.0";
  exported_at: string;
  profile: {
    name: string;
    class: string;
    mode: string;
    magic_find: number | null;
  };
  personal_bests: {
    fastest_run: { area: string; duration_secs: number; date: string } | null;
    best_items_in_run: { area: string; item_count: number; date: string } | null;
    best_items_per_hour: { area: string; items_per_hour: number; date: string } | null;
    longest_session_secs: number | null;
  };
  season: {
    name: string | null;
    start_date: string | null;
  };
}

type PersonalBestRun = NonNullable<PersonalBests["fastest_run"]>;
type PersonalBestItems = NonNullable<PersonalBests["best_items_in_run"]>;
type PersonalBestIPH = NonNullable<PersonalBests["best_items_per_hour"]>;

/** Filter to only valid runs (finished_at non-null). */
function validRuns(runs: RunWithItemCount[]): RunWithItemCount[] {
  return runs.filter((r) => r.finished_at !== null);
}

/** Filter to only valid runs with duration > 0. */
function timedRuns(runs: RunWithItemCount[]): RunWithItemCount[] {
  return validRuns(runs).filter((r) => r.duration_secs > 0);
}

/** Tie-break: among equal-value entries, pick the one with the latest started_at. */
function latest(a: RunWithItemCount, b: RunWithItemCount): RunWithItemCount {
  return a.started_at >= b.started_at ? a : b;
}

export function computeFastestRun(
  runs: RunWithItemCount[]
): PersonalBestRun | null {
  const eligible = timedRuns(runs);
  if (eligible.length === 0) return null;

  const min = Math.min(...eligible.map((r) => r.duration_secs));
  const candidates = eligible.filter((r) => r.duration_secs === min);
  const best = candidates.reduce(latest);
  return {
    area: best.area,
    value: best.duration_secs,
    run_id: best.id,
    date: best.started_at.slice(0, 10),
  };
}

export function computeBestItemsInRun(
  runs: RunWithItemCount[]
): PersonalBestItems | null {
  const eligible = validRuns(runs);
  if (eligible.length === 0) return null;

  const max = Math.max(...eligible.map((r) => r.item_count));
  const candidates = eligible.filter((r) => r.item_count === max);
  const best = candidates.reduce(latest);
  return {
    area: best.area,
    value: best.item_count,
    run_id: best.id,
    date: best.started_at.slice(0, 10),
    item_count: best.item_count,
  };
}

export function computeBestItemsPerHour(
  runs: RunWithItemCount[]
): PersonalBestIPH | null {
  const eligible = timedRuns(runs);
  if (eligible.length === 0) return null;

  const rates = eligible.map((r) => (r.item_count / r.duration_secs) * 3600);
  const maxRate = Math.max(...rates);
  const candidates = eligible.filter(
    (_r, i) => rates[i] === maxRate
  );
  const best = candidates.reduce(latest);
  const iph = (best.item_count / best.duration_secs) * 3600;
  return {
    area: best.area,
    value: iph,
    run_id: best.id,
    date: best.started_at.slice(0, 10),
    items_per_hour: iph,
  };
}

export function computeLongestRun(
  runs: RunWithItemCount[]
): PersonalBestRun | null {
  const eligible = validRuns(runs);
  if (eligible.length === 0) return null;

  const max = Math.max(...eligible.map((r) => r.duration_secs));
  const candidates = eligible.filter((r) => r.duration_secs === max);
  const best = candidates.reduce(latest);
  return {
    area: best.area,
    value: best.duration_secs,
    run_id: best.id,
    date: best.started_at.slice(0, 10),
  };
}

export function computePersonalBests(runs: RunWithItemCount[]): PersonalBests {
  return {
    fastest_run: computeFastestRun(runs),
    best_items_in_run: computeBestItemsInRun(runs),
    best_items_per_hour: computeBestItemsPerHour(runs),
    longest_run: computeLongestRun(runs),
  };
}

/** Compute personal bests limited to runs where finished_at >= since. */
export function computePersonalBestsSince(
  runs: RunWithItemCount[],
  since: string
): PersonalBests {
  const filtered = runs.filter(
    (r) => r.finished_at !== null && r.finished_at >= since
  );
  return computePersonalBests(filtered);
}

/** Build the community export JSON payload. */
export function buildCommunityExportJson(
  profile: Profile,
  bests: PersonalBests,
  activeSeason: Season | null
): CommunityExport {
  return {
    schema_version: "1.0",
    exported_at: new Date().toISOString(),
    profile: {
      name: profile.name.slice(0, 128),
      class: profile.class.slice(0, 64),
      mode: profile.mode.slice(0, 64),
      magic_find: profile.magic_find ?? null,
    },
    personal_bests: {
      fastest_run: bests.fastest_run
        ? {
            area: bests.fastest_run.area,
            duration_secs: bests.fastest_run.value,
            date: bests.fastest_run.date,
          }
        : null,
      best_items_in_run: bests.best_items_in_run
        ? {
            area: bests.best_items_in_run.area,
            item_count: bests.best_items_in_run.item_count,
            date: bests.best_items_in_run.date,
          }
        : null,
      best_items_per_hour: bests.best_items_per_hour
        ? {
            area: bests.best_items_per_hour.area,
            items_per_hour: bests.best_items_per_hour.items_per_hour,
            date: bests.best_items_per_hour.date,
          }
        : null,
      longest_session_secs: bests.longest_run ? bests.longest_run.value : null,
    },
    season: {
      name: activeSeason?.name ?? null,
      start_date: activeSeason?.start_date ?? null,
    },
  };
}

/** Replace filesystem-invalid characters in a filename. */
export function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-useless-escape
  return name.replace(/[\/\\:*?"<>|]/g, "_");
}

/** Compute the ISO-8601 boundaries for this month and last month. */
export function getMonthBoundaries(now: Date): {
  startA: string;
  endA: string;
  startB: string;
  endB: string;
} {
  const year = now.getFullYear();
  const month = now.getMonth();

  const startA = new Date(year, month, 1, 0, 0, 0, 0).toISOString();
  const endA = new Date(year, month + 1, 1, 0, 0, 0, 0).toISOString();
  const startB = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString();
  const endB = startA;

  return { startA, endA, startB, endB };
}
