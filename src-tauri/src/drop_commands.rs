use serde::{Deserialize, Serialize};

use crate::probability_engine;

// ─── Input/Output Structs ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DropProbabilityInput {
    pub monster_id: String,
    pub item_id: String,
    pub magic_find: u32,         // 0–9999
    pub player_count: u8,        // 1–8
    pub quest_bonus: bool,
    pub terror_zone: bool,
    pub herald_tier: Option<u8>, // 1–5 if Herald encounter
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DropProbabilityResult {
    pub probability: f64,
    pub one_in_x: f64,
    pub kills_for_50: u64,
    pub kills_for_63: u64,
    pub kills_for_90: u64,
    pub kills_for_99: u64,
    pub effective_mf: f64,
    pub mf_applied: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CumulativeDistInput {
    pub probability: f64,
    pub max_kills: u64,
    pub step: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DistributionPoint {
    pub kills: u64,
    pub cumulative_probability: f64,
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn calculate_drop_probability(
    input: DropProbabilityInput,
) -> Result<DropProbabilityResult, String> {
    // Input validation
    if input.magic_find > 9999 {
        return Err("Magic Find must be between 0 and 9999".to_string());
    }
    if input.player_count < 1 || input.player_count > 8 {
        return Err("Player count must be between 1 and 8".to_string());
    }

    let tc_data = probability_engine::load_tc_data();

    // Validate monster and item exist
    let monster = tc_data
        .monsters
        .get(&input.monster_id)
        .ok_or_else(|| format!("Monster not found: {}", input.monster_id))?;
    if !tc_data.items.contains_key(&input.item_id) {
        return Err(format!("Item not found: {}", input.item_id));
    }

    // Determine effective TC and drop_rolls (TZ and Herald modifications)
    let (effective_tc, effective_rolls) = if let Some(tier) = input.herald_tier {
        probability_engine::apply_herald_tier(tc_data, &input.monster_id, Some(tier))?
    } else if input.terror_zone {
        let area_key = monster.area.to_lowercase().replace(" ", "_");
        let tz_tc =
            probability_engine::apply_terror_zone(tc_data, &input.monster_id, &area_key, true)?;
        (tz_tc, monster.drop_rolls)
    } else {
        (monster.base_tc.clone(), monster.drop_rolls)
    };

    // TC tree traversal for per-roll probability
    let mut visited = Vec::new();
    let per_roll_prob = probability_engine::compute_item_probability(
        tc_data,
        &effective_tc,
        &input.item_id,
        &mut visited,
    )?;

    // Apply multiple rolls per kill (with or without quest bonus)
    let mut per_kill_prob = if input.quest_bonus && monster.quest_bonus_eligible {
        probability_engine::apply_quest_bonus(per_roll_prob, effective_rolls)
    } else {
        1.0 - (1.0 - per_roll_prob).powi(effective_rolls as i32)
    };

    // Determine rarity and whether MF applies
    let item_def = &tc_data.items[&input.item_id];
    let mf_applied = item_def.rarity != "Rune" && item_def.rarity != "Normal";

    let effective_mf = if mf_applied {
        let factor = match item_def.rarity.as_str() {
            "Unique" => 250.0,
            "Set" => 500.0,
            _ => 0.0,
        };
        if factor > 0.0 {
            (input.magic_find as f64 * factor) / (input.magic_find as f64 + factor)
        } else {
            0.0
        }
    } else {
        0.0
    };

    // Apply MF adjustment
    if mf_applied && per_kill_prob > 0.0 {
        let one_in_x = 1.0 / per_kill_prob;
        let adjusted =
            probability_engine::apply_mf_adjustment(one_in_x, input.magic_find, &item_def.rarity);
        per_kill_prob = 1.0 / adjusted;
    }

    // Apply player count adjustment
    if input.player_count > 1 && per_kill_prob > 0.0 {
        let tc = tc_data
            .treasure_classes
            .get(&effective_tc)
            .ok_or_else(|| format!("TC not found: {}", effective_tc))?;
        let total_weight: u32 = tc.items.iter().map(|i| i.weight).sum::<u32>()
            + tc.sub_tcs.iter().map(|s| s.weight).sum::<u32>()
            + tc.no_drop_weight;
        let one_in_x = 1.0 / per_kill_prob;
        let adjusted = probability_engine::adjust_for_player_count(
            one_in_x,
            tc.no_drop_weight,
            total_weight,
            input.player_count,
        );
        per_kill_prob = 1.0 / adjusted;
    }

    // Calculate thresholds
    let one_in_x = if per_kill_prob > 0.0 {
        1.0 / per_kill_prob
    } else {
        0.0
    };

    Ok(DropProbabilityResult {
        probability: per_kill_prob,
        one_in_x,
        kills_for_50: probability_engine::kills_for_threshold(per_kill_prob, 0.5),
        kills_for_63: probability_engine::kills_for_threshold(per_kill_prob, 0.632),
        kills_for_90: probability_engine::kills_for_threshold(per_kill_prob, 0.9),
        kills_for_99: probability_engine::kills_for_threshold(per_kill_prob, 0.99),
        effective_mf,
        mf_applied,
    })
}

#[tauri::command]
pub fn calculate_cumulative_distribution(
    input: CumulativeDistInput,
) -> Result<Vec<DistributionPoint>, String> {
    if input.probability <= 0.0 || input.probability >= 1.0 {
        return Err("Probability must be between 0 and 1 (exclusive)".to_string());
    }
    if input.step == 0 {
        return Err("Step must be greater than 0".to_string());
    }

    let mut points = Vec::new();
    let mut kills = 0u64;
    while kills <= input.max_kills {
        points.push(DistributionPoint {
            kills,
            cumulative_probability: probability_engine::cumulative_probability(
                input.probability,
                kills,
            ),
        });
        kills += input.step;
    }

    Ok(points)
}
