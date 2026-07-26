# DClone API — Design

## Overview

The DClone API upgrade adds two new Rust Tauri commands (`poll_dclone_api`, `get_dclone_settings`, `update_dclone_settings`, and an updated `update_dclone_progress`) backed by two SQLite migrations. The frontend switches from a placeholder to a real auto-polling timer.

---

## Architecture

```
DCloneTracker.tsx
├── loadData()        → getDcloneProgress()    → commands::get_dclone_progress
│                     → getDcloneSettings()    → commands::get_dclone_settings
│                     → getAnniLogs()          → commands::get_anni_logs
├── polling timer     → pollDcloneApi()        → commands::poll_dclone_api
│                          └─► reqwest GET https://diablo2.io/api/
│                               └─► UPDATE dclone_progress (skips manual overrides)
│                               └─► UPDATE dclone_settings.last_poll_at
├── handleUpdateProgress() → updateDcloneProgress() → commands::update_dclone_progress
├── handleClearOverride()  → updateDcloneProgress(is_manual_override=false)
└── saveSettings()    → updateDcloneSettings() → commands::update_dclone_settings

Pure logic (commands.rs helper fns, testable without DB):
  clamp_progress(n: i64) → i64
  map_region_code(code: &str) → &'static str
  map_mode_code(code: &str) → &'static str
```

---

## Database Schema Changes

### Migration v1: `dclone_progress` (already existed, single PK on `region`)

Already applied in the initial migration. The v2 migration (see below) upgrades it to a composite PK.

### Migration v2: `dclone_progress` composite PK (new)

```sql
-- Recreate with composite PK (region, mode) and new columns
CREATE TABLE IF NOT EXISTS dclone_progress_new (
    region              TEXT NOT NULL,
    mode                TEXT NOT NULL DEFAULT 'Non-Ladder',
    progress            INTEGER NOT NULL DEFAULT 1,
    last_updated        TEXT NOT NULL,
    is_manual_override  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (region, mode)
);

-- Migrate existing rows (single mode) to new table
INSERT OR IGNORE INTO dclone_progress_new (region, mode, progress, last_updated, is_manual_override)
SELECT region, 'Non-Ladder', progress, last_updated, 0
FROM dclone_progress;

DROP TABLE dclone_progress;
ALTER TABLE dclone_progress_new RENAME TO dclone_progress;
```

### New table: `dclone_settings`

```sql
CREATE TABLE IF NOT EXISTS dclone_settings (
    id                      INTEGER PRIMARY KEY CHECK(id = 1),
    auto_fetch_enabled      INTEGER NOT NULL DEFAULT 1,
    poll_interval_minutes   INTEGER NOT NULL DEFAULT 5,
    notify_threshold        INTEGER NOT NULL DEFAULT 5,
    preferred_region        TEXT NOT NULL DEFAULT 'Americas',
    preferred_mode          TEXT NOT NULL DEFAULT 'Non-Ladder',
    last_poll_at            TEXT,
    last_notified_progress  INTEGER DEFAULT NULL
);

INSERT OR IGNORE INTO dclone_settings
    (id, auto_fetch_enabled, poll_interval_minutes, notify_threshold, preferred_region, preferred_mode)
VALUES (1, 1, 5, 5, 'Americas', 'Non-Ladder');
```

---

## Rust Models (`src-tauri/src/models.rs`)

```rust
pub struct DCloneProgress {
    pub region: String,
    pub mode: String,
    pub progress: i64,
    pub last_updated: String,
    pub is_manual_override: bool,
}

pub struct DCloneSettings {
    pub auto_fetch_enabled: bool,
    pub poll_interval_minutes: u32,  // 5 | 10 | 15 | 30
    pub notify_threshold: u8,        // 3–6
    pub preferred_region: String,
    pub preferred_mode: String,
    pub last_poll_at: Option<String>,
    pub last_notified_progress: Option<i64>,
}

/// Raw record as returned by the diablo2.io API
pub struct DCloneApiRecord {
    pub region: String,     // "1" | "2" | "3"
    pub mode: String,       // "1" | "2" | "3" | "4"
    pub progress: String,   // numeric string; parse then clamp to [1,6]
    pub updated: String,    // Unix timestamp string
}
```

---

## Rust Commands (`src-tauri/src/commands.rs`)

### Pure helper functions

```rust
fn clamp_progress(raw: i64) -> i64 {
    raw.clamp(1, 6)
}

fn map_region_code(code: &str) -> &'static str {
    match code {
        "1" => "Americas",
        "2" => "Europe",
        "3" => "Asia",
        _   => "Unknown",
    }
}

fn map_mode_code(code: &str) -> &'static str {
    match code {
        "1" => "Non-Ladder",
        "2" => "Ladder",
        "3" => "Hardcore Non-Ladder",
        "4" => "Hardcore Ladder",
        _   => "Unknown",
    }
}
```

### `poll_dclone_api`

```
async fn poll_dclone_api(state) -> Result<Vec<DCloneProgress>, String>

1. Lock DB, read last_poll_at from dclone_settings.
2. If last_poll_at is set and < 1 minute ago:
   → return current dclone_progress rows without HTTP call.
3. HTTP GET https://diablo2.io/api/ with 10s timeout.
4. Parse JSON array of DCloneApiRecord.
5. For each record:
   - map region code → string, map mode code → string
   - clamp progress to [1, 6]
   - UPSERT into dclone_progress WHERE is_manual_override = 0
6. UPDATE dclone_settings SET last_poll_at = now WHERE id = 1
7. Return all current dclone_progress rows.
```

### `get_dclone_settings`

```
fn get_dclone_settings(state) -> Result<DCloneSettings, String>

SELECT row from dclone_settings WHERE id = 1.
Return defaults if no row exists (first run).
```

