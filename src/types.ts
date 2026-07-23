export interface Profile {
  id: string;
  name: string;
  class: string;
  mode: string;
  magic_find: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileInput {
  name: string;
  class: string;
  mode: string;
  magic_find?: number;
}

export interface UpdateProfileInput {
  name?: string;
  class?: string;
  mode?: string;
  magic_find?: number;
}

export interface Run {
  id: string;
  profile_id: string;
  area: string;
  duration_secs: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  notes: string | null;
  player_count: number | null;
  route_id: string | null;
  route_step_index: number | null;
  tags: string | null;
}

export interface CreateRunInput {
  profile_id: string;
  area: string;
  notes?: string;
  player_count?: number;
  route_id?: string;
  route_step_index?: number;
  tags?: string[];
}

export interface FinishRunInput {
  duration_secs: number;
  notes?: string;
  tags?: string[];
}

/** Parse tags from the JSON string stored in the database */
export function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface Item {
  id: string;
  run_id: string;
  profile_id: string;
  name: string;
  item_type: string;
  rarity: string;
  found_at: string;
  notes: string | null;
}

export interface CreateItemInput {
  run_id: string;
  profile_id: string;
  name: string;
  item_type: string;
  rarity: string;
  notes?: string;
}

export interface Stats {
  total_runs: number;
  total_items: number;
  total_time_secs: number;
  avg_run_duration_secs: number;
  items_per_run: number;
  items_by_rarity: RarityCount[];
  runs_by_area: AreaCount[];
}

export interface RarityCount {
  rarity: string;
  count: number;
}

export interface AreaCount {
  area: string;
  count: number;
}

export interface DetailedRun {
  run: Run;
  items: Item[];
}

export interface CombinedStats {
  summary: Stats;
  detailed_runs: DetailedRun[];
  routes: Route[];
}

export interface VacuumResult {
  size_before_bytes: number;
  size_after_bytes: number;
  success: boolean;
}

export interface ExportData {
  version: string;
  exported_at: string;
  profiles: Profile[];
  runs: Run[];
  items: Item[];
}

export interface ImportResult {
  profiles_imported: number;
  runs_imported: number;
  items_imported: number;
  skipped: number;
}

export interface PaginatedRuns {
  runs: Run[];
  total: number;
}

export interface CustomArea {
  id: string;
  profile_id: string;
  name: string;
  created_at: string;
}

export interface ObsStatsInput {
  runCount: number;
  sessionTime: string;
  currentArea: string;
  lastItems: string[];
  format: "text" | "json";
}

export const D2R_CLASSES = [
  "Amazon",
  "Necromancer",
  "Barbarian",
  "Sorceress",
  "Paladin",
  "Druid",
  "Assassin",
  "Warlock",
];

export const GAME_MODES = ["Ladder", "Non-Ladder", "Single Player"];

export const RARITIES = [
  "Normal",
  "Magic",
  "Rare",
  "Set",
  "Unique",
  "Runeword",
  "Rune",
  "Charm",
];

export const ITEM_TYPES = [
  "Weapon",
  "Armor",
  "Helmet",
  "Shield",
  "Gloves",
  "Boots",
  "Belt",
  "Ring",
  "Amulet",
  "Charm",
  "Rune",
  "Jewel",
  "Grimoire",
  "Other",
];

export const AREAS = [
  "Ancient Tunnels",
  "Andariel",
  "Arcane Sanctuary",
  "Baal",
  "Chaos Sanctuary",
  "Colossal Ancients",
  "Council",
  "Countess",
  "Cow Level",
  "Diablo",
  "Durance of Hate",
  "Eldritch",
  "Lower Kurast",
  "Mephisto",
  "Nihlathak",
  "Pindleskin",
  "Pit",
  "Stony Tomb",
  "Summoner",
  "Terror Zone",
  "Travincal",
  "Tristram",
  "Uber Tristram",
  "Worldstone Keep",
  "Other",
];

export interface Route {
  id: string;
  profile_id: string;
  name: string;
  areas: string[];
  created_at: string;
}

export interface CreateRouteInput {
  profile_id: string;
  name: string;
  areas: string[];
}

export interface UpdateRouteInput {
  name: string;
  areas: string[];
}

export interface RouteStats {
  route_id: string;
  route_name: string;
  total_cycles: number;
  avg_cycle_time_secs: number;
  total_items: number;
  items_per_cycle: number;
}

// ===== COMPARISON MODE =====

export interface ComparisonRequest {
  type: "area" | "date_range";
  profile_id: string;
  area_a?: string;
  area_b?: string;
  start_a?: string;
  end_a?: string;
  start_b?: string;
  end_b?: string;
}

export interface SubjectMetrics {
  label: string;
  total_runs: number;
  total_items: number;
  total_unique_items: number;
  total_duration_secs: number;
  items_per_hour: number;
  unique_items_per_hour: number;
  items_per_run: number;
  avg_time_per_run: number;
  fastest_run_secs: number | null;
  slowest_run_secs: number | null;
}

export interface ComparisonResult {
  subject_a: SubjectMetrics;
  subject_b: SubjectMetrics;
}

// ===== HERALD TRACKING =====

export interface HeraldEncounter {
  id: string;
  profile_id: string;
  tier: number;
  area: string;
  result: string;
  sunder_charm: string | null;
  notes: string | null;
  encountered_at: string;
}

export interface CreateHeraldEncounterInput {
  profile_id: string;
  tier: number;
  area: string;
  result: string;
  sunder_charm?: string;
  notes?: string;
}

export interface HeraldStats {
  total_encounters: number;
  success_count: number;
  fail_count: number;
  encounters_by_tier: HeraldTierCount[];
  sunder_charms_found: string[];
}

export interface HeraldTierCount {
  tier: number;
  count: number;
  successes: number;
}

// ===== COLOSSAL ANCIENTS =====

export interface ColossalAncientAttempt {
  id: string;
  profile_id: string;
  boss_name: string;
  attempt_number: number;
  result: string;
  drops: string | null;
  duration_secs: number;
  notes: string | null;
  attempted_at: string;
}

export interface CreateColossalAttemptInput {
  profile_id: string;
  boss_name: string;
  result: string;
  drops?: string;
  duration_secs: number;
  notes?: string;
}

export interface ColossalAncientStats {
  total_attempts: number;
  total_successes: number;
  bosses_defeated: string[];
  stats_by_boss: BossStats[];
}

export interface BossStats {
  boss_name: string;
  attempts: number;
  successes: number;
  best_time_secs: number | null;
  avg_time_secs: number;
}

export const COLOSSAL_BOSSES = ["Baal", "Diablo", "Mephisto", "Duriel", "Andariel"] as const;

// ===== DIABLO CLONE TRACKER =====

export interface DCloneProgress {
  region: string;
  progress: number;
  last_updated: string;
}

export interface AnniLog {
  id: string;
  profile_id: string;
  stats: string;
  notes: string | null;
  obtained_at: string;
}

export interface CreateAnniLogInput {
  profile_id: string;
  stats: string;
  notes?: string;
}

export const DCLONE_REGIONS = ["Americas", "Europe", "Asia"] as const;

// ===== XP TRACKING =====

export interface XpEntry {
  id: string;
  profile_id: string;
  run_id: string | null;
  level: number;
  xp_gained: number;
  duration_secs: number;
  area: string | null;
  notes: string | null;
  recorded_at: string;
}

export interface CreateXpEntryInput {
  profile_id: string;
  run_id?: string;
  level: number;
  xp_gained: number;
  duration_secs: number;
  area?: string;
  notes?: string;
}

export interface XpStats {
  total_xp: number;
  total_time_secs: number;
  xp_per_hour: number;
  entries_count: number;
  avg_xp_per_session: number;
}

// ===== KEYBIND PROFILES =====

export interface KeybindProfile {
  id: string;
  name: string;
  bindings: string;
  created_at: string;
}

export interface CreateKeybindProfileInput {
  name: string;
  bindings: string;
}

export interface UpdateKeybindProfileInput {
  name: string;
  bindings: string;
}

// ===== CO-OP TRACKING =====

export interface CoopServerInfo {
  session_code: string;
  host_ip: string;
  port: number;
}

export interface CoopSessionView {
  role: "host" | "guest";
  session_code: string;
  host_ip: string;
  port: number;
  players: CoopPlayer[];
  items: CoopItem[];
  run_count: number;
  elapsed_secs: number;
  paused: boolean;
}

export interface CoopPlayer {
  name: string;
  profile_id: string;
  status: "connected" | "disconnected";
  items_found: number;
  runs_contributed: number;
}

export interface CoopItem {
  id: string;
  name: string;
  item_type: string;
  rarity: string;
  player_name: string;
  found_at: string;
}

export interface CoopCombinedStats {
  total_runs: number;
  total_items: number;
  session_time_secs: number;
  items_per_hour: number;
}

export interface CoopItemInput {
  name: string;
  item_type: string;
  rarity: string;
}

// ===== ACHIEVEMENTS =====

export interface AchievementDefinition {
  id: string;
  category: "milestone" | "streak" | "per-class" | "per-area";
  name_key: string;
  description_key: string;
  icon: string;
  condition_type: string;
  condition_target: string | null;
  threshold: number;
  sort_order: number;
}

export interface AchievementUnlock {
  id: string;
  profile_id: string;
  definition_id: string;
  unlocked_at: string;
  definition: AchievementDefinition;
}

export interface AchievementProgress {
  definition: AchievementDefinition;
  unlocked: boolean;
  unlocked_at: string | null;
  current_value: number;
}

export interface LifetimeStats {
  total_time_hours: number;
  total_runs: number;
  total_items: number;
  runs_by_class: { class: string; count: number }[];
  runs_by_area: { area: string; count: number }[];
  items_by_rarity: { rarity: string; count: number }[];
}

export type AchievementCategory = "milestone" | "streak" | "per-class" | "per-area";

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  "milestone", "streak", "per-class", "per-area"
];

