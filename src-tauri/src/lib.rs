mod commands;
mod db;
mod models;

use db::{init_db, DbState};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db_path = db::get_db_path(&app.handle());
            let conn = Connection::open(db_path).expect("failed to open database");
            conn.execute_batch("PRAGMA foreign_keys = ON;")
                .expect("failed to enable foreign keys");
            init_db(&conn).expect("failed to initialize database");
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_profile,
            commands::get_profiles,
            commands::update_profile,
            commands::delete_profile,
            commands::create_run,
            commands::get_runs,
            commands::finish_run,
            commands::update_run_area,
            commands::delete_run,
            commands::create_item,
            commands::get_items,
            commands::get_all_items,
            commands::delete_item,
            commands::get_stats,
            commands::get_detailed_runs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
