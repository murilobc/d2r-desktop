use chrono::{Local, NaiveDate};
use rusqlite::{params, Connection, Result};
use uuid::Uuid;

use crate::models::{
    AchievementDefinition, AchievementProgress, AchievementUnlock, AreaCount, ClassCount,
    LifetimeStats, RarityCount,
};

/// Initialize the achievements tables and seed default definitions.
/// Called from `init_db` during application startup.
pub fn init_achievements(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS achievement_definitions (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL CHECK(category IN ('milestone', 'streak', 'per-class', 'per-area')),
            name_key TEXT NOT NULL,
            description_key TEXT NOT NULL,
            icon TEXT NOT NULL,
            condition_type TEXT NOT NULL,
            condition_target TEXT,
            threshold INTEGER NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS achievement_unlocks (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            definition_id TEXT NOT NULL,
            unlocked_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
            FOREIGN KEY (definition_id) REFERENCES achievement_definitions(id) ON DELETE CASCADE,
            UNIQUE(profile_id, definition_id)
        );

        CREATE INDEX IF NOT EXISTS idx_unlocks_profile ON achievement_unlocks(profile_id);
        ",
    )?;

    seed_default_definitions(conn)?;

    Ok(())
}

/// Evaluate all locked achievements for a profile and unlock any whose conditions are met.
/// Returns the list of newly unlocked achievements with their joined definition data.
pub fn evaluate_achievements(
    conn: &Connection,
    profile_id: &str,
) -> Result<Vec<AchievementUnlock>> {
    // 1. Get all definitions NOT yet unlocked by this profile
    let locked = get_locked_definitions(conn, profile_id)?;

    // 2. Compute current profile stats once
    let stats = compute_profile_stats(conn, profile_id)?;
    let streak = compute_streak(conn, profile_id)?;

    // 3. Check each locked definition
    let mut newly_unlocked = Vec::new();
    for def in &locked {
        let current_value = match def.condition_type.as_str() {
            "total_runs" => stats.total_runs,
            "total_items" => stats.total_items,
            "total_time" => stats.total_time_secs / 3600, // convert seconds to hours
            "streak_days" => streak,
            "class_runs" => stats.runs_for_class(def.condition_target.as_deref()),
            "area_runs" => stats.runs_for_area(def.condition_target.as_deref()),
            _ => 0,
        };

        if current_value >= def.threshold {
            let unlock = create_unlock_record(conn, profile_id, def)?;
            newly_unlocked.push(unlock);
        }
    }

    Ok(newly_unlocked)
}

/// Internal stats struct used during evaluation.
struct ProfileStats {
    total_runs: i64,
    total_items: i64,
    total_time_secs: i64,
    profile_class: String,
    area_run_counts: Vec<(String, i64)>,
}

impl ProfileStats {
    fn runs_for_class(&self, target: Option<&str>) -> i64 {
        match target {
            Some(class) if class == self.profile_class => self.total_runs,
            _ => 0,
        }
    }

    fn runs_for_area(&self, target: Option<&str>) -> i64 {
        match target {
            Some(area) => self
                .area_run_counts
                .iter()
                .find(|(a, _)| a == area)
                .map(|(_, count)| *count)
                .unwrap_or(0),
            None => 0,
        }
    }
}

