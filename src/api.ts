import { invoke } from "@tauri-apps/api/core";
import type {
  Profile,
  CreateProfileInput,
  UpdateProfileInput,
  Run,
  CreateRunInput,
  FinishRunInput,
  Item,
  CreateItemInput,
  Stats,
  DetailedRun,
  CombinedStats,
  VacuumResult,
  ExportData,
  ImportResult,
  PaginatedRuns,
  CustomArea,
  ObsStatsInput,
  Route,
  CreateRouteInput,
  UpdateRouteInput,
  RouteStats,
  ComparisonRequest,
  ComparisonResult,
  HeraldEncounter,
  CreateHeraldEncounterInput,
  HeraldStats,
  ColossalAncientAttempt,
  CreateColossalAttemptInput,
  ColossalAncientStats,
  DCloneProgress,
  AnniLog,
  CreateAnniLogInput,
  XpEntry,
  CreateXpEntryInput,
  XpStats,
  KeybindProfile,
  CreateKeybindProfileInput,
  UpdateKeybindProfileInput,
  CoopServerInfo,
  CoopSessionView,
  CoopItemInput,
  AchievementUnlock,
  AchievementDefinition,
  AchievementProgress,
  LifetimeStats,
  RuneCount,
  RunewordTarget,
} from "./types";
import type {
  GistPullResult,
  GistPushResult,
  GistTestResult,
} from "./services/cloud-sync.types";

// Profiles
export const createProfile = (input: CreateProfileInput) =>
  invoke<Profile>("create_profile", { input });

export const getProfiles = () => invoke<Profile[]>("get_profiles");

export const updateProfile = (id: string, input: UpdateProfileInput) =>
  invoke<Profile>("update_profile", { id, input });

export const deleteProfile = (id: string) =>
  invoke<void>("delete_profile", { id });

// Runs
export const createRun = (input: CreateRunInput) =>
  invoke<Run>("create_run", { input });

export const getRuns = (profileId: string) =>
  invoke<Run[]>("get_runs", { profileId });

export const finishRun = (id: string, input: FinishRunInput) =>
  invoke<Run>("finish_run", { id, input });

export const deleteRun = (id: string) => invoke<void>("delete_run", { id });

export const updateRunArea = (id: string, area: string) =>
  invoke<void>("update_run_area", { id, area });

export const updateRunTags = (id: string, tags: string[]) =>
  invoke<void>("update_run_tags", { id, input: { tags } });

// Items
export const createItem = (input: CreateItemInput) =>
  invoke<Item>("create_item", { input });

export const getItems = (runId: string) =>
  invoke<Item[]>("get_items", { runId });

export const getAllItems = (profileId: string) =>
  invoke<Item[]>("get_all_items", { profileId });

export const deleteItem = (id: string) => invoke<void>("delete_item", { id });

// Stats
export const getStats = (profileId: string) =>
  invoke<Stats>("get_stats", { profileId });

export const getDetailedRuns = (profileId: string, areaFilter?: string) =>
  invoke<DetailedRun[]>("get_detailed_runs", { profileId, areaFilter: areaFilter || null });

export const getStatsCombined = (profileId: string, areaFilter?: string) =>
  invoke<CombinedStats>("get_stats_combined", { profileId, areaFilter: areaFilter || null });

// Database Maintenance
export const vacuumDatabase = () =>
  invoke<VacuumResult>("vacuum_database");

// Export / Import
export const exportData = () => invoke<ExportData>("export_data");

export const importData = (data: ExportData) =>
  invoke<ImportResult>("import_data", { data });


// Paginated runs
export const getRunsPaginated = (profileId: string, offset: number, limit: number) =>
  invoke<PaginatedRuns>("get_runs_paginated", { profileId, offset, limit });

// Custom areas
export const getCustomAreas = (profileId: string) =>
  invoke<CustomArea[]>("get_custom_areas", { profileId });

export const addCustomArea = (profileId: string, name: string) =>
  invoke<CustomArea>("add_custom_area", { profileId, name });

export const deleteCustomArea = (id: string) =>
  invoke<void>("delete_custom_area", { id });

// OBS Integration
export const writeObsStats = (input: ObsStatsInput): Promise<string> =>
  invoke<string>("write_obs_stats", { input });

export const getObsFilePath = (): Promise<string> =>
  invoke<string>("get_obs_file_path");

// Routes
export const createRoute = (input: CreateRouteInput) =>
  invoke<Route>("create_route", { input });

export const getRoutes = (profileId: string) =>
  invoke<Route[]>("get_routes", { profileId });

export const updateRoute = (id: string, input: UpdateRouteInput) =>
  invoke<Route>("update_route", { id, input });

