use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenshotSettings {
    pub monitoring_enabled: bool,
    pub auto_detection_enabled: bool,
    pub confidence_threshold: u8,
}

impl Default for ScreenshotSettings {
    fn default() -> Self {
        Self {
            monitoring_enabled: false,
            auto_detection_enabled: true,
            confidence_threshold: 80,
        }
    }
}

pub fn create_screenshot_settings_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS screenshot_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            monitoring_enabled INTEGER NOT NULL DEFAULT 0,
            auto_detection_enabled INTEGER NOT NULL DEFAULT 1,
            confidence_threshold INTEGER NOT NULL DEFAULT 80
                CHECK (confidence_threshold >= 50 AND confidence_threshold <= 100)
        );
        ",
    )?;
    Ok(())
}

pub fn get_settings(conn: &Connection) -> ScreenshotSettings {
    let result = conn.query_row(
        "SELECT monitoring_enabled, auto_detection_enabled, confidence_threshold FROM screenshot_settings WHERE id = 1",
        [],
        |row| {
            Ok(ScreenshotSettings {
                monitoring_enabled: row.get::<_, i32>(0)? != 0,
                auto_detection_enabled: row.get::<_, i32>(1)? != 0,
                confidence_threshold: row.get::<_, u8>(2)?,
            })
        },
    );

    match result {
        Ok(settings) => settings,
        Err(_) => ScreenshotSettings::default(),
    }
}

