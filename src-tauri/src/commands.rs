use crate::db::DbState;
use crate::models::*;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

// ===== PROFILES =====

#[tauri::command]
pub fn create_profile(state: State<DbState>, input: CreateProfileInput) -> Result<Profile, String> {
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
        "INSERT INTO runs (id, profile_id, area, duration_secs, started_at, status, notes) VALUES (?1, ?2, ?3, 0, ?4, 'in_progress', ?5)",
        rusqlite::params![id, input.profile_id, input.area, now, input.notes],
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
    })
}

#[tauri::command]
pub fn get_runs(state: State<DbState>, profile_id: String) -> Result<Vec<Run>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes FROM runs WHERE profile_id = ?1 ORDER BY started_at DESC")
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
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes FROM runs WHERE id = ?1")
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
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(run)
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
