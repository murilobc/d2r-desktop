/**
 * Cloud Sync type definitions.
 *
 * Defines the payload schema, per-entity data types, configuration,
 * and status interfaces used by the sync engine.
 */

// ===== SYNC CONFIG KEY =====

export const SYNC_CONFIG_KEY = "d2r_sync_config";

// ===== SYNC STATE & STATUS =====

export type SyncState = "not_configured" | "synced" | "syncing" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: string | null; // ISO 8601
  errorMessage: string | null;
}

export interface SyncResult {
  success: boolean;
  recordsMerged: number;
  conflicts: number;
  error?: string;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
}

// ===== SYNC CONFIGURATION =====

export interface SyncConfig {
  backend: "off" | "github_gist" | "local_folder";
  gistId: string | null;
  localFolderPath: string | null;
  autoSyncOnClose: boolean;
  lastSyncTimestamp: string | null;
}

export interface CloudSyncConfig {
  backend: "off" | "github_gist" | "local_folder";
  gistId: string | null;
  localFolderPath: string | null;
  autoSyncOnClose: boolean;
}

// ===== SYNC RECORD WRAPPER =====

export interface SyncRecord<T> {
  id: string;
  updated_at: string; // ISO 8601 UTC with ms
  deleted_at: string | null; // soft-delete timestamp or null
  data: T;
}

// ===== PER-ENTITY DATA TYPES =====

export interface ProfileData {
  name: string;
  class: string;
  mode: string;
  magic_find: number | null;
  created_at: string;
  updated_at: string;
}

export interface RunData {
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

export interface ItemData {
  run_id: string;
  profile_id: string;
  name: string;
  item_type: string;
  rarity: string;
  found_at: string;
  notes: string | null;
}

export interface HeraldEncounterData {
  profile_id: string;
  tier: number;
  area: string;
  result: string;
  sunder_charm: string | null;
  notes: string | null;
  encountered_at: string;
}

export interface ColossalAncientAttemptData {
  profile_id: string;
  boss_name: string;
  attempt_number: number;
  result: string;
  drops: string | null;
  duration_secs: number;
  notes: string | null;
  attempted_at: string;
}

export interface AnniLogData {
  profile_id: string;
  stats: string;
  notes: string | null;
  obtained_at: string;
}

export interface XpEntryData {
  profile_id: string;
  run_id: string | null;
  level: number;
  xp_gained: number;
  duration_secs: number;
  area: string | null;
  notes: string | null;
  recorded_at: string;
}

export interface KeybindProfileData {
  name: string;
  bindings: string;
  created_at: string;
}

export interface RouteData {
  profile_id: string;
  name: string;
  areas: string[];
  created_at: string;
}

export interface CustomAreaData {
  profile_id: string;
  name: string;
  created_at: string;
}

export interface RuneInventoryData {
  profile_id: string;
  rune_name: string;
  count: number;
}

export interface RunewordTargetData {
  profile_id: string;
  runeword_name: string;
  created_at: string;
}

// ===== RUST COMMAND RESULT TYPES =====

export interface GistPullResult {
  payload: string;
  gist_id: string;
}

export interface GistPushResult {
  gist_id: string;
}

export interface GistTestResult {
  success: boolean;
  error: string | null;
}

// ===== SYNC PAYLOAD =====

export interface SyncPayload {
  schema_version: number; // starts at 1
  timestamp: string; // ISO 8601 UTC with ms
  profiles: SyncRecord<ProfileData>[];
  runs: SyncRecord<RunData>[];
  items: SyncRecord<ItemData>[];
  herald_encounters: SyncRecord<HeraldEncounterData>[];
  colossal_ancient_attempts: SyncRecord<ColossalAncientAttemptData>[];
  anni_logs: SyncRecord<AnniLogData>[];
  xp_entries: SyncRecord<XpEntryData>[];
  keybind_profiles: SyncRecord<KeybindProfileData>[];
  routes: SyncRecord<RouteData>[];
  custom_areas: SyncRecord<CustomAreaData>[];
  rune_inventory: SyncRecord<RuneInventoryData>[];
  runeword_targets: SyncRecord<RunewordTargetData>[];
}
