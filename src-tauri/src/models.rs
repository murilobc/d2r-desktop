use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub class: String,
    pub mode: String,
    pub magic_find: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateProfileInput {
    pub name: String,
    pub class: String,
    pub mode: String,
    pub magic_find: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateProfileInput {
    pub name: Option<String>,
    pub class: Option<String>,
    pub mode: Option<String>,
    pub magic_find: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Run {
    pub id: String,
    pub profile_id: String,
    pub area: String,
    pub duration_secs: i64,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub player_count: Option<i64>,
    pub route_id: Option<String>,
    pub route_step_index: Option<i64>,
    pub tags: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateRunInput {
    pub profile_id: String,
    pub area: String,
    pub notes: Option<String>,
    pub player_count: Option<i64>,
    pub route_id: Option<String>,
    pub route_step_index: Option<i64>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinishRunInput {
    pub duration_secs: i64,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRunTagsInput {
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Item {
    pub id: String,
    pub run_id: String,
    pub profile_id: String,
    pub name: String,
    pub item_type: String,
    pub rarity: String,
    pub found_at: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateItemInput {
    pub run_id: String,
    pub profile_id: String,
    pub name: String,
    pub item_type: String,
    pub rarity: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Stats {
    pub total_runs: i64,
    pub total_items: i64,
    pub total_time_secs: i64,
    pub avg_run_duration_secs: f64,
    pub items_per_run: f64,
    pub items_by_rarity: Vec<RarityCount>,
    pub runs_by_area: Vec<AreaCount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RarityCount {
    pub rarity: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AreaCount {
    pub area: String,
    pub count: i64,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailedRun {
    pub run: Run,
    pub items: Vec<Item>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportData {
    pub version: String,
    pub exported_at: String,
    pub profiles: Vec<Profile>,
    pub runs: Vec<Run>,
    pub items: Vec<Item>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub profiles_imported: i64,
    pub runs_imported: i64,
    pub items_imported: i64,
    pub skipped: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginatedRuns {
    pub runs: Vec<Run>,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomArea {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub created_at: String,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Route {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub areas: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateRouteInput {
    pub profile_id: String,
    pub name: String,
    pub areas: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateRouteInput {
    pub name: String,
    pub areas: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RouteStats {
    pub route_id: String,
    pub route_name: String,
    pub total_cycles: i64,
    pub avg_cycle_time_secs: f64,
    pub total_items: i64,
    pub items_per_cycle: f64,
}

// ===== COMPARISON MODE =====

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ComparisonRequest {
    #[serde(rename = "area")]
    Area {
        profile_id: String,
        area_a: String,
        area_b: String,
    },
    #[serde(rename = "date_range")]
    DateRange {
        profile_id: String,
        start_a: String,
        end_a: String,
        start_b: String,
        end_b: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubjectMetrics {
    pub label: String,
    pub total_runs: i64,
    pub total_items: i64,
    pub total_unique_items: i64,
    pub total_duration_secs: i64,
    pub items_per_hour: f64,
    pub unique_items_per_hour: f64,
    pub items_per_run: f64,
    pub avg_time_per_run: f64,
    pub fastest_run_secs: Option<i64>,
    pub slowest_run_secs: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComparisonResult {
    pub subject_a: SubjectMetrics,
    pub subject_b: SubjectMetrics,
}

// ===== HERALD TRACKING =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeraldEncounter {
    pub id: String,
    pub profile_id: String,
    pub tier: i64,
    pub area: String,
    pub result: String,
    pub sunder_charm: Option<String>,
    pub notes: Option<String>,
    pub encountered_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateHeraldEncounterInput {
    pub profile_id: String,
    pub tier: i64,
    pub area: String,
    pub result: String,
    pub sunder_charm: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeraldStats {
    pub total_encounters: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub encounters_by_tier: Vec<TierCount>,
    pub sunder_charms_found: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TierCount {
    pub tier: i64,
    pub count: i64,
    pub successes: i64,
}

// ===== COLOSSAL ANCIENTS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColossalAncientAttempt {
    pub id: String,
    pub profile_id: String,
    pub boss_name: String,
    pub attempt_number: i64,
    pub result: String,
    pub drops: Option<String>,
    pub duration_secs: i64,
    pub notes: Option<String>,
    pub attempted_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateColossalAttemptInput {
    pub profile_id: String,
    pub boss_name: String,
    pub result: String,
    pub drops: Option<String>,
    pub duration_secs: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColossalAncientStats {
    pub total_attempts: i64,
    pub total_successes: i64,
    pub bosses_defeated: Vec<String>,
    pub stats_by_boss: Vec<BossStats>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BossStats {
    pub boss_name: String,
    pub attempts: i64,
    pub successes: i64,
    pub best_time_secs: Option<i64>,
    pub avg_time_secs: f64,
}

// ===== DIABLO CLONE TRACKER =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DCloneProgress {
    pub region: String,
    pub progress: i64,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnniLog {
    pub id: String,
    pub profile_id: String,
    pub stats: String,
    pub notes: Option<String>,
    pub obtained_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateAnniLogInput {
    pub profile_id: String,
    pub stats: String,
    pub notes: Option<String>,
}

// ===== XP TRACKING =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XpEntry {
    pub id: String,
    pub profile_id: String,
    pub run_id: Option<String>,
    pub level: i64,
    pub xp_gained: i64,
    pub duration_secs: i64,
    pub area: Option<String>,
    pub notes: Option<String>,
    pub recorded_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateXpEntryInput {
    pub profile_id: String,
    pub run_id: Option<String>,
    pub level: i64,
    pub xp_gained: i64,
    pub duration_secs: i64,
    pub area: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XpStats {
    pub total_xp: i64,
    pub total_time_secs: i64,
    pub xp_per_hour: f64,
    pub entries_count: i64,
    pub avg_xp_per_session: f64,
}
