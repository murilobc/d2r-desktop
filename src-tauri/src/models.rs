use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub class: String,
    pub mode: String,
    pub magic_find: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateProfileInput {
    pub name: String,
    pub class: String,
    pub mode: String,
    pub magic_find: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateProfileInput {
    pub name: Option<String>,
    pub class: Option<String>,
    pub mode: Option<String>,
    pub magic_find: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Run {
    pub id: String,
    pub profile_id: String,
    pub area: String,
    pub duration_secs: i64,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub player_count: Option<i64>,
    pub route_id: Option<String>,
    pub route_step_index: Option<i64>,
    pub tags: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateRunInput {
    pub profile_id: String,
    pub area: String,
    pub notes: Option<String>,
    pub player_count: Option<i64>,
    pub route_id: Option<String>,
    pub route_step_index: Option<i64>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinishRunInput {
    pub duration_secs: i64,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRunTagsInput {
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Item {
    pub id: String,
    pub run_id: String,
    pub profile_id: String,
    pub name: String,
    pub item_type: String,
    pub rarity: String,
    pub found_at: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateItemInput {
    pub run_id: String,
    pub profile_id: String,
    pub name: String,
    pub item_type: String,
    pub rarity: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Stats {
    pub total_runs: i64,
    pub total_items: i64,
    pub total_time_secs: i64,
    pub avg_run_duration_secs: f64,
    pub items_per_run: f64,
    pub items_by_rarity: Vec<RarityCount>,
    pub runs_by_area: Vec<AreaCount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RarityCount {
    pub rarity: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AreaCount {
    pub area: String,
    pub count: i64,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailedRun {
    pub run: Run,
    pub items: Vec<Item>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CombinedStats {
    pub summary: Stats,
    pub detailed_runs: Vec<DetailedRun>,
    pub routes: Vec<Route>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportData {
    pub version: String,
    pub exported_at: String,
    pub profiles: Vec<Profile>,
    pub runs: Vec<Run>,
    pub items: Vec<Item>,
    pub templates: Option<Vec<Template>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub profiles_imported: i64,
    pub runs_imported: i64,
    pub items_imported: i64,
    pub skipped: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginatedRuns {
    pub runs: Vec<Run>,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomArea {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub created_at: String,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Route {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub areas: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateRouteInput {
    pub profile_id: String,
    pub name: String,
    pub areas: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateRouteInput {
    pub name: String,
    pub areas: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RouteStats {
    pub route_id: String,
    pub route_name: String,
    pub total_cycles: i64,
    pub avg_cycle_time_secs: f64,
    pub total_items: i64,
    pub items_per_cycle: f64,
}

// ===== QUICK-START TEMPLATES =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Template {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub area: String,
    pub player_count: i64,
    pub route_id: Option<String>,
    pub session_goal_type: String,    // "none" | "runs" | "time"
    pub session_goal_value: Option<i64>,
    pub tags: Option<String>,         // JSON array string, e.g. '["mf","tz"]'
    pub last_used_at: Option<String>, // ISO 8601 timestamp
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateTemplateInput {
    pub profile_id: String,
    pub name: String,
    pub area: String,
    pub player_count: i64,
    pub route_id: Option<String>,
    pub session_goal_type: String,
    pub session_goal_value: Option<i64>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateTemplateInput {
    pub name: String,
    pub area: String,
    pub player_count: i64,
    pub route_id: Option<String>,
    pub session_goal_type: String,
    pub session_goal_value: Option<i64>,
    pub tags: Option<Vec<String>>,
}

// ===== COMPARISON MODE =====

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ComparisonRequest {
    #[serde(rename = "area")]
    Area {
        profile_id: String,
        area_a: String,
        area_b: String,
    },
    #[serde(rename = "date_range")]
    DateRange {
        profile_id: String,
        start_a: String,
        end_a: String,
        start_b: String,
        end_b: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubjectMetrics {
    pub label: String,
    pub total_runs: i64,
    pub total_items: i64,
    pub total_unique_items: i64,
    pub total_duration_secs: i64,
    pub items_per_hour: f64,
    pub unique_items_per_hour: f64,
    pub items_per_run: f64,
    pub avg_time_per_run: f64,
    pub fastest_run_secs: Option<i64>,
    pub slowest_run_secs: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComparisonResult {
    pub subject_a: SubjectMetrics,
    pub subject_b: SubjectMetrics,
}

// ===== HERALD TRACKING =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeraldEncounter {
    pub id: String,
    pub profile_id: String,
    pub tier: i64,
    pub area: String,
    pub result: String,
    pub sunder_charm: Option<String>,
    pub notes: Option<String>,
    pub encountered_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateHeraldEncounterInput {
    pub profile_id: String,
    pub tier: i64,
    pub area: String,
    pub result: String,
    pub sunder_charm: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeraldStats {
    pub total_encounters: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub encounters_by_tier: Vec<TierCount>,
    pub sunder_charms_found: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TierCount {
    pub tier: i64,
    pub count: i64,
    pub successes: i64,
}

// ===== COLOSSAL ANCIENTS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColossalAncientAttempt {
    pub id: String,
    pub profile_id: String,
    pub boss_name: String,
    pub attempt_number: i64,
    pub result: String,
    pub drops: Option<String>,
    pub duration_secs: i64,
    pub notes: Option<String>,
    pub attempted_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateColossalAttemptInput {
    pub profile_id: String,
    pub boss_name: String,
    pub result: String,
    pub drops: Option<String>,
    pub duration_secs: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColossalAncientStats {
    pub total_attempts: i64,
    pub total_successes: i64,
    pub bosses_defeated: Vec<String>,
    pub stats_by_boss: Vec<BossStats>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BossStats {
    pub boss_name: String,
    pub attempts: i64,
    pub successes: i64,
    pub best_time_secs: Option<i64>,
    pub avg_time_secs: f64,
}

// ===== DIABLO CLONE TRACKER =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DCloneProgress {
    pub region: String,
    pub progress: i64,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnniLog {
    pub id: String,
    pub profile_id: String,
    pub stats: String,
    pub notes: Option<String>,
    pub obtained_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateAnniLogInput {
    pub profile_id: String,
    pub stats: String,
    pub notes: Option<String>,
}

// ===== KEYBIND PROFILES =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KeybindProfile {
    pub id: String,
    pub name: String,
    pub bindings: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateKeybindProfileInput {
    pub name: String,
    pub bindings: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateKeybindProfileInput {
    pub name: String,
    pub bindings: String,
}

// ===== XP TRACKING =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XpEntry {
    pub id: String,
    pub profile_id: String,
    pub run_id: Option<String>,
    pub level: i64,
    pub xp_gained: i64,
    pub duration_secs: i64,
    pub area: Option<String>,
    pub notes: Option<String>,
    pub recorded_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateXpEntryInput {
    pub profile_id: String,
    pub run_id: Option<String>,
    pub level: i64,
    pub xp_gained: i64,
    pub duration_secs: i64,
    pub area: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XpStats {
    pub total_xp: i64,
    pub total_time_secs: i64,
    pub xp_per_hour: f64,
    pub entries_count: i64,
    pub avg_xp_per_session: f64,
}

// ===== CO-OP TRACKING =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoopServerInfo {
    pub session_code: String,
    pub host_ip: String,
    pub port: u16,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct SessionState {
    pub session_code: String,
    pub host_player: String,
    pub players: Vec<PlayerInfo>,
    pub run_count: u32,
    pub elapsed_secs: u64,
    pub paused: bool,
    pub items: Vec<CoopItemData>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PlayerInfo {
    pub name: String,
    pub profile_id: String,
    pub status: String,  // "connected" | "disconnected"
    pub items_found: u32,
    pub runs_contributed: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CoopItemData {
    pub id: String,
    pub name: String,
    pub item_type: String,
    pub rarity: String,
    pub player_name: String,
    pub found_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoopItemInput {
    pub name: String,
    pub item_type: String,
    pub rarity: String,
}

// ===== DATABASE MAINTENANCE =====

#[derive(Debug, Serialize, Clone)]
pub struct VacuumResult {
    pub size_before_bytes: u64,
    pub size_after_bytes: u64,
    pub success: bool,
}

// ===== ACHIEVEMENTS =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AchievementDefinition {
    pub id: String,
    pub category: String,
    pub name_key: String,
    pub description_key: String,
    pub icon: String,
    pub condition_type: String,
    pub condition_target: Option<String>,
    pub threshold: i64,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AchievementUnlock {
    pub id: String,
    pub profile_id: String,
    pub definition_id: String,
    pub unlocked_at: String,
    pub definition: AchievementDefinition,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AchievementProgress {
    pub definition: AchievementDefinition,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
    pub current_value: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LifetimeStats {
    pub total_time_hours: f64,
    pub total_runs: i64,
    pub total_items: i64,
    pub runs_by_class: Vec<ClassCount>,
    pub runs_by_area: Vec<AreaCount>,
    pub items_by_rarity: Vec<RarityCount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClassCount {
    pub class: String,
    pub count: i64,
}

// ===== RUNE INVENTORY =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuneCount {
    pub profile_id: String,
    pub rune_name: String,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RunewordTarget {
    pub id: String,
    pub profile_id: String,
    pub runeword_name: String,
    pub created_at: String,
}

// ===== OVERLAY PROFILES =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OverlayProfile {
    pub id: String,
    pub name: String,
    pub layout: OverlayProfileLayout,
    pub is_active: bool,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OverlayProfileLayout {
    pub widgets: Vec<WidgetPlacement>,
    pub background_color: String,
    pub background_opacity: f64,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WidgetPlacement {
    pub id: String,
    #[serde(rename = "type", alias = "widget_type")]
    pub widget_type: String,
    pub x: f64,
    pub y: f64,
    pub size: String,
    pub opacity: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateOverlayProfileInput {
    pub name: String,
    pub layout: OverlayProfileLayout,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateOverlayProfileInput {
    pub name: Option<String>,
    pub layout: Option<OverlayProfileLayout>,
}


// ===== PRESERVATION PROPERTY TESTS =====

#[cfg(test)]
mod preservation_tests {
    use super::*;
    use proptest::prelude::*;

    /// Valid widget type strings that the system currently handles.
    fn valid_widget_type() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("timer".to_string()),
            Just("run_timer".to_string()),
            Just("run_count".to_string()),
            Just("items_found".to_string()),
            Just("last_item".to_string()),
            Just("dry_streak".to_string()),
            Just("goal_progress".to_string()),
            Just("xp_per_hour".to_string()),
            Just("route_step".to_string()),
        ]
    }

    fn valid_widget_size() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("small".to_string()),
            Just("medium".to_string()),
            Just("large".to_string()),
        ]
    }

    fn valid_opacity() -> impl Strategy<Value = f64> {
        (1u32..=10u32).prop_map(|n| n as f64 / 10.0)
    }

    fn valid_coordinate() -> impl Strategy<Value = f64> {
        (0u32..=800u32).prop_map(|n| n as f64)
    }

    // **Validates: Requirements 3.1**
    //
    // Property 2 (Preservation): For all valid WidgetPlacement JSON with "type" field,
    // deserialization succeeds and round-trips correctly.
    // This tests the NON-buggy path: JSON that already uses "type" should always work.
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(5))]

        #[test]
        fn widget_placement_type_field_roundtrips(
            id in "[a-z0-9]{8,36}",
            widget_type in valid_widget_type(),
            x in valid_coordinate(),
            y in valid_coordinate(),
            size in valid_widget_size(),
            opacity in valid_opacity(),
        ) {
            // Build a WidgetPlacement with the "type" field (correct format)
            let widget = WidgetPlacement {
                id: id.clone(),
                widget_type: widget_type.clone(),
                x,
                y,
                size: size.clone(),
                opacity,
            };

            // Serialize to JSON
            let json = serde_json::to_string(&widget).unwrap();

            // Verify serialization produces "type" field (not "widget_type")
            assert!(json.contains("\"type\""), "Serialized JSON should contain 'type' field");
            assert!(!json.contains("\"widget_type\""), "Serialized JSON should NOT contain 'widget_type' field");

            // Deserialize back
            let deserialized: WidgetPlacement = serde_json::from_str(&json).unwrap();

            // Verify round-trip correctness
            assert_eq!(deserialized.id, id);
            assert_eq!(deserialized.widget_type, widget_type);
            assert_eq!(deserialized.x, x);
            assert_eq!(deserialized.y, y);
            assert_eq!(deserialized.size, size);
            assert_eq!(deserialized.opacity, opacity);
        }
    }

    // **Validates: Requirements 3.1**
    //
    // Full OverlayProfileLayout with "type" fields round-trips correctly.
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(5))]

        #[test]
        fn overlay_profile_layout_roundtrips(
            widget_type in valid_widget_type(),
            x in valid_coordinate(),
            y in valid_coordinate(),
            size in valid_widget_size(),
            opacity in valid_opacity(),
            width in 200u32..=800u32,
            height in 100u32..=600u32,
        ) {
            let layout = OverlayProfileLayout {
                widgets: vec![WidgetPlacement {
                    id: "test-id".to_string(),
                    widget_type: widget_type.clone(),
                    x,
                    y,
                    size: size.clone(),
                    opacity,
                }],
                background_color: "#1a2b3c".to_string(),
                background_opacity: 0.85,
                width,
                height,
            };

            let json = serde_json::to_string(&layout).unwrap();
            let deserialized: OverlayProfileLayout = serde_json::from_str(&json).unwrap();

            assert_eq!(deserialized.widgets.len(), 1);
            assert_eq!(deserialized.widgets[0].widget_type, widget_type);
            assert_eq!(deserialized.widgets[0].x, x);
            assert_eq!(deserialized.widgets[0].y, y);
            assert_eq!(deserialized.widgets[0].size, size);
            assert_eq!(deserialized.widgets[0].opacity, opacity);
            assert_eq!(deserialized.width, width);
            assert_eq!(deserialized.height, height);
            assert_eq!(deserialized.background_color, "#1a2b3c");
            assert_eq!(deserialized.background_opacity, 0.85);
        }
    }
}

// ===== BUG CONDITION EXPLORATION TESTS =====

#[cfg(test)]
mod bug_condition_tests {
    use super::*;

    /// Bug Condition Exploration Test - Bug 1: Legacy JSON Deserialization
    ///
    /// **Validates: Requirements 1.1**
    ///
    /// The WidgetPlacement struct uses `#[serde(rename = "type")]` on its `widget_type` field.
    /// Legacy stored JSON contains `"widget_type"` instead of `"type"`. This test asserts that
    /// deserialization succeeds for the legacy format. On UNFIXED code, this WILL FAIL because
    /// serde only accepts `"type"` (the rename target) but not `"widget_type"` (the field name).
    ///
    /// EXPECTED OUTCOME: Test FAILS on unfixed code (confirms bug exists).
    #[test]
    fn bug1_legacy_widget_type_field_deserializes_successfully() {
        // This JSON uses "widget_type" as the field name (legacy format)
        let legacy_json = r#"{"id":"abc","widget_type":"timer","x":10,"y":10,"size":"medium","opacity":1.0}"#;

        let result = serde_json::from_str::<WidgetPlacement>(legacy_json);

        // On unfixed code, this assertion will FAIL because serde rejects "widget_type"
        // (it only accepts "type" due to the rename attribute without an alias)
        assert!(
            result.is_ok(),
            "Legacy JSON with 'widget_type' field should deserialize successfully. Got error: {:?}",
            result.err()
        );

        let widget = result.unwrap();
        assert_eq!(widget.widget_type, "timer");
        assert_eq!(widget.id, "abc");
        assert_eq!(widget.x, 10.0);
        assert_eq!(widget.y, 10.0);
        assert_eq!(widget.size, "medium");
        assert_eq!(widget.opacity, 1.0);
    }

    /// Additional test: Verify that "type" field still works (this should pass on both fixed and unfixed code)
    #[test]
    fn current_type_field_deserializes_successfully() {
        let current_json = r#"{"id":"def","type":"run_count","x":50,"y":25,"size":"large","opacity":0.8}"#;

        let result = serde_json::from_str::<WidgetPlacement>(current_json);

        assert!(
            result.is_ok(),
            "Current JSON with 'type' field should always deserialize. Got error: {:?}",
            result.err()
        );

        let widget = result.unwrap();
        assert_eq!(widget.widget_type, "run_count");
    }

    /// Property-style test: deserialize a full OverlayProfileLayout with legacy "widget_type" fields
    #[test]
    fn bug1_full_layout_with_legacy_widget_type_deserializes() {
        let layout_json = r##"{
            "widgets": [
                {"id":"w1","widget_type":"timer","x":10,"y":10,"size":"medium","opacity":1.0},
                {"id":"w2","widget_type":"items_found","x":50,"y":50,"size":"small","opacity":0.8}
            ],
            "background_color": "#000000",
            "background_opacity": 0.85,
            "width": 400,
            "height": 300
        }"##;

        let result = serde_json::from_str::<OverlayProfileLayout>(layout_json);

        assert!(
            result.is_ok(),
            "Layout with legacy 'widget_type' fields should deserialize. Got error: {:?}",
            result.err()
        );

        let layout = result.unwrap();
        assert_eq!(layout.widgets.len(), 2);
        assert_eq!(layout.widgets[0].widget_type, "timer");
        assert_eq!(layout.widgets[1].widget_type, "items_found");
    }
}
