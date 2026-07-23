use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

// ─── Data Model Structs ───────────────────────────────────────────────────────

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

// ─── Static TC Data Loading ───────────────────────────────────────────────────

static TC_DATA: OnceLock<TcData> = OnceLock::new();

const TC_DATA_JSON: &str = include_str!("../data/tc_data.json");

/// Load and return a reference to the parsed TC data.
/// The data is parsed once on first access and cached for the lifetime of the process.
pub fn load_tc_data() -> &'static TcData {
    TC_DATA.get_or_init(|| {
        serde_json::from_str(TC_DATA_JSON)
            .expect("Failed to parse embedded tc_data.json")
    })
}

// ─── Core Probability Algorithms ─────────────────────────────────────────────

/// Compute the probability of a specific item dropping from one roll of a TC.
/// Uses recursive traversal of the TC tree.
pub fn compute_item_probability(
    tc_data: &TcData,
    tc_name: &str,
    target_item_id: &str,
    visited: &mut Vec<String>,
) -> Result<f64, String> {
    if visited.contains(&tc_name.to_string()) {
        return Err(format!("Circular TC reference detected: {}", tc_name));
    }
    visited.push(tc_name.to_string());

    let tc = tc_data
        .treasure_classes
        .get(tc_name)
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

/// Compute the per-kill probability of finding an item from a specific monster.
/// Accounts for the monster's drop_rolls (multiple TC picks per kill).
pub fn compute_monster_drop_probability(
    tc_data: &TcData,
    monster_id: &str,
    item_id: &str,
) -> Result<f64, String> {
    let monster = tc_data
        .monsters
        .get(monster_id)
        .ok_or_else(|| format!("Monster not found: {}", monster_id))?;

    if !tc_data.items.contains_key(item_id) {
        return Err(format!("Item not found: {}", item_id));
    }

    let mut visited = Vec::new();
    let per_roll_prob =
        compute_item_probability(tc_data, &monster.base_tc, item_id, &mut visited)?;

    // Multiple rolls per kill: P(at least 1) = 1 - (1 - p)^rolls
    let per_kill_prob = 1.0 - (1.0 - per_roll_prob).powi(monster.drop_rolls as i32);
    Ok(per_kill_prob)
}

// ─── MF, Player Count, and Quest Bonus ─────────────────────────────

/// Apply Magic Find diminishing returns to a probability.
/// Formula: effective_mf = (mf * factor) / (mf + factor)
/// Factor: 250 for Unique, 500 for Set
/// Returns: adjusted 1-in-X chance (lower = better)
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

/// Adjust no-drop probability for player count.
/// D2R formula: reduces effective NoDrop with more players.
pub fn adjust_for_player_count(base_one_in_x: f64, no_drop_weight: u32, total_weight: u32, players: u8) -> f64 {
    if players <= 1 {
        return base_one_in_x;
    }
    let no_drop_ratio = no_drop_weight as f64 / total_weight as f64;
    let drop_ratio = 1.0 - no_drop_ratio;
    let nd_pow = no_drop_ratio.powi(players as i32);
    let effective_no_drop = nd_pow / (nd_pow + drop_ratio * (1.0 - nd_pow) / (1.0 - no_drop_ratio));
    let base_no_drop = no_drop_ratio;
    let adjustment = (1.0 - effective_no_drop) / (1.0 - base_no_drop);
    base_one_in_x / adjustment
}

/// Apply quest bonus — doubles effective drop rolls.
/// Input: per-roll probability, drop_rolls count.
/// Returns: improved per-kill probability with doubled rolls.
pub fn apply_quest_bonus(per_roll_prob: f64, drop_rolls: u8) -> f64 {
    let doubled_rolls = drop_rolls as u32 * 2;
    1.0 - (1.0 - per_roll_prob).powi(doubled_rolls as i32)
}

// ─── Cumulative Distribution and Luck Percentile ─────────────────────────────

/// P(at least 1 drop in N kills) = 1 - (1 - p)^N
pub fn cumulative_probability(per_kill_prob: f64, kills: u64) -> f64 {
    1.0 - (1.0 - per_kill_prob).powf(kills as f64)
}

/// Kills needed for a target cumulative probability threshold.
/// N = ceil(ln(1 - threshold) / ln(1 - p))
pub fn kills_for_threshold(per_kill_prob: f64, threshold: f64) -> u64 {
    if per_kill_prob <= 0.0 || per_kill_prob >= 1.0 {
        return 0;
    }
    if threshold <= 0.0 || threshold >= 1.0 {
        return 0;
    }
    ((1.0 - threshold).ln() / (1.0 - per_kill_prob).ln()).ceil() as u64
}

/// Calculate where actual results fall on the expected distribution.
/// Uses normal approximation to the binomial distribution for large N.
/// Returns percentile 0.0–100.0
pub fn luck_percentile(actual_drops: u64, total_kills: u64, per_kill_prob: f64) -> f64 {
    let mean = total_kills as f64 * per_kill_prob;
    let std_dev = (total_kills as f64 * per_kill_prob * (1.0 - per_kill_prob)).sqrt();
    if std_dev == 0.0 {
        return 50.0;
    }
    let z = (actual_drops as f64 - mean) / std_dev;
    normal_cdf(z) * 100.0
}

// ─── Terror Zone and Herald Modifications ─────────────────────────────────────

/// Get the elevated TC for a Terror Zone area.
/// Returns the TZ TC if the area is found in the scaling table, otherwise returns None.
pub fn get_terror_zone_tc<'a>(tc_data: &'a TcData, area_id: &str) -> Option<&'a str> {
    tc_data.terror_zone_scaling.get(area_id).map(|tz| tz.tz_tc.as_str())
}

/// Apply Terror Zone elevation to a monster's base TC.
/// If the area is terrorized and found in the scaling table, returns the elevated TC.
/// Otherwise returns the monster's base TC unchanged.
pub fn apply_terror_zone(
    tc_data: &TcData,
    monster_id: &str,
    area_id: &str,
    terror_zone: bool,
) -> Result<String, String> {
    let monster = tc_data.monsters.get(monster_id)
        .ok_or_else(|| format!("Monster not found: {}", monster_id))?;

    if !terror_zone {
        return Ok(monster.base_tc.clone());
    }

    match tc_data.terror_zone_scaling.get(area_id) {
        Some(tz_scaling) => {
            // Validate elevated alvl >= base alvl
            if tz_scaling.tz_alvl < tz_scaling.base_alvl {
                return Err(format!(
                    "Invalid TZ scaling for {}: tz_alvl {} < base_alvl {}",
                    area_id, tz_scaling.tz_alvl, tz_scaling.base_alvl
                ));
            }
            Ok(tz_scaling.tz_tc.clone())
        }
        None => {
            // Area not eligible for Terror Zone, use base TC
            Ok(monster.base_tc.clone())
        }
    }
}

