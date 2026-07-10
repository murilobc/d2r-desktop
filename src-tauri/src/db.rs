use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

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
