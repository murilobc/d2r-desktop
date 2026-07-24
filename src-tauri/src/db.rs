use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use chrono::Utc;
use uuid::Uuid;

use crate::models::{CreateTemplateInput, Template, UpdateTemplateInput};

pub struct DbState(pub Mutex<Connection>);

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
    app_dir.join("d2r_tracker.db")
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            class TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'Ladder',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            area TEXT NOT NULL,
            duration_secs INTEGER NOT NULL DEFAULT 0,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            status TEXT NOT NULL DEFAULT 'in_progress',
            notes TEXT,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            profile_id TEXT NOT NULL,
            name TEXT NOT NULL,
            item_type TEXT NOT NULL,
            rarity TEXT NOT NULL,
            found_at TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS custom_areas (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS routes (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            name TEXT NOT NULL,
            areas TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_routes_profile ON routes(profile_id);
        ",
    )?;

    // Migration: if old schema had level/difficulty, migrate to mode
    migrate_profiles(conn)?;

    // Create indexes for performance
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_runs_profile_status ON runs(profile_id, status);
        CREATE INDEX IF NOT EXISTS idx_runs_profile_area ON runs(profile_id, area);
        CREATE INDEX IF NOT EXISTS idx_runs_profile_started ON runs(profile_id, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_run ON items(run_id);
        CREATE INDEX IF NOT EXISTS idx_items_profile ON items(profile_id);
        ",
    )?;

    // Migration: add player_count column if missing
    migrate_player_count(conn)?;

    // Migration: add magic_find column to profiles if missing
    migrate_magic_find(conn)?;

    // Migration: add routes table and route columns to runs
    migrate_routes(conn)?;

    // Migration: add tags column to runs
    migrate_tags(conn)?;

    // Migration: add herald_encounters table
    migrate_herald_encounters(conn)?;

    // Migration: add colossal_ancients table
    migrate_colossal_ancients(conn)?;

    // Migration: add anni_log table
    migrate_anni_log(conn)?;

    // Migration: add xp_entries table
    migrate_xp_entries(conn)?;

    // Migration: add dclone_progress table
    migrate_dclone_progress(conn)?;

    // Migration: add keybind_profiles table
    migrate_keybind_profiles(conn)?;

    // Migration: add coop_player_name column to items
    migrate_coop_player_name(conn)?;

    // Migration: add rune_inventory and runeword_targets tables
    migrate_rune_planner(conn)?;

    // Migration: add overlay_profiles table
    migrate_overlay_profiles(conn)?;

    // Migration: add templates table
    migrate_templates(conn)?;

    // Initialize achievements tables and seed definitions
    crate::achievements::init_achievements(conn)?;

    // Migration: add screenshot_settings table
    crate::screenshot::settings::create_screenshot_settings_table(conn)?;

    Ok(())
}

fn migrate_profiles(conn: &Connection) -> Result<()> {
    // Check if 'mode' column exists
    let has_mode: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('profiles') WHERE name = 'mode'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;

    if !has_mode {
        // Old schema: add mode column and drop level/difficulty by recreating table
        conn.execute_batch(
            "
            ALTER TABLE profiles RENAME TO profiles_old;

            CREATE TABLE profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                class TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'Ladder',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            INSERT INTO profiles (id, name, class, mode, created_at, updated_at)
            SELECT id, name, class, 'Ladder', created_at, updated_at FROM profiles_old;

            DROP TABLE profiles_old;
            ",
        )?;
    }

    Ok(())
}

fn migrate_player_count(conn: &Connection) -> Result<()> {
    let has_col: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('runs') WHERE name = 'player_count'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;

    if !has_col {
        conn.execute_batch("ALTER TABLE runs ADD COLUMN player_count INTEGER DEFAULT NULL;")?;
    }

    Ok(())
}

fn migrate_magic_find(conn: &Connection) -> Result<()> {
    let has_col: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('profiles') WHERE name = 'magic_find'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;

    if !has_col {
        conn.execute_batch("ALTER TABLE profiles ADD COLUMN magic_find INTEGER DEFAULT NULL;")?;
    }

    Ok(())
}