// ===== RUNEWORD PLANNER =====

export interface RuneCount {
  profile_id: string;
  rune_name: string;
  count: number;
}

export interface RunewordTarget {
  id: string;
  profile_id: string;
  runeword_name: string;
  created_at: string;
}

// ===== SCREENSHOT ITEM DETECTION =====

export interface ScreenshotSettings {
  monitoring_enabled: boolean;
  auto_detection_enabled: boolean;
  confidence_threshold: number;
}

export interface MatchCandidate {
  item_name: string;
  category: string;
  subcategory: string;
  confidence: number;
}

export interface DetectionResult {
  top_match: MatchCandidate | null;
  candidates: MatchCandidate[];
  raw_text: string;
  is_auto_suggested: boolean;
  detected_at: string;
}

// ===== CUSTOMIZABLE OVERLAY PROFILES =====

export type WidgetType =
  | "timer"           // Session elapsed time
  | "run_timer"       // Current run elapsed
  | "run_count"       // Session + total run count
  | "items_found"     // Session item count
  | "last_item"       // Most recent item name
  | "dry_streak"      // Runs since last item
  | "goal_progress"   // Runs toward session goal
  | "xp_per_hour"     // XP/hour rate
  | "route_step";     // Current step in active route

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetPlacement {
  id: string;          // Unique instance ID (UUID)
  type: WidgetType;
  x: number;           // Pixels from left edge
  y: number;           // Pixels from top edge
  size: WidgetSize;
  opacity: number;     // 0.1 to 1.0
}

