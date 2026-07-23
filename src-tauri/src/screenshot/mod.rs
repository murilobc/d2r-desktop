pub mod settings;
pub mod matcher;
pub mod parser;
pub mod ocr;
pub mod monitor;

use std::sync::{Arc, Mutex};
use tauri::State;

use crate::db::DbState;
use monitor::ClipboardMonitor;
use settings::ScreenshotSettings;

/// Managed state wrapping an optional running ClipboardMonitor instance.
/// The monitor is `Some` when clipboard monitoring is active, `None` when stopped.
pub struct MonitorState(pub Arc<Mutex<Option<ClipboardMonitor>>>);

/// Returns the current screenshot detection settings from the database.
#[tauri::command]
pub fn get_screenshot_settings(state: State<DbState>) -> Result<ScreenshotSettings, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
    Ok(settings::get_settings(&conn))
}

/// Validates and persists updated screenshot settings, starting or stopping
/// the clipboard monitor within 1 second when the monitoring toggle changes.
#[tauri::command]
pub fn update_screenshot_settings(
    state: State<DbState>,
    monitor_state: State<MonitorState>,
    app: tauri::AppHandle,
    settings: ScreenshotSettings,
) -> Result<ScreenshotSettings, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    // Read old settings to detect monitoring toggle change
    let old_settings = settings::get_settings(&conn);

    // Validate and persist new settings
    settings::update_settings(&conn, &settings)?;

    // Start/stop monitor based on toggle change
    let mut monitor = monitor_state
        .0
        .lock()
        .map_err(|e| format!("Monitor lock failed: {}", e))?;

    if settings.monitoring_enabled && !old_settings.monitoring_enabled {
        // Starting monitoring
        let new_monitor = ClipboardMonitor::start(app, settings.clone());
        *monitor = Some(new_monitor);
    } else if !settings.monitoring_enabled && old_settings.monitoring_enabled {
        // Stopping monitoring
        if let Some(m) = monitor.take() {
            m.stop();
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
