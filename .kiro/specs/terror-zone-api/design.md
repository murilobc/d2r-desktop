# Terror Zone API — Design

## Overview

The Terror Zone feature is split cleanly between a pure-logic Rust module (`src-tauri/src/tz/mod.rs`), a Tauri commands file (`src-tauri/src/tz/commands.rs`), two SQLite tables, and a React page (`TerrorZone.tsx`) with a supporting hook and banner component.

---

## Architecture

```
TerrorZone.tsx
├── loadInitial()
│   ├── getTzSettings()  → tz::commands::get_tz_settings
│   └── getTzCache()     → tz::commands::get_tz_cache
│        └─► on miss: getSpTerrorZone() → tz::commands::get_sp_terror_zone
├── polling timer (setInterval, 60s)
│   └── fetchTerrorZone() → tz::commands::fetch_terror_zone
│        └─► reqwest GET https://www.terrorzonetracker.com/api/v1/tz
│             └─► upsert terror_zone_cache
├── countdown timer (setInterval, 60s)
│   └─► resets lastFetchAt → 0 on hour boundary
├── advisor useEffect
│   ├── getAreaRunStats(profileId, zone_name)
│   └── getStatsCombined(profileId)
└── saveSettings() → updateTzSettings() → tz::commands::update_tz_settings

Pure logic (src-tauri/src/tz/mod.rs — no Tauri deps):
├── TERROR_ZONES: [&str; 65]
├── rotation_index(unix_secs: i64) → usize   (div_euclid)
├── zone_at(unix_secs: i64) → &'static str
├── next_boundary(unix_secs: i64) → i64
├── upcoming_zones(unix_secs, count) → Vec<(i64, &'static str)>
├── tier_for_zone(zone: &str) → &'static str
└── RateLimiter { last_fetch_secs, cooldown_secs }

Proptest suite (same file, #[cfg(test)]):
  P1: zone_membership
  P2: same_hour_same_zone
  P3: boundary_zone_changes
  P4: rate_limit_enforcement
  P5: upcoming_monotonic
```

---

## Database Schema

### New table: `terror_zone_cache`

```sql
CREATE TABLE IF NOT EXISTS terror_zone_cache (
    id           INTEGER PRIMARY KEY CHECK(id = 1),
    current_zone TEXT NOT NULL,
    next_zone    TEXT NOT NULL,
    upcoming     TEXT NOT NULL,   -- JSON array of zone name strings
    fetched_at   TEXT NOT NULL    -- ISO-8601 UTC
);
```

### New table: `tz_settings`

```sql
CREATE TABLE IF NOT EXISTS tz_settings (
    id              INTEGER PRIMARY KEY CHECK(id = 1),
    polling_enabled INTEGER NOT NULL DEFAULT 1,
    good_tz_tier    TEXT    NOT NULL DEFAULT 'A'   -- 'S' | 'A' | 'B' | 'C'
);

INSERT OR IGNORE INTO tz_settings (id, polling_enabled, good_tz_tier)
VALUES (1, 1, 'A');
```

Both created in `migrate_terror_zone(conn)`, called from `init_db`.

---

## Rust Pure Logic (`src-tauri/src/tz/mod.rs`)

### `TERROR_ZONES`

A `const [&str; 65]` array containing all 65 zone names in rotation order per D2R v3.2 patch.

### Core functions

```rust
pub fn rotation_index(unix_secs: i64) -> usize {
    let hour = unix_secs.div_euclid(3600);
    hour.rem_euclid(TERROR_ZONES.len() as i64) as usize
}

pub fn zone_at(unix_secs: i64) -> &'static str {
    TERROR_ZONES[rotation_index(unix_secs)]
}

pub fn next_boundary(unix_secs: i64) -> i64 {
    (unix_secs.div_euclid(3600) + 1) * 3600
}

pub fn upcoming_zones(unix_secs: i64, count: usize) -> Vec<(i64, &'static str)> {
    let base = (unix_secs.div_euclid(3600) + 1) * 3600;
    (0..count as i64).map(|i| {
        let t = base + i * 3600;
        (t, zone_at(t))
    }).collect()
}
```