fn migrate_routes(conn: &Connection) -> Result<()> {
    // Add route_id column to runs if missing
    let has_route_id: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('runs') WHERE name = 'route_id'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;

    if !has_route_id {
        conn.execute_batch("ALTER TABLE runs ADD COLUMN route_id TEXT DEFAULT NULL;")?;
    }

    // Add route_step_index column to runs if missing
    let has_step_index: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('runs') WHERE name = 'route_step_index'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;

    if !has_step_index {
        conn.execute_batch("ALTER TABLE runs ADD COLUMN route_step_index INTEGER DEFAULT NULL;")?;
    }

    // Add index for route lookups
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_runs_route ON runs(route_id);")?;

    Ok(())
}

fn migrate_tags(conn: &Connection) -> Result<()> {
    let has_tags: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('runs') WHERE name = 'tags'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;

    if !has_tags {
        conn.execute_batch("ALTER TABLE runs ADD COLUMN tags TEXT DEFAULT NULL;")?;
    }

    Ok(())
}

fn migrate_herald_encounters(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS herald_encounters (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            tier INTEGER NOT NULL,
            area TEXT NOT NULL,
            result TEXT NOT NULL,
            sunder_charm TEXT,
            notes TEXT,
            encountered_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_herald_profile ON herald_encounters(profile_id);
        ",
    )?;

    Ok(())
}

fn migrate_colossal_ancients(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS colossal_ancients (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            boss_name TEXT NOT NULL,
            attempt_number INTEGER NOT NULL,
            result TEXT NOT NULL,
            drops TEXT,
            duration_secs INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            attempted_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_colossal_profile ON colossal_ancients(profile_id);
        CREATE INDEX IF NOT EXISTS idx_colossal_boss ON colossal_ancients(profile_id, boss_name);
        ",
    )?;

    Ok(())
}

fn migrate_anni_log(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS anni_log (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            stats TEXT NOT NULL,
            notes TEXT,
            obtained_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_anni_profile ON anni_log(profile_id);
        ",
    )?;

    Ok(())
}

fn migrate_xp_entries(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS xp_entries (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            run_id TEXT,
            level INTEGER NOT NULL,
            xp_gained INTEGER NOT NULL,
            duration_secs INTEGER NOT NULL DEFAULT 0,
            area TEXT,
            notes TEXT,
            recorded_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_xp_profile ON xp_entries(profile_id);
        ",
    )?;

    Ok(())
}

fn migrate_dclone_progress(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS dclone_progress (
            region TEXT PRIMARY KEY,
            progress INTEGER NOT NULL DEFAULT 1,
            last_updated TEXT NOT NULL
        );
        ",
    )?;

    Ok(())
}

fn migrate_keybind_profiles(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS keybind_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            bindings TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        ",
    )?;

    Ok(())
}

fn migrate_coop_player_name(conn: &Connection) -> Result<()> {
    let has_col: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('items') WHERE name = 'coop_player_name'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;

    if !has_col {
        conn.execute_batch("ALTER TABLE items ADD COLUMN coop_player_name TEXT DEFAULT NULL;")?;
    }

    Ok(())
}

fn migrate_rune_planner(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS rune_inventory (
            profile_id TEXT NOT NULL,
            rune_name TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (profile_id, rune_name),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_rune_inventory_profile ON rune_inventory(profile_id);

        CREATE TABLE IF NOT EXISTS runeword_targets (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            runeword_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_runeword_targets_profile ON runeword_targets(profile_id);
        ",
    )?;

    Ok(())
}

fn migrate_overlay_profiles(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS overlay_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            layout_json TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0,
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_overlay_profiles_active ON overlay_profiles(is_active);
        ",
    )?;

    Ok(())
}

fn migrate_templates(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            name TEXT NOT NULL,
            area TEXT NOT NULL,
            player_count INTEGER NOT NULL DEFAULT 1,
            route_id TEXT,
            session_goal_type TEXT NOT NULL DEFAULT 'none',
            session_goal_value INTEGER,
            tags TEXT,
            last_used_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
            FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_templates_profile ON templates(profile_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_profile_name ON templates(profile_id, name COLLATE NOCASE);
        ",
    )?;

    Ok(())
}

// ===== QUICK-START TEMPLATES =====