/// Get Herald tier TC and drop_rolls overrides.
/// Returns (tc, drop_rolls) for the specified tier, or None if tier is not found.
pub fn get_herald_tier_info(tc_data: &TcData, tier: u8) -> Option<(&str, u8)> {
    let tier_key = tier.to_string();
    tc_data.herald_tiers.get(&tier_key).map(|h| (h.tc.as_str(), h.drop_rolls))
}

/// Apply Herald tier modifications to the drop calculation parameters.
/// Returns (effective_tc, effective_drop_rolls) based on the Herald tier.
/// If herald_tier is None, returns the monster's base TC and drop_rolls.
pub fn apply_herald_tier(
    tc_data: &TcData,
    monster_id: &str,
    herald_tier: Option<u8>,
) -> Result<(String, u8), String> {
    let monster = tc_data.monsters.get(monster_id)
        .ok_or_else(|| format!("Monster not found: {}", monster_id))?;

    match herald_tier {
        Some(tier) => {
            let tier_key = tier.to_string();
            match tc_data.herald_tiers.get(&tier_key) {
                Some(herald) => Ok((herald.tc.clone(), herald.drop_rolls)),
                None => Err(format!("Herald tier not found: {}", tier)),
            }
        }
        None => Ok((monster.base_tc.clone(), monster.drop_rolls)),
    }
}

/// Standard normal CDF approximation using the error function.
fn normal_cdf(x: f64) -> f64 {
    0.5 * (1.0 + erf(x / std::f64::consts::SQRT_2))
}

