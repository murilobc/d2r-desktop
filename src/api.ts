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
} from "./types";

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
