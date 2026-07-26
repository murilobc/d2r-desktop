# Leaderboards — Design

## Overview

The leaderboards feature is pure frontend computation layered on top of three new Rust Tauri commands. All metric logic lives in `leaderboard-helpers.ts` (no I/O) so it can be property-tested without any Tauri mocking. The UI is a single page (`Leaderboards.tsx`) with four collapsible sections.

---

## Architecture

```
Leaderboards.tsx
├── § Personal Bests     → getPersonalBests()        → commands::get_personal_bests
├── § Monthly Comparison → getComparison()           → commands::get_comparison  (reused)
├── § Season Archive     → createSeason()            → commands::create_season
│                        → getSeasons()              → commands::get_seasons
└── § Export
    ├── PNG share card   → html2canvas → save() + writeFile()
    └── Community JSON   → buildCommunityExportJson() → save() + writeFile()

leaderboard-helpers.ts  (pure functions, no imports from Tauri/React)
├── computeFastestRun
├── computeBestItemsInRun
├── computeBestItemsPerHour
├── computeLongestRun
├── computePersonalBests
├── computePersonalBestsSince
├── buildCommunityExportJson
├── sanitizeFilename
└── getMonthBoundaries
```

---

## Database Schema Changes

### New table: `seasons`

```sql
CREATE TABLE IF NOT EXISTS seasons (
    id                  TEXT PRIMARY KEY,
    profile_id          TEXT NOT NULL,
    name                TEXT NOT NULL,
    start_date          TEXT NOT NULL,  -- ISO-8601
    end_date            TEXT NOT NULL,  -- ISO-8601 (== start_date at creation)
    bests_snapshot_json TEXT NOT NULL,  -- JSON-serialised PersonalBests
    created_at          TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_seasons_profile ON seasons(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_profile_name ON seasons(profile_id, name);
```

### Additive column: `profiles.season_start_date`

```sql
ALTER TABLE profiles ADD COLUMN season_start_date TEXT DEFAULT NULL;
```

Both migrations use `IF NOT EXISTS` / column-existence checks so they are safe to run on existing databases.

---

## Rust Models (`src-tauri/src/models.rs`)

```rust
pub struct PersonalBestRun {
    pub area: String,
    pub value: f64,
    pub run_id: String,
    pub date: String,        // YYYY-MM-DD
}

pub struct PersonalBestItemsInRun {
    pub area: String,
    pub value: f64,
    pub run_id: String,
    pub date: String,
    pub item_count: i64,
}

pub struct PersonalBestItemsPerHour {
    pub area: String,
    pub value: f64,
    pub run_id: String,
    pub date: String,
    pub items_per_hour: f64,
}

pub struct PersonalBests {
    pub fastest_run: Option<PersonalBestRun>,
    pub best_items_in_run: Option<PersonalBestItemsInRun>,
    pub best_items_per_hour: Option<PersonalBestItemsPerHour>,
    pub longest_run: Option<PersonalBestRun>,
}

pub struct Season {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub bests_snapshot: PersonalBests,  // deserialized from bests_snapshot_json
    pub created_at: String,
}
```

---

## Rust Commands (`src-tauri/src/commands.rs`)

### `get_personal_bests`

```
Input:  profile_id: String, since: Option<String>
Output: Result<PersonalBests, String>

Query:
  SELECT r.id, r.area, r.duration_secs, r.started_at, r.finished_at,
         COUNT(i.id) AS item_count
  FROM runs r
  LEFT JOIN items i ON i.run_id = r.id
  WHERE r.profile_id = ? AND r.status = 'completed'
    AND (? IS NULL OR r.finished_at >= ?)
  GROUP BY r.id

Then compute the four metrics in Rust using the same tie-break logic as
the TypeScript helpers (select min/max, tie-break on started_at DESC).
```

### `create_season`

```
Input:  profile_id: String, name: String
Output: Result<Season, String>

Validation: name.trim().len() in 1..=80

Steps:
  1. Call get_personal_bests(profile_id, None) internally (reads same conn)
  2. Serialize PersonalBests → JSON
  3. INSERT INTO seasons (...) with id=UUID, start_date=now, end_date=now
  4. UPDATE profiles SET season_start_date = now WHERE id = profile_id
  5. Return deserialized Season struct
```

### `get_seasons`

```
Input:  profile_id: String
Output: Result<Vec<Season>, String>

Query:
  SELECT id, profile_id, name, start_date, end_date, bests_snapshot_json, created_at
  FROM seasons WHERE profile_id = ?
  ORDER BY created_at DESC

Deserialize bests_snapshot_json → PersonalBests for each row.
```

---

## TypeScript Types (`src/types.ts`)

```typescript
export interface PersonalBest {
  area: string;
  value: number;
  run_id: string;
  date: string;       // YYYY-MM-DD
}

export interface PersonalBests {
  fastest_run: PersonalBest | null;
  best_items_in_run: (PersonalBest & { item_count: number }) | null;
  best_items_per_hour: (PersonalBest & { items_per_hour: number }) | null;
  longest_run: PersonalBest | null;
}

export interface Season {
  id: string;
  profile_id: string;
  name: string;
  start_date: string;
  end_date: string;
  bests_snapshot: PersonalBests;
  created_at: string;
}
```