export const deleteRoute = (id: string) =>
  invoke<void>("delete_route", { id });

export const getRouteStats = (routeId: string) =>
  invoke<RouteStats>("get_route_stats", { routeId });

// Comparison
export const getComparison = (request: ComparisonRequest) =>
  invoke<ComparisonResult>("get_comparison", { request });

// Herald Tracking
export const createHeraldEncounter = (input: CreateHeraldEncounterInput) =>
  invoke<HeraldEncounter>("create_herald_encounter", { input });

export const getHeraldEncounters = (profileId: string) =>
  invoke<HeraldEncounter[]>("get_herald_encounters", { profileId });

export const getHeraldStats = (profileId: string) =>
  invoke<HeraldStats>("get_herald_stats", { profileId });

export const deleteHeraldEncounter = (id: string) =>
  invoke<void>("delete_herald_encounter", { id });


// Colossal Ancients
export const createAncientAttempt = (input: CreateColossalAttemptInput) =>
  invoke<ColossalAncientAttempt>("create_ancient_attempt", { input });

export const getAncientAttempts = (profileId: string) =>
  invoke<ColossalAncientAttempt[]>("get_ancient_attempts", { profileId });

export const getAncientStats = (profileId: string) =>
  invoke<ColossalAncientStats>("get_ancient_stats", { profileId });

export const deleteAncientAttempt = (id: string) =>
  invoke<void>("delete_ancient_attempt", { id });

// Diablo Clone
export const getDcloneProgress = () =>
  invoke<DCloneProgress[]>("get_dclone_progress");

export const updateDcloneProgress = (region: string, progress: number) =>
  invoke<DCloneProgress>("update_dclone_progress", { region, progress });

export const createAnniLog = (input: CreateAnniLogInput) =>
  invoke<AnniLog>("create_anni_log", { input });

export const getAnniLogs = (profileId: string) =>
  invoke<AnniLog[]>("get_anni_logs", { profileId });

export const deleteAnniLog = (id: string) =>
  invoke<void>("delete_anni_log", { id });

// XP Tracking
export const createXpEntry = (input: CreateXpEntryInput) =>
  invoke<XpEntry>("create_xp_entry", { input });

export const getXpEntries = (profileId: string) =>
  invoke<XpEntry[]>("get_xp_entries", { profileId });

export const getXpStats = (profileId: string) =>
  invoke<XpStats>("get_xp_stats", { profileId });

export const deleteXpEntry = (id: string) =>
  invoke<void>("delete_xp_entry", { id });

// Keybind Profiles
export const createKeybindProfile = (input: CreateKeybindProfileInput) =>
  invoke<KeybindProfile>("create_keybind_profile", { input });

export const getKeybindProfiles = () =>
  invoke<KeybindProfile[]>("get_keybind_profiles");

export const updateKeybindProfile = (id: string, input: UpdateKeybindProfileInput) =>
  invoke<KeybindProfile>("update_keybind_profile", { id, input });

export const deleteKeybindProfile = (id: string) =>
  invoke<void>("delete_keybind_profile", { id });

// Backup Scheduler
export const runAutoBackup = (folderPath: string) =>
  invoke<string>("run_auto_backup", { folderPath });

export const cleanupOldBackups = (folderPath: string, keepCount: number) =>
  invoke<void>("cleanup_old_backups", { folderPath, keepCount });

// Co-op Tracking
export const startCoopServer = (playerName: string) =>
  invoke<CoopServerInfo>("start_coop_server", { playerName });

export const stopCoopServer = () =>
  invoke<void>("stop_coop_server");

export const joinCoopSession = (hostIp: string, port: number, sessionCode: string, playerName: string) =>
  invoke<void>("join_coop_session", { hostIp, port, sessionCode, playerName });

export const leaveCoopSession = () =>
  invoke<void>("leave_coop_session");

export const coopSplitRun = () =>
  invoke<void>("coop_split_run");

export const coopPause = () =>
  invoke<void>("coop_pause");

export const coopEndSession = () =>
  invoke<void>("coop_end_session");

export const coopLogItem = (item: CoopItemInput, playerName: string) =>
  invoke<void>("coop_log_item", { item, playerName });

export const getCoopState = () =>
  invoke<CoopSessionView | null>("get_coop_state");

// Cloud Sync
export const saveSyncToken = (service: string, token: string) =>
  invoke<void>("save_sync_token", { service, token });

export const getSyncToken = (service: string) =>
  invoke<string | null>("get_sync_token", { service });

export const deleteSyncToken = (service: string) =>
  invoke<void>("delete_sync_token", { service });

export const githubGistPull = (gistId: string | null) =>
  invoke<GistPullResult | null>("github_gist_pull", { gistId });

