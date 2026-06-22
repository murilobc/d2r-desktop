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
