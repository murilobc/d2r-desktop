pub mod color_detector;
pub mod folder_watcher;
pub mod settings;
pub mod matcher;
pub mod parser;
pub mod ocr;
pub mod monitor;

#[cfg(test)]
mod preservation_tests;
#[cfg(test)]
mod bug_exploration_tests;

use std::sync::{Arc, Mutex};
use tauri::State;

use crate::db::DbState;
use folder_watcher::FolderWatcher;
use monitor::ClipboardMonitor;
use settings::ScreenshotSettings;

/// Managed state wrapping an optional running ClipboardMonitor instance.
/// The monitor is `Some` when clipboard monitoring is active, `None` when stopped.
pub struct MonitorState(pub Arc<Mutex<Option<ClipboardMonitor>>>);

/// Managed state wrapping an optional running FolderWatcher instance.
/// The watcher is `Some` when folder monitoring is active, `None` when stopped.
pub struct FolderWatcherState(pub Arc<Mutex<Option<FolderWatcher>>>);

/// Returns the current screenshot detection settings from the database.
#[tauri::command]
pub fn get_screenshot_settings(state: State<DbState>) -> Result<ScreenshotSettings, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
    Ok(settings::get_settings(&conn))
}

/// Returns the auto-detected D2R screenshots folder path, or None if not found.
#[tauri::command]
pub fn get_default_screenshot_folder() -> Result<Option<String>, String> {
    Ok(FolderWatcher::resolve_default_path().map(|p| p.to_string_lossy().to_string()))
}

/// Triggers detection from a specific image file on disk.
/// Validates file exists and is readable, then runs the detection pipeline.
#[tauri::command]
pub async fn detect_from_file(
    path: String,
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !file_path.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    let image_data =
        std::fs::read(file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let settings = {
        let conn = state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
        settings::get_settings(&conn)
    };

    ClipboardMonitor::process_image(&app, &image_data, &settings);
    Ok(())
}

/// Validates and persists updated screenshot settings, starting or stopping
/// the clipboard monitor within 1 second when the monitoring toggle changes.
#[tauri::command]
pub async fn update_screenshot_settings(
    state: State<'_, DbState>,
    monitor_state: State<'_, MonitorState>,
    folder_watcher_state: State<'_, FolderWatcherState>,
    app: tauri::AppHandle,
    settings: ScreenshotSettings,
) -> Result<ScreenshotSettings, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    // Read old settings to detect monitoring toggle change
    let old_settings = settings::get_settings(&conn);

    // Validate and persist new settings
    settings::update_settings(&conn, &settings)?;

    // Start/stop clipboard monitor based on toggle change
    let mut monitor = monitor_state
        .0
        .lock()
        .map_err(|e| format!("Monitor lock failed: {}", e))?;

    if settings.monitoring_enabled && !old_settings.monitoring_enabled {
        // Starting monitoring
        let new_monitor = ClipboardMonitor::start(app.clone(), settings.clone());
        *monitor = Some(new_monitor);
    } else if !settings.monitoring_enabled && old_settings.monitoring_enabled {
        // Stopping monitoring
        if let Some(m) = monitor.take() {
            m.stop();
        }
    }

    // Start/stop folder watcher based on toggle change
    let mut watcher = folder_watcher_state
        .0
        .lock()
        .map_err(|e| format!("FolderWatcher lock failed: {}", e))?;

    if settings.folder_monitoring_enabled && !old_settings.folder_monitoring_enabled {
        // Enabling folder monitoring: resolve path and start watcher
        let folder_path = if let Some(ref custom_path) = settings.screenshot_folder_path {
            let p = std::path::PathBuf::from(custom_path);
            if !p.is_dir() {
                return Err(format!(
                    "Screenshots folder not found: {}",
                    custom_path
                ));
            }
            p
        } else {
            FolderWatcher::resolve_default_path().ok_or_else(|| {
                "Screenshots folder not found: could not auto-detect D2R screenshots folder"
                    .to_string()
            })?
        };

        let new_watcher = FolderWatcher::start(app.clone(), folder_path, settings.clone());
        *watcher = Some(new_watcher);
    } else if !settings.folder_monitoring_enabled && old_settings.folder_monitoring_enabled {
        // Disabling folder monitoring: stop watcher
        if let Some(w) = watcher.take() {
            w.stop();
        }
    }

    Ok(settings)
}

/// Triggers a one-shot detection from the current clipboard image content.
/// Used for the manual "Detect from Screenshot" button.
#[tauri::command]
pub async fn detect_from_clipboard(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let settings = {
        let conn = state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
        settings::get_settings(&conn)
    };

    ClipboardMonitor::detect_once(&app, &settings)
}

/// Polls the watched folder for new screenshot files and processes them through
/// the detection pipeline. Used by the frontend when manual detection is triggered
/// and folder monitoring is enabled — complements `detect_from_clipboard`.
#[tauri::command]
pub async fn detect_from_folder(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
    folder_watcher_state: State<'_, FolderWatcherState>,
) -> Result<(), String> {
    let settings = {
        let conn = state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
        settings::get_settings(&conn)
    };

    let watcher_guard = folder_watcher_state
        .0
        .lock()
        .map_err(|e| format!("FolderWatcher lock failed: {}", e))?;

    let watcher = match watcher_guard.as_ref() {
        Some(w) => w,
        None => return Ok(()), // No active folder watcher — nothing to do
    };

    let new_files = watcher.poll_new_files();

    for file_path in new_files {
        let image_data =
            std::fs::read(&file_path).map_err(|e| format!("Failed to read file {:?}: {}", file_path, e))?;
        ClipboardMonitor::process_image(&app, &image_data, &settings);
    }

    Ok(())
}

/// Finds the most recently modified .jpg/.png in the configured screenshots folder
/// and processes it through the detection pipeline.
///
/// Unlike `detect_from_folder` (which requires the watcher baseline), this command
/// always picks the newest file by mtime regardless of when the watcher started.
/// Used by the manual "Detect Screenshot" button and the detect keybind so that
/// Print Screen saves are picked up reliably.
#[tauri::command]
pub async fn detect_latest_folder_file(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<bool, String> {
    let settings = {
        let conn = state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
        settings::get_settings(&conn)
    };

    if !settings.folder_monitoring_enabled {
        return Ok(false);
    }

    let folder_path = if let Some(ref custom_path) = settings.screenshot_folder_path {
        let p = std::path::PathBuf::from(custom_path);
        if p.is_dir() { p } else { return Ok(false); }
    } else {
        match folder_watcher::FolderWatcher::resolve_default_path() {
            Some(p) => p,
            None => return Ok(false),
        }
    };

    // Find the most recently modified .jpg / .png in the folder
    let entries = std::fs::read_dir(&folder_path)
        .map_err(|e| format!("Cannot read folder {:?}: {}", folder_path, e))?;

    let mut newest: Option<(std::path::PathBuf, std::time::SystemTime)> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() { continue; }
        let ext = path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase());
        if !matches!(ext.as_deref(), Some("jpg") | Some("png")) { continue; }
        if let Ok(meta) = entry.metadata() {
            if let Ok(modified) = meta.modified() {
                match &newest {
                    None => { newest = Some((path, modified)); }
                    Some((_, best)) if modified > *best => { newest = Some((path, modified)); }
                    _ => {}
                }
            }
        }
    }

    match newest {
        None => Ok(false),
        Some((file_path, _)) => {
            let image_data = std::fs::read(&file_path)
                .map_err(|e| format!("Failed to read {:?}: {}", file_path, e))?;
            ClipboardMonitor::process_image(&app, &image_data, &settings);
            Ok(true)
        }
    }
}