export const githubGistPush = (gistId: string | null, payload: string) =>
  invoke<GistPushResult>("github_gist_push", { gistId, payload });

export const githubGistTest = () =>
  invoke<GistTestResult>("github_gist_test");

export const localFilePull = (folderPath: string) =>
  invoke<string | null>("local_file_pull", { folderPath });

export const localFilePush = (folderPath: string, payload: string) =>
  invoke<void>("local_file_push", { folderPath, payload });

export const localFolderValidate = (folderPath: string) =>
  invoke<boolean>("local_folder_validate", { folderPath });

// Achievements
export const evaluateAchievements = (profileId: string) =>
  invoke<AchievementUnlock[]>("evaluate_achievements", { profileId });

export const getAchievementDefinitions = () =>
  invoke<AchievementDefinition[]>("get_achievement_definitions");

export const getAchievementProgress = (profileId: string) =>
  invoke<AchievementProgress[]>("get_achievement_progress", { profileId });

export const getLifetimeStats = (profileId: string) =>
  invoke<LifetimeStats>("get_lifetime_stats", { profileId });

// Rune Inventory
export const getRuneInventory = (profileId: string) =>
  invoke<RuneCount[]>("get_rune_inventory", { profileId });

export const updateRuneCount = (profileId: string, runeName: string, delta: number) =>
  invoke<RuneCount>("update_rune_count", { profileId, runeName, delta });

export const setRuneCount = (profileId: string, runeName: string, count: number) =>
  invoke<RuneCount>("set_rune_count", { profileId, runeName, count });

// Runeword Targets
export const getRunewordTargets = (profileId: string) =>
  invoke<RunewordTarget[]>("get_runeword_targets", { profileId });

export const addRunewordTarget = (profileId: string, runewordName: string) =>
  invoke<RunewordTarget>("add_runeword_target", { profileId, runewordName });

export const removeRunewordTarget = (id: string) =>
  invoke<void>("remove_runeword_target", { id });

// ─── Drop Probability Engine Types ────────────────────────────────────────────

export interface DropProbabilityInput {
  monster_id: string;
  item_id: string;
  magic_find: number;
  player_count: number;
  quest_bonus: boolean;
  terror_zone: boolean;
  herald_tier: number | null;
}

export interface DropProbabilityResult {
  probability: number;
  one_in_x: number;
  kills_for_50: number;
  kills_for_63: number;
  kills_for_90: number;
  kills_for_99: number;
  effective_mf: number;
  mf_applied: boolean;
}

export interface CumulativeDistInput {
  probability: number;
  max_kills: number;
  step: number;
}

export interface DistributionPoint {
  kills: number;
  cumulative_probability: number;
}

export interface AreaRunStats {
  area: string;
  total_runs: number;
  avg_duration_secs: number;
  total_items_found: number;
  item_counts: { item_name: string; count: number }[];
}

export interface LuckPercentileInput {
  actual_drops: number;
  total_kills: number;
  per_kill_probability: number;
}

export interface LuckPercentileResult {
  percentile: number;
  expected_drops: number;
  deviation: number;
  deviation_sigma: number;
}

export interface AreaDropProbabilityInput {
  area_id: string;
  item_id: string;
  magic_find: number;
  player_count: number;
  quest_bonus: boolean;
}

export interface AreaDropProbabilityResult {
  probability: number;
  one_in_x: number;
  kills_for_50: number;
  kills_for_63: number;
  kills_for_90: number;
  kills_for_99: number;
  monster_breakdown: MonsterBreakdown[];
}

export interface MonsterBreakdown {
  monster_id: string;
  monster_name: string;
  probability: number;
  one_in_x: number;
}

// ─── Drop Probability Engine API Functions ────────────────────────────────────

export const calculateDropProbability = (input: DropProbabilityInput) =>
  invoke<DropProbabilityResult>("calculate_drop_probability", { input });

export const calculateCumulativeDistribution = (probability: number, maxKills: number, step: number) =>
  invoke<DistributionPoint[]>("calculate_cumulative_distribution", { input: { probability, max_kills: maxKills, step } });

export const calculateAreaDropProbability = (input: AreaDropProbabilityInput) =>
  invoke<AreaDropProbabilityResult>("calculate_area_drop_probability", { input });

export const getAreaRunStats = (profileId: string, area: string) =>
  invoke<AreaRunStats>("get_area_run_stats", { profileId, area });

export const calculateLuckPercentile = (actualDrops: number, totalKills: number, perKillProbability: number) =>
  invoke<LuckPercentileResult>("calculate_luck_percentile", { input: { actual_drops: actualDrops, total_kills: totalKills, per_kill_probability: perKillProbability } });
