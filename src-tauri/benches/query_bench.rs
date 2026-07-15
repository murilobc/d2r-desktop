use criterion::{criterion_group, criterion_main, Criterion};
use rusqlite::Connection;

/// Initialize the database schema (mirrors db.rs init_db).
fn init_schema(conn: &Connection) {
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            class TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'Ladder',
            magic_find INTEGER DEFAULT NULL,
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
            player_count INTEGER DEFAULT NULL,
            route_id TEXT DEFAULT NULL,
            route_step_index INTEGER DEFAULT NULL,
            tags TEXT DEFAULT NULL,
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

        CREATE TABLE IF NOT EXISTS routes (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            name TEXT NOT NULL,
            areas TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_runs_profile_status ON runs(profile_id, status);
        CREATE INDEX IF NOT EXISTS idx_runs_profile_area ON runs(profile_id, area);
        CREATE INDEX IF NOT EXISTS idx_runs_profile_started ON runs(profile_id, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_run ON items(run_id);
        CREATE INDEX IF NOT EXISTS idx_items_profile ON items(profile_id);
        CREATE INDEX IF NOT EXISTS idx_routes_profile ON routes(profile_id);
        ",
    )
    .expect("Failed to initialize schema");
}

/// Seed the database with `row_count` runs and approximately 2 items per run.
fn setup_db(row_count: usize) -> Connection {
    let conn = Connection::open_in_memory().expect("Failed to open in-memory DB");
    init_schema(&conn);

    let profile_id = "profile_bench";

    // Insert the benchmark profile
    conn.execute(
        "INSERT INTO profiles (id, name, class, mode, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![profile_id, "Bench Profile", "Sorceress", "Ladder", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"],
    )
    .expect("Failed to insert profile");

    // Insert a route for the profile
    conn.execute(
        "INSERT INTO routes (id, profile_id, name, areas, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params!["route_1", profile_id, "MF Route", "[\"Ancient Tunnels\",\"Chaos Sanctuary\"]", "2024-01-01T00:00:00Z"],
    )
    .expect("Failed to insert route");

    let areas = [
        "Ancient Tunnels",
        "Chaos Sanctuary",
        "The Pit",
        "Travincal",
        "Worldstone Keep",
    ];
    let rarities = ["Unique", "Set", "Rare", "Magic", "Normal"];
    let item_types = ["Armor", "Weapon", "Ring", "Amulet", "Charm"];

    // Batch inserts using a transaction for speed
    conn.execute_batch("BEGIN TRANSACTION")
        .expect("Failed to begin transaction");

    for i in 0..row_count {
        let run_id = format!("run_{}", i);
        let area = areas[i % areas.len()];
        let duration = 60 + (i % 300) as i64;
        let started_at = format!("2024-01-{:02}T{:02}:{:02}:00Z", (i % 28) + 1, (i % 24), (i % 60));

        conn.execute(
            "INSERT INTO runs (id, profile_id, area, duration_secs, started_at, finished_at, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'completed')",
            rusqlite::params![run_id, profile_id, area, duration, started_at, started_at],
        )
        .expect("Failed to insert run");

        // Insert ~2 items per run
        for j in 0..2 {
            let item_id = format!("item_{}_{}", i, j);
            let rarity = rarities[(i + j) % rarities.len()];
            let item_type = item_types[(i + j) % item_types.len()];

            conn.execute(
                "INSERT INTO items (id, run_id, profile_id, name, item_type, rarity, found_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![item_id, run_id, profile_id, format!("Item {}", i * 2 + j), item_type, rarity, started_at],
            )
            .expect("Failed to insert item");
        }
    }

    conn.execute_batch("COMMIT").expect("Failed to commit");
    conn
}

