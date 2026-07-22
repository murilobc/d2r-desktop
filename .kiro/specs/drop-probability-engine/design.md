# Design Document

## Overview

The Drop Probability Engine replaces the existing DropCalculator page with an upgraded, unified drop probability system. The core computation (TC tree traversal and probability math) runs in Rust via Tauri commands for performance, with TC data embedded as static compiled data in the Rust binary. The frontend provides rich Recharts visualizations including probability distribution curves, expected-vs-actual overlays, and a luck percentile gauge. The engine integrates with existing farming history data for personalized estimations.

## Architecture

The Drop Probability Engine is a two-layer system: a Rust backend module (`probability_engine`) that performs TC tree traversal and probability math, exposed via Tauri commands; and a React frontend page that replaces the existing `DropCalculator.tsx` with rich Recharts visualizations. The engine integrates with the existing SQLite-backed statistics system for historical data lookups.

```
┌─────────────────────────────────────────────────────┐
│  React Frontend (DropCalculator Page)               │
│  ┌───────────┬──────────────┬────────────────────┐  │
│  │ Area Tab  │ Probability  │ Expected vs Actual │  │
│  │ (existing)│ Calculator   │ Comparison         │  │
│  └───────────┴──────────────┴────────────────────┘  │
│         │                                           │
│         │ invoke("calculate_drop_probability", ...) │
│         │ invoke("calculate_cumulative_dist", ...)  │
│         │ invoke("get_area_run_stats", ...)         │
│         ▼                                           │
├─────────────────────────────────────────────────────┤
│  Rust Backend (Tauri Commands)                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  probability_engine module                   │   │
│  │  ┌────────────┐  ┌──────────────────────┐   │   │
│  │  │ TC Data    │  │ Computation Engine   │   │   │
│  │  │ (static)   │→ │ - TC tree traversal  │   │   │
│  │  │            │  │ - MF adjustment      │   │   │
│  │  │ include_   │  │ - Player scaling     │   │   │
│  │  │ str! JSON  │  │ - Quest bonus        │   │   │
│  │  └────────────┘  │ - TZ/Herald mods     │   │   │
│  │                   └──────────────────────┘   │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Existing DB (SQLite) — runs, items, stats   │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Rust Backend: `probability_engine` Module

New file: `src-tauri/src/probability_engine.rs`

This module contains:
- Static TC data (loaded via `include_str!` + `serde_json`)
- TC tree traversal algorithm
- MF adjustment functions
- Player count no-drop adjustment
- Quest bonus calculation
- Terror Zone TC elevation
- Herald tier TC modification

### 2. Rust Backend: Tauri Commands

New commands added to `src-tauri/src/commands.rs` (or a dedicated `drop_commands.rs`):
- `calculate_drop_probability` — per-kill probability for a monster/item/config
- `calculate_cumulative_distribution` — probability curve data points
- `get_area_run_stats` — historical run speed data from SQLite
- `calculate_luck_percentile` — where actual results fall on distribution

### 3. React Frontend: Replaced `DropCalculator.tsx`

Replaces the existing page at the same route with three tabs:
- **Areas Tab** — retained from existing implementation (area browser)
- **Probability Tab** — new calculation interface with distribution chart
- **Comparison Tab** — expected-vs-actual with luck gauge

### 4. TC Data File

New file: `src-tauri/data/tc_data.json`

Static JSON file containing the full D2R v3.2 RotW treasure class hierarchy, monster-to-TC mappings, TZ scaling tables, and Herald tier tables. Embedded at compile time.

## Interfaces

### Tauri Command: `calculate_drop_probability`

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DropProbabilityInput {
    pub monster_id: String,
    pub item_id: String,
    pub magic_find: u32,       // 0–9999
    pub player_count: u8,      // 1–8
    pub quest_bonus: bool,
    pub terror_zone: bool,
    pub herald_tier: Option<u8>, // 1–5 if Herald encounter
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DropProbabilityResult {
    pub probability: f64,          // e.g., 0.000943
    pub one_in_x: f64,            // e.g., 1060.5 (1 in X format)
    pub kills_for_50: u64,        // kills for 50% cumulative
    pub kills_for_63: u64,        // kills for 63.2% (1-1/e)
    pub kills_for_90: u64,        // kills for 90%
    pub kills_for_99: u64,        // kills for 99%
    pub effective_mf: f64,        // computed effective MF after diminishing returns
    pub mf_applied: bool,         // whether MF was applied (false for runes)
}

#[tauri::command]
pub fn calculate_drop_probability(
    input: DropProbabilityInput,
) -> Result<DropProbabilityResult, String> { ... }
```