---

## API Layer (`src/api.ts`)

```typescript
export const getPersonalBests = (profileId: string, since?: string) =>
  invoke<PersonalBests>("get_personal_bests", { profileId, since: since ?? null });

export const createSeason = (profileId: string, name: string) =>
  invoke<Season>("create_season", { profileId, name });

export const getSeasons = (profileId: string) =>
  invoke<Season[]>("get_seasons", { profileId });
```

---

## `leaderboard-helpers.ts`

Location: `src/pages/leaderboard-helpers.ts`

Key interfaces and functions:

```typescript
interface RunWithItemCount extends Run { item_count: number }
interface CommunityExport { schema_version: "1.0"; exported_at: string; profile: {...}; personal_bests: {...}; season: {...} }

computeFastestRun(runs)       → PersonalBestRun | null
computeBestItemsInRun(runs)   → PersonalBestItems | null
computeBestItemsPerHour(runs) → PersonalBestIPH | null
computeLongestRun(runs)       → PersonalBestRun | null
computePersonalBests(runs)    → PersonalBests
computePersonalBestsSince(runs, since) → PersonalBests
buildCommunityExportJson(profile, bests, season) → CommunityExport
sanitizeFilename(name)        → string  (replaces /\:*?"<>| with _)
getMonthBoundaries(now)       → { startA, endA, startB, endB }
```

All functions are pure — no `invoke`, no `useState`, no side effects.

---

## `Leaderboards.tsx` — Component Structure

```
<div className="page">
  <!-- off-screen share card (html2canvas target) -->
  <div ref={shareCardRef} style={{ position: "absolute", left: "-9999px" }}>
    ...personal bests table...
  </div>

  <!-- Section 1: Personal Bests -->
  <div className="herald-section">
    <h2>Personal Bests</h2>
    <table className="stats-table">...</table>
  </div>

  <!-- Section 2: Monthly Comparison -->
  <div className="herald-section">
    <h2>Monthly Comparison</h2>
    <table className="stats-table">...</table>
  </div>

  <!-- Section 3: Season Archive -->
  <div className="herald-section">
    <h2>Season Archive</h2>
    <button>⊞ Start New Season</button>
    <table className="stats-table">...</table>
    {showSeasonDialog && <modal>...</modal>}
  </div>

  <!-- Section 4: Export -->
  <div className="herald-section">
    <h2>Export</h2>
    <button onClick={handleExportPng}>◫ Export Share Card (PNG)</button>
    <button onClick={handleExportJson}>↓ Export Community JSON</button>
  </div>
</div>
```

State: `bests`, `comparison`, `seasons`, `showSeasonDialog`, `seasonName`, `exportPngError`, `exportJsonError`.

Polling: `setInterval(loadBests, 5000)` started in the `useEffect` for personal bests.

---

## Property-Based Tests (`src/pages/Leaderboards.property.test.ts`)

Uses **fast-check** + vitest. 13 properties verify:

| Property | What it checks |
|----------|----------------|
| P1 | `computeFastestRun` → minimum `duration_secs` |
| P2 | `computeBestItemsInRun` → maximum `item_count` |
| P3 | `computeBestItemsPerHour` → maximum rate |
| P4 | Invalid runs excluded from all metrics |
| P5 | Adding a non-improving run changes nothing |
| P6 | Every returned `run_id` is in the input set |
| P7 | Tie-break picks the run with the later `started_at` |
| P8 | `computePersonalBestsSince` = `computePersonalBests` on filtered subset |
| P9 | `buildCommunityExportJson` always has 5 top-level keys |
| P10 | JSON round-trip preserves all field values |
| P11 | Null bests serialize as `null`, not `undefined`/omitted |
| P12 | `sanitizeFilename` strips all 9 forbidden characters |
| P13 | `getMonthBoundaries` produces correct first-of-month ISO timestamps |

Each property runs 100–200 samples.

---

## Key Design Decisions

1. **Computation in Rust, not TypeScript** — The `get_personal_bests` command does a single SQL join and computes all four metrics server-side. The TypeScript helpers exist for PBT isolation and future offline use, not as the primary code path.

2. **Season archive uses a JSON snapshot** — `bests_snapshot_json` stores the serialized `PersonalBests` at the moment of archival, which avoids a complex historical query later.

3. **`getMonthBoundaries` uses local wall-clock time** — Month boundaries are computed in the user's local timezone (matching how players think about "this month"), not UTC.

4. **html2canvas for PNG export** — The share card is rendered off-screen at a fixed 600 px width. The canvas blob is written via Tauri's `plugin-fs` `writeFile`, not a `<a>` download trick (per project conventions).

5. **Season name uniqueness** — Enforced via `CREATE UNIQUE INDEX ... ON seasons(profile_id, name)`, so the database rejects duplicates with a clear error that the UI surfaces.
