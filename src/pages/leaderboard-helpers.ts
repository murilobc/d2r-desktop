import type { Profile, PersonalBests, PersonalBest, Season } from "../types";
import type { Run } from "../types";

// Local type extending Run with item_count fetched from items table
export type RunWithItemCount = Run & { item_count: number };

// Community export schema (requirement 4.3)
export interface CommunityExport {
  schema_version: string;
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

// Returns the run with the lowest duration_secs > 0; tie-breaks by latest started_at.
// Returns null if no valid runs exist.
export function computeFastestRun(runs: RunWithItemCount[]): (PersonalBest) | null {
  const valid = runs.filter(
    (r) => r.duration_secs > 0 && r.finished_at !== null
  );
  if (valid.length === 0) return null;

  const minDuration = Math.min(...valid.map((r) => r.duration_secs));
  const candidates = valid.filter((r) => r.duration_secs === minDuration);
  candidates.sort((a, b) => b.started_at.localeCompare(a.started_at));
  const best = candidates[0];
  return {
    area: best.area,
    value: best.duration_secs,
    run_id: best.id,
    date: best.started_at.slice(0, 10),
  };
}

// Returns the run with the highest item_count; tie-breaks by latest started_at.
// Returns null if no valid runs (finished_at not null) exist.
export function computeBestItemsInRun(
  runs: RunWithItemCount[]
): (PersonalBest & { item_count: number }) | null {
  const valid = runs.filter((r) => r.finished_at !== null);
  if (valid.length === 0) return null;

  const maxItems = Math.max(...valid.map((r) => r.item_count));
  const candidates = valid.filter((r) => r.item_count === maxItems);
  candidates.sort((a, b) => b.started_at.localeCompare(a.started_at));
  const best = candidates[0];
  return {
    area: best.area,
    value: best.item_count,
    run_id: best.id,
    date: best.started_at.slice(0, 10),
    item_count: best.item_count,
  };
}

// Returns the run with the highest (item_count / duration_secs) * 3600 rate.
// Excludes runs with duration_secs = 0 or finished_at = null.
// Tie-breaks by latest started_at.
export function computeBestItemsPerHour(
  runs: RunWithItemCount[]
): (PersonalBest & { items_per_hour: number }) | null {
  const valid = runs.filter(
    (r) => r.duration_secs > 0 && r.finished_at !== null
  );
  if (valid.length === 0) return null;

  const rates = valid.map((r) => ({
    run: r,
    rate: (r.item_count / r.duration_secs) * 3600,
  }));
  const maxRate = Math.max(...rates.map((x) => x.rate));
  const candidates = rates.filter((x) => x.rate === maxRate);
  candidates.sort((a, b) => b.run.started_at.localeCompare(a.run.started_at));
  const best = candidates[0];
  return {
    area: best.run.area,
    value: best.rate,
    run_id: best.run.id,
    date: best.run.started_at.slice(0, 10),
    items_per_hour: best.rate,
  };
}

// Returns the run with the highest duration_secs.
// Filters out runs with finished_at = null.
// Tie-breaks by latest started_at.
export function computeLongestRun(runs: RunWithItemCount[]): PersonalBest | null {
  const valid = runs.filter((r) => r.finished_at !== null);
  if (valid.length === 0) return null;

  const maxDuration = Math.max(...valid.map((r) => r.duration_secs));
  const candidates = valid.filter((r) => r.duration_secs === maxDuration);
  candidates.sort((a, b) => b.started_at.localeCompare(a.started_at));
  const best = candidates[0];
  return {
    area: best.area,
    value: best.duration_secs,
    run_id: best.id,
    date: best.started_at.slice(0, 10),
  };
}

// Computes all four personal bests from an array of runs.
export function computePersonalBests(runs: RunWithItemCount[]): PersonalBests {
  return {
    fastest_run: computeFastestRun(runs),
    best_items_in_run: computeBestItemsInRun(runs),
    best_items_per_hour: computeBestItemsPerHour(runs),
    longest_run: computeLongestRun(runs),
  };
}

// Filter runs by finished_at >= since and then compute personal bests.
export function computePersonalBestsSince(
  runs: RunWithItemCount[],
  since: string
): PersonalBests {
  const filtered = runs.filter(
    (r) => r.finished_at !== null && r.finished_at >= since
  );
  return computePersonalBests(filtered);
}

// Assembles the full community export JSON object (requirement 4.3).
// All missing metric fields serialize as null, not omitted.
export function buildCommunityExportJson(
  profile: Profile,
  bests: PersonalBests,
  activeSeason: Season | null
): CommunityExport {
  const name = profile.name.slice(0, 128);
  const cls = profile.class.slice(0, 64);
  const mode = profile.mode.slice(0, 64);
  const magicFind =
    profile.magic_find !== null && profile.magic_find !== undefined
      ? Math.min(65535, Math.max(0, profile.magic_find))
      : null;

  const fastestRun = bests.fastest_run
    ? {
        area: bests.fastest_run.area,
        duration_secs: Math.min(86400, Math.max(0, bests.fastest_run.value)),
        date: bests.fastest_run.date,
      }
    : null;

  const bestItemsInRun = bests.best_items_in_run
    ? {
        area: bests.best_items_in_run.area,
        item_count: Math.min(9999, Math.max(0, bests.best_items_in_run.item_count)),
        date: bests.best_items_in_run.date,
      }
    : null;

  const bestItemsPerHour = bests.best_items_per_hour
    ? {
        area: bests.best_items_per_hour.area,
        items_per_hour: Math.min(
          99999,
          Math.max(0, bests.best_items_per_hour.items_per_hour)
        ),
        date: bests.best_items_per_hour.date,
      }
    : null;

  const longestSessionSecs =
    bests.longest_run !== null
      ? Math.min(864000, Math.max(0, bests.longest_run.value))
      : null;

  return {
    schema_version: "1.0",
    exported_at: new Date().toISOString(),
    profile: {
      name,
      class: cls,
      mode,
      magic_find: magicFind,
    },
    personal_bests: {
      fastest_run: fastestRun,
      best_items_in_run: bestItemsInRun,
      best_items_per_hour: bestItemsPerHour,
      longest_session_secs: longestSessionSecs,
    },
    season: {
      name: activeSeason?.name ?? null,
      start_date: activeSeason?.start_date ?? null,
    },
  };
}

// Replaces characters invalid in filesystem filenames with underscores.
// Invalid chars: / \ : * ? " < > |
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_");
}

// Computes first-of-current-month (startA/endB), first-of-next-month (endA),
// and first-of-previous-month (startB) as ISO date strings using local time.
export function getMonthBoundaries(now: Date): {
  startA: string;
  endA: string;
  startB: string;
  endB: string;
} {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // startA = first day of current month at 00:00:00 local
  const startA = new Date(year, month, 1, 0, 0, 0, 0);

  // endA = first day of next month at 00:00:00 local
  const endA = new Date(year, month + 1, 1, 0, 0, 0, 0);

  // startB = first day of previous month at 00:00:00 local
  const startB = new Date(year, month - 1, 1, 0, 0, 0, 0);

  // endB = startA (exclusive upper bound for previous month)
  const endB = new Date(startA);

  const toIso = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const sec = String(d.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${day}T${h}:${min}:${sec}`;
  };

  return {
    startA: toIso(startA),
    endA: toIso(endA),
    startB: toIso(startB),
    endB: toIso(endB),
  };
}
