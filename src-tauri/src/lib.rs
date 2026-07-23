mod achievements;
mod commands;
mod coop;
mod db;
mod drop_commands;
mod models;
mod probability_engine;
mod sync;

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
            app.manage(coop::CoopState {
                server: std::sync::Mutex::new(None),
                client: std::sync::Mutex::new(None),
            });
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
            commands::update_run_tags,
            commands::delete_run,
            commands::create_item,
            commands::get_items,
            commands::get_all_items,
            commands::delete_item,
            commands::get_stats,
            commands::get_stats_combined,
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
            commands::create_herald_encounter,
            commands::get_herald_encounters,
            commands::get_herald_stats,
            commands::delete_herald_encounter,
            // Colossal Ancients
            commands::create_ancient_attempt,
            commands::get_ancient_attempts,
            commands::get_ancient_stats,
            commands::delete_ancient_attempt,
            // Diablo Clone
            commands::get_dclone_progress,
            commands::update_dclone_progress,
            commands::create_anni_log,
            commands::get_anni_logs,
            commands::delete_anni_log,
            // XP Tracking
            commands::create_xp_entry,
            commands::get_xp_entries,
            commands::get_xp_stats,
            commands::delete_xp_entry,
            // Keybind Profiles
            commands::create_keybind_profile,
            commands::get_keybind_profiles,
            commands::update_keybind_profile,
            commands::delete_keybind_profile,
            // Backup Scheduler
            commands::run_auto_backup,
            commands::cleanup_old_backups,
            // Database Maintenance
            commands::vacuum_database,
            // Co-op
            coop::start_coop_server,
            coop::stop_coop_server,
            coop::join_coop_session,
            coop::leave_coop_session,
            coop::coop_split_run,
            coop::coop_pause,
            coop::coop_end_session,
            coop::coop_log_item,
            coop::get_coop_state,
            // Cloud Sync
            sync::save_sync_token,
            sync::get_sync_token,
            sync::delete_sync_token,
            sync::github_gist_pull,
            sync::github_gist_push,
            sync::github_gist_test,
            sync::local_file_pull,
            sync::local_file_push,
            sync::local_folder_validate,
            // Achievements
            commands::evaluate_achievements,
            commands::get_achievement_definitions,
            commands::get_achievement_progress,
            commands::get_lifetime_stats,
            // Rune Inventory & Runeword Planner
            commands::get_rune_inventory,
            commands::update_rune_count,
            commands::set_rune_count,
            commands::get_runeword_targets,
            commands::add_runeword_target,
            commands::remove_runeword_target,
            // Drop Probability Engine
            drop_commands::calculate_drop_probability,
            drop_commands::calculate_cumulative_distribution,
            drop_commands::calculate_area_drop_probability,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
