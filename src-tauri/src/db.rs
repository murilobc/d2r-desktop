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
