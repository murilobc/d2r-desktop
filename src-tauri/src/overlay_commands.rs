use crate::db::DbState;
use crate::models::*;
use chrono::Utc;
use rusqlite::Connection;
use serde_json;
use tauri::State;
use uuid::Uuid;

/// Initialize default overlay profiles if none exist.
/// Called directly with a &Connection during app setup (similar to init_achievements).
pub fn init_default_profiles(conn: &Connection) -> rusqlite::Result<()> {
    // Only create defaults if no profiles exist
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM overlay_profiles", [], |row| {
        row.get(0)
    })?;

    if count > 0 {
        return Ok(());
    }

    let now = Utc::now().to_rfc3339();

    // Compact profile (active by default, 300x120)
    let compact_id = Uuid::new_v4().to_string();
    let compact_layout = OverlayProfileLayout {
        widgets: vec![
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "timer".to_string(),
                x: 10.0,
                y: 10.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_timer".to_string(),
                x: 10.0,
                y: 40.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_count".to_string(),
                x: 10.0,
                y: 70.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
        ],
        background_color: "#000000".to_string(),
        background_opacity: 0.85,
        width: 300,
        height: 120,
    };
    let compact_json =
        serde_json::to_string(&compact_layout).expect("failed to serialize compact layout");

    conn.execute(
        "INSERT INTO overlay_profiles (id, name, layout_json, is_active, is_default, created_at, updated_at) VALUES (?1, ?2, ?3, 1, 1, ?4, ?5)",
        rusqlite::params![compact_id, "Compact", compact_json, now, now],
    )?;

    // Streamer profile (400x200)
    let streamer_id = Uuid::new_v4().to_string();
    let streamer_layout = OverlayProfileLayout {
        widgets: vec![
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "timer".to_string(),
                x: 10.0,
                y: 10.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_timer".to_string(),
                x: 10.0,
                y: 45.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_count".to_string(),
                x: 10.0,
                y: 80.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "last_item".to_string(),
                x: 10.0,
                y: 115.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "items_found".to_string(),
                x: 10.0,
                y: 150.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
        ],
        background_color: "#000000".to_string(),
        background_opacity: 0.85,
        width: 400,
        height: 200,
    };
    let streamer_json =
        serde_json::to_string(&streamer_layout).expect("failed to serialize streamer layout");

    conn.execute(
        "INSERT INTO overlay_profiles (id, name, layout_json, is_active, is_default, created_at, updated_at) VALUES (?1, ?2, ?3, 0, 1, ?4, ?5)",
        rusqlite::params![streamer_id, "Streamer", streamer_json, now, now],
    )?;

    // Detailed profile (500x400)
    let detailed_id = Uuid::new_v4().to_string();
    let detailed_layout = OverlayProfileLayout {
        widgets: vec![
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "timer".to_string(),
                x: 10.0,
                y: 10.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_timer".to_string(),
                x: 10.0,
                y: 45.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_count".to_string(),
                x: 10.0,
                y: 80.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "items_found".to_string(),
                x: 10.0,
                y: 115.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "last_item".to_string(),
                x: 10.0,
                y: 150.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "dry_streak".to_string(),
                x: 10.0,
                y: 185.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "goal_progress".to_string(),
                x: 10.0,
                y: 220.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "xp_per_hour".to_string(),
                x: 10.0,
                y: 255.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
        ],
        background_color: "#000000".to_string(),
        background_opacity: 0.85,
        width: 500,
        height: 400,
    };
    let detailed_json =
        serde_json::to_string(&detailed_layout).expect("failed to serialize detailed layout");

    conn.execute(
        "INSERT INTO overlay_profiles (id, name, layout_json, is_active, is_default, created_at, updated_at) VALUES (?1, ?2, ?3, 0, 1, ?4, ?5)",
        rusqlite::params![detailed_id, "Detailed", detailed_json, now, now],
    )?;

    Ok(())
}

