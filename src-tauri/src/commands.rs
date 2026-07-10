use crate::db::DbState;
use crate::models::*;
use chrono::Utc;
use serde::Deserialize;
use serde_json;
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

// ===== PROFILES =====

#[tauri::command]
pub fn create_profile(state: State<DbState>, input: CreateProfileInput) -> Result<Profile, String> {
    // Input validation
    if input.name.trim().is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    if input.name.len() > 100 {
        return Err("Profile name is too long (max 100 characters)".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO profiles (id, name, class, mode, magic_find, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, input.name, input.class, input.mode, input.magic_find, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Profile {
        id,
        name: input.name,
        class: input.class,
        mode: input.mode,
        magic_find: input.magic_find,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn get_profiles(state: State<DbState>) -> Result<Vec<Profile>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, class, mode, magic_find, created_at, updated_at FROM profiles ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let profiles = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                class: row.get(2)?,
                mode: row.get(3)?,
                magic_find: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(profiles)
}

#[tauri::command]
pub fn update_profile(state: State<DbState>, id: String, input: UpdateProfileInput) -> Result<Profile, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get current profile
    let mut stmt = conn
        .prepare("SELECT id, name, class, mode, magic_find, created_at, updated_at FROM profiles WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let mut profile: Profile = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                class: row.get(2)?,
                mode: row.get(3)?,
                magic_find: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(name) = input.name {
        profile.name = name;
    }
    if let Some(class) = input.class {
        profile.class = class;
    }
    if let Some(mode) = input.mode {
        profile.mode = mode;
    }
    if let Some(mf) = input.magic_find {
        profile.magic_find = Some(mf);
    }
    profile.updated_at = now;

    conn.execute(
        "UPDATE profiles SET name = ?1, class = ?2, mode = ?3, magic_find = ?4, updated_at = ?5 WHERE id = ?6",
        rusqlite::params![profile.name, profile.class, profile.mode, profile.magic_find, profile.updated_at, profile.id],
    ).map_err(|e| e.to_string())?;

    Ok(profile)
}

#[tauri::command]
pub fn delete_profile(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM items WHERE profile_id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM runs WHERE profile_id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM profiles WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== RUNS =====

#[tauri::command]
pub fn create_run(state: State<DbState>, input: CreateRunInput) -> Result<Run, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    let tags_json = input.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());

    conn.execute(
        "INSERT INTO runs (id, profile_id, area, duration_secs, started_at, status, notes, player_count, route_id, route_step_index, tags) VALUES (?1, ?2, ?3, 0, ?4, 'in_progress', ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![id, input.profile_id, input.area, now, input.notes, input.player_count, input.route_id, input.route_step_index, tags_json],
    ).map_err(|e| e.to_string())?;

    Ok(Run {
        id,
        profile_id: input.profile_id,
        area: input.area,
        duration_secs: 0,
        started_at: now,
        finished_at: None,
        status: "in_progress".to_string(),
        notes: input.notes,
        player_count: input.player_count,
        route_id: input.route_id,
        route_step_index: input.route_step_index,
        tags: tags_json,
    })
}

#[tauri::command]
pub fn get_runs(state: State<DbState>, profile_id: String) -> Result<Vec<Run>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count, route_id, route_step_index, tags FROM runs WHERE profile_id = ?1 ORDER BY started_at DESC")
        .map_err(|e| e.to_string())?;

    let runs = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(Run {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                area: row.get(2)?,
                duration_secs: row.get(3)?,
                started_at: row.get(4)?,
                finished_at: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                player_count: row.get(8)?,
                route_id: row.get(9)?,
                route_step_index: row.get(10)?,
                tags: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(runs)
}

#[tauri::command]
pub fn get_runs_paginated(state: State<DbState>, profile_id: String, offset: i64, limit: i64) -> Result<PaginatedRuns, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed'",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count, route_id, route_step_index, tags FROM runs WHERE profile_id = ?1 AND status = 'completed' ORDER BY started_at DESC LIMIT ?2 OFFSET ?3")
        .map_err(|e| e.to_string())?;

    let runs = stmt
        .query_map(rusqlite::params![profile_id, limit, offset], |row| {
            Ok(Run {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                area: row.get(2)?,
                duration_secs: row.get(3)?,
                started_at: row.get(4)?,
                finished_at: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                player_count: row.get(8)?,
                route_id: row.get(9)?,
                route_step_index: row.get(10)?,
                tags: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PaginatedRuns { runs, total })
}

#[tauri::command]
pub fn finish_run(state: State<DbState>, id: String, input: FinishRunInput) -> Result<Run, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let tags_json = input.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());

    if tags_json.is_some() {
        conn.execute(
            "UPDATE runs SET duration_secs = ?1, finished_at = ?2, status = 'completed', notes = ?3, tags = ?4 WHERE id = ?5",
            rusqlite::params![input.duration_secs, now, input.notes, tags_json, id],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE runs SET duration_secs = ?1, finished_at = ?2, status = 'completed', notes = ?3 WHERE id = ?4",
            rusqlite::params![input.duration_secs, now, input.notes, id],
        ).map_err(|e| e.to_string())?;
    }

    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count, route_id, route_step_index, tags FROM runs WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let run = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Run {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                area: row.get(2)?,
                duration_secs: row.get(3)?,
                started_at: row.get(4)?,
                finished_at: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                player_count: row.get(8)?,
                route_id: row.get(9)?,
                route_step_index: row.get(10)?,
                tags: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(run)
}

#[tauri::command]
pub fn update_run_area(state: State<DbState>, id: String, area: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE runs SET area = ?1 WHERE id = ?2",
        rusqlite::params![area, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_run_tags(state: State<DbState>, id: String, input: UpdateRunTagsInput) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&input.tags).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE runs SET tags = ?1 WHERE id = ?2",
        rusqlite::params![tags_json, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_run(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM items WHERE run_id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM runs WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== ITEMS =====

#[tauri::command]
pub fn create_item(state: State<DbState>, input: CreateItemInput) -> Result<Item, String> {
    // Input validation
    if input.name.trim().is_empty() {
        return Err("Item name cannot be empty".to_string());
    }
    if input.name.len() > 200 {
        return Err("Item name is too long (max 200 characters)".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO items (id, run_id, profile_id, name, item_type, rarity, found_at, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, input.run_id, input.profile_id, input.name, input.item_type, input.rarity, now, input.notes],
    ).map_err(|e| e.to_string())?;

    Ok(Item {
        id,
        run_id: input.run_id,
        profile_id: input.profile_id,
        name: input.name,
        item_type: input.item_type,
        rarity: input.rarity,
        found_at: now,
        notes: input.notes,
    })
}

#[tauri::command]
pub fn get_items(state: State<DbState>, run_id: String) -> Result<Vec<Item>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, run_id, profile_id, name, item_type, rarity, found_at, notes FROM items WHERE run_id = ?1 ORDER BY found_at DESC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(rusqlite::params![run_id], |row| {
            Ok(Item {
                id: row.get(0)?,
                run_id: row.get(1)?,
                profile_id: row.get(2)?,
                name: row.get(3)?,
                item_type: row.get(4)?,
                rarity: row.get(5)?,
                found_at: row.get(6)?,
                notes: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn get_all_items(state: State<DbState>, profile_id: String) -> Result<Vec<Item>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, run_id, profile_id, name, item_type, rarity, found_at, notes FROM items WHERE profile_id = ?1 ORDER BY found_at DESC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(Item {
                id: row.get(0)?,
                run_id: row.get(1)?,
                profile_id: row.get(2)?,
                name: row.get(3)?,
                item_type: row.get(4)?,
                rarity: row.get(5)?,
                found_at: row.get(6)?,
                notes: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn delete_item(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM items WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== STATS =====

#[tauri::command]
pub fn get_stats(state: State<DbState>, profile_id: String) -> Result<Stats, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let total_runs: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed'",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_items: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE profile_id = ?1",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_time_secs: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_secs), 0) FROM runs WHERE profile_id = ?1 AND status = 'completed'",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let avg_run_duration_secs = if total_runs > 0 {
        total_time_secs as f64 / total_runs as f64
    } else {
        0.0
    };

    let items_per_run = if total_runs > 0 {
        total_items as f64 / total_runs as f64
    } else {
        0.0
    };

    // Items by rarity
    let mut stmt = conn
        .prepare("SELECT rarity, COUNT(*) FROM items WHERE profile_id = ?1 GROUP BY rarity ORDER BY COUNT(*) DESC")
        .map_err(|e| e.to_string())?;
    let items_by_rarity = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(RarityCount {
                rarity: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Runs by area
    let mut stmt = conn
        .prepare("SELECT area, COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed' GROUP BY area ORDER BY COUNT(*) DESC")
        .map_err(|e| e.to_string())?;
    let runs_by_area = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(AreaCount {
                area: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(Stats {
        total_runs,
        total_items,
        total_time_secs,
        avg_run_duration_secs,
        items_per_run,
        items_by_rarity,
        runs_by_area,
    })
}

#[tauri::command]
pub fn get_detailed_runs(state: State<DbState>, profile_id: String, area_filter: Option<String>) -> Result<Vec<DetailedRun>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let runs: Vec<Run> = if let Some(ref area) = area_filter {
        let mut stmt = conn
            .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count, route_id, route_step_index, tags FROM runs WHERE profile_id = ?1 AND status = 'completed' AND area = ?2 ORDER BY started_at DESC")
            .map_err(|e| e.to_string())?;
        let result = stmt.query_map(rusqlite::params![profile_id, area], |row| {
            Ok(Run {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                area: row.get(2)?,
                duration_secs: row.get(3)?,
                started_at: row.get(4)?,
                finished_at: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                player_count: row.get(8)?,
                route_id: row.get(9)?,
                route_step_index: row.get(10)?,
                tags: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        result
    } else {
        let mut stmt = conn
            .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count, route_id, route_step_index, tags FROM runs WHERE profile_id = ?1 AND status = 'completed' ORDER BY started_at DESC")
            .map_err(|e| e.to_string())?;
        let result = stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok(Run {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                area: row.get(2)?,
                duration_secs: row.get(3)?,
                started_at: row.get(4)?,
                finished_at: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                player_count: row.get(8)?,
                route_id: row.get(9)?,
                route_step_index: row.get(10)?,
                tags: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        result
    };

    let mut detailed_runs = Vec::new();
    for run in runs {
        let mut stmt = conn
            .prepare("SELECT id, run_id, profile_id, name, item_type, rarity, found_at, notes FROM items WHERE run_id = ?1 ORDER BY found_at ASC")
            .map_err(|e| e.to_string())?;
        let items = stmt
            .query_map(rusqlite::params![run.id], |row| {
                Ok(Item {
                    id: row.get(0)?,
                    run_id: row.get(1)?,
                    profile_id: row.get(2)?,
                    name: row.get(3)?,
                    item_type: row.get(4)?,
                    rarity: row.get(5)?,
                    found_at: row.get(6)?,
                    notes: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        detailed_runs.push(DetailedRun {
            run,
            items,
        });
    }

    Ok(detailed_runs)
}

// ===== EXPORT / IMPORT =====

#[tauri::command]
pub fn export_data(state: State<DbState>) -> Result<ExportData, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Profiles
    let mut stmt = conn
        .prepare("SELECT id, name, class, mode, magic_find, created_at, updated_at FROM profiles ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let profiles = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                class: row.get(2)?,
                mode: row.get(3)?,
                magic_find: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Runs
    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count, route_id, route_step_index, tags FROM runs ORDER BY started_at ASC")
        .map_err(|e| e.to_string())?;
    let runs = stmt
        .query_map([], |row| {
            Ok(Run {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                area: row.get(2)?,
                duration_secs: row.get(3)?,
                started_at: row.get(4)?,
                finished_at: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                player_count: row.get(8)?,
                route_id: row.get(9)?,
                route_step_index: row.get(10)?,
                tags: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Items
    let mut stmt = conn
        .prepare("SELECT id, run_id, profile_id, name, item_type, rarity, found_at, notes FROM items ORDER BY found_at ASC")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([], |row| {
            Ok(Item {
                id: row.get(0)?,
                run_id: row.get(1)?,
                profile_id: row.get(2)?,
                name: row.get(3)?,
                item_type: row.get(4)?,
                rarity: row.get(5)?,
                found_at: row.get(6)?,
                notes: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ExportData {
        version: "1.0".to_string(),
        exported_at: Utc::now().to_rfc3339(),
        profiles,
        runs,
        items,
    })
}

#[tauri::command]
pub fn import_data(state: State<DbState>, data: ExportData) -> Result<ImportResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Validate input data
    for profile in &data.profiles {
        if profile.id.is_empty() || profile.name.is_empty() || profile.class.is_empty() {
            return Err("Invalid profile data: id, name, and class are required".to_string());
        }
        if profile.name.len() > 100 || profile.class.len() > 50 {
            return Err("Invalid profile data: field length exceeds maximum".to_string());
        }
    }
    for run in &data.runs {
        if run.id.is_empty() || run.profile_id.is_empty() || run.area.is_empty() {
            return Err("Invalid run data: id, profile_id, and area are required".to_string());
        }
    }
    for item in &data.items {
        if item.id.is_empty() || item.run_id.is_empty() || item.profile_id.is_empty() || item.name.is_empty() {
            return Err("Invalid item data: id, run_id, profile_id, and name are required".to_string());
        }
        if item.name.len() > 200 {
            return Err("Invalid item data: name length exceeds maximum".to_string());
        }
    }

    let mut profiles_imported = 0i64;
    let mut runs_imported = 0i64;
    let mut items_imported = 0i64;
    let mut skipped = 0i64;

    // Import profiles
    for profile in &data.profiles {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM profiles WHERE id = ?1",
                rusqlite::params![profile.id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if exists {
            skipped += 1;
            continue;
        }

        conn.execute(
            "INSERT INTO profiles (id, name, class, mode, magic_find, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![profile.id, profile.name, profile.class, profile.mode, profile.magic_find, profile.created_at, profile.updated_at],
        ).map_err(|e| e.to_string())?;
        profiles_imported += 1;
    }

    // Import runs
    for run in &data.runs {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM runs WHERE id = ?1",
                rusqlite::params![run.id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if exists {
            skipped += 1;
            continue;
        }

        conn.execute(
            "INSERT INTO runs (id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![run.id, run.profile_id, run.area, run.duration_secs, run.started_at, run.finished_at, run.status, run.notes, run.player_count],
        ).map_err(|e| e.to_string())?;
        runs_imported += 1;
    }

    // Import items
    for item in &data.items {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM items WHERE id = ?1",
                rusqlite::params![item.id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if exists {
            skipped += 1;
            continue;
        }

        conn.execute(
            "INSERT INTO items (id, run_id, profile_id, name, item_type, rarity, found_at, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![item.id, item.run_id, item.profile_id, item.name, item.item_type, item.rarity, item.found_at, item.notes],
        ).map_err(|e| e.to_string())?;
        items_imported += 1;
    }

    Ok(ImportResult {
        profiles_imported,
        runs_imported,
        items_imported,
        skipped,
    })
}

// ===== ROUTES =====

#[tauri::command]
pub fn create_route(state: State<DbState>, input: CreateRouteInput) -> Result<Route, String> {
    if input.name.trim().is_empty() {
        return Err("Route name cannot be empty".to_string());
    }
    if input.name.len() > 100 {
        return Err("Route name is too long (max 100 characters)".to_string());
    }
    if input.areas.len() < 2 {
        return Err("Route must contain at least 2 areas".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    let areas_json = serde_json::to_string(&input.areas).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO routes (id, profile_id, name, areas, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, input.profile_id, input.name, areas_json, now],
    ).map_err(|e| e.to_string())?;

    Ok(Route {
        id,
        profile_id: input.profile_id,
        name: input.name,
        areas: input.areas,
        created_at: now,
    })
}

#[tauri::command]
pub fn get_routes(state: State<DbState>, profile_id: String) -> Result<Vec<Route>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, name, areas, created_at FROM routes WHERE profile_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let routes = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            let areas_json: String = row.get(3)?;
            let areas: Vec<String> = serde_json::from_str(&areas_json)
                .unwrap_or_default();
            Ok(Route {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                areas,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(routes)
}

#[tauri::command]
pub fn update_route(state: State<DbState>, id: String, input: UpdateRouteInput) -> Result<Route, String> {
    if input.name.trim().is_empty() {
        return Err("Route name cannot be empty".to_string());
    }
    if input.name.len() > 100 {
        return Err("Route name is too long (max 100 characters)".to_string());
    }
    if input.areas.len() < 2 {
        return Err("Route must contain at least 2 areas".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Verify route exists
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM routes WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !exists {
        return Err("Route not found".to_string());
    }

    let areas_json = serde_json::to_string(&input.areas).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE routes SET name = ?1, areas = ?2 WHERE id = ?3",
        rusqlite::params![input.name, areas_json, id],
    ).map_err(|e| e.to_string())?;

    // Fetch updated route
    let mut stmt = conn
        .prepare("SELECT id, profile_id, name, areas, created_at FROM routes WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let route = stmt
        .query_row(rusqlite::params![id], |row| {
            let areas_json: String = row.get(3)?;
            let areas: Vec<String> = serde_json::from_str(&areas_json)
                .unwrap_or_default();
            Ok(Route {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                areas,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(route)
}

#[tauri::command]
pub fn delete_route(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM routes WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !exists {
        return Err("Route not found".to_string());
    }

    conn.execute("DELETE FROM routes WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_route_stats(state: State<DbState>, route_id: String) -> Result<RouteStats, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Get route name and area count
    let (route_name, route_area_count): (String, usize) = {
        let mut stmt = conn
            .prepare("SELECT name, areas FROM routes WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row(rusqlite::params![route_id], |row| {
            let name: String = row.get(0)?;
            let areas_json: String = row.get(1)?;
            let areas: Vec<String> = serde_json::from_str(&areas_json).unwrap_or_default();
            Ok((name, areas.len()))
        }).map_err(|e| e.to_string())?
    };

    // Get all completed runs for this route, ordered by started_at
    let mut stmt = conn
        .prepare("SELECT route_step_index, duration_secs FROM runs WHERE route_id = ?1 AND status = 'completed' ORDER BY started_at ASC")
        .map_err(|e| e.to_string())?;

    let runs: Vec<(i64, i64)> = stmt
        .query_map(rusqlite::params![route_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Group into cycles: a cycle is a sequence of runs with step indices 0..N-1
    let mut total_cycles: i64 = 0;
    let mut total_cycle_time: i64 = 0;
    let mut total_items: i64 = 0;

    // Collect runs into groups by detecting when step wraps back to 0
    let mut current_cycle: Vec<(i64, i64)> = Vec::new();

    for (step_index, duration) in &runs {
        // If we see step 0 and we already have items in current_cycle, check if previous cycle is complete
        if *step_index == 0 && !current_cycle.is_empty() {
            // Check if the previous cycle is complete (has all steps 0..N-1)
            if is_complete_cycle(&current_cycle, route_area_count) {
                total_cycles += 1;
                total_cycle_time += current_cycle.iter().map(|(_, d)| d).sum::<i64>();
            }
            current_cycle.clear();
        }
        current_cycle.push((*step_index, *duration));
    }

    // Check final cycle
    if is_complete_cycle(&current_cycle, route_area_count) {
        total_cycles += 1;
        total_cycle_time += current_cycle.iter().map(|(_, d)| d).sum::<i64>();
    }

    // Count items in complete cycles
    // Re-iterate to count items for complete cycles
    let mut current_cycle_runs: Vec<(i64, i64)> = Vec::new();
    let mut cycle_start_indices: Vec<usize> = Vec::new();
    let mut cycle_lengths: Vec<usize> = Vec::new();
    let mut idx = 0;

    // Reprocess to get cycle boundaries
    for (step_index, duration) in &runs {
        if *step_index == 0 && !current_cycle_runs.is_empty() {
            if is_complete_cycle(&current_cycle_runs, route_area_count) {
                cycle_start_indices.push(idx - current_cycle_runs.len());
                cycle_lengths.push(current_cycle_runs.len());
            }
            current_cycle_runs.clear();
        }
        current_cycle_runs.push((*step_index, *duration));
        idx += 1;
    }
    if is_complete_cycle(&current_cycle_runs, route_area_count) {
        cycle_start_indices.push(idx - current_cycle_runs.len());
        cycle_lengths.push(current_cycle_runs.len());
    }

    // Now count items: get run IDs for complete cycles
    // We need to query items, so let's get all run IDs for this route and count
    let mut stmt = conn
        .prepare("SELECT id, route_step_index FROM runs WHERE route_id = ?1 AND status = 'completed' ORDER BY started_at ASC")
        .map_err(|e| e.to_string())?;

    let run_ids: Vec<(String, i64)> = stmt
        .query_map(rusqlite::params![route_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Count items for runs in complete cycles
    for i in 0..cycle_start_indices.len() {
        let start = cycle_start_indices[i];
        let len = cycle_lengths[i];
        for j in start..(start + len) {
            if j < run_ids.len() {
                let item_count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM items WHERE run_id = ?1",
                        rusqlite::params![run_ids[j].0],
                        |row| row.get(0),
                    )
                    .map_err(|e| e.to_string())?;
                total_items += item_count;
            }
        }
    }

    let avg_cycle_time_secs = if total_cycles > 0 {
        total_cycle_time as f64 / total_cycles as f64
    } else {
        0.0
    };

    let items_per_cycle = if total_cycles > 0 {
        total_items as f64 / total_cycles as f64
    } else {
        0.0
    };

    Ok(RouteStats {
        route_id,
        route_name,
        total_cycles,
        avg_cycle_time_secs,
        total_items,
        items_per_cycle,
    })
}

fn is_complete_cycle(cycle: &[(i64, i64)], area_count: usize) -> bool {
    if cycle.len() != area_count {
        return false;
    }
    // Check that steps are 0, 1, 2, ..., N-1 in order
    for (i, (step, _)) in cycle.iter().enumerate() {
        if *step != i as i64 {
            return false;
        }
    }
    true
}

// ===== OVERLAY =====

#[tauri::command]
pub fn overlay_action(app_handle: tauri::AppHandle, action: String) -> Result<(), String> {
    // Emit event to main window so it can handle the action
    app_handle.emit("overlay-action", action).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn overlay_add_item(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
    app_handle.emit("overlay-add-item", name).map_err(|e| e.to_string())?;
    Ok(())
}

// ===== CUSTOM AREAS =====

#[tauri::command]
pub fn get_custom_areas(state: State<DbState>, profile_id: String) -> Result<Vec<CustomArea>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, name, created_at FROM custom_areas WHERE profile_id = ?1 ORDER BY name ASC")
        .map_err(|e| e.to_string())?;

    let areas = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(CustomArea {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(areas)
}

#[tauri::command]
pub fn add_custom_area(state: State<DbState>, profile_id: String, name: String) -> Result<CustomArea, String> {
    if name.trim().is_empty() {
        return Err("Area name cannot be empty".to_string());
    }
    if name.len() > 100 {
        return Err("Area name is too long".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO custom_areas (id, profile_id, name, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, profile_id, name, now],
    ).map_err(|e| e.to_string())?;

    Ok(CustomArea { id, profile_id, name, created_at: now })
}

#[tauri::command]
pub fn delete_custom_area(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM custom_areas WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== OBS INTEGRATION =====

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsStatsInput {
    pub run_count: i64,
    pub session_time: String,
    pub current_area: String,
    pub last_items: Vec<String>,
    pub format: String,
}

fn format_plain_text(input: &ObsStatsInput) -> String {
    let items_str = input.last_items.join(", ");
    format!(
        "Run Count: {}\nSession Time: {}\nCurrent Area: {}\nLast Items: {}\n",
        input.run_count, input.session_time, input.current_area, items_str
    )
}

fn format_json(input: &ObsStatsInput) -> String {
    let items_json: Vec<String> = input
        .last_items
        .iter()
        .map(|item| format!("\"{}\"", item.replace('\\', "\\\\").replace('"', "\\\"")))
        .collect();
    format!(
        "{{\"runCount\":{},\"sessionTime\":\"{}\",\"currentArea\":\"{}\",\"lastItems\":[{}]}}",
        input.run_count,
        input.session_time.replace('\\', "\\\\").replace('"', "\\\""),
        input.current_area.replace('\\', "\\\\").replace('"', "\\\""),
        items_json.join(",")
    )
}

#[tauri::command]
pub fn write_obs_stats(app_handle: tauri::AppHandle, input: ObsStatsInput) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

    let file_path = app_data_dir.join("obs_stats.txt");
    let tmp_path = app_data_dir.join("obs_stats.txt.tmp");

    let content = match input.format.as_str() {
        "json" => format_json(&input),
        _ => format_plain_text(&input),
    };

    std::fs::write(&tmp_path, &content).map_err(|e| e.to_string())?;

    if std::fs::rename(&tmp_path, &file_path).is_err() {
        // Fallback: direct write if rename fails (e.g. Windows file locking)
        std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;
        // Clean up tmp file if it still exists
        let _ = std::fs::remove_file(&tmp_path);
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_obs_file_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let file_path = app_data_dir.join("obs_stats.txt");
    Ok(file_path.to_string_lossy().to_string())
}

// ===== COMPARISON MODE =====

/// Pure computation function for subject metrics.
/// Each tuple in run_data is (duration_secs, item_count, unique_item_count).
pub fn compute_subject_metrics(label: &str, run_data: &[(i64, i64, i64)]) -> SubjectMetrics {
    let total_runs = run_data.len() as i64;
    let total_items: i64 = run_data.iter().map(|(_, items, _)| items).sum();
    let total_unique_items: i64 = run_data.iter().map(|(_, _, unique)| unique).sum();
    let total_duration_secs: i64 = run_data.iter().map(|(d, _, _)| d).sum();

    let nonzero_durations: Vec<i64> = run_data.iter().map(|(d, _, _)| *d).filter(|d| *d > 0).collect();
    let nonzero_duration: i64 = nonzero_durations.iter().sum();
    let count_nonzero = nonzero_durations.len() as i64;

    let items_per_hour = if nonzero_duration > 0 {
        (total_items as f64 / nonzero_duration as f64) * 3600.0
    } else {
        0.0
    };

    let unique_items_per_hour = if nonzero_duration > 0 {
        (total_unique_items as f64 / nonzero_duration as f64) * 3600.0
    } else {
        0.0
    };

    let avg_time_per_run = if count_nonzero > 0 {
        nonzero_duration as f64 / count_nonzero as f64
    } else {
        0.0
    };

    let items_per_run = if total_runs > 0 {
        total_items as f64 / total_runs as f64
    } else {
        0.0
    };

    let fastest_run_secs = nonzero_durations.iter().copied().min();
    let slowest_run_secs = nonzero_durations.iter().copied().max();

    SubjectMetrics {
        label: label.to_string(),
        total_runs,
        total_items,
        total_unique_items,
        total_duration_secs,
        items_per_hour,
        unique_items_per_hour,
        items_per_run,
        avg_time_per_run,
        fastest_run_secs,
        slowest_run_secs,
    }
}

fn query_run_data(conn: &rusqlite::Connection, profile_id: &str, area: Option<&str>, date_start: Option<&str>, date_end: Option<&str>) -> Result<Vec<(i64, i64, i64)>, String> {
    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(area_val) = area {
        (
            "SELECT r.duration_secs, COUNT(i.id) as item_count, SUM(CASE WHEN i.rarity IN ('Unique', 'Set', 'Runeword') THEN 1 ELSE 0 END) as unique_count FROM runs r LEFT JOIN items i ON i.run_id = r.id WHERE r.profile_id = ?1 AND r.status = 'completed' AND r.area = ?2 GROUP BY r.id".to_string(),
            vec![Box::new(profile_id.to_string()) as Box<dyn rusqlite::types::ToSql>, Box::new(area_val.to_string())],
        )
    } else if let (Some(start), Some(end)) = (date_start, date_end) {
        (
            "SELECT r.duration_secs, COUNT(i.id) as item_count, SUM(CASE WHEN i.rarity IN ('Unique', 'Set', 'Runeword') THEN 1 ELSE 0 END) as unique_count FROM runs r LEFT JOIN items i ON i.run_id = r.id WHERE r.profile_id = ?1 AND r.status = 'completed' AND r.started_at >= ?2 AND r.started_at < ?3 GROUP BY r.id".to_string(),
            vec![
                Box::new(profile_id.to_string()) as Box<dyn rusqlite::types::ToSql>,
                Box::new(start.to_string()),
                Box::new(format!("{}T23:59:59", end)),
            ],
        )
    } else {
        return Err("Invalid query parameters".to_string());
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(params_refs.as_slice(), |row| {
            let duration: i64 = row.get(0)?;
            let item_count: i64 = row.get(1)?;
            let unique_count: i64 = row.get::<_, Option<i64>>(2)?.unwrap_or(0);
            Ok((duration, item_count, unique_count))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn get_comparison(state: State<DbState>, request: ComparisonRequest) -> Result<ComparisonResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let (subject_a, subject_b) = match &request {
        ComparisonRequest::Area { profile_id, area_a, area_b } => {
            let data_a = query_run_data(&conn, profile_id, Some(area_a), None, None)?;
            let data_b = query_run_data(&conn, profile_id, Some(area_b), None, None)?;
            (
                compute_subject_metrics(area_a, &data_a),
                compute_subject_metrics(area_b, &data_b),
            )
        }
        ComparisonRequest::DateRange { profile_id, start_a, end_a, start_b, end_b } => {
            let label_a = format!("{} — {}", start_a, end_a);
            let label_b = format!("{} — {}", start_b, end_b);
            let data_a = query_run_data(&conn, profile_id, None, Some(start_a), Some(end_a))?;
            let data_b = query_run_data(&conn, profile_id, None, Some(start_b), Some(end_b))?;
            (
                compute_subject_metrics(&label_a, &data_a),
                compute_subject_metrics(&label_b, &data_b),
            )
        }
    };

    Ok(ComparisonResult { subject_a, subject_b })
}

// ===== HERALD TRACKING =====

#[tauri::command]
pub fn create_herald_encounter(state: State<DbState>, input: CreateHeraldEncounterInput) -> Result<HeraldEncounter, String> {
    // Input validation
    if input.tier < 1 || input.tier > 5 {
        return Err("Herald tier must be between 1 and 5".to_string());
    }
    if input.result != "success" && input.result != "fail" {
        return Err("Result must be 'success' or 'fail'".to_string());
    }
    if input.area.trim().is_empty() {
        return Err("Area cannot be empty".to_string());
    }
    if input.area.len() > 200 {
        return Err("Area name is too long (max 200 characters)".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO herald_encounters (id, profile_id, tier, area, result, sunder_charm, notes, encountered_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, input.profile_id, input.tier, input.area, input.result, input.sunder_charm, input.notes, now],
    ).map_err(|e| e.to_string())?;

    Ok(HeraldEncounter {
        id,
        profile_id: input.profile_id,
        tier: input.tier,
        area: input.area,
        result: input.result,
        sunder_charm: input.sunder_charm,
        notes: input.notes,
        encountered_at: now,
    })
}

#[tauri::command]
pub fn get_herald_encounters(state: State<DbState>, profile_id: String) -> Result<Vec<HeraldEncounter>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, tier, area, result, sunder_charm, notes, encountered_at FROM herald_encounters WHERE profile_id = ?1 ORDER BY encountered_at DESC")
        .map_err(|e| e.to_string())?;

    let encounters = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(HeraldEncounter {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                tier: row.get(2)?,
                area: row.get(3)?,
                result: row.get(4)?,
                sunder_charm: row.get(5)?,
                notes: row.get(6)?,
                encountered_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(encounters)
}

#[tauri::command]
pub fn get_herald_stats(state: State<DbState>, profile_id: String) -> Result<HeraldStats, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let total_encounters: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM herald_encounters WHERE profile_id = ?1",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let success_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM herald_encounters WHERE profile_id = ?1 AND result = 'success'",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let fail_count = total_encounters - success_count;

    // Encounters by tier
    let mut stmt = conn
        .prepare("SELECT tier, COUNT(*) as total, SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) as successes FROM herald_encounters WHERE profile_id = ?1 GROUP BY tier ORDER BY tier")
        .map_err(|e| e.to_string())?;

    let encounters_by_tier = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(TierCount {
                tier: row.get(0)?,
                count: row.get(1)?,
                successes: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Sunder charms found (distinct values)
    let mut stmt = conn
        .prepare("SELECT DISTINCT sunder_charm FROM herald_encounters WHERE profile_id = ?1 AND sunder_charm IS NOT NULL AND sunder_charm != '' ORDER BY sunder_charm")
        .map_err(|e| e.to_string())?;

    let sunder_charms_found = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(HeraldStats {
        total_encounters,
        success_count,
        fail_count,
        encounters_by_tier,
        sunder_charms_found,
    })
}

#[tauri::command]
pub fn delete_herald_encounter(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM herald_encounters WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== COLOSSAL ANCIENTS =====

const COLOSSAL_BOSSES: [&str; 5] = ["Baal", "Diablo", "Mephisto", "Duriel", "Andariel"];

#[tauri::command]
pub fn create_ancient_attempt(state: State<DbState>, input: CreateColossalAttemptInput) -> Result<ColossalAncientAttempt, String> {
    // Input validation
    if !COLOSSAL_BOSSES.contains(&input.boss_name.as_str()) {
        return Err(format!("Invalid boss name. Must be one of: {}", COLOSSAL_BOSSES.join(", ")));
    }
    if input.result != "success" && input.result != "fail" {
        return Err("Result must be 'success' or 'fail'".to_string());
    }
    if input.duration_secs < 0 {
        return Err("Duration cannot be negative".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    // Calculate attempt number for this boss
    let attempt_number: i64 = conn
        .query_row(
            "SELECT COUNT(*) + 1 FROM colossal_ancients WHERE profile_id = ?1 AND boss_name = ?2",
            rusqlite::params![input.profile_id, input.boss_name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO colossal_ancients (id, profile_id, boss_name, attempt_number, result, drops, duration_secs, notes, attempted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![id, input.profile_id, input.boss_name, attempt_number, input.result, input.drops, input.duration_secs, input.notes, now],
    ).map_err(|e| e.to_string())?;

    Ok(ColossalAncientAttempt {
        id,
        profile_id: input.profile_id,
        boss_name: input.boss_name,
        attempt_number,
        result: input.result,
        drops: input.drops,
        duration_secs: input.duration_secs,
        notes: input.notes,
        attempted_at: now,
    })
}

#[tauri::command]
pub fn get_ancient_attempts(state: State<DbState>, profile_id: String) -> Result<Vec<ColossalAncientAttempt>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, boss_name, attempt_number, result, drops, duration_secs, notes, attempted_at FROM colossal_ancients WHERE profile_id = ?1 ORDER BY attempted_at DESC")
        .map_err(|e| e.to_string())?;

    let attempts = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(ColossalAncientAttempt {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                boss_name: row.get(2)?,
                attempt_number: row.get(3)?,
                result: row.get(4)?,
                drops: row.get(5)?,
                duration_secs: row.get(6)?,
                notes: row.get(7)?,
                attempted_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(attempts)
}

#[tauri::command]
pub fn get_ancient_stats(state: State<DbState>, profile_id: String) -> Result<ColossalAncientStats, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let total_attempts: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM colossal_ancients WHERE profile_id = ?1",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_successes: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM colossal_ancients WHERE profile_id = ?1 AND result = 'success'",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Bosses defeated (at least one success)
    let mut stmt = conn
        .prepare("SELECT DISTINCT boss_name FROM colossal_ancients WHERE profile_id = ?1 AND result = 'success'")
        .map_err(|e| e.to_string())?;
    let bosses_defeated = stmt
        .query_map(rusqlite::params![profile_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Stats by boss
    let mut stats_by_boss = Vec::new();
    for boss in COLOSSAL_BOSSES.iter() {
        let attempts: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM colossal_ancients WHERE profile_id = ?1 AND boss_name = ?2",
                rusqlite::params![profile_id, boss],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let successes: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM colossal_ancients WHERE profile_id = ?1 AND boss_name = ?2 AND result = 'success'",
                rusqlite::params![profile_id, boss],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let best_time_secs: Option<i64> = conn
            .query_row(
                "SELECT MIN(duration_secs) FROM colossal_ancients WHERE profile_id = ?1 AND boss_name = ?2 AND result = 'success' AND duration_secs > 0",
                rusqlite::params![profile_id, boss],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let avg_time_secs: f64 = conn
            .query_row(
                "SELECT COALESCE(AVG(duration_secs), 0) FROM colossal_ancients WHERE profile_id = ?1 AND boss_name = ?2 AND duration_secs > 0",
                rusqlite::params![profile_id, boss],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        stats_by_boss.push(BossStats {
            boss_name: boss.to_string(),
            attempts,
            successes,
            best_time_secs,
            avg_time_secs,
        });
    }

    Ok(ColossalAncientStats {
        total_attempts,
        total_successes,
        bosses_defeated,
        stats_by_boss,
    })
}

#[tauri::command]
pub fn delete_ancient_attempt(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM colossal_ancients WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== DIABLO CLONE TRACKER =====

#[tauri::command]
pub fn get_dclone_progress(state: State<DbState>) -> Result<Vec<DCloneProgress>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT region, progress, last_updated FROM dclone_progress ORDER BY region")
        .map_err(|e| e.to_string())?;

    let progress = stmt
        .query_map([], |row| {
            Ok(DCloneProgress {
                region: row.get(0)?,
                progress: row.get(1)?,
                last_updated: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(progress)
}

#[tauri::command]
pub fn update_dclone_progress(state: State<DbState>, region: String, progress: i64) -> Result<DCloneProgress, String> {
    // Input validation
    let valid_regions = ["Americas", "Europe", "Asia"];
    if !valid_regions.contains(&region.as_str()) {
        return Err(format!("Invalid region. Must be one of: {}", valid_regions.join(", ")));
    }
    if progress < 1 || progress > 6 {
        return Err("Progress must be between 1 and 6".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO dclone_progress (region, progress, last_updated) VALUES (?1, ?2, ?3) ON CONFLICT(region) DO UPDATE SET progress = ?2, last_updated = ?3",
        rusqlite::params![region, progress, now],
    ).map_err(|e| e.to_string())?;

    Ok(DCloneProgress {
        region,
        progress,
        last_updated: now,
    })
}

#[tauri::command]
pub fn create_anni_log(state: State<DbState>, input: CreateAnniLogInput) -> Result<AnniLog, String> {
    // Input validation
    if input.stats.trim().is_empty() {
        return Err("Stats cannot be empty".to_string());
    }
    if input.stats.len() > 500 {
        return Err("Stats text is too long (max 500 characters)".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO anni_log (id, profile_id, stats, notes, obtained_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, input.profile_id, input.stats, input.notes, now],
    ).map_err(|e| e.to_string())?;

    Ok(AnniLog {
        id,
        profile_id: input.profile_id,
        stats: input.stats,
        notes: input.notes,
        obtained_at: now,
    })
}

#[tauri::command]
pub fn get_anni_logs(state: State<DbState>, profile_id: String) -> Result<Vec<AnniLog>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, stats, notes, obtained_at FROM anni_log WHERE profile_id = ?1 ORDER BY obtained_at DESC")
        .map_err(|e| e.to_string())?;

    let logs = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(AnniLog {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                stats: row.get(2)?,
                notes: row.get(3)?,
                obtained_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(logs)
}

#[tauri::command]
pub fn delete_anni_log(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM anni_log WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== XP TRACKING =====

#[tauri::command]
pub fn create_xp_entry(state: State<DbState>, input: CreateXpEntryInput) -> Result<XpEntry, String> {
    // Input validation
    if input.level < 1 || input.level > 99 {
        return Err("Level must be between 1 and 99".to_string());
    }
    if input.xp_gained < 0 {
        return Err("XP gained cannot be negative".to_string());
    }
    if input.duration_secs < 0 {
        return Err("Duration cannot be negative".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO xp_entries (id, profile_id, run_id, level, xp_gained, duration_secs, area, notes, recorded_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![id, input.profile_id, input.run_id, input.level, input.xp_gained, input.duration_secs, input.area, input.notes, now],
    ).map_err(|e| e.to_string())?;

    Ok(XpEntry {
        id,
        profile_id: input.profile_id,
        run_id: input.run_id,
        level: input.level,
        xp_gained: input.xp_gained,
        duration_secs: input.duration_secs,
        area: input.area,
        notes: input.notes,
        recorded_at: now,
    })
}

#[tauri::command]
pub fn get_xp_entries(state: State<DbState>, profile_id: String) -> Result<Vec<XpEntry>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, run_id, level, xp_gained, duration_secs, area, notes, recorded_at FROM xp_entries WHERE profile_id = ?1 ORDER BY recorded_at DESC")
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(XpEntry {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                run_id: row.get(2)?,
                level: row.get(3)?,
                xp_gained: row.get(4)?,
                duration_secs: row.get(5)?,
                area: row.get(6)?,
                notes: row.get(7)?,
                recorded_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
pub fn get_xp_stats(state: State<DbState>, profile_id: String) -> Result<XpStats, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let total_xp: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(xp_gained), 0) FROM xp_entries WHERE profile_id = ?1",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_time_secs: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_secs), 0) FROM xp_entries WHERE profile_id = ?1",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let entries_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM xp_entries WHERE profile_id = ?1",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let xp_per_hour = if total_time_secs > 0 {
        (total_xp as f64 / total_time_secs as f64) * 3600.0
    } else {
        0.0
    };

    let avg_xp_per_session = if entries_count > 0 {
        total_xp as f64 / entries_count as f64
    } else {
        0.0
    };

    Ok(XpStats {
        total_xp,
        total_time_secs,
        xp_per_hour,
        entries_count,
        avg_xp_per_session,
    })
}

#[tauri::command]
pub fn delete_xp_entry(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM xp_entries WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== KEYBIND PROFILES =====

#[tauri::command]
pub fn create_keybind_profile(state: State<DbState>, input: CreateKeybindProfileInput) -> Result<KeybindProfile, String> {
    if input.name.trim().is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    if input.name.len() > 100 {
        return Err("Profile name is too long (max 100 characters)".to_string());
    }
    // Validate bindings is valid JSON
    let _: serde_json::Value = serde_json::from_str(&input.bindings)
        .map_err(|_| "Bindings must be valid JSON".to_string())?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO keybind_profiles (id, name, bindings, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, input.name, input.bindings, now],
    ).map_err(|e| e.to_string())?;

    Ok(KeybindProfile {
        id,
        name: input.name,
        bindings: input.bindings,
        created_at: now,
    })
}

#[tauri::command]
pub fn get_keybind_profiles(state: State<DbState>) -> Result<Vec<KeybindProfile>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, bindings, created_at FROM keybind_profiles ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let profiles = stmt
        .query_map([], |row| {
            Ok(KeybindProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                bindings: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(profiles)
}

#[tauri::command]
pub fn update_keybind_profile(state: State<DbState>, id: String, input: UpdateKeybindProfileInput) -> Result<KeybindProfile, String> {
    if input.name.trim().is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    if input.name.len() > 100 {
        return Err("Profile name is too long (max 100 characters)".to_string());
    }
    let _: serde_json::Value = serde_json::from_str(&input.bindings)
        .map_err(|_| "Bindings must be valid JSON".to_string())?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM keybind_profiles WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !exists {
        return Err("Keybind profile not found".to_string());
    }

    conn.execute(
        "UPDATE keybind_profiles SET name = ?1, bindings = ?2 WHERE id = ?3",
        rusqlite::params![input.name, input.bindings, id],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, bindings, created_at FROM keybind_profiles WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let profile = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(KeybindProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                bindings: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(profile)
}

#[tauri::command]
pub fn delete_keybind_profile(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM keybind_profiles WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ===== BACKUP SCHEDULER =====

#[tauri::command]
pub fn run_auto_backup(state: State<DbState>, folder_path: String) -> Result<String, String> {
    // Validate folder exists
    let path = std::path::Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Backup folder does not exist or is not a directory".to_string());
    }

    // Use the existing export_data logic
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Profiles
    let mut stmt = conn
        .prepare("SELECT id, name, class, mode, magic_find, created_at, updated_at FROM profiles ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let profiles = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                class: row.get(2)?,
                mode: row.get(3)?,
                magic_find: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Runs
    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count, route_id, route_step_index, tags FROM runs ORDER BY started_at ASC")
        .map_err(|e| e.to_string())?;
    let runs = stmt
        .query_map([], |row| {
            Ok(Run {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                area: row.get(2)?,
                duration_secs: row.get(3)?,
                started_at: row.get(4)?,
                finished_at: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                player_count: row.get(8)?,
                route_id: row.get(9)?,
                route_step_index: row.get(10)?,
                tags: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Items
    let mut stmt = conn
        .prepare("SELECT id, run_id, profile_id, name, item_type, rarity, found_at, notes FROM items ORDER BY found_at ASC")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([], |row| {
            Ok(Item {
                id: row.get(0)?,
                run_id: row.get(1)?,
                profile_id: row.get(2)?,
                name: row.get(3)?,
                item_type: row.get(4)?,
                rarity: row.get(5)?,
                found_at: row.get(6)?,
                notes: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let export = ExportData {
        version: "1.0".to_string(),
        exported_at: Utc::now().to_rfc3339(),
        profiles,
        runs,
        items,
    };

    let json = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("d2r_backup_{}.json", timestamp);
    let file_path = path.join(&filename);

    std::fs::write(&file_path, json).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn cleanup_old_backups(folder_path: String, keep_count: i64) -> Result<(), String> {
    let path = std::path::Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Backup folder does not exist or is not a directory".to_string());
    }

    if keep_count < 1 {
        return Err("Keep count must be at least 1".to_string());
    }

    // List all matching backup files
    let mut backup_files: Vec<std::path::PathBuf> = std::fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|p| {
            if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                name.starts_with("d2r_backup_") && name.ends_with(".json")
            } else {
                false
            }
        })
        .collect();

    // Sort by filename (which includes timestamp, so alphabetical = chronological)
    backup_files.sort();

    // Delete oldest files if over keep_count
    let count = backup_files.len() as i64;
    if count > keep_count {
        let to_delete = (count - keep_count) as usize;
        for file in backup_files.iter().take(to_delete) {
            let _ = std::fs::remove_file(file);
        }
    }

    Ok(())
}
