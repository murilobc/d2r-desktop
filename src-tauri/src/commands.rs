use crate::db::DbState;
use crate::models::*;
use chrono::Utc;
use tauri::{Emitter, State};
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
        "INSERT INTO profiles (id, name, class, mode, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, input.name, input.class, input.mode, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(Profile {
        id,
        name: input.name,
        class: input.class,
        mode: input.mode,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn get_profiles(state: State<DbState>) -> Result<Vec<Profile>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, class, mode, created_at, updated_at FROM profiles ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let profiles = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                class: row.get(2)?,
                mode: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
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
        .prepare("SELECT id, name, class, mode, created_at, updated_at FROM profiles WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let mut profile: Profile = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                class: row.get(2)?,
                mode: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
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
    profile.updated_at = now;

    conn.execute(
        "UPDATE profiles SET name = ?1, class = ?2, mode = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![profile.name, profile.class, profile.mode, profile.updated_at, profile.id],
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

    conn.execute(
        "INSERT INTO runs (id, profile_id, area, duration_secs, started_at, status, notes, player_count) VALUES (?1, ?2, ?3, 0, ?4, 'in_progress', ?5, ?6)",
        rusqlite::params![id, input.profile_id, input.area, now, input.notes, input.player_count],
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
    })
}

#[tauri::command]
pub fn get_runs(state: State<DbState>, profile_id: String) -> Result<Vec<Run>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count FROM runs WHERE profile_id = ?1 ORDER BY started_at DESC")
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
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(runs)
}

#[tauri::command]
pub fn finish_run(state: State<DbState>, id: String, input: FinishRunInput) -> Result<Run, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE runs SET duration_secs = ?1, finished_at = ?2, status = 'completed', notes = ?3 WHERE id = ?4",
        rusqlite::params![input.duration_secs, now, input.notes, id],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count FROM runs WHERE id = ?1")
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
            .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count FROM runs WHERE profile_id = ?1 AND status = 'completed' AND area = ?2 ORDER BY started_at DESC")
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
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        result
    } else {
        let mut stmt = conn
            .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count FROM runs WHERE profile_id = ?1 AND status = 'completed' ORDER BY started_at DESC")
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
        .prepare("SELECT id, name, class, mode, created_at, updated_at FROM profiles ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let profiles = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                class: row.get(2)?,
                mode: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Runs
    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count FROM runs ORDER BY started_at ASC")
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
            "INSERT INTO profiles (id, name, class, mode, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![profile.id, profile.name, profile.class, profile.mode, profile.created_at, profile.updated_at],
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