pub fn db_create_template(
    conn: &Connection,
    input: CreateTemplateInput,
) -> std::result::Result<Template, String> {
    // Validate name: at least 1 non-whitespace char, max 100 chars
    if input.name.trim().is_empty() {
        return Err("Template name must contain at least 1 non-whitespace character".to_string());
    }
    if input.name.len() > 100 {
        return Err("Template name must not exceed 100 characters".to_string());
    }

    // Validate player_count: 1–8
    if input.player_count < 1 || input.player_count > 8 {
        return Err("Player count must be between 1 and 8".to_string());
    }

    // Validate session_goal_value: 1–9999 if provided
    if let Some(goal) = input.session_goal_value {
        if goal < 1 || goal > 9999 {
            return Err("Session goal must be between 1 and 9999".to_string());
        }
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let tags_json = input
        .tags
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()));

    conn.execute(
        "INSERT INTO templates (id, profile_id, name, area, player_count, route_id, session_goal_type, session_goal_value, tags, last_used_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL, ?10, ?10)",
        rusqlite::params![
            id,
            input.profile_id,
            input.name,
            input.area,
            input.player_count,
            input.route_id,
            input.session_goal_type,
            input.session_goal_value,
            tags_json,
            now,
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "A template with this name already exists".to_string()
        } else {
            e.to_string()
        }
    })?;

    Ok(Template {
        id,
        profile_id: input.profile_id,
        name: input.name,
        area: input.area,
        player_count: input.player_count,
        route_id: input.route_id,
        session_goal_type: input.session_goal_type,
        session_goal_value: input.session_goal_value,
        tags: tags_json,
        last_used_at: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn db_get_templates(
    conn: &Connection,
    profile_id: &str,
) -> std::result::Result<Vec<Template>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, profile_id, name, area, player_count, route_id, session_goal_type, session_goal_value, tags, last_used_at, created_at, updated_at FROM templates WHERE profile_id = ?1 ORDER BY CASE WHEN last_used_at IS NULL THEN 1 ELSE 0 END, last_used_at DESC, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let templates = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok(Template {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                area: row.get(3)?,
                player_count: row.get(4)?,
                route_id: row.get(5)?,
                session_goal_type: row.get(6)?,
                session_goal_value: row.get(7)?,
                tags: row.get(8)?,
                last_used_at: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(templates)
}

pub fn db_update_template(
    conn: &Connection,
    id: &str,
    input: UpdateTemplateInput,
) -> std::result::Result<Template, String> {
    // Validate name: at least 1 non-whitespace char, max 100 chars
    if input.name.trim().is_empty() {
        return Err("Template name must contain at least 1 non-whitespace character".to_string());
    }
    if input.name.len() > 100 {
        return Err("Template name must not exceed 100 characters".to_string());
    }

    // Validate player_count: 1–8
    if input.player_count < 1 || input.player_count > 8 {
        return Err("Player count must be between 1 and 8".to_string());
    }

    // Validate session_goal_value: 1–9999 if provided
    if let Some(goal) = input.session_goal_value {
        if goal < 1 || goal > 9999 {
            return Err("Session goal must be between 1 and 9999".to_string());
        }
    }

    // Verify template exists
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM templates WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !exists {
        return Err("Template not found".to_string());
    }

    let now = Utc::now().to_rfc3339();
    let tags_json = input
        .tags
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()));

    conn.execute(
        "UPDATE templates SET name = ?1, area = ?2, player_count = ?3, route_id = ?4, session_goal_type = ?5, session_goal_value = ?6, tags = ?7, updated_at = ?8 WHERE id = ?9",
        rusqlite::params![
            input.name,
            input.area,
            input.player_count,
            input.route_id,
            input.session_goal_type,
            input.session_goal_value,
            tags_json,
            now,
            id,
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "A template with this name already exists".to_string()
        } else {
            e.to_string()
        }
    })?;

    // Fetch and return the updated template
    let mut stmt = conn
        .prepare("SELECT id, profile_id, name, area, player_count, route_id, session_goal_type, session_goal_value, tags, last_used_at, created_at, updated_at FROM templates WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let template = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Template {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                area: row.get(3)?,
                player_count: row.get(4)?,
                route_id: row.get(5)?,
                session_goal_type: row.get(6)?,
                session_goal_value: row.get(7)?,
                tags: row.get(8)?,
                last_used_at: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(template)
}

pub fn db_delete_template(conn: &Connection, id: &str) -> std::result::Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM templates WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !exists {
        return Err("Template not found".to_string());
    }

    conn.execute("DELETE FROM templates WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn db_touch_template(conn: &Connection, id: &str) -> std::result::Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM templates WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !exists {
        return Err("Template not found".to_string());
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE templates SET last_used_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
