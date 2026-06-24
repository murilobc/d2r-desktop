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