/// Error function approximation (Abramowitz and Stegun formula 7.1.26)
fn erf(x: f64) -> f64 {
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;

    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    let t = 1.0 / (1.0 + p * x);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * (-x * x).exp();
    sign * y
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn test_tc_data_loads_successfully() {
        let data = load_tc_data();
        assert!(!data.treasure_classes.is_empty(), "treasure_classes should not be empty");
        assert!(!data.monsters.is_empty(), "monsters should not be empty");
        assert!(!data.items.is_empty(), "items should not be empty");
        assert!(!data.terror_zone_scaling.is_empty(), "terror_zone_scaling should not be empty");
        assert!(!data.herald_tiers.is_empty(), "herald_tiers should not be empty");
    }

    #[test]
    fn test_tc_data_json_is_valid() {
        let result: Result<TcData, _> = serde_json::from_str(TC_DATA_JSON);
        assert!(result.is_ok(), "tc_data.json should be valid: {:?}", result.err());
    }

    #[test]
    fn test_tc_data_contains_required_monsters() {
        let data = load_tc_data();
        assert!(data.monsters.contains_key("mephisto"), "missing Mephisto");
        assert!(data.monsters.contains_key("baal"), "missing Baal");
        assert!(data.monsters.contains_key("andariel"), "missing Andariel");

        let mephisto = &data.monsters["mephisto"];
        assert_eq!(mephisto.name, "Mephisto");
        assert_eq!(mephisto.monster_type, "Boss");
        assert_eq!(mephisto.base_tc, "TC78");
        assert!(mephisto.quest_bonus_eligible);

        let baal = &data.monsters["baal"];
        assert_eq!(baal.name, "Baal");
        assert_eq!(baal.base_tc, "TC87");
        assert!(!baal.quest_bonus_eligible);

        let andariel = &data.monsters["andariel"];
        assert_eq!(andariel.name, "Andariel");
        assert_eq!(andariel.base_tc, "TC69");
        assert!(andariel.quest_bonus_eligible);
    }

    #[test]
    fn test_tc_data_contains_required_items() {
        let data = load_tc_data();
        assert!(data.items.contains_key("harlequin_crest"), "missing Shako");
        assert!(data.items.contains_key("tyrael's_might"), "missing Tyrael's Might");
        assert!(data.items.contains_key("ber_rune"), "missing Ber rune");

        let shako = &data.items["harlequin_crest"];
        assert_eq!(shako.rarity, "Unique");

        let tyraels = &data.items["tyrael's_might"];
        assert_eq!(tyraels.rarity, "Unique");
        assert_eq!(tyraels.qlvl, 87);

        let ber = &data.items["ber_rune"];
        assert_eq!(ber.rarity, "Rune");
    }

    #[test]
    fn test_tc_hierarchy_is_coherent() {
        let data = load_tc_data();

        // TC87 → TC84 → TC81 hierarchy exists
        assert!(data.treasure_classes.contains_key("TC87"), "missing TC87");
        assert!(data.treasure_classes.contains_key("TC84"), "missing TC84");
        assert!(data.treasure_classes.contains_key("TC81"), "missing TC81");

        let tc87 = &data.treasure_classes["TC87"];
        assert!(tc87.sub_tcs.iter().any(|s| s.tc == "TC84"), "TC87 should reference TC84");

        let tc84 = &data.treasure_classes["TC84"];
        assert!(tc84.sub_tcs.iter().any(|s| s.tc == "TC81"), "TC84 should reference TC81");
    }

    #[test]
    fn test_tc_items_reference_existing_items() {
        let data = load_tc_data();

        // Every item referenced in a TC should exist in the items map
        for (tc_name, tc) in &data.treasure_classes {
            for tc_item in &tc.items {
                assert!(
                    data.items.contains_key(&tc_item.id),
                    "TC '{}' references item '{}' which is not in the items map",
                    tc_name,
                    tc_item.id
                );
            }
        }
    }

    #[test]
    fn test_monster_base_tc_references_existing_tc() {
        let data = load_tc_data();

        for (monster_id, monster) in &data.monsters {
            assert!(
                data.treasure_classes.contains_key(&monster.base_tc),
                "Monster '{}' references base_tc '{}' which doesn't exist",
                monster_id,
                monster.base_tc
            );
        }
    }

    #[test]
    fn test_herald_tiers_complete() {
        let data = load_tc_data();

        for tier in 1..=5 {
            let key = tier.to_string();
            assert!(
                data.herald_tiers.contains_key(&key),
                "Missing herald tier {}",
                tier
            );
        }

        // Verify monotonicity: higher tiers should have >= drop_rolls
        let tier1 = &data.herald_tiers["1"];
        let tier5 = &data.herald_tiers["5"];
        assert!(tier5.drop_rolls >= tier1.drop_rolls, "Higher herald tiers should have more drop rolls");
    }

    #[test]
    fn test_terror_zone_scaling_entries() {
        let data = load_tc_data();

        assert!(data.terror_zone_scaling.contains_key("ancient_tunnels"), "missing ancient_tunnels TZ");

        let at = &data.terror_zone_scaling["ancient_tunnels"];
        assert!(at.tz_alvl >= at.base_alvl, "TZ alvl should be >= base alvl");
        assert!(
            data.treasure_classes.contains_key(&at.tz_tc),
            "TZ references TC '{}' which doesn't exist",
            at.tz_tc
        );
    }

    // ─── TC Tree Traversal Tests ──────────────────────────────────────────────

    #[test]
    fn test_baal_can_drop_tyraels_might() {
        let data = load_tc_data();
        let result = compute_monster_drop_probability(data, "baal", "tyrael's_might");
        assert!(result.is_ok(), "Should succeed: {:?}", result.err());
        let prob = result.unwrap();
        assert!(prob > 0.0, "Baal should be able to drop Tyrael's Might (prob={})", prob);
        assert!(prob < 1.0, "Probability should be less than 1.0");
    }

    #[test]
    fn test_mephisto_cannot_drop_tyraels_might() {
        let data = load_tc_data();
        let result = compute_monster_drop_probability(data, "mephisto", "tyrael's_might");
        assert!(result.is_ok(), "Should succeed: {:?}", result.err());
        let prob = result.unwrap();
        assert_eq!(prob, 0.0, "Mephisto (TC78) cannot drop Tyrael's Might (TC87 item)");
    }

    #[test]
    fn test_circular_reference_detection() {
        // Create TC data with a circular reference: A → B → A
        let mut tc_data = TcData {
            treasure_classes: HashMap::new(),
            monsters: HashMap::new(),
            items: HashMap::new(),
            terror_zone_scaling: HashMap::new(),
            herald_tiers: HashMap::new(),
        };

        tc_data.treasure_classes.insert(
            "TC_A".to_string(),
            TreasureClass {
                items: vec![],
                sub_tcs: vec![SubTcRef { tc: "TC_B".to_string(), weight: 1 }],
                no_drop_weight: 10,
            },
        );
        tc_data.treasure_classes.insert(
            "TC_B".to_string(),
            TreasureClass {
                items: vec![],
                sub_tcs: vec![SubTcRef { tc: "TC_A".to_string(), weight: 1 }],
                no_drop_weight: 10,
            },
        );

        let mut visited = Vec::new();
        let result = compute_item_probability(&tc_data, "TC_A", "some_item", &mut visited);
        assert!(result.is_err(), "Should detect circular reference");
        assert!(
            result.unwrap_err().contains("Circular TC reference detected"),
            "Error should mention circular reference"
        );
    }

    #[test]
    fn test_unknown_tc_returns_error() {
        let data = load_tc_data();
        let mut visited = Vec::new();
        let result = compute_item_probability(data, "NONEXISTENT_TC", "tyrael's_might", &mut visited);
        assert!(result.is_err(), "Should return error for unknown TC");
        assert!(
            result.unwrap_err().contains("TC not found"),
            "Error should mention TC not found"
        );
    }

    #[test]
    fn test_unknown_monster_returns_error() {
        let data = load_tc_data();
        let result = compute_monster_drop_probability(data, "unknown_monster", "tyrael's_might");
        assert!(result.is_err(), "Should return error for unknown monster");
        assert!(
            result.unwrap_err().contains("Monster not found"),
            "Error should mention monster not found"
        );
    }

    #[test]
    fn test_unknown_item_returns_error() {
        let data = load_tc_data();
        let result = compute_monster_drop_probability(data, "baal", "nonexistent_item");
        assert!(result.is_err(), "Should return error for unknown item");
        assert!(
            result.unwrap_err().contains("Item not found"),
            "Error should mention item not found"
        );
    }

    #[test]
    fn test_compute_item_probability_direct_item() {
        let data = load_tc_data();
        // TC87 directly contains tyrael's_might with weight 1
        // TC87 total weight = items(1+2) + sub_tcs(3) + no_drop(100) = 106
        let mut visited = Vec::new();
        let prob = compute_item_probability(data, "TC87", "tyrael's_might", &mut visited).unwrap();
        let expected = 1.0 / 106.0;
        assert!(
            (prob - expected).abs() < 1e-10,
            "Direct item probability should be weight/total = 1/106, got {}",
            prob
        );
    }

    #[test]
    fn test_compute_item_probability_nested() {
        let data = load_tc_data();
        // harlequin_crest is in TC84 (weight 2, total = 2+4+80 = 86)
        // TC87 references TC84 with weight 3 (total TC87 = 1+2+3+100 = 106)
        // So from TC87: prob = (3/106) * (2/86)
        let mut visited = Vec::new();
        let prob = compute_item_probability(data, "TC87", "harlequin_crest", &mut visited).unwrap();
        let expected = (3.0 / 106.0) * (2.0 / 86.0);
        assert!(
            (prob - expected).abs() < 1e-10,
            "Nested item probability mismatch: expected {}, got {}",
            expected,
            prob
        );
    }

    #[test]
    fn test_monster_drop_probability_multiple_rolls() {
        let data = load_tc_data();
        // Baal has 7 drop_rolls on TC87
        // Per-roll prob for tyrael's_might from TC87 = 1/106
        // Per-kill = 1 - (1 - 1/106)^7
        let mut visited = Vec::new();
        let per_roll = compute_item_probability(data, "TC87", "tyrael's_might", &mut visited).unwrap();
        let expected_per_kill = 1.0 - (1.0 - per_roll).powi(7);

        let actual = compute_monster_drop_probability(data, "baal", "tyrael's_might").unwrap();
        assert!(
            (actual - expected_per_kill).abs() < 1e-10,
            "Monster drop probability should account for 7 rolls: expected {}, got {}",
            expected_per_kill,
            actual
        );
    }

    // ─── Cumulative Distribution and Luck Percentile Tests ───────────────────

    #[test]
    fn test_cumulative_probability_100_kills() {
        // 1 - (0.99)^100 ≈ 0.6340
        let result = cumulative_probability(0.01, 100);
        assert!((result - 0.634).abs() < 0.001, "Expected ~0.634, got {}", result);
    }

    #[test]
    fn test_cumulative_probability_monotonic() {
        // More kills should always yield higher cumulative probability
        let p = 0.01;
        let prev = cumulative_probability(p, 50);
        let next = cumulative_probability(p, 100);
        assert!(next > prev, "cumulative_probability should increase with kills");
    }

    #[test]
    fn test_cumulative_probability_zero_kills() {
        assert_eq!(cumulative_probability(0.01, 0), 0.0);
    }

    #[test]
    fn test_kills_for_threshold_50_percent() {
        // ceil(ln(0.5) / ln(0.99)) = ceil(69.075) = 69 (actually rounds up to 69)
        let result = kills_for_threshold(0.01, 0.5);
        assert_eq!(result, 69, "Expected 69 kills for 50% threshold at p=0.01, got {}", result);
    }

    #[test]
    fn test_kills_for_threshold_invalid_probability_zero() {
        assert_eq!(kills_for_threshold(0.0, 0.5), 0);
    }

    #[test]
    fn test_kills_for_threshold_invalid_probability_one() {
        assert_eq!(kills_for_threshold(1.0, 0.5), 0);
    }

    #[test]
    fn test_kills_for_threshold_invalid_threshold_zero() {
        assert_eq!(kills_for_threshold(0.01, 0.0), 0);
    }

    #[test]
    fn test_kills_for_threshold_invalid_threshold_one() {
        assert_eq!(kills_for_threshold(0.01, 1.0), 0);
    }

    #[test]
    fn test_luck_percentile_mean_outcome() {
        // If actual drops equals the expected mean, percentile should be ~50
        let p = 0.01;
        let kills = 1000_u64;
        let expected_drops = (kills as f64 * p).round() as u64; // 10
        let result = luck_percentile(expected_drops, kills, p);
        assert!((result - 50.0).abs() < 5.0, "Expected ~50 percentile for mean outcome, got {}", result);
    }

    #[test]
    fn test_luck_percentile_zero_std_dev() {
        // When p=0, std_dev = 0, should return 50.0
        let result = luck_percentile(0, 100, 0.0);
        assert_eq!(result, 50.0, "Expected 50.0 for zero std_dev, got {}", result);
    }

    #[test]
    fn test_luck_percentile_above_mean_is_above_50() {
        let p = 0.01;
        let kills = 1000_u64;
        let above_mean_drops = 15; // mean is 10
        let result = luck_percentile(above_mean_drops, kills, p);
        assert!(result > 50.0, "Drops above mean should give percentile > 50, got {}", result);
    }

    #[test]
    fn test_luck_percentile_below_mean_is_below_50() {
        let p = 0.01;
        let kills = 1000_u64;
        let below_mean_drops = 5; // mean is 10
        let result = luck_percentile(below_mean_drops, kills, p);
        assert!(result < 50.0, "Drops below mean should give percentile < 50, got {}", result);
    }

    // ─── MF Adjustment Tests ──────────────────────────────────────────────────

    #[test]
    fn test_mf_zero_returns_base_unchanged() {
        let base = 1000.0;
        assert_eq!(apply_mf_adjustment(base, 0, "Unique"), base);
        assert_eq!(apply_mf_adjustment(base, 0, "Set"), base);
        assert_eq!(apply_mf_adjustment(base, 0, "Rune"), base);
    }

    #[test]
    fn test_mf_300_unique_produces_lower_one_in_x() {
        let base = 1000.0;
        let adjusted = apply_mf_adjustment(base, 300, "Unique");
        assert!(adjusted < base, "MF=300 on Unique should produce lower 1-in-X than base, got {}", adjusted);
        // Verify formula: effective_mf = (300 * 250) / (300 + 250) = 136.36...
        // multiplier = 1 + 136.36/100 = 2.3636...
        // adjusted = 1000 / 2.3636... ≈ 423.08
        let expected_effective_mf = (300.0 * 250.0) / (300.0 + 250.0);
        let expected_multiplier = 1.0 + expected_effective_mf / 100.0;
        let expected = base / expected_multiplier;
        assert!((adjusted - expected).abs() < 0.001, "Expected ~{}, got {}", expected, adjusted);
    }

    #[test]
    fn test_mf_on_rune_returns_base_unchanged() {
        let base = 5000.0;
        // MF should never affect rune drops regardless of MF value
        assert_eq!(apply_mf_adjustment(base, 100, "Rune"), base);
        assert_eq!(apply_mf_adjustment(base, 500, "Rune"), base);
        assert_eq!(apply_mf_adjustment(base, 9999, "Rune"), base);
    }

    #[test]
    fn test_mf_unknown_rarity_returns_base() {
        let base = 1000.0;
        assert_eq!(apply_mf_adjustment(base, 300, "Magic"), base);
        assert_eq!(apply_mf_adjustment(base, 300, "Rare"), base);
    }

    // ─── Player Count Adjustment Tests ────────────────────────────────────────

    #[test]
    fn test_player_count_1_returns_base_unchanged() {
        let base = 1000.0;
        let result = adjust_for_player_count(base, 100, 200, 1);
        assert_eq!(result, base);
    }

    #[test]
    fn test_player_count_8_improves_probability() {
        let base = 1000.0;
        let no_drop_weight = 100;
        let total_weight = 200;
        let result = adjust_for_player_count(base, no_drop_weight, total_weight, 8);
        assert!(result < base, "Player count 8 should improve probability (lower 1-in-X), got {}", result);
    }

    #[test]
    fn test_player_count_monotonically_improves() {
        let base = 1000.0;
        let no_drop_weight = 100;
        let total_weight = 200;
        let mut prev = base;
        for players in 2..=8u8 {
            let result = adjust_for_player_count(base, no_drop_weight, total_weight, players);
            assert!(result <= prev, "Player {} should be <= player {}: {} vs {}", players, players - 1, result, prev);
            prev = result;
        }
    }

    // ─── Quest Bonus Tests ────────────────────────────────────────────────────

    #[test]
    fn test_quest_bonus_improves_probability() {
        let per_roll_prob: f64 = 0.001; // 1 in 1000 per roll
        let drop_rolls = 5u8;

        // Without quest bonus: 1 - (1 - 0.001)^5
        let without_bonus: f64 = 1.0 - (1.0 - per_roll_prob).powi(drop_rolls as i32);
        // With quest bonus: doubled rolls
        let with_bonus = apply_quest_bonus(per_roll_prob, drop_rolls);

        assert!(with_bonus > without_bonus,
            "Quest bonus should improve probability: {} > {}", with_bonus, without_bonus);
    }

    #[test]
    fn test_quest_bonus_doubles_rolls() {
        let per_roll_prob = 0.01;
        let drop_rolls = 3u8;

        let result = apply_quest_bonus(per_roll_prob, drop_rolls);
        // Should be equivalent to 6 rolls
        let expected = 1.0 - (1.0 - per_roll_prob).powi(6);
        assert!((result - expected).abs() < 1e-10, "Expected {}, got {}", expected, result);
    }

    // ─── Terror Zone Tests ──────────────────────────────────────────────────

    #[test]
    fn test_terror_zone_elevation() {
        let data = load_tc_data();
        // ancient_tunnels: TZ TC = TC87
        let tc = apply_terror_zone(data, "mephisto", "ancient_tunnels", true).unwrap();
        assert_eq!(tc, "TC87");
    }

    #[test]
    fn test_terror_zone_disabled_returns_base_tc() {
        let data = load_tc_data();
        let tc = apply_terror_zone(data, "mephisto", "ancient_tunnels", false).unwrap();
        assert_eq!(tc, "TC78"); // Mephisto's base TC
    }

    #[test]
    fn test_terror_zone_unknown_area_returns_base_tc() {
        let data = load_tc_data();
        let tc = apply_terror_zone(data, "baal", "unknown_area", true).unwrap();
        assert_eq!(tc, "TC87"); // Baal's base TC unchanged
    }

    #[test]
    fn test_terror_zone_unknown_monster_returns_error() {
        let data = load_tc_data();
        let result = apply_terror_zone(data, "unknown_monster", "ancient_tunnels", true);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Monster not found"));
    }

    #[test]
    fn test_get_terror_zone_tc() {
        let data = load_tc_data();
        assert_eq!(get_terror_zone_tc(data, "ancient_tunnels"), Some("TC87"));
        assert_eq!(get_terror_zone_tc(data, "nonexistent"), None);
    }

    #[test]
    fn test_terror_zone_all_entries_valid() {
        let data = load_tc_data();
        // All TZ entries should have tz_alvl >= base_alvl
        for (area_id, tz) in &data.terror_zone_scaling {
            assert!(
                tz.tz_alvl >= tz.base_alvl,
                "TZ scaling for '{}' has tz_alvl {} < base_alvl {}",
                area_id, tz.tz_alvl, tz.base_alvl
            );
        }
    }

    // ─── Herald Tier Tests ────────────────────────────────────────────────────

    #[test]
    fn test_herald_tier_info() {
        let data = load_tc_data();
        let (tc, rolls) = get_herald_tier_info(data, 1).unwrap();
        assert_eq!(tc, "TC78");
        assert_eq!(rolls, 3);

        let (tc, rolls) = get_herald_tier_info(data, 5).unwrap();
        assert_eq!(tc, "TC87");
        assert_eq!(rolls, 8);

        assert!(get_herald_tier_info(data, 0).is_none());
        assert!(get_herald_tier_info(data, 6).is_none());
    }

    #[test]
    fn test_apply_herald_tier_some() {
        let data = load_tc_data();
        let (tc, rolls) = apply_herald_tier(data, "mephisto", Some(5)).unwrap();
        assert_eq!(tc, "TC87");
        assert_eq!(rolls, 8);
    }

    #[test]
    fn test_apply_herald_tier_none_returns_monster_base() {
        let data = load_tc_data();
        let (tc, rolls) = apply_herald_tier(data, "mephisto", None).unwrap();
        assert_eq!(tc, "TC78");
        assert_eq!(rolls, 7); // Mephisto's base drop_rolls
    }

    #[test]
    fn test_apply_herald_tier_invalid_returns_error() {
        let data = load_tc_data();
        let result = apply_herald_tier(data, "mephisto", Some(99));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Herald tier not found"));
    }

    #[test]
    fn test_herald_tier_monotonicity() {
        let data = load_tc_data();
        // TC ordering: TC75 < TC78 < TC81 < TC84 < TC87
        let tc_order = vec!["TC75", "TC78", "TC81", "TC84", "TC87"];

        let mut prev_tc_idx = 0;
        let mut prev_rolls = 0u8;
        for tier in 1..=5u8 {
            let (tc, rolls) = get_herald_tier_info(data, tier).unwrap();
            let tc_idx = tc_order.iter().position(|&t| t == tc).unwrap_or(0);
            assert!(tc_idx >= prev_tc_idx, "Herald tier {} TC should be >= tier {}", tier, tier - 1);
            assert!(rolls >= prev_rolls, "Herald tier {} rolls should be >= tier {}", tier, tier - 1);
            prev_tc_idx = tc_idx;
            prev_rolls = rolls;
        }
    }

    // ─── Property-Based Tests ─────────────────────────────────────────────────

    proptest! {
        /// **Validates: Requirements 1.2**
        /// Property 1: MF Adjustment Monotonicity — higher MF always produces lower 1-in-X
        /// for Unique and Set rarities.
        #[test]
        fn prop_mf_adjustment_monotonicity(
            base_one_in_x in 1.0f64..100000.0,
            mf_a in 0u32..9999,
            mf_b in 0u32..9999,
        ) {
            // Ensure mf_a < mf_b (skip if equal)
            if mf_a < mf_b {
                let result_a = apply_mf_adjustment(base_one_in_x, mf_a, "Unique");
                let result_b = apply_mf_adjustment(base_one_in_x, mf_b, "Unique");
                prop_assert!(result_b < result_a,
                    "Higher MF should produce lower 1-in-X for Unique: mf_a={}, mf_b={}, result_a={}, result_b={}",
                    mf_a, mf_b, result_a, result_b);

                let result_a_set = apply_mf_adjustment(base_one_in_x, mf_a, "Set");
                let result_b_set = apply_mf_adjustment(base_one_in_x, mf_b, "Set");
                prop_assert!(result_b_set < result_a_set,
                    "Higher MF should produce lower 1-in-X for Set: mf_a={}, mf_b={}, result_a={}, result_b={}",
                    mf_a, mf_b, result_a_set, result_b_set);
            }
        }

        /// **Validates: Requirements 1.2**
        /// Property 1 (cont.): MF Formula Correctness — result equals
        /// base / (1 + effective_mf/100) where effective_mf = (mf * factor) / (mf + factor).
        #[test]
        fn prop_mf_formula_correctness(
            base_one_in_x in 1.0f64..100000.0,
            mf in 0u32..9999,
        ) {
            // Verify Unique formula (factor = 250)
            let factor_unique = 250.0f64;
            let effective_mf_unique = (mf as f64 * factor_unique) / (mf as f64 + factor_unique);
            let expected_unique = base_one_in_x / (1.0 + effective_mf_unique / 100.0);
            let actual_unique = apply_mf_adjustment(base_one_in_x, mf, "Unique");
            prop_assert!((actual_unique - expected_unique).abs() < 1e-10,
                "Unique formula mismatch: mf={}, expected={}, actual={}", mf, expected_unique, actual_unique);

            // Verify Set formula (factor = 500)
            let factor_set = 500.0f64;
            let effective_mf_set = (mf as f64 * factor_set) / (mf as f64 + factor_set);
            let expected_set = base_one_in_x / (1.0 + effective_mf_set / 100.0);
            let actual_set = apply_mf_adjustment(base_one_in_x, mf, "Set");
            prop_assert!((actual_set - expected_set).abs() < 1e-10,
                "Set formula mismatch: mf={}, expected={}, actual={}", mf, expected_set, actual_set);
        }

        /// **Validates: Requirements 1.5**
        /// Property 2: Rune MF Immunity — MF never changes rune drop probability.
        #[test]
        fn prop_rune_mf_immunity(
            base_one_in_x in 1.0f64..100000.0,
            mf in 0u32..9999,
        ) {
            let result = apply_mf_adjustment(base_one_in_x, mf, "Rune");
            prop_assert!((result - base_one_in_x).abs() < f64::EPSILON,
                "Rune should be immune to MF: base={}, mf={}, result={}", base_one_in_x, mf, result);
        }

        /// **Validates: Requirements 1.3**
        /// Property 3: Player Count Monotonicity — more players always improve (or maintain)
        /// drop chance. At player count 1, the adjustment returns the original base probability.
        #[test]
        fn prop_player_count_monotonicity(
            base_one_in_x in 10.0f64..100000.0,
            no_drop_weight in 1u32..200,
            total_weight_extra in 1u32..500,
        ) {
            let total_weight = no_drop_weight + total_weight_extra; // ensure total > no_drop
            let mut prev = base_one_in_x;
            for players in 1u8..=8 {
                let adjusted = adjust_for_player_count(base_one_in_x, no_drop_weight, total_weight, players);
                if players == 1 {
                    prop_assert!((adjusted - base_one_in_x).abs() < 1e-10,
                        "Player 1 should not change result: base={}, adjusted={}", base_one_in_x, adjusted);
                } else {
                    prop_assert!(adjusted <= prev + 1e-10,
                        "More players should improve (lower) 1-in-X: p={}, prev={}, cur={}",
                        players, prev, adjusted);
                }
                prev = adjusted;
            }
        }

        /// **Validates: Requirements 1.4**
        /// Property 4: Quest Bonus Improvement — quest bonus always improves per-kill
        /// probability compared to normal (non-quest-bonus) calculation.
        #[test]
        fn prop_quest_bonus_improvement(
            per_roll_prob in 0.0001f64..0.1,
            drop_rolls in 1u8..8,
        ) {
            let normal_prob = 1.0 - (1.0 - per_roll_prob).powi(drop_rolls as i32);
            let quest_prob = apply_quest_bonus(per_roll_prob, drop_rolls);
            prop_assert!(quest_prob > normal_prob,
                "Quest bonus should improve probability: normal={}, quest={}, per_roll={}, rolls={}",
                normal_prob, quest_prob, per_roll_prob, drop_rolls);
        }
    }

    // ─── Concrete Quest Bonus Test with TC Data ──────────────────────────────

    #[test]
    fn test_quest_bonus_mephisto_concrete() {
        let data = load_tc_data();
        let mephisto = &data.monsters["mephisto"];
        assert!(mephisto.quest_bonus_eligible,
            "Mephisto should be quest bonus eligible");

        // Get per-roll probability for an item Mephisto can drop (oculus is in TC78)
        let mut visited = Vec::new();
        let per_roll_prob = compute_item_probability(data, &mephisto.base_tc, "oculus", &mut visited).unwrap();
        assert!(per_roll_prob > 0.0, "Mephisto should be able to drop Oculus (per_roll_prob={})", per_roll_prob);

        let normal = 1.0 - (1.0 - per_roll_prob).powi(mephisto.drop_rolls as i32);
        let quest = apply_quest_bonus(per_roll_prob, mephisto.drop_rolls);
        assert!(quest > normal,
            "Quest bonus should improve Mephisto's Oculus drop rate: normal={}, quest={}", normal, quest);
    }

    // ─── Property 5: TC Tree Traversal Validity ──────────────────────────────
    // **Validates: Requirements 1.1**
    // For any valid monster and item combination where the item exists in the
    // monster's TC tree, compute_item_probability SHALL return a value in (0.0, 1.0].
    // For any item NOT reachable in the monster's TC tree, it SHALL return exactly 0.0.

    #[test]
    fn prop_tc_traversal_reachable_items_in_valid_range() {
        // **Validates: Requirements 1.1**
        let data = load_tc_data();
        // Test all items reachable from Baal's TC87 (highest TC in the hierarchy)
        for (item_id, _) in &data.items {
            let mut visited = Vec::new();
            let result = compute_item_probability(data, "TC87", item_id, &mut visited);
            if let Ok(prob) = result {
                assert!(
                    prob >= 0.0 && prob <= 1.0,
                    "Probability for item '{}' from TC87 should be in [0, 1], got {}",
                    item_id,
                    prob
                );
                // If the item is reachable (prob > 0), it must be strictly within (0, 1]
                if prob > 0.0 {
                    assert!(
                        prob <= 1.0,
                        "Reachable item '{}' should have probability <= 1.0, got {}",
                        item_id,
                        prob
                    );
                }
            }
        }
    }

    #[test]
    fn prop_tc_traversal_unreachable_items_return_zero() {
        // **Validates: Requirements 1.1**
        let data = load_tc_data();
        // Mephisto (TC78) cannot reach TC87-only items like Tyrael's Might
        let mut visited = Vec::new();
        let prob = compute_item_probability(data, "TC78", "tyrael's_might", &mut visited).unwrap();
        assert_eq!(
            prob, 0.0,
            "Unreachable item (tyrael's_might from TC78) should have probability 0.0, got {}",
            prob
        );
    }

    #[test]
    fn prop_tc_traversal_all_monsters_items_bounded() {
        // **Validates: Requirements 1.1**
        // For every monster in the data, all item probabilities must be in [0, 1]
        let data = load_tc_data();
        for (monster_id, monster) in &data.monsters {
            for (item_id, _) in &data.items {
                let mut visited = Vec::new();
                let result = compute_item_probability(data, &monster.base_tc, item_id, &mut visited);
                if let Ok(prob) = result {
                    assert!(
                        prob >= 0.0 && prob <= 1.0,
                        "Monster '{}' (TC: {}), item '{}': probability {} out of bounds [0, 1]",
                        monster_id,
                        monster.base_tc,
                        item_id,
                        prob
                    );
                }
            }
        }
    }

    // ─── Property 6: Cumulative Distribution and Threshold Consistency ────────
    // **Validates: Requirements 3.1, 3.2**
    // For any per-kill probability p in (0, 1) and threshold t in (0, 1),
    // if N = kills_for_threshold(p, t), then cumulative_probability(p, N) >= t.
    // The cumulative probability must also be monotonically non-decreasing with kills.

    proptest! {
        #[test]
        fn prop_cumulative_threshold_consistency(
            p in 0.0001f64..0.5,
            t in 0.01f64..0.99,
        ) {
            // **Validates: Requirements 3.1, 3.2**
            let n = kills_for_threshold(p, t);
            prop_assert!(n > 0, "kills_for_threshold should return > 0 for valid p={} and t={}", p, t);
            let cum_prob = cumulative_probability(p, n);
            prop_assert!(
                cum_prob >= t - 1e-10,
                "cumulative_probability({}, {}) = {} should be >= threshold {}",
                p, n, cum_prob, t
            );
        }

        #[test]
        fn prop_cumulative_monotonically_increasing(
            p in 0.0001f64..0.5,
            kills_a in 1u64..10000,
            kills_b in 1u64..10000,
        ) {
            // **Validates: Requirements 3.1, 3.2**
            if kills_a < kills_b {
                let prob_a = cumulative_probability(p, kills_a);
                let prob_b = cumulative_probability(p, kills_b);
                prop_assert!(
                    prob_b >= prob_a - 1e-10,
                    "More kills should give higher cumulative probability: p={}, kills_a={} (prob={}), kills_b={} (prob={})",
                    p, kills_a, prob_a, kills_b, prob_b
                );
            }
        }

        #[test]
        fn prop_cumulative_probability_bounded(
            p in 0.0001f64..0.9999,
            kills in 1u64..100000,
        ) {
            // **Validates: Requirements 3.1, 3.2**
            let cum_prob = cumulative_probability(p, kills);
            prop_assert!(
                cum_prob >= 0.0 && cum_prob <= 1.0,
                "Cumulative probability should be in [0, 1]: p={}, kills={}, result={}",
                p, kills, cum_prob
            );
        }

        #[test]
        fn prop_kills_for_threshold_minimum(
            p in 0.0001f64..0.5,
            t in 0.01f64..0.99,
        ) {
            // **Validates: Requirements 3.1, 3.2**
            // kills_for_threshold returns the minimum N such that cumulative >= t
            // So N-1 should give cumulative < t (for N > 1)
            let n = kills_for_threshold(p, t);
            if n > 1 {
                let cum_prob_prev = cumulative_probability(p, n - 1);
                prop_assert!(
                    cum_prob_prev < t + 1e-10,
                    "cumulative_probability({}, {}) = {} should be < threshold {} (N={} is supposed to be minimum)",
                    p, n - 1, cum_prob_prev, t, n
                );
            }
        }

        /// **Validates: Requirements 7.1**
        /// Property 11: Herald Tier TC Monotonicity (proptest variant)
        /// For any two Herald tiers t_a < t_b both in [1, 5], the TC assigned to tier t_b
        /// SHALL be >= the TC assigned to tier t_a in the TC hierarchy, and the drop rolls
        /// for t_b SHALL be >= the drop rolls for t_a.
        #[test]
        fn prop_herald_tiers_monotonic_random_pairs(
            tier_a in 1u8..=5,
            tier_b in 1u8..=5,
        ) {
            if tier_a < tier_b {
                let data = load_tc_data();
                let tc_order: Vec<&str> = vec!["TC69", "TC75", "TC78", "TC81", "TC84", "TC87"];

                let (tc_a, rolls_a) = get_herald_tier_info(data, tier_a).unwrap();
                let (tc_b, rolls_b) = get_herald_tier_info(data, tier_b).unwrap();

                let idx_a = tc_order.iter().position(|&t| t == tc_a).unwrap();
                let idx_b = tc_order.iter().position(|&t| t == tc_b).unwrap();

                prop_assert!(idx_b >= idx_a,
                    "Higher tier {} (TC={}) should have >= TC than tier {} (TC={})",
                    tier_b, tc_b, tier_a, tc_a);
                prop_assert!(rolls_b >= rolls_a,
                    "Higher tier {} (rolls={}) should have >= drop_rolls than tier {} (rolls={})",
                    tier_b, rolls_b, tier_a, rolls_a);
            }
        }
    }

    // ─── Property 10: Terror Zone Elevation Invariant ─────────────────────────
    // **Validates: Requirements 6.1, 6.2**
    // For any area eligible for Terror Zone designation, the computed TZ area level
    // SHALL be >= the base area level, and the resulting TC SHALL be >= the base TC
    // (in the TC hierarchy ordering).

    #[test]
    fn prop_terror_zone_elevation_invariant() {
        // **Validates: Requirements 6.1, 6.2**
        let data = load_tc_data();
        let tc_order: Vec<&str> = vec!["TC69", "TC75", "TC78", "TC81", "TC84", "TC87"];

        for (area_id, tz_scaling) in &data.terror_zone_scaling {
            // tz_alvl >= base_alvl
            assert!(tz_scaling.tz_alvl >= tz_scaling.base_alvl,
                "Area '{}': TZ alvl {} should be >= base alvl {}",
                area_id, tz_scaling.tz_alvl, tz_scaling.base_alvl);

            // Verify TZ TC exists in the treasure_classes map
            assert!(data.treasure_classes.contains_key(&tz_scaling.tz_tc),
                "Area '{}': TZ TC '{}' should exist in treasure_classes",
                area_id, tz_scaling.tz_tc);

            // Verify TZ TC is in the known TC hierarchy ordering
            let tz_tc_idx = tc_order.iter().position(|&t| t == tz_scaling.tz_tc.as_str());
            assert!(tz_tc_idx.is_some(),
                "Area '{}': TZ TC '{}' should be in the TC hierarchy ordering",
                area_id, tz_scaling.tz_tc);

            // Verify the TZ TC is at or above the base level (it should always be
            // an elevation, never a downgrade)
            let tz_idx = tz_tc_idx.unwrap();
            // The base_alvl determines a minimum TC tier — higher alvl means higher TC.
            // Since tz_alvl >= base_alvl, we just confirm tz_tc is a valid high-tier TC.
            // For all our test data, TZ TC should be at a reasonable position in the hierarchy.
            assert!(tz_idx >= 1,
                "Area '{}': TZ TC '{}' (idx {}) should be above the lowest TC tier",
                area_id, tz_scaling.tz_tc, tz_idx);
        }
    }

    #[test]
    fn prop_terror_zone_apply_always_elevates_or_maintains() {
        // **Validates: Requirements 6.1, 6.2**
        // Verify that apply_terror_zone with terror_zone=true always returns a TC
        // that is >= the monster's base TC in the hierarchy ordering.
        let data = load_tc_data();
        let tc_order: Vec<&str> = vec!["TC69", "TC75", "TC78", "TC81", "TC84", "TC87"];

        for (monster_id, monster) in &data.monsters {
            for (area_id, _tz_scaling) in &data.terror_zone_scaling {
                let tz_tc = apply_terror_zone(data, monster_id, area_id, true).unwrap();
                let base_tc = &monster.base_tc;

                let base_idx = tc_order.iter().position(|&t| t == base_tc.as_str())
                    .expect(&format!("Monster '{}' base_tc '{}' should be in tc_order", monster_id, base_tc));
                let tz_idx = tc_order.iter().position(|&t| t == tz_tc.as_str())
                    .expect(&format!("TZ TC '{}' for monster '{}' in area '{}' should be in tc_order",
                        tz_tc, monster_id, area_id));

                assert!(tz_idx >= base_idx,
                    "Monster '{}' in TZ area '{}': TZ TC '{}' (idx {}) should be >= base TC '{}' (idx {})",
                    monster_id, area_id, tz_tc, tz_idx, base_tc, base_idx);
            }
        }
    }

    // ─── Property 11: Herald Tier TC Monotonicity ─────────────────────────────
    // **Validates: Requirements 7.1**
    // For any two Herald tiers t_a < t_b both in [1, 5], the TC assigned to tier t_b
    // SHALL be >= the TC assigned to tier t_a in the TC hierarchy, and the drop rolls
    // for t_b SHALL be >= the drop rolls for t_a.

    #[test]
    fn prop_herald_tier_tc_monotonicity() {
        // **Validates: Requirements 7.1**
        let data = load_tc_data();
        let tc_order: Vec<&str> = vec!["TC69", "TC75", "TC78", "TC81", "TC84", "TC87"];

        let mut prev_tc_idx = 0usize;
        let mut prev_rolls = 0u8;

        for tier in 1..=5u8 {
            let (tc, rolls) = get_herald_tier_info(data, tier)
                .expect(&format!("Herald tier {} should exist", tier));

            let tc_idx = tc_order.iter().position(|&t| t == tc)
                .expect(&format!("Herald tier {} TC '{}' should be in tc_order", tier, tc));

            assert!(tc_idx >= prev_tc_idx,
                "Herald tier {}: TC '{}' (idx {}) should be >= previous '{}' (idx {})",
                tier, tc, tc_idx, tc_order[prev_tc_idx], prev_tc_idx);
            assert!(rolls >= prev_rolls,
                "Herald tier {}: drop_rolls {} should be >= previous {}",
                tier, rolls, prev_rolls);

            prev_tc_idx = tc_idx;
            prev_rolls = rolls;
        }
    }

    #[test]
    fn prop_herald_tier_all_pairs_monotonic() {
        // **Validates: Requirements 7.1**
        // Exhaustively verify all tier pairs (i, j) where i < j
        let data = load_tc_data();
        let tc_order: Vec<&str> = vec!["TC69", "TC75", "TC78", "TC81", "TC84", "TC87"];

        for tier_a in 1..=5u8 {
            for tier_b in (tier_a + 1)..=5u8 {
                let (tc_a, rolls_a) = get_herald_tier_info(data, tier_a).unwrap();
                let (tc_b, rolls_b) = get_herald_tier_info(data, tier_b).unwrap();

                let idx_a = tc_order.iter().position(|&t| t == tc_a)
                    .expect(&format!("Tier {} TC '{}' in tc_order", tier_a, tc_a));
                let idx_b = tc_order.iter().position(|&t| t == tc_b)
                    .expect(&format!("Tier {} TC '{}' in tc_order", tier_b, tc_b));

                assert!(idx_b >= idx_a,
                    "Herald tiers ({}, {}): TC '{}' (idx {}) should be >= TC '{}' (idx {})",
                    tier_a, tier_b, tc_b, idx_b, tc_a, idx_a);
                assert!(rolls_b >= rolls_a,
                    "Herald tiers ({}, {}): drop_rolls {} should be >= {}",
                    tier_a, tier_b, rolls_b, rolls_a);
            }
        }
    }

    // ─── Property 9: Luck Percentile Bounded and Monotonic ────────────────────
    // **Validates: Requirements 5.4**
    // For any valid tuple (actual_drops, total_kills, per_kill_probability) where
    // total_kills > 0 and per_kill_probability is in (0, 1), the luck percentile
    // SHALL be in the range [0, 100]. Additionally, for fixed total_kills and
    // per_kill_probability, increasing actual_drops SHALL produce a non-decreasing
    // percentile value.

    proptest! {
        #[test]
        fn prop_luck_percentile_bounded(
            actual_drops in 0u64..1000,
            total_kills in 1u64..100000,
            per_kill_prob in 0.0001f64..0.9999,
        ) {
            // **Validates: Requirements 5.4**
            let percentile = luck_percentile(actual_drops, total_kills, per_kill_prob);
            prop_assert!(percentile >= 0.0 && percentile <= 100.0,
                "Percentile should be in [0, 100]: actual_drops={}, total_kills={}, p={}, result={}",
                actual_drops, total_kills, per_kill_prob, percentile);
        }

        #[test]
        fn prop_luck_percentile_monotonic_with_drops(
            total_kills in 100u64..10000,
            per_kill_prob in 0.001f64..0.1,
            drops_a in 0u64..100,
            drops_b in 0u64..100,
        ) {
            // **Validates: Requirements 5.4**
            if drops_a < drops_b {
                let perc_a = luck_percentile(drops_a, total_kills, per_kill_prob);
                let perc_b = luck_percentile(drops_b, total_kills, per_kill_prob);
                prop_assert!(perc_b >= perc_a - 1e-10,
                    "More drops should give higher percentile: drops_a={} ({}%), drops_b={} ({}%)",
                    drops_a, perc_a, drops_b, perc_b);
            }
        }
    }

    // ─── Property 12: Input Validation Boundary ───────────────────────────────
    // **Validates: Requirements 10.1, 10.3**
    // For any Magic Find value outside [0, 9999] or any monster/item identifier
    // not present in TC_Data, the engine SHALL return an error result.
    // For any MF in [0, 9999] with a valid monster and item, the engine SHALL NOT
    // return a validation error.

    #[test]
    fn prop_input_validation_invalid_mf() {
        // **Validates: Requirements 10.1, 10.3**
        use crate::drop_commands::{DropProbabilityInput, calculate_drop_probability};

        let input = DropProbabilityInput {
            monster_id: "baal".to_string(),
            item_id: "ber_rune".to_string(),
            magic_find: 10000, // Invalid: > 9999
            player_count: 1,
            quest_bonus: false,
            terror_zone: false,
            herald_tier: None,
        };
        let result = calculate_drop_probability(input);
        assert!(result.is_err(), "MF > 9999 should return Err");
        assert!(result.unwrap_err().contains("Magic Find"),
            "Error should mention Magic Find");
    }

    #[test]
    fn prop_input_validation_invalid_monster() {
        // **Validates: Requirements 10.1, 10.3**
        use crate::drop_commands::{DropProbabilityInput, calculate_drop_probability};

        let input = DropProbabilityInput {
            monster_id: "nonexistent_monster".to_string(),
            item_id: "ber_rune".to_string(),
            magic_find: 300,
            player_count: 1,
            quest_bonus: false,
            terror_zone: false,
            herald_tier: None,
        };
        let result = calculate_drop_probability(input);
        assert!(result.is_err(), "Unknown monster should return Err");
        assert!(result.unwrap_err().contains("Monster not found"),
            "Error should mention Monster not found");
    }

    #[test]
    fn prop_input_validation_invalid_item() {
        // **Validates: Requirements 10.1, 10.3**
        use crate::drop_commands::{DropProbabilityInput, calculate_drop_probability};

        let input = DropProbabilityInput {
            monster_id: "baal".to_string(),
            item_id: "nonexistent_item".to_string(),
            magic_find: 300,
            player_count: 1,
            quest_bonus: false,
            terror_zone: false,
            herald_tier: None,
        };
        let result = calculate_drop_probability(input);
        assert!(result.is_err(), "Unknown item should return Err");
        assert!(result.unwrap_err().contains("Item not found"),
            "Error should mention Item not found");
    }

    #[test]
    fn prop_input_validation_valid_inputs() {
        // **Validates: Requirements 10.1, 10.3**
        use crate::drop_commands::{DropProbabilityInput, calculate_drop_probability};

        let input = DropProbabilityInput {
            monster_id: "baal".to_string(),
            item_id: "ber_rune".to_string(),
            magic_find: 300,
            player_count: 3,
            quest_bonus: false,
            terror_zone: false,
            herald_tier: None,
        };
        let result = calculate_drop_probability(input);
        assert!(result.is_ok(), "Valid inputs should not return error: {:?}", result.err());
    }
}