export interface OverlayProfileLayout {
  widgets: WidgetPlacement[];
  background_color: string;
  background_opacity: number;
  width: number;
  height: number;
}

export interface OverlayProfile {
  id: string;
  name: string;
  layout: OverlayProfileLayout;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOverlayProfileInput {
  name: string;
  layout: OverlayProfileLayout;
}

export interface UpdateOverlayProfileInput {
  name?: string;
  layout?: OverlayProfileLayout;
}

export const WIDGET_TYPES: WidgetType[] = [
  "timer",
  "run_timer",
  "run_count",
  "items_found",
  "last_item",
  "dry_streak",
  "goal_progress",
  "xp_per_hour",
  "route_step",
] as const;

export const WIDGET_SIZE_SCALES: Record<WidgetSize, number> = {
  small: 0.75,
  medium: 1.0,
  large: 1.5,
};

// ===== QUICK-START TEMPLATES =====

export interface Template {
  id: string;
  profile_id: string;
  name: string;
  area: string;
  player_count: number;
  route_id: string | null;
  session_goal_type: string; // "none" | "runs" | "time"
  session_goal_value: number | null;
  tags: string | null;       // JSON array string
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  profile_id: string;
  name: string;
  area: string;
  player_count: number;
  route_id?: string;
  session_goal_type: string;
  session_goal_value?: number;
  tags?: string[];
}

export interface UpdateTemplateInput {
  name: string;
  area: string;
  player_count: number;
  route_id?: string;
  session_goal_type: string;
  session_goal_value?: number;
  tags?: string[];
}