#[tauri::command]
pub fn get_overlay_profiles(state: State<DbState>) -> Result<Vec<OverlayProfile>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, layout_json, is_active, is_default, created_at, updated_at FROM overlay_profiles ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let profiles = stmt
        .query_map([], |row| {
            let layout_json: String = row.get(2)?;
            let is_active: i32 = row.get(3)?;
            let is_default: i32 = row.get(4)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                layout_json,
                is_active,
                is_default,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for (id, name, layout_json, is_active, is_default, created_at, updated_at) in profiles {
        let layout: OverlayProfileLayout =
            serde_json::from_str(&layout_json).map_err(|e| e.to_string())?;
        result.push(OverlayProfile {
            id,
            name,
            layout,
            is_active: is_active == 1,
            is_default: is_default == 1,
            created_at,
            updated_at,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_active_overlay_profile(state: State<DbState>) -> Result<OverlayProfile, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, layout_json, is_active, is_default, created_at, updated_at FROM overlay_profiles WHERE is_active = 1 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let profile = stmt
        .query_row([], |row| {
            let layout_json: String = row.get(2)?;
            let is_active: i32 = row.get(3)?;
            let is_default: i32 = row.get(4)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                layout_json,
                is_active,
                is_default,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| format!("No active overlay profile found: {}", e))?;

    let (id, name, layout_json, is_active, is_default, created_at, updated_at) = profile;
    let layout: OverlayProfileLayout =
        serde_json::from_str(&layout_json).map_err(|e| e.to_string())?;

    Ok(OverlayProfile {
        id,
        name,
        layout,
        is_active: is_active == 1,
        is_default: is_default == 1,
        created_at,
        updated_at,
    })
}

#[tauri::command]
pub fn create_overlay_profile(
    state: State<DbState>,
    input: CreateOverlayProfileInput,
) -> Result<OverlayProfile, String> {
    let name = input.name.trim().to_string();

    // Validate name length (1-50 chars after trimming)
    if name.is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    if name.len() > 50 {
        return Err("Profile name is too long (max 50 characters)".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Check uniqueness
    let name_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM overlay_profiles WHERE name = ?1",
            rusqlite::params![name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if name_exists {
        return Err("Profile name already in use".to_string());
    }

    // Enforce max 20 profiles
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM overlay_profiles",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if count >= 20 {
        return Err("Maximum number of profiles reached".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let layout_json = serde_json::to_string(&input.layout).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO overlay_profiles (id, name, layout_json, is_active, is_default, created_at, updated_at) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5)",
        rusqlite::params![id, name, layout_json, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(OverlayProfile {
        id,
        name,
        layout: input.layout,
        is_active: false,
        is_default: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_overlay_profile(
    state: State<DbState>,
    id: String,
    input: UpdateOverlayProfileInput,
) -> Result<OverlayProfile, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Verify the profile exists and get current data
    let mut stmt = conn
        .prepare(
            "SELECT id, name, layout_json, is_active, is_default, created_at, updated_at FROM overlay_profiles WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let (current_name, current_layout_json, is_active, is_default, created_at): (
        String,
        String,
        i32,
        i32,
        String,
    ) = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok((
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i32>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|e| format!("Profile not found: {}", e))?;

    // Validate name if provided
    let final_name = if let Some(ref new_name) = input.name {
        let trimmed = new_name.trim().to_string();
        if trimmed.is_empty() {
            return Err("Profile name cannot be empty".to_string());
        }
        if trimmed.len() > 50 {
            return Err("Profile name is too long (max 50 characters)".to_string());
        }
        // Check uniqueness (excluding current profile)
        let name_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM overlay_profiles WHERE name = ?1 AND id != ?2",
                rusqlite::params![trimmed, id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if name_exists {
            return Err("Profile name already in use".to_string());
        }
        trimmed
    } else {
        current_name
    };

    // Determine final layout
    let final_layout = if let Some(ref layout) = input.layout {
        serde_json::to_string(layout).map_err(|e| e.to_string())?
    } else {
        current_layout_json
    };

    // Update the profile
    conn.execute(
        "UPDATE overlay_profiles SET name = ?1, layout_json = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![final_name, final_layout, now, id],
    )
    .map_err(|e| e.to_string())?;

    let layout: OverlayProfileLayout =
        serde_json::from_str(&final_layout).map_err(|e| e.to_string())?;

    Ok(OverlayProfile {
        id,
        name: final_name,
        layout,
        is_active: is_active == 1,
        is_default: is_default == 1,
        created_at,
        updated_at: now,
    })
}

#[tauri::command]
pub fn delete_overlay_profile(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Check total profile count
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM overlay_profiles",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if count <= 1 {
        return Err("Cannot delete the last profile".to_string());
    }

    // Check if the profile being deleted is active
    let is_active: bool = conn
        .query_row(
            "SELECT is_active FROM overlay_profiles WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                let val: i32 = row.get(0)?;
                Ok(val == 1)
            },
        )
        .map_err(|e| format!("Profile not found: {}", e))?;

    // Delete the profile
    conn.execute(
        "DELETE FROM overlay_profiles WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    // If the deleted profile was active, activate the first remaining profile
    if is_active {
        conn.execute(
            "UPDATE overlay_profiles SET is_active = 1 WHERE id = (SELECT id FROM overlay_profiles ORDER BY created_at ASC LIMIT 1)",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn set_active_overlay_profile(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Verify the target profile exists
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM overlay_profiles WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !exists {
        return Err("Profile not found".to_string());
    }

    // Deactivate all profiles
    conn.execute("UPDATE overlay_profiles SET is_active = 0", [])
        .map_err(|e| e.to_string())?;

    // Activate the target profile
    conn.execute(
        "UPDATE overlay_profiles SET is_active = 1 WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn init_default_overlay_profiles(state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Only create defaults if no profiles exist
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM overlay_profiles",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Ok(());
    }

    let now = Utc::now().to_rfc3339();

    // Compact profile (active by default, 300x120)
    let compact_id = Uuid::new_v4().to_string();
    let compact_layout = OverlayProfileLayout {
        widgets: vec![
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "timer".to_string(),
                x: 10.0,
                y: 10.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_timer".to_string(),
                x: 10.0,
                y: 40.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_count".to_string(),
                x: 10.0,
                y: 70.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
        ],
        background_color: "#000000".to_string(),
        background_opacity: 0.85,
        width: 300,
        height: 120,
    };
    let compact_json = serde_json::to_string(&compact_layout).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO overlay_profiles (id, name, layout_json, is_active, is_default, created_at, updated_at) VALUES (?1, ?2, ?3, 1, 1, ?4, ?5)",
        rusqlite::params![compact_id, "Compact", compact_json, now, now],
    )
    .map_err(|e| e.to_string())?;

    // Streamer profile (400x200)
    let streamer_id = Uuid::new_v4().to_string();
    let streamer_layout = OverlayProfileLayout {
        widgets: vec![
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "timer".to_string(),
                x: 10.0,
                y: 10.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_timer".to_string(),
                x: 10.0,
                y: 45.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_count".to_string(),
                x: 10.0,
                y: 80.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "last_item".to_string(),
                x: 10.0,
                y: 115.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "items_found".to_string(),
                x: 10.0,
                y: 150.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
        ],
        background_color: "#000000".to_string(),
        background_opacity: 0.85,
        width: 400,
        height: 200,
    };
    let streamer_json = serde_json::to_string(&streamer_layout).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO overlay_profiles (id, name, layout_json, is_active, is_default, created_at, updated_at) VALUES (?1, ?2, ?3, 0, 1, ?4, ?5)",
        rusqlite::params![streamer_id, "Streamer", streamer_json, now, now],
    )
    .map_err(|e| e.to_string())?;

    // Detailed profile (500x400)
    let detailed_id = Uuid::new_v4().to_string();
    let detailed_layout = OverlayProfileLayout {
        widgets: vec![
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "timer".to_string(),
                x: 10.0,
                y: 10.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_timer".to_string(),
                x: 10.0,
                y: 45.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "run_count".to_string(),
                x: 10.0,
                y: 80.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "items_found".to_string(),
                x: 10.0,
                y: 115.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "last_item".to_string(),
                x: 10.0,
                y: 150.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "dry_streak".to_string(),
                x: 10.0,
                y: 185.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "goal_progress".to_string(),
                x: 10.0,
                y: 220.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
            WidgetPlacement {
                id: Uuid::new_v4().to_string(),
                widget_type: "xp_per_hour".to_string(),
                x: 10.0,
                y: 255.0,
                size: "medium".to_string(),
                opacity: 1.0,
            },
        ],
        background_color: "#000000".to_string(),
        background_opacity: 0.85,
        width: 500,
        height: 400,
    };
    let detailed_json = serde_json::to_string(&detailed_layout).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO overlay_profiles (id, name, layout_json, is_active, is_default, created_at, updated_at) VALUES (?1, ?2, ?3, 0, 1, ?4, ?5)",
        rusqlite::params![detailed_id, "Detailed", detailed_json, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
