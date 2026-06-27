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
