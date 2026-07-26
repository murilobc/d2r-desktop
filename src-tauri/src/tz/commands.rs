use crate::db::DbState;
use crate::tz;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerrorZoneApiResponse {
    pub current_zone: String,
    pub next_zone: String,
    pub upcoming: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerrorZoneInfo {
    pub zone_name: String,
    pub tier: String,               // "S" | "A" | "B" | "C"
    pub fetched_at: Option<String>, // ISO-8601 UTC, None for SP-computed
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TzSettings {
    pub polling_enabled: bool,
    pub good_tz_tier: String, // "S" | "A" | "B" | "C"
}

// ── Zone ID → human readable name mapping ────────────────────────────────────
fn zone_id_to_name(id: &str) -> &str {
    // Maps snake_case IDs returned by d2r.kimpton.io to display names.
    static MAP: std::sync::OnceLock<HashMap<&'static str, &'static str>> =
        std::sync::OnceLock::new();
    let m = MAP.get_or_init(|| {
        let mut m = HashMap::new();
        m.insert("blood_moor", "Blood Moor and Den of Evil");
        m.insert("den_of_evil", "Blood Moor and Den of Evil");
        m.insert("cold_plains", "Cold Plains and The Cave");
        m.insert("the_cave", "Cold Plains and The Cave");
        m.insert("stony_field", "Stony Field");
        m.insert("dark_wood", "Dark Wood and Black Marsh");
        m.insert("black_marsh", "Dark Wood and Black Marsh");
        m.insert("tamoe_highland", "Tamoe Highland and Pit");
        m.insert("the_pit", "Tamoe Highland and Pit");
        m.insert("monastery_gate", "Outer Cloister and Barracks");
        m.insert("outer_cloister", "Outer Cloister and Barracks");
        m.insert("barracks", "Outer Cloister and Barracks");
        m.insert("jail", "Jail");
        m.insert("inner_cloister", "Inner Cloister and Cathedral");
        m.insert("cathedral", "Inner Cloister and Cathedral");
        m.insert("catacombs", "Catacombs");
        m.insert("lut_gholein_sewers", "Lut Gholein Sewers");
        m.insert("sewers", "Lut Gholein Sewers");
        m.insert("rocky_waste", "Rocky Waste and Stony Tomb");
        m.insert("stony_tomb", "Rocky Waste and Stony Tomb");
        m.insert("dry_hills", "Dry Hills and Halls of the Dead");
        m.insert("halls_of_the_dead", "Dry Hills and Halls of the Dead");
        m.insert("far_oasis", "Far Oasis");
        m.insert("lost_city", "Lost City, Valley of Snakes, and Claw Viper Temple");
        m.insert("valley_of_snakes", "Lost City, Valley of Snakes, and Claw Viper Temple");
        m.insert("claw_viper_temple", "Lost City, Valley of Snakes, and Claw Viper Temple");
        m.insert("arcane_sanctuary", "Arcane Sanctuary");
        m.insert("canyon_of_the_magi", "Canyon of the Magi");
        m.insert("tal_rashas_tombs", "Tal Rasha's Tombs");
        m.insert("spider_forest", "Spider Forest and Spider Cavern");
        m.insert("spider_cavern", "Spider Forest and Spider Cavern");
        m.insert("flayer_jungle", "Flayer Jungle and Swampy Pit");
        m.insert("swampy_pit", "Flayer Jungle and Swampy Pit");
        m.insert("lower_kurast", "Lower Kurast");
        m.insert("kurast_bazaar", "Kurast Bazaar, Upper Kurast, and Kurast Causeway");
        m.insert("upper_kurast", "Kurast Bazaar, Upper Kurast, and Kurast Causeway");
        m.insert("kurast_causeway", "Kurast Bazaar, Upper Kurast, and Kurast Causeway");
        m.insert("travincal", "Travincal");
        m.insert("durance_of_hate", "Durance of Hate");
        m.insert("outer_steppes", "Outer Steppes and Plains of Despair");
        m.insert("plains_of_despair", "Outer Steppes and Plains of Despair");
        m.insert("city_of_the_damned", "City of the Damned");
        m.insert("river_of_flame", "River of Flame");
        m.insert("chaos_sanctuary", "Chaos Sanctuary");
        m.insert("bloody_foothills", "Bloody Foothills and Frigid Highlands");
        m.insert("frigid_highlands", "Bloody Foothills and Frigid Highlands");
        m.insert("glacial_trail", "Glacial Trail and Drifter Cavern");
        m.insert("drifter_cavern", "Glacial Trail and Drifter Cavern");
        m.insert("crystalline_passage", "Crystalline Passage and Frozen River");
        m.insert("frozen_river", "Crystalline Passage and Frozen River");
        m.insert("frozen_tundra", "Frozen Tundra and Ancient's Way");
        m.insert("ancients_way", "Frozen Tundra and Ancient's Way");
        m.insert("ancient_tunnels", "Ancient Tunnels");
        m.insert("nihlathaks_temple", "Nihlathak's Temple, Halls of Anguish, and Halls of Pain");
        m.insert("halls_of_anguish", "Nihlathak's Temple, Halls of Anguish, and Halls of Pain");
        m.insert("halls_of_pain", "Nihlathak's Temple, Halls of Anguish, and Halls of Pain");
        m.insert("halls_of_vaught", "Halls of Vaught");
        m.insert("abaddon", "Abaddon");
        m.insert("pit_of_acheron", "Pit of Acheron");
        m.insert("infernal_pit", "Infernal Pit");
        m.insert("worldstone_keep", "The Worldstone Keep and Throne of Destruction");
        m.insert("throne_of_destruction", "The Worldstone Keep and Throne of Destruction");
        m.insert("worldstone_chamber", "The Worldstone Keep and Throne of Destruction");
        m
    });
    m.get(id).copied().unwrap_or(id)
}

/// Converts a list of zone IDs (possibly multiple per rotation) into one display name.
fn zone_ids_to_display(ids: &[String]) -> String {
    if ids.is_empty() {
        return "Unknown".to_string();
    }
    // Use the first ID's mapped name; if multiple IDs map to the same display name, deduplicate
    let names: Vec<&str> = ids
        .iter()
        .map(|id| zone_id_to_name(id.as_str()))
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    names.join(", ")
}

// ===== TAURI COMMANDS =====

#[tauri::command]
pub async fn fetch_terror_zone(state: State<'_, DbState>) -> Result<TerrorZoneApiResponse, String> {
    // Real working API: d2r.kimpton.io/api/tz
    // Response: { current_zone_ids: [...], next_zone_ids: [...], next_rotation_at: unix, generated_at: iso }
    #[derive(Deserialize)]
    struct KimptonApiResponse {
        current_zone_ids: Option<Vec<String>>,
        next_zone_ids: Option<Vec<String>>,
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("d2r-tracker/5.2.0")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get("https://d2r.kimpton.io/api/tz")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned status {}", response.status()));
    }

    let raw_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let api: KimptonApiResponse = serde_json::from_str(&raw_text).map_err(|e| {
        format!(
            "Parse error: {}; raw body: {}",
            e,
            &raw_text[..raw_text.len().min(300)]
        )
    })?;

    let current_ids = api.current_zone_ids.unwrap_or_default();
    let next_ids = api.next_zone_ids.unwrap_or_default();

    let current_zone = zone_ids_to_display(&current_ids);
    let next_zone = zone_ids_to_display(&next_ids);

    // Build upcoming: next hour from API, then SP-derived hours after that
    let now_secs = Utc::now().timestamp();
    let mut upcoming = vec![next_zone.clone()];

    // Fill remaining upcoming slots with SP-deterministic calculation (hours 2-4 ahead)
    for i in 2i64..=4 {
        let t = (now_secs / 3600 + i) * 3600;
        upcoming.push(tz::zone_at(t).to_string());
    }

    let now = Utc::now().to_rfc3339();
    let upcoming_json = serde_json::to_string(&upcoming).unwrap_or_else(|_| "[]".to_string());

    // Upsert cache
    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let _ = conn.execute(
            "INSERT INTO terror_zone_cache (id, current_zone, next_zone, upcoming, fetched_at)
             VALUES (1, ?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
               current_zone = ?1, next_zone = ?2, upcoming = ?3, fetched_at = ?4",
            rusqlite::params![current_zone, next_zone, upcoming_json, now],
        );
    }

    Ok(TerrorZoneApiResponse {
        current_zone,
        next_zone,
        upcoming,
    })
}

#[tauri::command]
pub fn get_sp_terror_zone(timestamp_unix: i64) -> Result<TerrorZoneInfo, String> {
    let zone_name = tz::zone_at(timestamp_unix).to_string();
    let tier = tz::tier_for_zone(&zone_name).to_string();
    Ok(TerrorZoneInfo {
        zone_name,
        tier,
        fetched_at: None,
    })
}

#[tauri::command]
pub fn get_tz_cache(state: State<DbState>) -> Result<Option<TerrorZoneInfo>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT current_zone, fetched_at FROM terror_zone_cache WHERE id = 1",
        [],
        |row| {
            let zone_name: String = row.get(0)?;
            let fetched_at: Option<String> = row.get(1)?;
            Ok((zone_name, fetched_at))
        },
    );

    match result {
        Ok((zone_name, fetched_at)) => {
            let tier = tz::tier_for_zone(&zone_name).to_string();
            Ok(Some(TerrorZoneInfo {
                zone_name,
                tier,
                fetched_at,
            }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_tz_settings(state: State<DbState>) -> Result<TzSettings, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT polling_enabled, good_tz_tier FROM tz_settings WHERE id = 1",
        [],
        |row| {
            Ok(TzSettings {
                polling_enabled: row.get::<_, i64>(0)? != 0,
                good_tz_tier: row.get(1)?,
            })
        },
    );

    match result {
        Ok(s) => Ok(s),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(TzSettings {
            polling_enabled: true,
            good_tz_tier: "A".to_string(),
        }),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn update_tz_settings(
    state: State<DbState>,
    settings: TzSettings,
) -> Result<TzSettings, String> {
    let valid_tiers = ["S", "A", "B", "C"];
    if !valid_tiers.contains(&settings.good_tz_tier.as_str()) {
        return Err("Invalid tier. Must be S, A, B, or C".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO tz_settings (id, polling_enabled, good_tz_tier)
         VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET polling_enabled = ?1, good_tz_tier = ?2",
        rusqlite::params![settings.polling_enabled as i64, settings.good_tz_tier],
    )
    .map_err(|e| e.to_string())?;

    Ok(settings)
}