pub fn update_settings(conn: &Connection, settings: &ScreenshotSettings) -> Result<(), String> {
    if settings.confidence_threshold < 50 || settings.confidence_threshold > 100 {
        return Err(format!(
            "confidence_threshold must be between 50 and 100, got {}",
            settings.confidence_threshold
        ));
    }

    conn.execute(
        "INSERT OR REPLACE INTO screenshot_settings (id, monitoring_enabled, auto_detection_enabled, confidence_threshold) VALUES (1, ?1, ?2, ?3)",
        params![
            settings.monitoring_enabled as i32,
            settings.auto_detection_enabled as i32,
            settings.confidence_threshold,
        ],
    )
    .map_err(|e| format!("Failed to update screenshot settings: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        create_screenshot_settings_table(&conn).unwrap();
        conn
    }

    #[test]
    fn test_create_table() {
        let conn = setup_db();
        // Table should exist without errors
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM screenshot_settings", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_get_settings_returns_defaults_when_empty() {
        let conn = setup_db();
        let settings = get_settings(&conn);
        assert!(!settings.monitoring_enabled);
        assert!(settings.auto_detection_enabled);
        assert_eq!(settings.confidence_threshold, 80);
    }

    #[test]
    fn test_update_and_get_settings() {
        let conn = setup_db();
        let settings = ScreenshotSettings {
            monitoring_enabled: true,
            auto_detection_enabled: false,
            confidence_threshold: 75,
        };
        update_settings(&conn, &settings).unwrap();

        let loaded = get_settings(&conn);
        assert!(loaded.monitoring_enabled);
        assert!(!loaded.auto_detection_enabled);
        assert_eq!(loaded.confidence_threshold, 75);
    }

    #[test]
    fn test_update_settings_rejects_threshold_below_50() {
        let conn = setup_db();
        let settings = ScreenshotSettings {
            monitoring_enabled: false,
            auto_detection_enabled: true,
            confidence_threshold: 49,
        };
        let result = update_settings(&conn, &settings);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("between 50 and 100"));
    }

    #[test]
    fn test_update_settings_rejects_threshold_above_100() {
        let conn = setup_db();
        let settings = ScreenshotSettings {
            monitoring_enabled: false,
            auto_detection_enabled: true,
            confidence_threshold: 101,
        };
        let result = update_settings(&conn, &settings);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("between 50 and 100"));
    }

    #[test]
    fn test_update_settings_accepts_boundary_values() {
        let conn = setup_db();

        let settings_50 = ScreenshotSettings {
            monitoring_enabled: false,
            auto_detection_enabled: true,
            confidence_threshold: 50,
        };
        assert!(update_settings(&conn, &settings_50).is_ok());

        let settings_100 = ScreenshotSettings {
            monitoring_enabled: false,
            auto_detection_enabled: true,
            confidence_threshold: 100,
        };
        assert!(update_settings(&conn, &settings_100).is_ok());

        let loaded = get_settings(&conn);
        assert_eq!(loaded.confidence_threshold, 100);
    }

    #[test]
    fn test_update_settings_replaces_existing() {
        let conn = setup_db();

        let settings1 = ScreenshotSettings {
            monitoring_enabled: true,
            auto_detection_enabled: true,
            confidence_threshold: 60,
        };
        update_settings(&conn, &settings1).unwrap();

        let settings2 = ScreenshotSettings {
            monitoring_enabled: false,
            auto_detection_enabled: false,
            confidence_threshold: 90,
        };
        update_settings(&conn, &settings2).unwrap();

        let loaded = get_settings(&conn);
        assert!(!loaded.monitoring_enabled);
        assert!(!loaded.auto_detection_enabled);
        assert_eq!(loaded.confidence_threshold, 90);
    }

    #[test]
    fn test_single_row_constraint() {
        let conn = setup_db();

        // Insert a row via update_settings
        let settings = ScreenshotSettings {
            monitoring_enabled: true,
            auto_detection_enabled: true,
            confidence_threshold: 80,
        };
        update_settings(&conn, &settings).unwrap();

        // Attempting to insert with a different id should fail due to CHECK(id=1)
        let result = conn.execute(
            "INSERT INTO screenshot_settings (id, monitoring_enabled, auto_detection_enabled, confidence_threshold) VALUES (2, 0, 0, 80)",
            [],
        );
        assert!(result.is_err());
    }

    // Feature: screenshot-item-detection, Property 7: Settings threshold validation
    mod property_tests {
        use super::*;
        use proptest::prelude::*;

        proptest! {
            /// **Validates: Requirements 7.3, 7.4**
            ///
            /// For any u8 value, `update_settings` succeeds if and only if 50 ≤ threshold ≤ 100.
            /// Values outside this range are rejected and the previously persisted value remains unchanged.
            #[test]
            fn prop_threshold_validation(threshold in 0u8..=255u8) {
                let conn = Connection::open_in_memory().unwrap();
                create_screenshot_settings_table(&conn).unwrap();

                // First, persist a known valid value so we can verify it remains unchanged on rejection
                let initial = ScreenshotSettings {
                    monitoring_enabled: false,
                    auto_detection_enabled: true,
                    confidence_threshold: 75,
                };
                update_settings(&conn, &initial).unwrap();

                // Attempt to update with the arbitrary threshold
                let settings = ScreenshotSettings {
                    monitoring_enabled: false,
                    auto_detection_enabled: true,
                    confidence_threshold: threshold,
                };
                let result = update_settings(&conn, &settings);

                if threshold >= 50 && threshold <= 100 {
                    prop_assert!(result.is_ok(), "Expected Ok for threshold {}, got Err: {:?}", threshold, result);
                } else {
                    prop_assert!(result.is_err(), "Expected Err for threshold {}, got Ok", threshold);
                    // Verify the previously persisted value remains unchanged
                    let loaded = get_settings(&conn);
                    prop_assert_eq!(loaded.confidence_threshold, 75,
                        "Expected previous value 75 to remain after rejecting threshold {}", threshold);
                }
            }

            /// Feature: screenshot-item-detection, Property 8: Settings persistence round-trip
            /// **Validates: Requirements 7.5**
            ///
            /// For any valid ScreenshotSettings (bool, bool, 50–100), saving settings
            /// to the database and then loading them produces identical values.
            #[test]
            fn prop_settings_round_trip(
                monitoring in proptest::bool::ANY,
                auto_detection in proptest::bool::ANY,
                threshold in 50u8..=100u8,
            ) {
                let conn = Connection::open_in_memory().unwrap();
                create_screenshot_settings_table(&conn).unwrap();
                let settings = ScreenshotSettings {
                    monitoring_enabled: monitoring,
                    auto_detection_enabled: auto_detection,
                    confidence_threshold: threshold,
                };
                update_settings(&conn, &settings).unwrap();
                let loaded = get_settings(&conn);
                prop_assert_eq!(loaded.monitoring_enabled, settings.monitoring_enabled);
                prop_assert_eq!(loaded.auto_detection_enabled, settings.auto_detection_enabled);
                prop_assert_eq!(loaded.confidence_threshold, settings.confidence_threshold);
            }
        }
    }
}