### `tier_for_zone`

Uses a `OnceLock<HashMap<&str, &str>>` for the tier map. Returns "C" for unmapped zones.

### `RateLimiter`

```rust
pub struct RateLimiter {
    pub last_fetch_secs: Option<i64>,
    pub cooldown_secs: i64,
}
// should_fetch(&mut self, now_secs: i64) -> bool
```

Used only in property tests to verify the rate-limit invariant.

---

## Rust Commands (`src-tauri/src/tz/commands.rs`)

### `fetch_terror_zone`

```
async fn fetch_terror_zone(state: State<'_, DbState>)
  -> Result<TerrorZoneApiResponse, String>

1. Build reqwest::Client with 10s timeout.
2. GET https://www.terrorzonetracker.com/api/v1/tz
3. Assert response.status().is_success().
4. Parse JSON: { current: { zone }, upcoming: [{ zone }] }
5. Upsert terror_zone_cache (id=1).
6. Return TerrorZoneApiResponse { current_zone, next_zone, upcoming }.
```

### `get_sp_terror_zone`

```
fn get_sp_terror_zone(timestamp_unix: i64) -> Result<TerrorZoneInfo, String>

Calls tz::zone_at(timestamp_unix) and tz::tier_for_zone().
Returns TerrorZoneInfo { zone_name, tier, fetched_at: None }.
No DB access.
```

### `get_tz_cache`

```
fn get_tz_cache(state: State<DbState>) -> Result<Option<TerrorZoneInfo>, String>

SELECT current_zone, fetched_at FROM terror_zone_cache WHERE id = 1.
On QueryReturnedNoRows → Ok(None).
Compute tier via tz::tier_for_zone().
Return Some(TerrorZoneInfo { zone_name, tier, fetched_at }).
```

### `get_tz_settings`

```
fn get_tz_settings(state: State<DbState>) -> Result<TzSettings, String>

SELECT polling_enabled, good_tz_tier FROM tz_settings WHERE id = 1.
On QueryReturnedNoRows → return defaults { polling_enabled: true, good_tz_tier: "A" }.
```

### `update_tz_settings`

```
fn update_tz_settings(state: State<DbState>, settings: TzSettings)
  -> Result<TzSettings, String>

Validate good_tz_tier ∈ { "S", "A", "B", "C" }.
UPSERT tz_settings WHERE id = 1.
Return settings.
```

---

## TypeScript Types (`src/types.ts`)

```typescript
export interface TerrorZoneApiResponse {
  current_zone: string;
  next_zone: string;
  upcoming: string[];
}

export interface TerrorZoneInfo {
  zone_name: string;
  tier: "S" | "A" | "B" | "C";
  fetched_at: string | null;
}

export interface TzSettings {
  polling_enabled: boolean;
  good_tz_tier: "S" | "A" | "B" | "C";
}

export interface UpcomingZoneEntry {
  zone_name: string;
  tier: "S" | "A" | "B" | "C";
  utc_start_secs: number;
}
```

---

## API Layer (`src/api.ts`)

```typescript
export const fetchTerrorZone = () =>
  invoke<TerrorZoneApiResponse>("fetch_terror_zone");

export const getSpTerrorZone = (timestampUnix: number) =>
  invoke<TerrorZoneInfo>("get_sp_terror_zone", {
    timestampUnix: Math.floor(timestampUnix),
  });

export const getTzCache = () =>
  invoke<TerrorZoneInfo | null>("get_tz_cache");

export const getTzSettings = () =>
  invoke<TzSettings>("get_tz_settings");

export const updateTzSettings = (settings: TzSettings) =>
  invoke<TzSettings>("update_tz_settings", { settings });
```

---

## `useTerrorZone` Hook (optional extraction)

If extracted from `TerrorZone.tsx`, the hook manages:

```typescript
const useTerrorZone = (profileId: string) => {
  // state: tzInfo, upcoming, countdown, settings, advisorData
  // effects: loadInitial, countdown timer, polling timer, advisor loader
  return { tzInfo, upcoming, countdown, settings, saveSettings, advisorData };
};
```