/// Replicate the get_stats_combined query logic from commands.rs.
/// Queries summary stats, detailed runs with items, and routes.
fn query_stats_combined(conn: &Connection, profile_id: &str, area_filter: Option<&str>) {
    // Summary stats
    let _total_runs: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed'",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .unwrap();

    let _total_items: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE profile_id = ?1",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .unwrap();

    let _total_time_secs: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_secs), 0) FROM runs WHERE profile_id = ?1 AND status = 'completed'",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .unwrap();

    // Items by rarity
    let mut stmt = conn
        .prepare("SELECT rarity, COUNT(*) FROM items WHERE profile_id = ?1 GROUP BY rarity ORDER BY COUNT(*) DESC")
        .unwrap();
    let _items_by_rarity: Vec<(String, i64)> = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    // Runs by area
    let mut stmt = conn
        .prepare("SELECT area, COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed' GROUP BY area ORDER BY COUNT(*) DESC")
        .unwrap();
    let _runs_by_area: Vec<(String, i64)> = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    // Detailed runs (with area filter support)
    let runs: Vec<(String, String, String, i64, String, Option<String>, String)> = if let Some(area) = area_filter {
        let mut stmt = conn
            .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status FROM runs WHERE profile_id = ?1 AND status = 'completed' AND area = ?2 ORDER BY started_at DESC")
            .unwrap();
        stmt.query_map(rusqlite::params![profile_id, area], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap()
    } else {
        let mut stmt = conn
            .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status FROM runs WHERE profile_id = ?1 AND status = 'completed' ORDER BY started_at DESC")
            .unwrap();
        stmt.query_map(rusqlite::params![profile_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap()
    };

    // Fetch items for each run
    for (run_id, _, _, _, _, _, _) in &runs {
        let mut stmt = conn
            .prepare("SELECT id, run_id, profile_id, name, item_type, rarity, found_at, notes FROM items WHERE run_id = ?1 ORDER BY found_at ASC")
            .unwrap();
        let _items: Vec<(String, String, String, String, String, String, String, Option<String>)> = stmt
            .query_map(rusqlite::params![run_id], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                ))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
    }

    // Routes
    let mut stmt = conn
        .prepare("SELECT id, profile_id, name, areas, created_at FROM routes WHERE profile_id = ?1 ORDER BY created_at DESC")
        .unwrap();
    let _routes: Vec<(String, String, String, String, String)> = stmt
        .query_map(rusqlite::params![profile_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
}

/// Replicate the get_runs_paginated query logic from commands.rs.
fn query_runs_paginated(conn: &Connection, profile_id: &str, offset: i64, limit: i64) {
    let _total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM runs WHERE profile_id = ?1 AND status = 'completed'",
            rusqlite::params![profile_id],
            |row| row.get(0),
        )
        .unwrap();

    let mut stmt = conn
        .prepare("SELECT id, profile_id, area, duration_secs, started_at, finished_at, status, notes, player_count, route_id, route_step_index, tags FROM runs WHERE profile_id = ?1 AND status = 'completed' ORDER BY started_at DESC LIMIT ?2 OFFSET ?3")
        .unwrap();

    let _runs: Vec<(String, String, String, i64, String, Option<String>, String, Option<String>, Option<i64>, Option<String>, Option<i64>, Option<String>)> = stmt
        .query_map(rusqlite::params![profile_id, limit, offset], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
                row.get(11)?,
            ))
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
}

fn bench_stats_combined(c: &mut Criterion) {
    let conn_10k = setup_db(10_000);
    let conn_50k = setup_db(50_000);
    let conn_100k = setup_db(100_000);

    let mut group = c.benchmark_group("stats_combined");
    group.sample_size(10); // Reduce sample size for large DBs

    group.bench_function("10k_rows", |b| {
        b.iter(|| query_stats_combined(&conn_10k, "profile_bench", None))
    });
    group.bench_function("50k_rows", |b| {
        b.iter(|| query_stats_combined(&conn_50k, "profile_bench", None))
    });
    group.bench_function("100k_rows", |b| {
        b.iter(|| query_stats_combined(&conn_100k, "profile_bench", None))
    });

    group.finish();
}

fn bench_paginated_runs(c: &mut Criterion) {
    let conn_10k = setup_db(10_000);
    let conn_50k = setup_db(50_000);
    let conn_100k = setup_db(100_000);

    let mut group = c.benchmark_group("paginated_runs");
    group.sample_size(10);

    group.bench_function("10k_rows", |b| {
        b.iter(|| query_runs_paginated(&conn_10k, "profile_bench", 0, 100))
    });
    group.bench_function("50k_rows", |b| {
        b.iter(|| query_runs_paginated(&conn_50k, "profile_bench", 0, 100))
    });
    group.bench_function("100k_rows", |b| {
        b.iter(|| query_runs_paginated(&conn_100k, "profile_bench", 0, 100))
    });

    group.finish();
}

criterion_group!(benches, bench_stats_combined, bench_paginated_runs);
criterion_main!(benches);