### Tauri Command: `calculate_cumulative_distribution`

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CumulativeDistInput {
    pub probability: f64,   // per-kill probability
    pub max_kills: u64,     // how many data points to generate
    pub step: u64,          // step size between points
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DistributionPoint {
    pub kills: u64,
    pub cumulative_probability: f64,
}

#[tauri::command]
pub fn calculate_cumulative_distribution(
    input: CumulativeDistInput,
) -> Result<Vec<DistributionPoint>, String> { ... }
```

### Tauri Command: `get_area_run_stats`

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AreaRunStats {
    pub area: String,
    pub total_runs: u64,
    pub avg_duration_secs: f64,
    pub total_items_found: u64,
    pub item_counts: Vec<ItemCount>,  // count of specific items found
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ItemCount {
    pub item_name: String,
    pub count: u64,
}

#[tauri::command]
pub fn get_area_run_stats(
    state: State<DbState>,
    profile_id: String,
    area: String,
) -> Result<AreaRunStats, String> { ... }
```

### Tauri Command: `calculate_luck_percentile`

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LuckPercentileInput {
    pub actual_drops: u64,
    pub total_kills: u64,
    pub per_kill_probability: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LuckPercentileResult {
    pub percentile: f64,          // 0.0–100.0
    pub expected_drops: f64,      // N * p
    pub deviation: f64,           // actual - expected (signed)
    pub deviation_sigma: f64,     // standard deviations from mean
}

#[tauri::command]
pub fn calculate_luck_percentile(
    input: LuckPercentileInput,
) -> Result<LuckPercentileResult, String> { ... }
```

### Frontend API Layer

```typescript
// src/api.ts additions

export interface DropProbabilityInput {
  monster_id: string;
  item_id: string;
  magic_find: number;
  player_count: number;
  quest_bonus: boolean;
  terror_zone: boolean;
  herald_tier: number | null;
}

export interface DropProbabilityResult {
  probability: number;
  one_in_x: number;
  kills_for_50: number;
  kills_for_63: number;
  kills_for_90: number;
  kills_for_99: number;
  effective_mf: number;
  mf_applied: boolean;
}

export interface DistributionPoint {
  kills: number;
  cumulative_probability: number;
}

export interface AreaRunStats {
  area: string;
  total_runs: number;
  avg_duration_secs: number;
  total_items_found: number;
  item_counts: { item_name: string; count: number }[];
}

export interface LuckPercentileResult {
  percentile: number;
  expected_drops: number;
  deviation: number;
  deviation_sigma: number;
}

export const calculateDropProbability = (input: DropProbabilityInput) =>
  invoke<DropProbabilityResult>("calculate_drop_probability", { input });

export const calculateCumulativeDistribution = (probability: number, maxKills: number, step: number) =>
  invoke<DistributionPoint[]>("calculate_cumulative_distribution", { input: { probability, max_kills: maxKills, step } });

export const getAreaRunStats = (profileId: string, area: string) =>
  invoke<AreaRunStats>("get_area_run_stats", { profileId, area });

export const calculateLuckPercentile = (actualDrops: number, totalKills: number, perKillProbability: number) =>
  invoke<LuckPercentileResult>("calculate_luck_percentile", { input: { actual_drops: actualDrops, total_kills: totalKills, per_kill_probability: perKillProbability } });
```

## Data Models

### TC Data JSON Schema

```json
{
  "treasure_classes": {
    "TC87": {
      "items": [
        { "id": "tyrael's_might", "weight": 1, "group": "elite_armor" }
      ],
      "sub_tcs": [
        { "tc": "TC84", "weight": 3 }
      ],
      "no_drop_weight": 100
    }
  },
  "monsters": {
    "baal": {
      "name": "Baal",
      "type": "Boss",
      "area": "Worldstone Chamber",
      "act": 5,
      "base_tc": "TC87",
      "drop_rolls": 7,
      "quest_bonus_eligible": false
    }
  },
  "items": {
    "tyrael's_might": {
      "name": "Tyrael's Might",
      "rarity": "Unique",
      "base_type": "Sacred Armor",
      "qlvl": 87
    }
  },
  "terror_zone_scaling": {
    "ancient_tunnels": { "base_alvl": 85, "tz_alvl": 96, "tz_tc": "TC87" }
  },
  "herald_tiers": {
    "1": { "tc": "TC78", "drop_rolls": 3 },
    "2": { "tc": "TC81", "drop_rolls": 4 },
    "3": { "tc": "TC84", "drop_rolls": 5 },
    "4": { "tc": "TC87", "drop_rolls": 6 },
    "5": { "tc": "TC87", "drop_rolls": 8 }
  }
}
```

### Probability Engine Internal Structures

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize, Clone)]
pub struct TcData {
    pub treasure_classes: HashMap<String, TreasureClass>,
    pub monsters: HashMap<String, Monster>,
    pub items: HashMap<String, ItemDef>,
    pub terror_zone_scaling: HashMap<String, TzScaling>,
    pub herald_tiers: HashMap<String, HeraldTier>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TreasureClass {
    pub items: Vec<TcItem>,
    pub sub_tcs: Vec<SubTcRef>,
    pub no_drop_weight: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TcItem {
    pub id: String,
    pub weight: u32,
    pub group: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SubTcRef {
    pub tc: String,
    pub weight: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Monster {
    pub name: String,
    pub monster_type: String,
    pub area: String,
    pub act: u8,
    pub base_tc: String,
    pub drop_rolls: u8,
    pub quest_bonus_eligible: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ItemDef {
    pub name: String,
    pub rarity: String,
    pub base_type: String,
    pub qlvl: u8,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TzScaling {
    pub base_alvl: u8,
    pub tz_alvl: u8,
    pub tz_tc: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct HeraldTier {
    pub tc: String,
    pub drop_rolls: u8,
}
```

## Key Algorithms

### TC Tree Traversal

The core algorithm walks the TC tree from a monster's base TC to the target item, accumulating probability weights:

```rust
/// Compute the probability of a specific item dropping from one roll of a TC.
/// Uses recursive traversal of the TC tree.
pub fn compute_item_probability(
    tc_data: &TcData,
    tc_name: &str,
    target_item_id: &str,
    visited: &mut Vec<String>,  // cycle detection
) -> Result<f64, String> {
    if visited.contains(&tc_name.to_string()) {
        return Err(format!("Circular TC reference detected: {}", tc_name));
    }
    visited.push(tc_name.to_string());

    let tc = tc_data.treasure_classes.get(tc_name)
        .ok_or_else(|| format!("TC not found: {}", tc_name))?;

    let total_weight: u32 = tc.items.iter().map(|i| i.weight).sum::<u32>()
        + tc.sub_tcs.iter().map(|s| s.weight).sum::<u32>()
        + tc.no_drop_weight;

    let mut probability = 0.0;

    // Direct item hits
    for item in &tc.items {
        if item.id == target_item_id {
            probability += item.weight as f64 / total_weight as f64;
        }
    }

    // Recurse into sub-TCs
    for sub_tc in &tc.sub_tcs {
        let sub_prob = compute_item_probability(tc_data, &sub_tc.tc, target_item_id, visited)?;
        probability += (sub_tc.weight as f64 / total_weight as f64) * sub_prob;
    }

    visited.pop();
    Ok(probability)
}
```

### MF Adjustment Formula

```rust
/// Apply Magic Find diminishing returns to a probability.
/// Formula: effective_mf = (mf * factor) / (mf + factor)
/// Factor: 250 for Unique, 500 for Set
/// Returns: adjusted 1-in-X chance
pub fn apply_mf_adjustment(base_one_in_x: f64, mf: u32, rarity: &str) -> f64 {
    if rarity == "Rune" {
        return base_one_in_x; // MF does not affect runes
    }
    let factor: f64 = match rarity {
        "Unique" => 250.0,
        "Set" => 500.0,
        _ => return base_one_in_x,
    };
    let effective_mf = (mf as f64 * factor) / (mf as f64 + factor);
    let multiplier = 1.0 + effective_mf / 100.0;
    base_one_in_x / multiplier
}
```

### Player Count No-Drop Adjustment

```rust
/// Adjust no-drop probability for player count.
/// D2R formula: NoDrop_effective = NoDrop^players / (NoDrop^players + (Total-NoDrop)^players ... )
/// Simplified: each additional player reduces effective NoDrop.
pub fn adjust_for_player_count(base_one_in_x: f64, no_drop_weight: u32, total_weight: u32, players: u8) -> f64 {
    if players <= 1 {
        return base_one_in_x;
    }
    let no_drop_ratio = no_drop_weight as f64 / total_weight as f64;
    let drop_ratio = 1.0 - no_drop_ratio;
    // NoDrop^n / (NoDrop^n + Drop * sum(NoDrop^i, i=0..n-1))
    let nd_pow = no_drop_ratio.powi(players as i32);
    let effective_no_drop = nd_pow / (nd_pow + drop_ratio * (1.0 - nd_pow) / (1.0 - no_drop_ratio));
    let base_no_drop = no_drop_ratio;
    let adjustment = (1.0 - effective_no_drop) / (1.0 - base_no_drop);
    base_one_in_x / adjustment
}
```

### Cumulative Probability

```rust
/// P(at least 1 drop in N kills) = 1 - (1 - p)^N
pub fn cumulative_probability(per_kill_prob: f64, kills: u64) -> f64 {
    1.0 - (1.0 - per_kill_prob).powi(kills as i32)
}

/// Kills needed for a target cumulative probability threshold.
/// N = ceil(ln(1 - threshold) / ln(1 - p))
pub fn kills_for_threshold(per_kill_prob: f64, threshold: f64) -> u64 {
    if per_kill_prob <= 0.0 || per_kill_prob >= 1.0 {
        return 0;
    }
    ((1.0 - threshold).ln() / (1.0 - per_kill_prob).ln()).ceil() as u64
}
```

### Luck Percentile (Binomial CDF Approximation)

```rust
/// Calculate where actual results fall on the expected distribution.
/// Uses normal approximation to the binomial distribution for large N.
/// Percentile = CDF(actual | mean=N*p, std=sqrt(N*p*(1-p)))
pub fn luck_percentile(actual_drops: u64, total_kills: u64, per_kill_prob: f64) -> f64 {
    let mean = total_kills as f64 * per_kill_prob;
    let std_dev = (total_kills as f64 * per_kill_prob * (1.0 - per_kill_prob)).sqrt();
    if std_dev == 0.0 {
        return 50.0;
    }
    let z = (actual_drops as f64 - mean) / std_dev;
    // Normal CDF approximation
    normal_cdf(z) * 100.0
}
```

## Error Handling

| Error Condition | Rust Response | Frontend Handling |
|---|---|---|
| Unknown monster_id | `Err("Monster not found: {id}")` | Display "unknown monster" message |
| Unknown item_id | `Err("Item not found: {id}")` | Display "unknown item" message |
| Circular TC reference | `Err("Circular TC reference: {tc}")` | Display engine error alert |
| MF out of range (>9999) | Validated in frontend; Rust also rejects | Show validation error on input |
| Player count out of range | Validated in frontend; Rust also rejects | Show validation error on select |
| Item unreachable from TC | Returns `one_in_x: 0.0, probability: 0.0` | Display "item cannot drop from this source" |
| No historical data for area | `AreaRunStats` with `total_runs: 0` | Show runs estimate without time; prompt user |
| DB query failure | `Err(e.to_string())` | Display generic error toast |

## Frontend Component Structure

```
src/pages/DropCalculator.tsx (replaced)
├── AreaTab (retained, existing logic)
├── ProbabilityTab (new)
│   ├── MonsterSelect
│   ├── ItemSelect  
│   ├── ConfigPanel (MF, players, quest bonus, TZ, herald)
│   ├── ProbabilityResult (1-in-X display)
│   ├── DistributionChart (Recharts AreaChart)
│   ├── ThresholdMarkers (50%, 63%, 90%, 99% lines)
│   └── RunEstimate (runs + time to find)
└── ComparisonTab (new)
    ├── ExpectedVsActualChart (Recharts LineChart overlay)
    ├── ComparisonSummary (textual luck description)
    └── LuckGauge (percentile radial gauge)
```

## Testing Strategy

- **Property-based tests** (Rust `proptest`): Validate all mathematical invariants of the probability engine — MF adjustment, player scaling, cumulative distribution, luck percentile, TC traversal bounds. Minimum 100 iterations per property.
- **Unit tests** (Rust): Verify specific known drop rates against pre-calculated reference values (e.g., Shako from Mephisto at 300 MF).
- **Integration tests** (Rust): Validate TC data loads correctly, all known monsters/items are queryable, TZ and Herald data completeness.
- **Frontend component tests** (Vitest + React Testing Library): Verify tab navigation, input validation UI, chart data preparation, and i18n key usage.
- **Benchmark tests** (Criterion): Ensure per-kill calculation completes within 10ms budget.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: MF Adjustment Monotonicity and Formula Correctness

*For any* base probability (1 in X) and two Magic Find values `mf_a < mf_b` both in [0, 9999], and any MF-affected rarity (Unique or Set), `apply_mf_adjustment(base, mf_b, rarity)` SHALL produce a lower (better) 1-in-X value than `apply_mf_adjustment(base, mf_a, rarity)`, and the result SHALL equal `base / (1 + effective_mf/100)` where `effective_mf = (mf * factor) / (mf + factor)`.

**Validates: Requirements 1.2**

### Property 2: Rune MF Immunity

*For any* rune item and any Magic Find value in [0, 9999], `apply_mf_adjustment(base, mf, "Rune")` SHALL return exactly the same value as `base` (the input unchanged).

**Validates: Requirements 1.5**

### Property 3: Player Count Monotonicity

*For any* base drop chance and player counts `p_a < p_b` both in [1, 8], the adjusted probability with `p_b` players SHALL be greater than or equal to the adjusted probability with `p_a` players. Additionally, at player count 1, the adjustment SHALL return the original base probability unchanged.

**Validates: Requirements 1.3**

### Property 4: Quest Bonus Improvement

*For any* boss that supports quest bonus and any target item reachable in their TC tree, the per-kill probability with `quest_bonus: true` SHALL be strictly greater than with `quest_bonus: false`.

**Validates: Requirements 1.4**

### Property 5: TC Tree Traversal Validity

*For any* valid monster and item combination where the item exists in the monster's TC tree, `compute_item_probability` SHALL return a value in the range (0.0, 1.0]. For any item NOT reachable in the monster's TC tree, it SHALL return exactly 0.0.

**Validates: Requirements 1.1**

### Property 6: Cumulative Distribution and Threshold Consistency

*For any* per-kill probability `p` in (0, 1) and threshold `t` in (0, 1), if `N = kills_for_threshold(p, t)`, then `cumulative_probability(p, N) >= t` AND `cumulative_probability(p, N - 1) < t` (for N > 1). The cumulative probability must also be monotonically non-decreasing with kills.

**Validates: Requirements 3.1, 3.2**

### Property 7: Run and Time Estimation Correctness

*For any* per-kill probability `p > 0` and average run duration `d > 0`, the runs-to-find estimate SHALL equal `kills_for_threshold(p, 0.632)` and the time estimate SHALL equal `runs_to_find * d` seconds, both being positive finite numbers.

**Validates: Requirements 4.1, 4.2**

### Property 8: Expected Drops Linearity

*For any* per-kill probability `p` and kill count `N >= 0`, the expected cumulative drops SHALL equal `N * p`, and this value SHALL scale linearly with N.

**Validates: Requirements 5.2**

### Property 9: Luck Percentile Bounded and Monotonic

*For any* valid tuple (actual_drops, total_kills, per_kill_probability) where total_kills > 0 and per_kill_probability is in (0, 1), the luck percentile SHALL be in the range [0, 100]. Additionally, for fixed total_kills and per_kill_probability, increasing actual_drops SHALL produce a non-decreasing percentile value.

**Validates: Requirements 5.4**

### Property 10: Terror Zone Elevation Invariant

*For any* area eligible for Terror Zone designation, the computed TZ area level SHALL be >= the base area level, and the resulting TC SHALL be >= the base TC (in the TC hierarchy ordering).

**Validates: Requirements 6.1, 6.2**

### Property 11: Herald Tier TC Monotonicity

*For any* two Herald tiers `t_a < t_b` both in [1, 5], the TC assigned to tier `t_b` SHALL be >= the TC assigned to tier `t_a` in the TC hierarchy, and the drop rolls for `t_b` SHALL be >= the drop rolls for `t_a`.

**Validates: Requirements 7.1**

### Property 12: Input Validation Boundary

*For any* Magic Find value outside [0, 9999] or any monster/item identifier not present in TC_Data, the engine SHALL return an error result (Err variant). For any MF in [0, 9999] with a valid monster and item, the engine SHALL NOT return a validation error.

**Validates: Requirements 10.1, 10.3**