---

## `TzSuggestionBanner` Component (`src/components/TzSuggestionBanner.tsx`)

```tsx
interface Props {
  tzInfo: TerrorZoneInfo | null;
  settings: TzSettings;
  onDismiss: () => void;
}

// Renders: "Active Terror Zone: {zone_name} [{tier}] — start a run here?"
// Shows only when tzInfo.tier >= settings.good_tz_tier
// Hidden after dismiss; reappears when zone changes
```

---

## `TerrorZone.tsx` Page Structure

```
<div className="page">
  <div className="page-header">
    <h1>⚡ Terror Zone</h1>
    <span className="badge">{profile.name} · {profile.class}</span>
  </div>

  <!-- Section 1: Current TZ Display -->
  <div className="herald-section">
    <h2>Current Terror Zone</h2>
    {tzInfo ? (
      <div>
        <strong>{tzInfo.zone_name}</strong> <TierBadge tier={tzInfo.tier} />
        {isRecommended && <span>✓ Recommended</span>}
        <p>Next rotation in ~{countdownMins} min · Last fetched: {time}</p>
      </div>
    ) : <p>Loading...</p>}
  </div>

  <!-- Section 2: Personal Advisor -->
  {tzInfo && advisorData && (
    <div className="herald-section">
      <h2>Your TZ Performance</h2>
      {advisorData.runCount < 3 ? <empty state> : <comparison>}
    </div>
  )}

  <!-- Section 3: TZ Calendar -->
  <div className="herald-section">
    <h2>Upcoming Zones</h2>
    <table>Zone | Tier | Active At</table>
  </div>

  <!-- Section 4: Settings -->
  <div className="herald-section">
    <h2>Settings</h2>
    <button>API Polling ON/OFF</button>
    <select>Good TZ Threshold S/A/B/C</select>
  </div>
</div>
```

---

## Proptest Properties (`src-tauri/src/tz/mod.rs`)

```
#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // P1: zone_at always returns a TERROR_ZONES member
    proptest! { fn prop_zone_membership(t: i64) { ... } }

    // P2: same-hour timestamps yield same zone
    proptest! { fn prop_same_hour_same_zone(t: i64, offset in 0i64..3600) { ... } }

    // P3: adjacent hours have different zones
    proptest! { fn prop_boundary_zone_changes(hour in -1_000_000_000i64..1_000_000_000) { ... } }

    // P4: RateLimiter never allows second dispatch within cooldown
    proptest! { fn prop_rate_limit_enforcement(start: i64, gaps: Vec<i64>) { ... } }

    // P5: upcoming_zones returns n entries with 3600s gaps
    proptest! { fn prop_upcoming_monotonic(t: i64, n in 2usize..8) { ... } }
}
```

Rule: use `//` (not `///`) before all `proptest!` macro invocations per project convention.

---

## Key Design Decisions

1. **Pure Rust module with no Tauri deps** — `tz/mod.rs` contains only pure functions. This makes proptest trivial (no mocking) and keeps the logic testable independently of the Tauri lifecycle.

2. **SP fallback is always available** — `get_sp_terror_zone` is a synchronous command that requires no network and no DB. The frontend always has a zone to display even when offline.

3. **10-minute client-side rate limit** — The frontend guards repeated calls with `lastFetchAt`. This is simpler than a server-side guard for the TZ API because TZ changes on the hour (not minute), so 10-minute granularity is sufficient.

4. **Hour-boundary auto-refresh** — The countdown timer detects when `secsUntilNextHour >= 3599` and resets `lastFetchAt = 0`, ensuring the new zone is fetched immediately after each hour boundary without requiring the user to interact.

5. **Tier computed at read time** — `tier_for_zone` is called when reading from cache or computing SP zone, so the tier map never needs to be stored in the DB.

6. **`OnceLock` for tier map** — The tier `HashMap` is initialized exactly once using `std::sync::OnceLock`, which is safe in a multi-threaded Tauri context without requiring a `Mutex`.
