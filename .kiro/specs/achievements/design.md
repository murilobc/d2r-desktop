# Design Document: Achievements

## Overview

This document describes the architecture, components, and interfaces for the achievements system in D2R Tracker. The feature adds per-profile achievement tracking with four categories (milestone, streak, per-class, per-area), automatic evaluation on run completion, toast notifications, and a gallery page with lifetime statistics.

## Architecture

The achievements feature follows the existing Tauri 2 architecture: a Rust backend module (`achievements.rs`) handles data storage and evaluation logic, exposed via Tauri commands, while a React frontend consumes results through `invoke` calls and renders the gallery, toasts, and lifetime stats.

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React 19 + TypeScript)                        │
│  ┌───────────────┐  ┌────────────────┐  ┌───────────┐  │
│  │ AchievementsPage │ │ UnlockToast    │  │ LifetimeStats │
│  │ (gallery+filter) │ │ (queue+dismiss)│  │ (dashboard) │  │
│  └───────┬───────┘  └───────┬────────┘  └─────┬─────┘  │
│          │                   │                  │        │
│          └─────── api.ts ────┴──────────────────┘        │
└──────────────────────┬──────────────────────────────────┘
                       │ invoke()
┌──────────────────────┴──────────────────────────────────┐
│ Backend (Rust / Tauri 2)                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │ achievements.rs (Achievement_Engine)              │   │
│  │  - evaluate_achievements(profile_id) → Vec<Unlock>│   │
│  │  - get_achievement_definitions() → Vec<Definition>│   │
│  │  - get_achievement_progress(profile_id)           │   │
│  │  - get_lifetime_stats(profile_id)                 │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────┴───────────────────────────┐   │
│  │ SQLite (rusqlite)                                 │   │
│  │  - achievement_definitions                        │   │
│  │  - achievement_unlocks                            │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### 1. Achievement_Engine Module (`src-tauri/src/achievements.rs`)

Responsible for:
- Schema migration (creating `achievement_definitions` and `achievement_unlocks` tables)
- Seeding default achievement definitions on first run
- Evaluating all locked achievements for a profile in a single batch pass
- Computing streak calculations from run timestamps
- Computing lifetime statistics aggregations

#### 2. Database Tables

**`achievement_definitions`** — stores the catalog of all possible achievements:

```sql
CREATE TABLE IF NOT EXISTS achievement_definitions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK(category IN ('milestone', 'streak', 'per-class', 'per-area')),
    name_key TEXT NOT NULL,
    description_key TEXT NOT NULL,
    icon TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    condition_target TEXT,
    threshold INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);
```

**`achievement_unlocks`** — records which profile unlocked which achievement and when:

```sql
CREATE TABLE IF NOT EXISTS achievement_unlocks (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    definition_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (definition_id) REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    UNIQUE(profile_id, definition_id)
);

CREATE INDEX IF NOT EXISTS idx_unlocks_profile ON achievement_unlocks(profile_id);
```

#### 3. Tauri Commands

New commands exposed in `commands.rs` and registered in `lib.rs`:

```rust
#[tauri::command]
pub fn evaluate_achievements(
    state: tauri::State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<AchievementUnlock>, String>;

#[tauri::command]
pub fn get_achievement_definitions(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<AchievementDefinition>, String>;

#[tauri::command]
pub fn get_achievement_progress(
    state: tauri::State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<AchievementProgress>, String>;

#[tauri::command]
pub fn get_lifetime_stats(
    state: tauri::State<'_, DbState>,
    profile_id: String,
) -> Result<LifetimeStats, String>;
```

### Frontend Components

#### 1. AchievementsPage (`src/pages/Achievements.tsx`)

Full-page view containing:
- Category filter tabs (All / Milestone / Streak / Per-Class / Per-Area)
- Achievement gallery grid with locked/unlocked visual states
- Progress bars for locked achievements
- Lifetime stats dashboard section

#### 2. UnlockToast (`src/components/UnlockToast.tsx`)

A notification component that:
- Receives a queue of newly unlocked achievements
- Displays them one at a time with name + icon
- Auto-dismisses each after 3–5 seconds (configurable via constant)
- Supports manual dismiss (click or Escape)
- Plays the "milestone" sound via an audio element on mount

#### 3. Achievement Toast Queue Manager (hook: `src/hooks/useAchievementToasts.ts`)

A React hook that:
- Maintains a FIFO queue of pending unlock notifications
- Manages the active toast and transitions between queued items
- Integrates with the `finish_run` flow — after a run completes, calls `evaluate_achievements` and feeds results into the queue

## Interfaces

