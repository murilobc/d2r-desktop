use crate::db::DbState;
use crate::tz;
use chrono::Utc;
use serde::{Deserialize, Serialize};
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
    pub tier: String,             // "S" | "A" | "B" | "C"
    pub fetched_at: Option<String>, // ISO-8601 UTC, None for SP-computed
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TzSettings {
    pub polling_enabled: bool,
    pub good_tz_tier: String, // "S" | "A" | "B" | "C"
}

// ===== TAURI COMMANDS =====

#[tauri::command]
pub async fn fetch_terror_zone(state: State<'_, DbState>) -> Result<TerrorZoneApiResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get("https://www.terrorzonetracker.com/api/v1/tz")
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

    // Attempt to parse the API response
    #[derive(Deserialize)]
    struct ApiShape {
        current: Option<ApiZoneEntry>,
        upcoming: Option<Vec<ApiZoneEntry>>,
    }
    #[derive(Deserialize)]
    struct ApiZoneEntry {
        zone: Option<String>,
    }

    let api: ApiShape = serde_json::from_str(&raw_text).map_err(|e| {
        format!("Parse error: {}; raw body: {}", e, &raw_text[..raw_text.len().min(200)])
    })?;

    let current_zone = api
        .current
        .and_then(|c| c.zone)
        .unwrap_or_else(|| "Unknown".to_string());

    let upcoming_zones: Vec<String> = api
        .upcoming
        .unwrap_or_default()
        .into_iter()
        .filter_map(|u| u.zone)
        .collect();

    let next_zone = upcoming_zones.first().cloned().unwrap_or_else(|| "Unknown".to_string());

    let now = Utc::now().to_rfc3339();
    let upcoming_json = serde_json::to_string(&upcoming_zones).unwrap_or_else(|_| "[]".to_string());

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
        upcoming: upcoming_zones,
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
pub fn update_tz_settings(state: State<DbState>, settings: TzSettings) -> Result<TzSettings, String> {
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