### `update_dclone_settings`

```
fn update_dclone_settings(state, settings) -> Result<DCloneSettings, String>

Validate:
  - poll_interval_minutes ∈ {5, 10, 15, 30}
  - notify_threshold ∈ [3, 6]

UPSERT into dclone_settings WHERE id = 1.
Return the saved settings.
```

### `update_dclone_progress` (updated signature)

```
fn update_dclone_progress(state, region, progress, mode?, is_manual_override?) -> Result<DCloneProgress, String>

Clamp progress to [1, 6].
mode defaults to "Non-Ladder" if None.
UPSERT (region, mode) row.
Return updated DCloneProgress.
```

---

## TypeScript Types (`src/types.ts`)

```typescript
export interface DCloneProgress {
  region: string;
  mode: string;
  progress: number;          // 1–6
  last_updated: string;
  is_manual_override: boolean;
}

export interface DCloneSettings {
  auto_fetch_enabled: boolean;
  poll_interval_minutes: number;   // 5 | 10 | 15 | 30
  notify_threshold: number;        // 3–6
  preferred_region: string;
  preferred_mode: string;
  last_poll_at: string | null;
  last_notified_progress: number | null;
}

export const DCLONE_REGIONS = ["Americas", "Europe", "Asia"] as const;
export const DCLONE_MODES = [
  "Non-Ladder", "Ladder", "Hardcore Non-Ladder", "Hardcore Ladder"
] as const;
export const DCLONE_POLL_INTERVALS = [5, 10, 15, 30] as const;
```

---

## API Layer (`src/api.ts`)

```typescript
export const pollDcloneApi = () =>
  invoke<DCloneProgress[]>("poll_dclone_api");

export const getDcloneSettings = () =>
  invoke<DCloneSettings>("get_dclone_settings");

export const updateDcloneSettings = (settings: DCloneSettings) =>
  invoke<DCloneSettings>("update_dclone_settings", { settings });

// Updated signature — mode + isManualOverride now supported
export const updateDcloneProgress = (
  region: string, progress: number, mode?: string, isManualOverride?: boolean
) =>
  invoke<DCloneProgress>("update_dclone_progress", {
    region, progress,
    mode: mode ?? null,
    isManualOverride: isManualOverride ?? null,
  });
```

---

## `DCloneTracker.tsx` Changes

### State additions

```typescript
const [settings, setSettings] = useState<DCloneSettings>({
  auto_fetch_enabled: true,
  poll_interval_minutes: 5,
  notify_threshold: 5,
  preferred_region: "Americas",
  preferred_mode: "Non-Ladder",
  last_poll_at: null,
  last_notified_progress: null,
});
const [settingsError, setSettingsError] = useState<string | null>(null);
```

### Polling `useEffect`

```typescript
useEffect(() => {
  if (!settings.auto_fetch_enabled) return;
  const intervalMs = settings.poll_interval_minutes * 60 * 1000;
  const timer = setInterval(async () => {
    try {
      const records = await pollDcloneApi();
      setProgress(records);
    } catch { /* silent fail */ }
  }, intervalMs);
  return () => clearInterval(timer);
}, [settings.auto_fetch_enabled, settings.poll_interval_minutes]);
```

### localStorage migration (in `loadData`)

```typescript
const legacyThreshold = localStorage.getItem("d2r-dclone-notify-threshold");
const legacyRegion = localStorage.getItem("d2r-dclone-preferred-region");
if (legacyThreshold || legacyRegion) {
  // Merge with DB settings, persist, then remove localStorage keys
}
```

### Per-mode progress rendering

Renders one card per region, with one sub-row per mode. Uses `getRegionModeProgress(region, mode)` to look up the relevant `DCloneProgress` record.

### Stale indicator

```typescript
const isStale = (rp: DCloneProgress): boolean => {
  const age = Date.now() - new Date(rp.last_updated).getTime();
  return age > settings.poll_interval_minutes * 2 * 60 * 1000;
};
```

---

## Property-Based Tests

Location: `src/pages/DCloneTracker.property.test.ts` (or `dclone.property.test.ts`)

Vitest + fast-check, 4 properties:

| # | Property | Generator |
|---|----------|-----------|
| P1 | `clampProgress(n) ∈ [1, 6]` | `fc.integer()` |
| P2 | `mapRegionCode(code)` returns known string or fallback | `fc.oneof(fc.constantFrom("1","2","3"), fc.string())` |
| P3 | `mapModeCode(code)` returns known string or fallback | `fc.oneof(fc.constantFrom("1","2","3","4"), fc.string())` |
| P4 | `isStale` returns true iff elapsed > `pollIntervalMinutes × 2 min` | `fc.integer({ min: 0 })` for elapsed ms |

These functions are re-exported from a `dclone-helpers.ts` module (pure, no I/O) so they can be tested without mocking Tauri or SQLite.

---

## Key Design Decisions

1. **Rust owns all HTTP** — reqwest is only available in the Rust backend. This prevents CORS issues, avoids weakening CSP, and centralizes rate-limit logic.

2. **Manual overrides are sticky** — `is_manual_override = true` means API polling skips that row. The user explicitly clears the override by clicking "Clear override".

3. **Settings in SQLite** — `dclone_settings` replaces localStorage for persistence, enabling cross-device sync in the future. The localStorage migration path is one-way.

4. **Silent polling failures** — Network errors during auto-poll leave existing UI state unchanged. Only settings-save failures show an error banner (because they're user-triggered).

5. **Composite PK migration** — The v1 `dclone_progress` table had `region TEXT PRIMARY KEY`. The v2 migration recreates it with `PRIMARY KEY (region, mode)` using a rename approach to avoid SQLite's lack of `DROP CONSTRAINT`.
