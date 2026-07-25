//! Preservation property tests for clipboard-monitor-crash-fix.
//!
//! These tests verify that behaviors NOT involving the bug condition
//! (toggling monitoring from OFF to ON) remain unchanged. They exercise:
//! - Toggle OFF: stopping a monitor sets is_running() to false
//! - Settings persistence: non-toggle updates persist correctly
//! - Read settings: get_settings returns whatever was last persisted
//!
//! **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

#[cfg(test)]
mod preservation_property_tests {
    use proptest::prelude::*;
    use rusqlite::Connection;

    use crate::screenshot::monitor::ClipboardMonitor;
    use crate::screenshot::settings::{
        create_screenshot_settings_table, get_settings, update_settings, ScreenshotSettings,
    };

    /// Helper: create an in-memory SQLite database with the screenshot_settings table.
    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        create_screenshot_settings_table(&conn).unwrap();
        conn
    }

    // =========================================================================
    // Property: Toggle OFF preservation
    // For any running monitor, calling stop() sets is_running() to false.
    // **Validates: Requirements 3.1**
    // =========================================================================

    #[test]
    fn test_stop_sets_running_to_false() {
        let monitor = ClipboardMonitor::new_running_for_test();
        assert!(monitor.is_running(), "Monitor should start as running");

        monitor.stop();
        assert!(
            !monitor.is_running(),
            "Monitor should not be running after stop()"
        );
    }

    #[test]
    fn test_stop_is_idempotent() {
        let monitor = ClipboardMonitor::new_running_for_test();
        monitor.stop();
        monitor.stop(); // calling stop again should not panic
        assert!(!monitor.is_running());
    }

    // =========================================================================
    // Property: Settings persistence preservation
    // For any valid ScreenshotSettings where monitoring_enabled does NOT change
    // from false to true, update_settings persists and get_settings returns
    // the same values.
    // **Validates: Requirements 3.2**
    // =========================================================================

    proptest! {
        /// For any valid settings where monitoring stays OFF or goes from ON to OFF,
        /// update_settings persists correctly and get_settings returns the same values.
        #[test]
        fn prop_settings_persistence_non_toggle_on(
            monitoring_enabled in proptest::bool::ANY,
            auto_detection in proptest::bool::ANY,
            threshold in 50u8..=100u8,
            old_monitoring in proptest::bool::ANY,
        ) {
            // Skip the bug condition: new=true AND old=false (toggle ON)
            // We only test inputs where isBugCondition is false:
            // - monitoring_enabled=false (any old state)
            // - monitoring_enabled=true AND old_monitoring=true (already on, no toggle)
            prop_assume!(!(monitoring_enabled && !old_monitoring));

            let conn = setup_db();

            // Set up old state
            let old_settings = ScreenshotSettings {
                monitoring_enabled: old_monitoring,
                auto_detection_enabled: true,
                confidence_threshold: 80,
                folder_monitoring_enabled: false,
                screenshot_folder_path: None,
            };
            update_settings(&conn, &old_settings).unwrap();

            // Apply new settings (non-bug-condition)
            let new_settings = ScreenshotSettings {
                monitoring_enabled,
                auto_detection_enabled: auto_detection,
                confidence_threshold: threshold,
                folder_monitoring_enabled: false,
                screenshot_folder_path: None,
            };
            let result = update_settings(&conn, &new_settings);
            prop_assert!(result.is_ok(), "update_settings should succeed for valid inputs");

            // Verify persistence round-trip
            let loaded = get_settings(&conn);
            prop_assert_eq!(loaded.monitoring_enabled, new_settings.monitoring_enabled,
                "monitoring_enabled should persist correctly");
            prop_assert_eq!(loaded.auto_detection_enabled, new_settings.auto_detection_enabled,
                "auto_detection_enabled should persist correctly");
            prop_assert_eq!(loaded.confidence_threshold, new_settings.confidence_threshold,
                "confidence_threshold should persist correctly");
        }

        /// Settings updates that only change non-toggle fields (confidence, auto_detection)
        /// while keeping monitoring_enabled the same should persist without error.
        /// **Validates: Requirements 3.2**
        #[test]
        fn prop_non_toggle_settings_persist_correctly(
            auto_detection in proptest::bool::ANY,
            threshold in 50u8..=100u8,
            monitoring_state in proptest::bool::ANY,
        ) {
            let conn = setup_db();

            // Set initial state with monitoring in some state
            let initial = ScreenshotSettings {
                monitoring_enabled: monitoring_state,
                auto_detection_enabled: true,
                confidence_threshold: 80,
                folder_monitoring_enabled: false,
                screenshot_folder_path: None,
            };
            update_settings(&conn, &initial).unwrap();

            // Update only non-toggle fields (monitoring stays the same)
            let updated = ScreenshotSettings {
                monitoring_enabled: monitoring_state, // same — no toggle
                auto_detection_enabled: auto_detection,
                confidence_threshold: threshold,
                folder_monitoring_enabled: false,
                screenshot_folder_path: None,
            };
            let result = update_settings(&conn, &updated);
            prop_assert!(result.is_ok());

            let loaded = get_settings(&conn);
            prop_assert_eq!(loaded.monitoring_enabled, monitoring_state);
            prop_assert_eq!(loaded.auto_detection_enabled, auto_detection);
            prop_assert_eq!(loaded.confidence_threshold, threshold);
        }
    }

    // =========================================================================
    // Property: Read settings preservation
    // get_settings returns whatever was last persisted (or defaults if nothing persisted).
    // **Validates: Requirements 3.4**
    // =========================================================================

    proptest! {
        /// For any sequence of valid settings updates, get_settings always returns
        /// the most recently persisted value.
        #[test]
        fn prop_read_settings_returns_last_persisted(
            settings_sequence in proptest::collection::vec(
                (proptest::bool::ANY, proptest::bool::ANY, 50u8..=100u8),
                1..5
            ),
        ) {
            let conn = setup_db();

            let mut last_settings = ScreenshotSettings::default();
            for (monitoring, auto_detect, threshold) in &settings_sequence {
                let s = ScreenshotSettings {
                    monitoring_enabled: *monitoring,
                    auto_detection_enabled: *auto_detect,
                    confidence_threshold: *threshold,
                    folder_monitoring_enabled: false,
                    screenshot_folder_path: None,
                };
                update_settings(&conn, &s).unwrap();
                last_settings = s;
            }

            let loaded = get_settings(&conn);
            prop_assert_eq!(loaded.monitoring_enabled, last_settings.monitoring_enabled,
                "Should return last persisted monitoring_enabled");
            prop_assert_eq!(loaded.auto_detection_enabled, last_settings.auto_detection_enabled,
                "Should return last persisted auto_detection_enabled");
            prop_assert_eq!(loaded.confidence_threshold, last_settings.confidence_threshold,
                "Should return last persisted confidence_threshold");
        }
    }

    /// get_settings returns defaults when no settings have been persisted.
    /// **Validates: Requirements 3.4**
    #[test]
    fn test_read_settings_returns_defaults_when_empty() {
        let conn = setup_db();
        let settings = get_settings(&conn);
        assert!(!settings.monitoring_enabled);
        assert!(settings.auto_detection_enabled);
        assert_eq!(settings.confidence_threshold, 80);
    }
}
