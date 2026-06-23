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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateRunInput {
    pub profile_id: String,
    pub area: String,
    pub notes: Option<String>,
    pub player_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinishRunInput {
    pub duration_secs: i64,
    pub notes: Option<String>,
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