/// Get all achievement definitions that this profile has NOT yet unlocked.
fn get_locked_definitions(
    conn: &Connection,
    profile_id: &str,
) -> Result<Vec<AchievementDefinition>> {
    let mut stmt = conn.prepare(
        "SELECT d.id, d.category, d.name_key, d.description_key, d.icon,
                d.condition_type, d.condition_target, d.threshold, d.sort_order
         FROM achievement_definitions d
         WHERE d.id NOT IN (
             SELECT definition_id FROM achievement_unlocks WHERE profile_id = ?1
         )
         ORDER BY d.sort_order",
    )?;

    let defs = stmt
        .query_map(params![profile_id], |row| {
            Ok(AchievementDefinition {
                id: row.get(0)?,
                category: row.get(1)?,
                name_key: row.get(2)?,
                description_key: row.get(3)?,
                icon: row.get(4)?,
                condition_type: row.get(5)?,
                condition_target: row.get(6)?,
                threshold: row.get(7)?,
                sort_order: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(defs)
}

/// Compute aggregate profile stats: total runs, total items, total time, class runs, area runs.
fn compute_profile_stats(conn: &Connection, profile_id: &str) -> Result<ProfileStats> {
    // Total completed runs and total time
    let (total_runs, total_time_secs): (i64, i64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(duration_secs), 0)
         FROM runs
         WHERE profile_id = ?1 AND status = 'completed'",
        params![profile_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    // Total items (items are linked to runs via run_id, filter by profile's runs)
    let total_items: i64 = conn.query_row(
        "SELECT COUNT(*)
         FROM items
         WHERE profile_id = ?1",
        params![profile_id],
        |row| row.get(0),
    )?;

    // Get the profile's class for per-class evaluation
    let profile_class: String = conn.query_row(
        "SELECT class FROM profiles WHERE id = ?1",
        params![profile_id],
        |row| row.get(0),
    )?;

    // Per-area: count completed runs grouped by area
    let mut area_stmt = conn.prepare(
        "SELECT area, COUNT(*)
         FROM runs
         WHERE profile_id = ?1 AND status = 'completed'
         GROUP BY area",
    )?;
    let area_run_counts = area_stmt
        .query_map(params![profile_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(ProfileStats {
        total_runs,
        total_items,
        total_time_secs,
        profile_class,
        area_run_counts,
    })
}

/// Compute the current consecutive-day streak for a profile.
/// A streak counts consecutive calendar days (local timezone) ending at today
/// during which at least one run was completed.
fn compute_streak(conn: &Connection, profile_id: &str) -> Result<i64> {
    // Get distinct completed run dates in local timezone, sorted descending
    let mut stmt = conn.prepare(
        "SELECT DISTINCT DATE(finished_at, 'localtime') as run_date
         FROM runs
         WHERE profile_id = ?1 AND status = 'completed' AND finished_at IS NOT NULL
         ORDER BY run_date DESC",
    )?;

    let dates: Vec<String> = stmt
        .query_map(params![profile_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>>>()?;

    if dates.is_empty() {
        return Ok(0);
    }

    let today = Local::now().date_naive();
    let mut streak: i64 = 0;
    let mut expected = today;

    for date_str in &dates {
        let date = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => break,
        };

        if date == expected {
            streak += 1;
            expected = match expected.pred_opt() {
                Some(d) => d,
                None => break,
            };
        } else if date < expected {
            // Gap found — streak ends
            break;
        }
        // If date > expected, skip (shouldn't happen with DESC order, but be safe)
    }

    Ok(streak)
}

/// Create an unlock record in the database and return the full AchievementUnlock with joined definition.
fn create_unlock_record(
    conn: &Connection,
    profile_id: &str,
    definition: &AchievementDefinition,
) -> Result<AchievementUnlock> {
    let id = Uuid::new_v4().to_string();
    let unlocked_at = Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO achievement_unlocks (id, profile_id, definition_id, unlocked_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![id, profile_id, definition.id, unlocked_at],
    )?;

    Ok(AchievementUnlock {
        id,
        profile_id: profile_id.to_string(),
        definition_id: definition.id.clone(),
        unlocked_at,
        definition: definition.clone(),
    })
}

/// Seed default achievement definitions using INSERT OR IGNORE so re-runs don't duplicate.
fn seed_default_definitions(conn: &Connection) -> Result<()> {
    let sql = "INSERT OR IGNORE INTO achievement_definitions
        (id, category, name_key, description_key, icon, condition_type, condition_target, threshold, sort_order)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)";

    let mut sort = 0;

    // --- Milestone: total_runs ---
    for threshold in [100, 500, 1000, 5000] {
        let id = format!("milestone_total_runs_{}", threshold);
        let name_key = format!("milestone_{}_runs", threshold);
        let desc_key = format!("milestone_{}_runs", threshold);
        conn.execute(
            sql,
            params![id, "milestone", name_key, desc_key, "🏃", "total_runs", None::<String>, threshold, sort],
        )?;
        sort += 1;
    }

    // --- Milestone: total_items ---
    for threshold in [100, 500, 1000] {
        let id = format!("milestone_total_items_{}", threshold);
        let name_key = format!("milestone_{}_items", threshold);
        let desc_key = format!("milestone_{}_items", threshold);
        conn.execute(
            sql,
            params![id, "milestone", name_key, desc_key, "💎", "total_items", None::<String>, threshold, sort],
        )?;
        sort += 1;
    }

    // --- Milestone: total_time (hours) ---
    for threshold in [50, 100, 500] {
        let id = format!("milestone_total_time_{}", threshold);
        let name_key = format!("milestone_{}_hours", threshold);
        let desc_key = format!("milestone_{}_hours", threshold);
        conn.execute(
            sql,
            params![id, "milestone", name_key, desc_key, "⏱️", "total_time", None::<String>, threshold, sort],
        )?;
        sort += 1;
    }

    // --- Streak: streak_days ---
    for threshold in [3, 7, 14, 30] {
        let id = format!("streak_{}_days", threshold);
        let name_key = format!("streak_{}_days", threshold);
        let desc_key = format!("streak_{}_days", threshold);
        conn.execute(
            sql,
            params![id, "streak", name_key, desc_key, "🔥", "streak_days", None::<String>, threshold, sort],
        )?;
        sort += 1;
    }

    // --- Per-class: class_runs ---
    let classes = [
        "Amazon",
        "Necromancer",
        "Barbarian",
        "Sorceress",
        "Paladin",
        "Druid",
        "Assassin",
        "Warlock",
    ];
    for class in &classes {
        for threshold in [500, 1000] {
            let class_lower = class.to_lowercase();
            let id = format!("class_{}_{}", class_lower, threshold);
            let name_key = format!("class_{}_{}", class_lower, threshold);
            let desc_key = format!("class_{}_{}", class_lower, threshold);
            conn.execute(
                sql,
                params![id, "per-class", name_key, desc_key, "⚔️", "class_runs", Some(*class), threshold, sort],
            )?;
            sort += 1;
        }
    }

    // --- Per-area: area_runs ---
    let areas = [
        "Pit",
        "Chaos Sanctuary",
        "Ancient Tunnels",
        "Cow Level",
        "Travincal",
        "Baal",
    ];
    for area in &areas {
        for threshold in [100, 500] {
            let area_slug = area.to_lowercase().replace(' ', "_");
            let id = format!("area_{}_{}", area_slug, threshold);
            let name_key = format!("area_{}_{}", area_slug, threshold);
            let desc_key = format!("area_{}_{}", area_slug, threshold);
            conn.execute(
                sql,
                params![id, "per-area", name_key, desc_key, "🗺️", "area_runs", Some(*area), threshold, sort],
            )?;
            sort += 1;
        }
    }

    Ok(())
}

/// Return all achievement definitions ordered by sort_order.
pub fn get_achievement_definitions(conn: &Connection) -> Result<Vec<AchievementDefinition>> {
    let mut stmt = conn.prepare(
        "SELECT id, category, name_key, description_key, icon, condition_type, condition_target, threshold, sort_order
         FROM achievement_definitions
         ORDER BY sort_order ASC",
    )?;
    let definitions = stmt
        .query_map([], |row| {
            Ok(AchievementDefinition {
                id: row.get(0)?,
                category: row.get(1)?,
                name_key: row.get(2)?,
                description_key: row.get(3)?,
                icon: row.get(4)?,
                condition_type: row.get(5)?,
                condition_target: row.get(6)?,
                threshold: row.get(7)?,
                sort_order: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
    Ok(definitions)
}

/// For each definition, compute current progress and check unlock state for the given profile.
pub fn get_achievement_progress(
    conn: &Connection,
    profile_id: &str,
) -> Result<Vec<AchievementProgress>> {
    let definitions = get_achievement_definitions(conn)?;

    // Compute profile stats once
    let total_runs = compute_total_runs(conn, profile_id)?;
    let total_items = compute_total_items(conn, profile_id)?;
    let total_time_hours = compute_total_time_hours(conn, profile_id)?;
    let streak = compute_streak(conn, profile_id)?;
    let profile_class = get_profile_class(conn, profile_id)?;

    let mut progress = Vec::with_capacity(definitions.len());
    for def in definitions {
        let current_value = match def.condition_type.as_str() {
            "total_runs" => total_runs,
            "total_items" => total_items,
            "total_time" => total_time_hours as i64,
            "streak_days" => streak,
            "class_runs" => {
                if def.condition_target.as_deref() == Some(profile_class.as_str()) {
                    total_runs
                } else {
                    0
                }
            }
            "area_runs" => {
                if let Some(ref target_area) = def.condition_target {
                    compute_area_runs(conn, profile_id, target_area)?
                } else {
                    0
                }
            }
            _ => 0,
        };

        // Check if unlocked
        let unlock_row: Option<String> = conn
            .query_row(
                "SELECT unlocked_at FROM achievement_unlocks WHERE profile_id = ?1 AND definition_id = ?2",
                params![profile_id, def.id],
                |row| row.get(0),
            )
            .ok();

        progress.push(AchievementProgress {
            definition: def,
            unlocked: unlock_row.is_some(),
            unlocked_at: unlock_row,
            current_value,
        });
    }

    Ok(progress)
}

/// Aggregate lifetime stats for a profile.
pub fn get_lifetime_stats(conn: &Connection, profile_id: &str) -> Result<LifetimeStats> {
    let total_runs = compute_total_runs(conn, profile_id)?;
    let total_items = compute_total_items(conn, profile_id)?;
    let total_time_hours = compute_total_time_hours(conn, profile_id)?;

    // Runs by class: profile has one class, so it's one entry with total runs
    let profile_class = get_profile_class(conn, profile_id)?;
    let runs_by_class = if total_runs > 0 {
        vec![ClassCount {
            class: profile_class,
            count: total_runs,
        }]
    } else {
        vec![]
    };

    // Runs by area
    let mut stmt = conn.prepare(
        "SELECT area, COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed' GROUP BY area ORDER BY COUNT(*) DESC",
    )?;
    let runs_by_area = stmt
        .query_map(params![profile_id], |row| {
            Ok(AreaCount {
                area: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    // Items by rarity
    let mut stmt = conn.prepare(
        "SELECT rarity, COUNT(*) FROM items WHERE profile_id = ?1 GROUP BY rarity ORDER BY COUNT(*) DESC",
    )?;
    let items_by_rarity = stmt
        .query_map(params![profile_id], |row| {
            Ok(RarityCount {
                rarity: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(LifetimeStats {
        total_time_hours,
        total_runs,
        total_items,
        runs_by_class,
        runs_by_area,
        items_by_rarity,
    })
}

// ===== Helper Functions =====

fn compute_total_runs(conn: &Connection, profile_id: &str) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed'",
        params![profile_id],
        |row| row.get(0),
    )
}

fn compute_total_items(conn: &Connection, profile_id: &str) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM items WHERE profile_id = ?1",
        params![profile_id],
        |row| row.get(0),
    )
}

fn compute_total_time_hours(conn: &Connection, profile_id: &str) -> Result<f64> {
    let total_secs: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_secs), 0) FROM runs WHERE profile_id = ?1 AND status = 'completed'",
        params![profile_id],
        |row| row.get(0),
    )?;
    Ok(total_secs as f64 / 3600.0)
}

fn compute_area_runs(conn: &Connection, profile_id: &str, area: &str) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed' AND area = ?2",
        params![profile_id, area],
        |row| row.get(0),
    )
}

fn get_profile_class(conn: &Connection, profile_id: &str) -> Result<String> {
    conn.query_row(
        "SELECT class FROM profiles WHERE id = ?1",
        params![profile_id],
        |row| row.get(0),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Local};
    use rusqlite::Connection;

    /// Creates an in-memory SQLite database with all required tables initialized.
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        // Create prerequisite tables that the evaluation logic queries against
        conn.execute_batch(
            "
            CREATE TABLE profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                class TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE runs (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                area TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                duration_secs INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'completed'
            );

            CREATE TABLE items (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                profile_id TEXT NOT NULL,
                name TEXT NOT NULL,
                rarity TEXT NOT NULL,
                base_type TEXT
            );
            ",
        )
        .unwrap();

        // Initialize achievements tables and seed definitions
        init_achievements(&conn).unwrap();

        conn
    }

    /// Helper: inserts a profile with given id and class.
    fn insert_profile(conn: &Connection, id: &str, class: &str) {
        conn.execute(
            "INSERT INTO profiles (id, name, class, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, format!("Test {}", class), class, "2024-01-01T00:00:00Z"],
        )
        .unwrap();
    }

    /// Helper: inserts N completed runs for a profile in a given area with a given duration.
    fn insert_runs(conn: &Connection, profile_id: &str, area: &str, count: i64, duration_secs: i64) {
        let now = Local::now().to_rfc3339();
        for i in 0..count {
            let id = format!("run_{}_{}", profile_id, i);
            conn.execute(
                "INSERT INTO runs (id, profile_id, area, started_at, finished_at, duration_secs, status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'completed')",
                params![id, profile_id, area, &now, &now, duration_secs],
            )
            .unwrap();
        }
    }

    /// Helper: inserts N items for a profile.
    fn insert_items(conn: &Connection, profile_id: &str, count: i64) {
        for i in 0..count {
            let id = format!("item_{}_{}", profile_id, i);
            conn.execute(
                "INSERT INTO items (id, run_id, profile_id, name, rarity, base_type)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, "run_0", profile_id, format!("Item {}", i), "unique", None::<String>],
            )
            .unwrap();
        }
    }

    /// Helper: inserts a run for a given profile with a specific finished_at date string.
    fn insert_run_on_date(conn: &Connection, profile_id: &str, run_id: &str, area: &str, finished_at: &str) {
        conn.execute(
            "INSERT INTO runs (id, profile_id, area, started_at, finished_at, duration_secs, status)
             VALUES (?1, ?2, ?3, ?4, ?5, 60, 'completed')",
            params![run_id, profile_id, area, finished_at, finished_at],
        )
        .unwrap();
    }

    /// Helper: clears all seeded definitions and inserts a custom one.
    fn insert_custom_definition(
        conn: &Connection,
        id: &str,
        category: &str,
        condition_type: &str,
        condition_target: Option<&str>,
        threshold: i64,
    ) {
        conn.execute(
            "INSERT OR REPLACE INTO achievement_definitions
             (id, category, name_key, description_key, icon, condition_type, condition_target, threshold, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)",
            params![id, category, id, id, "🏆", condition_type, condition_target, threshold],
        )
        .unwrap();
    }

    /// Helper: removes all seeded definitions to work with a clean slate.
    fn clear_definitions(conn: &Connection) {
        conn.execute("DELETE FROM achievement_definitions", []).unwrap();
    }

    // =========================================================================
    // Property 2: Milestone Threshold Evaluation
    // Validates: Requirements 4.1, 4.4
    // =========================================================================

    /// **Validates: Requirements 2.1, 2.2, 4.1, 4.4**
    #[test]
    fn test_milestone_total_runs_unlocks_at_threshold() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "test_runs_100", "milestone", "total_runs", None, 100);
        insert_profile(&conn, "p1", "Sorceress");

        // Insert exactly 100 runs — should unlock
        insert_runs(&conn, "p1", "Pit", 100, 60);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 1);
        assert_eq!(unlocks[0].definition_id, "test_runs_100");
    }

    /// **Validates: Requirements 2.1, 4.4**
    #[test]
    fn test_milestone_total_runs_no_unlock_below_threshold() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "test_runs_100", "milestone", "total_runs", None, 100);
        insert_profile(&conn, "p1", "Sorceress");

        // Insert 99 runs — should NOT unlock
        insert_runs(&conn, "p1", "Pit", 99, 60);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 0);
    }

    /// **Validates: Requirements 4.2, 4.4**
    #[test]
    fn test_milestone_total_items_unlocks_at_threshold() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "test_items_50", "milestone", "total_items", None, 50);
        insert_profile(&conn, "p1", "Barbarian");

        // Insert 50 items — should unlock
        insert_items(&conn, "p1", 50);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 1);
        assert_eq!(unlocks[0].definition_id, "test_items_50");
    }

    /// **Validates: Requirements 4.2, 4.4**
    #[test]
    fn test_milestone_total_items_no_unlock_below_threshold() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "test_items_50", "milestone", "total_items", None, 50);
        insert_profile(&conn, "p1", "Barbarian");

        // Insert 49 items — should NOT unlock
        insert_items(&conn, "p1", 49);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 0);
    }

    /// **Validates: Requirements 4.3, 4.4**
    #[test]
    fn test_milestone_total_time_unlocks_at_threshold() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        // Threshold is in hours; total_time evaluates as total_time_secs / 3600
        insert_custom_definition(&conn, "test_time_10h", "milestone", "total_time", None, 10);
        insert_profile(&conn, "p1", "Paladin");

        // Insert runs totaling 10 hours (36000 seconds) — 10 runs of 3600s each
        insert_runs(&conn, "p1", "Pit", 10, 3600);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 1);
        assert_eq!(unlocks[0].definition_id, "test_time_10h");
    }

    /// **Validates: Requirements 4.3, 4.4**
    #[test]
    fn test_milestone_total_time_no_unlock_below_threshold() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "test_time_10h", "milestone", "total_time", None, 10);
        insert_profile(&conn, "p1", "Paladin");

        // Insert runs totaling 9 hours (32400 seconds) — 9 runs of 3600s each
        insert_runs(&conn, "p1", "Pit", 9, 3600);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 0);
    }

    // =========================================================================
    // Property 3: Streak Calculation Correctness
    // Validates: Requirements 5.1, 5.2, 5.4
    // =========================================================================

    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn test_streak_consecutive_days() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "test_streak_3", "streak", "streak_days", None, 3);
        insert_profile(&conn, "p1", "Amazon");

        let today = Local::now().date_naive();
        // Insert runs on today, yesterday, and day before yesterday (3-day streak)
        for i in 0..3 {
            let date = today - Duration::days(i);
            let date_str = format!("{}T12:00:00+00:00", date.format("%Y-%m-%d"));
            insert_run_on_date(&conn, "p1", &format!("streak_run_{}", i), "Pit", &date_str);
        }

        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 1);
        assert_eq!(unlocks[0].definition_id, "test_streak_3");
    }

    /// **Validates: Requirements 5.4**
    #[test]
    fn test_streak_resets_on_gap() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "test_streak_3", "streak", "streak_days", None, 3);
        insert_profile(&conn, "p1", "Amazon");

        let today = Local::now().date_naive();
        // Insert runs on today and yesterday (2-day streak), then skip a day, then day before
        // Today: run, Yesterday: run, 2 days ago: NO run, 3 days ago: run
        // Streak should be 2 (today + yesterday only)
        let date_today = format!("{}T12:00:00+00:00", today.format("%Y-%m-%d"));
        let date_yesterday = format!("{}T12:00:00+00:00", (today - Duration::days(1)).format("%Y-%m-%d"));
        let date_3_days_ago = format!("{}T12:00:00+00:00", (today - Duration::days(3)).format("%Y-%m-%d"));

        insert_run_on_date(&conn, "p1", "r1", "Pit", &date_today);
        insert_run_on_date(&conn, "p1", "r2", "Pit", &date_yesterday);
        insert_run_on_date(&conn, "p1", "r3", "Pit", &date_3_days_ago);

        // Streak is 2 (today + yesterday), threshold is 3 — should NOT unlock
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 0);

        // Verify the streak value directly
        let streak = compute_streak(&conn, "p1").unwrap();
        assert_eq!(streak, 2);
    }

    /// **Validates: Requirements 5.2**
    #[test]
    fn test_streak_no_runs_is_zero() {
        let conn = setup_test_db();
        insert_profile(&conn, "p1", "Druid");

        let streak = compute_streak(&conn, "p1").unwrap();
        assert_eq!(streak, 0);
    }

    // =========================================================================
    // Property 4: Per-Class Evaluation
    // Validates: Requirements 6.1, 6.2
    // =========================================================================

    /// **Validates: Requirements 6.1, 6.2**
    #[test]
    fn test_per_class_unlocks_for_matching_class() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "class_sorceress_10", "per-class", "class_runs", Some("Sorceress"), 10);
        insert_profile(&conn, "p1", "Sorceress");

        // Insert 10 runs — should unlock since profile class matches
        insert_runs(&conn, "p1", "Pit", 10, 60);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 1);
        assert_eq!(unlocks[0].definition_id, "class_sorceress_10");
    }

    /// **Validates: Requirements 6.1, 6.2**
    #[test]
    fn test_per_class_does_not_unlock_for_different_class() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        // Achievement targets Barbarian
        insert_custom_definition(&conn, "class_barbarian_10", "per-class", "class_runs", Some("Barbarian"), 10);
        // Profile is Sorceress
        insert_profile(&conn, "p1", "Sorceress");

        // Insert 100 runs — should NOT unlock because profile class is Sorceress, not Barbarian
        insert_runs(&conn, "p1", "Pit", 100, 60);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 0);
    }

    // =========================================================================
    // Property 5: Per-Area Evaluation
    // Validates: Requirements 7.1, 7.2
    // =========================================================================

    /// **Validates: Requirements 7.1, 7.2**
    #[test]
    fn test_per_area_unlocks_for_matching_area() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "area_pit_10", "per-area", "area_runs", Some("Pit"), 10);
        insert_profile(&conn, "p1", "Necromancer");

        // Insert 10 runs in "Pit" — should unlock
        insert_runs(&conn, "p1", "Pit", 10, 60);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 1);
        assert_eq!(unlocks[0].definition_id, "area_pit_10");
    }

    /// **Validates: Requirements 7.1, 7.2**
    #[test]
    fn test_per_area_does_not_unlock_for_different_area() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        // Achievement targets Baal area
        insert_custom_definition(&conn, "area_baal_10", "per-area", "area_runs", Some("Baal"), 10);
        insert_profile(&conn, "p1", "Necromancer");

        // Insert 100 runs in "Pit" — should NOT unlock Baal achievement
        insert_runs(&conn, "p1", "Pit", 100, 60);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 0);
    }

    /// **Validates: Requirements 7.1, 7.2**
    #[test]
    fn test_per_area_no_unlock_below_threshold() {
        let conn = setup_test_db();
        clear_definitions(&conn);
        insert_custom_definition(&conn, "area_pit_10", "per-area", "area_runs", Some("Pit"), 10);
        insert_profile(&conn, "p1", "Necromancer");

        // Insert 9 runs in "Pit" — should NOT unlock
        insert_runs(&conn, "p1", "Pit", 9, 60);
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 0);
    }

    // =========================================================================
    // Property 6: Batch Evaluation Completeness
    // Validates: Requirements 2.1, 2.2, 2.3
    // =========================================================================

    /// **Validates: Requirements 2.1, 2.2, 2.3**
    #[test]
    fn test_batch_evaluation_returns_exact_unlock_count() {
        let conn = setup_test_db();
        clear_definitions(&conn);

        // Set up 3 achievements that should all unlock at once
        insert_custom_definition(&conn, "batch_runs_5", "milestone", "total_runs", None, 5);
        insert_custom_definition(&conn, "batch_items_3", "milestone", "total_items", None, 3);
        insert_custom_definition(&conn, "batch_area_pit_5", "per-area", "area_runs", Some("Pit"), 5);

        insert_profile(&conn, "p1", "Sorceress");
        insert_runs(&conn, "p1", "Pit", 5, 60);
        insert_items(&conn, "p1", 3);

        // Single call should unlock exactly 3 achievements
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 3);

        // Verify the specific achievements unlocked
        let ids: Vec<&str> = unlocks.iter().map(|u| u.definition_id.as_str()).collect();
        assert!(ids.contains(&"batch_runs_5"));
        assert!(ids.contains(&"batch_items_3"));
        assert!(ids.contains(&"batch_area_pit_5"));
    }

    /// **Validates: Requirements 2.2, 2.3**
    #[test]
    fn test_batch_evaluation_no_duplicates_on_second_call() {
        let conn = setup_test_db();
        clear_definitions(&conn);

        insert_custom_definition(&conn, "batch_runs_5", "milestone", "total_runs", None, 5);
        insert_profile(&conn, "p1", "Sorceress");
        insert_runs(&conn, "p1", "Pit", 5, 60);

        // First call unlocks
        let unlocks1 = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks1.len(), 1);

        // Second call should return empty — already unlocked
        let unlocks2 = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks2.len(), 0);
    }

    /// **Validates: Requirements 2.1, 2.3**
    #[test]
    fn test_batch_evaluation_partial_unlock() {
        let conn = setup_test_db();
        clear_definitions(&conn);

        // 2 achievements: one with threshold 5, one with threshold 10
        insert_custom_definition(&conn, "batch_runs_5", "milestone", "total_runs", None, 5);
        insert_custom_definition(&conn, "batch_runs_10", "milestone", "total_runs", None, 10);

        insert_profile(&conn, "p1", "Sorceress");
        insert_runs(&conn, "p1", "Pit", 7, 60);

        // Only the threshold-5 achievement should unlock (7 >= 5, but 7 < 10)
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 1);
        assert_eq!(unlocks[0].definition_id, "batch_runs_5");
    }

    // =========================================================================
    // Property 10: Profile Isolation
    // Validates: Requirements 10.1, 10.2
    // =========================================================================

    /// **Validates: Requirements 10.1, 10.2**
    #[test]
    fn test_profile_isolation_separate_stats() {
        let conn = setup_test_db();
        clear_definitions(&conn);

        insert_custom_definition(&conn, "iso_runs_10", "milestone", "total_runs", None, 10);

        insert_profile(&conn, "p1", "Sorceress");
        insert_profile(&conn, "p2", "Barbarian");

        // Add 10 runs to p1
        insert_runs(&conn, "p1", "Pit", 10, 60);

        // Evaluate for p2 — should return empty (p2 has no runs)
        let unlocks_p2 = evaluate_achievements(&conn, "p2").unwrap();
        assert_eq!(unlocks_p2.len(), 0);

        // Evaluate for p1 — should unlock
        let unlocks_p1 = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks_p1.len(), 1);
        assert_eq!(unlocks_p1[0].definition_id, "iso_runs_10");
    }

    /// **Validates: Requirements 10.1, 10.2**
    #[test]
    fn test_profile_isolation_items_not_shared() {
        let conn = setup_test_db();
        clear_definitions(&conn);

        insert_custom_definition(&conn, "iso_items_5", "milestone", "total_items", None, 5);

        insert_profile(&conn, "p1", "Sorceress");
        insert_profile(&conn, "p2", "Barbarian");

        // Add items only to p1
        insert_items(&conn, "p1", 10);

        // Evaluate for p2 — p2 has no items, should not unlock
        let unlocks_p2 = evaluate_achievements(&conn, "p2").unwrap();
        assert_eq!(unlocks_p2.len(), 0);

        // Evaluate for p1 — should unlock
        let unlocks_p1 = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks_p1.len(), 1);
    }

    /// **Validates: Requirements 10.1, 10.2**
    #[test]
    fn test_profile_isolation_area_runs_not_shared() {
        let conn = setup_test_db();
        clear_definitions(&conn);

        insert_custom_definition(&conn, "iso_area_5", "per-area", "area_runs", Some("Pit"), 5);

        insert_profile(&conn, "p1", "Sorceress");
        insert_profile(&conn, "p2", "Barbarian");

        // Add 5 Pit runs to p1 only
        insert_runs(&conn, "p1", "Pit", 5, 60);

        // p2 should not unlock
        let unlocks_p2 = evaluate_achievements(&conn, "p2").unwrap();
        assert_eq!(unlocks_p2.len(), 0);

        // p1 should unlock
        let unlocks_p1 = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks_p1.len(), 1);
    }

    // =========================================================================
    // Integration: Profile Deletion Cascade
    // Validates: Requirements 10.4
    // =========================================================================

    /// **Validates: Requirements 10.4**
    #[test]
    fn test_profile_deletion_cascades_unlock_records() {
        let conn = setup_test_db();
        clear_definitions(&conn);

        // Set up achievements that will unlock
        insert_custom_definition(&conn, "cascade_runs_5", "milestone", "total_runs", None, 5);
        insert_custom_definition(&conn, "cascade_area_5", "per-area", "area_runs", Some("Pit"), 5);

        insert_profile(&conn, "p1", "Sorceress");
        insert_runs(&conn, "p1", "Pit", 5, 60);

        // Evaluate to create unlock records
        let unlocks = evaluate_achievements(&conn, "p1").unwrap();
        assert_eq!(unlocks.len(), 2, "Expected 2 unlocks before deletion");

        // Verify unlock records exist
        let count_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM achievement_unlocks WHERE profile_id = ?1",
                params!["p1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_before, 2);

        // Delete the profile — FK CASCADE should remove unlock records
        conn.execute("DELETE FROM profiles WHERE id = ?1", params!["p1"])
            .unwrap();

        // Verify unlock records are gone
        let count_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM achievement_unlocks WHERE profile_id = ?1",
                params!["p1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_after, 0, "Unlock records should be deleted when profile is deleted");
    }

    /// **Validates: Requirements 10.4**
    #[test]
    fn test_new_profile_shows_empty_achievement_state() {
        let conn = setup_test_db();
        clear_definitions(&conn);

        // Set up a few definitions so we have achievements to check
        insert_custom_definition(&conn, "empty_runs_100", "milestone", "total_runs", None, 100);
        insert_custom_definition(&conn, "empty_items_50", "milestone", "total_items", None, 50);
        insert_custom_definition(&conn, "empty_area_10", "per-area", "area_runs", Some("Pit"), 10);

        // Create a fresh profile with no runs or items
        insert_profile(&conn, "new_profile", "Paladin");

        // Get achievement progress for this new profile
        let progress = get_achievement_progress(&conn, "new_profile").unwrap();

        // All achievements should be locked with current_value = 0
        assert_eq!(progress.len(), 3, "Should have progress for all 3 definitions");
        for p in &progress {
            assert!(!p.unlocked, "Achievement '{}' should be locked for new profile", p.definition.id);
            assert_eq!(
                p.current_value, 0,
                "Achievement '{}' should have current_value = 0 for new profile",
                p.definition.id
            );
            assert!(p.unlocked_at.is_none(), "Achievement '{}' should have no unlock timestamp", p.definition.id);
        }
    }
}
