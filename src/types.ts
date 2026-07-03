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