### Rust Models (added to `src-tauri/src/models.rs`)

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AchievementDefinition {
    pub id: String,
    pub category: String,          // "milestone" | "streak" | "per-class" | "per-area"
    pub name_key: String,
    pub description_key: String,
    pub icon: String,
    pub condition_type: String,     // "total_runs" | "total_items" | "total_time" | "streak_days" | "class_runs" | "area_runs"
    pub condition_target: Option<String>,  // class name or area name
    pub threshold: i64,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AchievementUnlock {
    pub id: String,
    pub profile_id: String,
    pub definition_id: String,
    pub unlocked_at: String,
    pub definition: AchievementDefinition,  // joined for convenience
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AchievementProgress {
    pub definition: AchievementDefinition,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
    pub current_value: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LifetimeStats {
    pub total_time_hours: f64,
    pub total_runs: i64,
    pub total_items: i64,
    pub runs_by_class: Vec<ClassCount>,
    pub runs_by_area: Vec<AreaCount>,
    pub items_by_rarity: Vec<RarityCount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClassCount {
    pub class: String,
    pub count: i64,
}
```

### TypeScript Types (added to `src/types.ts`)

```typescript
export interface AchievementDefinition {
  id: string;
  category: "milestone" | "streak" | "per-class" | "per-area";
  name_key: string;
  description_key: string;
  icon: string;
  condition_type: string;
  condition_target: string | null;
  threshold: number;
  sort_order: number;
}

export interface AchievementUnlock {
  id: string;
  profile_id: string;
  definition_id: string;
  unlocked_at: string;
  definition: AchievementDefinition;
}

export interface AchievementProgress {
  definition: AchievementDefinition;
  unlocked: boolean;
  unlocked_at: string | null;
  current_value: number;
}

export interface LifetimeStats {
  total_time_hours: number;
  total_runs: number;
  total_items: number;
  runs_by_class: { class: string; count: number }[];
  runs_by_area: { area: string; count: number }[];
  items_by_rarity: { rarity: string; count: number }[];
}

export type AchievementCategory = "milestone" | "streak" | "per-class" | "per-area";

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  "milestone", "streak", "per-class", "per-area"
];
```

### API Functions (added to `src/api.ts`)

```typescript
export const evaluateAchievements = (profileId: string) =>
  invoke<AchievementUnlock[]>("evaluate_achievements", { profileId });

export const getAchievementDefinitions = () =>
  invoke<AchievementDefinition[]>("get_achievement_definitions");

export const getAchievementProgress = (profileId: string) =>
  invoke<AchievementProgress[]>("get_achievement_progress", { profileId });

export const getLifetimeStats = (profileId: string) =>
  invoke<LifetimeStats>("get_lifetime_stats", { profileId });
```

## Data Models

### Achievement Definition Categories and Conditions

| Category   | condition_type  | condition_target | Example                         |
|-----------|-----------------|------------------|---------------------------------|
| milestone | total_runs      | NULL             | Reach 100 total runs            |
| milestone | total_items     | NULL             | Find 500 total items            |
| milestone | total_time      | NULL             | Play 100 hours                  |
| streak    | streak_days     | NULL             | 7 consecutive days with a run   |
| per-class | class_runs      | "Sorceress"      | 1000 runs as Sorceress          |
| per-area  | area_runs       | "Pit"            | 500 runs in Pit                 |

### Evaluation Logic (Pseudocode)

```rust
fn evaluate_achievements(conn: &Connection, profile_id: &str) -> Vec<AchievementUnlock> {
    // 1. Get all definitions NOT yet unlocked by this profile
    let locked = get_locked_definitions(conn, profile_id);

    // 2. Compute current profile stats once
    let stats = compute_profile_stats(conn, profile_id);
    let streak = compute_streak(conn, profile_id);

    // 3. Check each locked definition
    let mut newly_unlocked = Vec::new();
    for def in locked {
        let current_value = match def.condition_type.as_str() {
            "total_runs" => stats.total_runs,
            "total_items" => stats.total_items,
            "total_time" => stats.total_time_secs / 3600,  // hours
            "streak_days" => streak,
            "class_runs" => stats.runs_for_class(&def.condition_target),
            "area_runs" => stats.runs_for_area(&def.condition_target),
            _ => 0,
        };

        if current_value >= def.threshold {
            let unlock = create_unlock_record(conn, profile_id, &def.id);
            newly_unlocked.push(unlock);
        }
    }
    newly_unlocked
}
```

### Streak Calculation

```rust
fn compute_streak(conn: &Connection, profile_id: &str) -> i64 {
    // Get all completed run dates (local timezone), sorted descending
    let dates: Vec<NaiveDate> = get_run_dates_desc(conn, profile_id);

    if dates.is_empty() { return 0; }

    let today = Local::now().date_naive();
    let mut streak = 0i64;
    let mut expected = today;

    for date in dates.iter().dedup() {
        if *date == expected {
            streak += 1;
            expected = expected.pred_opt().unwrap_or(expected);
        } else if *date < expected {
            break; // gap found, streak ends
        }
        // skip duplicate dates (multiple runs same day)
    }
    streak
}
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Database locked during evaluation | Return Tauri error string; frontend retries on next run completion |
| Invalid condition_type in definition | Skip that definition silently (log warning); continue evaluation |
| Profile deleted mid-evaluation | FK CASCADE removes unlocks; evaluation returns empty |
| Missing translation key | i18next fallback to en-US (configured in i18n init) |
| Sound file unavailable | Catch audio play error silently; toast still displays |

## I18n Integration

Achievement definitions store `name_key` and `description_key` referencing translation keys in the `achievements` namespace:

```json
// en-US.json (excerpt)
{
  "achievements": {
    "names": {
      "milestone_100_runs": "Century Runner",
      "milestone_500_runs": "Marathon Farmer",
      "streak_7_days": "Week Warrior",
      "class_sorceress_1000": "Sorceress Master",
      "area_pit_500": "Pit Lord"
    },
    "descriptions": {
      "milestone_100_runs": "Complete 100 total runs",
      "milestone_500_runs": "Complete 500 total runs",
      "streak_7_days": "Run for 7 consecutive days",
      "class_sorceress_1000": "Complete 1000 runs as Sorceress",
      "area_pit_500": "Complete 500 runs in the Pit"
    }
  }
}
```

Frontend renders via: `t(\`achievements.names.${def.name_key}\`)`

## Frontend Flow: Run Completion → Toast

1. User finishes a run → `finishRun()` API call returns successfully
2. Frontend calls `evaluateAchievements(profileId)` immediately after
3. If the response contains unlocks, they are pushed into the toast queue
4. `useAchievementToasts` hook shifts items from the queue one at a time
5. `UnlockToast` renders with name (resolved via i18n) + icon
6. Audio element plays `milestone.mp3` on toast mount
7. Toast auto-dismisses after configured duration (default 4s)
8. If more items in queue, next toast appears after a short 300ms gap

## Testing Strategy

- **Property-based tests** (fast-check + vitest): Validate universal properties of the evaluation logic — milestone thresholds, streak calculations, per-class/per-area filtering, batch completeness, profile isolation, category filtering, and i18n resolution.
- **Unit tests** (vitest): Verify specific examples for toast display/dismiss behavior, dashboard rendering with known data, sound playback invocation, and profile deletion cascading.
- **Integration tests**: Verify end-to-end flow from `finish_run` through `evaluate_achievements` to toast display using mocked Tauri invoke.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Category Validation

For any string value used as an achievement category, the Achievement_Engine SHALL accept it if and only if it is one of the four valid values: "milestone", "streak", "per-class", or "per-area".

**Validates: Requirements 1.2**

### Property 2: Milestone Threshold Evaluation

For any milestone achievement definition with condition_type T (total_runs, total_items, or total_time) and threshold V, and for any profile with current statistic S for type T, the achievement SHALL unlock if and only if S >= V.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 3: Streak Calculation Correctness

For any sequence of run completion timestamps belonging to a profile, the computed consecutive-day streak SHALL equal the number of consecutive calendar days (using local timezone) ending at today (or the most recent run day) during which at least one run was completed — and SHALL reset to zero for any gap day.

**Validates: Requirements 5.1, 5.2, 5.4**

### Property 4: Per-Class Evaluation

For any profile with character class C and total run count R, and for any per-class achievement targeting class C with threshold V, the achievement SHALL unlock if and only if R >= V. Achievements targeting a different class than the profile's class SHALL NOT unlock regardless of run count.

**Validates: Requirements 6.1, 6.2**

### Property 5: Per-Area Evaluation

For any profile with N completed runs in area A, and for any per-area achievement targeting area A with threshold V, the achievement SHALL unlock if and only if N >= V.

**Validates: Requirements 7.1, 7.2**

### Property 6: Batch Evaluation Completeness

For any profile state where K distinct locked achievements have their conditions simultaneously met, a single call to evaluate_achievements SHALL return exactly K unlock records — no fewer (missed unlocks) and no more (spurious unlocks or duplicates).

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 7: Toast Queue Sequential Display

For any list of N newly unlocked achievements (N >= 1), the toast notification system SHALL display them one at a time in FIFO order, with each toast appearing only after the previous one has been dismissed or auto-dismissed.

**Validates: Requirements 3.4**

### Property 8: Progress Indicator Accuracy

For any locked achievement with threshold V and a profile's current statistic value C (where C < V), the progress indicator SHALL display the current value C and the threshold V such that both values are faithfully represented.

**Validates: Requirements 8.4**

### Property 9: Category Filter Correctness

For any selected category filter F, the set of achievements displayed on the Achievements page SHALL contain only achievements whose category equals F — no achievements from other categories SHALL appear.

**Validates: Requirements 8.5**

### Property 10: Profile Isolation

For any two distinct profiles P1 and P2, evaluating achievements for P1 SHALL use only P1's runs, items, and time statistics. Statistics from P2 SHALL have no effect on P1's evaluation results, and vice versa.

**Validates: Requirements 10.1, 10.2**

### Property 11: I18n Key Resolution

For any achievement definition with name_key K and any supported locale L, the rendered achievement name SHALL equal the translation string at path `achievements.names.{K}` in locale L's translation file. If the key is missing in locale L, it SHALL fall back to the en-US value.

**Validates: Requirements 11.1, 11.3**
