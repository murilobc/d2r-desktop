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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let db_path = db::get_db_path(&app.handle());
            let conn = Connection::open(db_path).expect("failed to open database");
            conn.execute_batch(
                "PRAGMA foreign_keys = ON;
                 PRAGMA journal_mode = WAL;
                 PRAGMA busy_timeout = 5000;
                 PRAGMA secure_delete = ON;"
            ).expect("failed to set database pragmas");
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
            commands::export_data,
            commands::import_data,
            commands::overlay_action,
            commands::overlay_add_item,
            commands::get_runs_paginated,
            commands::get_custom_areas,
            commands::add_custom_area,
            commands::delete_custom_area,
            commands::write_obs_stats,
            commands::get_obs_file_path,
            commands::create_route,
            commands::get_routes,
            commands::update_route,
            commands::delete_route,
            commands::get_route_stats,
            commands::get_comparison,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
