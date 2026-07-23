/**
 * Cloud Sync engine service.
 *
 * Orchestrates the pull → validate → merge → push cycle.
 * Stateless between sync cycles — all persistent state lives in SQLite and localStorage.
 */

import type {
  SyncConfig,
  SyncStatus,
  SyncState,
  SyncResult,
  SyncPayload,
  TestConnectionResult,
} from "./cloud-sync.types";
import { SYNC_CONFIG_KEY } from "./cloud-sync.types";
import { validatePayload } from "./cloud-sync.validation";
import { serializePayload, deserializePayload, buildPayloadFromDb } from "./cloud-sync.serialization";
import { merge } from "./cloud-sync.merge";
import {
  githubGistPull,
  githubGistPush,
  githubGistTest,
  localFilePull,
  localFilePush,
} from "../api";

/** Current schema version supported by this application. */
const CURRENT_SCHEMA_VERSION = 1;

/** Timeout for a full sync cycle in milliseconds (30 seconds). */
const SYNC_TIMEOUT_MS = 30_000;

/** Timeout for pushOnClose in milliseconds (10 seconds). */
const CLOSE_TIMEOUT_MS = 10_000;

/**
 * Load the sync configuration from localStorage.
 */
function loadConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncConfig;
  } catch {
    return null;
  }
}

/**
 * Save the sync configuration to localStorage.
 */
function saveConfig(config: SyncConfig): void {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Create a promise that rejects after the given timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Pull the remote payload from the configured backend.
 * Returns the parsed SyncPayload or null if no remote data exists.
 */
async function pullRemote(config: SyncConfig): Promise<SyncPayload | null> {
  if (config.backend === "github_gist") {
    const result = await githubGistPull(config.gistId);
    if (!result) return null;

    // If this is the first sync and we got a gist_id back, persist it
    if (!config.gistId && result.gist_id) {
      config.gistId = result.gist_id;
      saveConfig(config);
    }

    return deserializePayload(result.payload);
  }

  if (config.backend === "local_folder") {
    if (!config.localFolderPath) {
      throw new Error("Local folder path not configured");
    }
    const raw = await localFilePull(config.localFolderPath);
    if (!raw) return null;
    return deserializePayload(raw);
  }

  throw new Error(`Unknown backend: ${config.backend}`);
}

/**
 * Push a serialized payload to the configured backend.
 */
async function pushPayload(config: SyncConfig, serialized: string): Promise<void> {
  if (config.backend === "github_gist") {
    const result = await githubGistPush(config.gistId, serialized);
    // On first push, store the gist ID
    if (!config.gistId && result.gist_id) {
      config.gistId = result.gist_id;
      saveConfig(config);
    }
    return;
  }

  if (config.backend === "local_folder") {
    if (!config.localFolderPath) {
      throw new Error("Local folder path not configured");
    }
    await localFilePush(config.localFolderPath, serialized);
    return;
  }

  throw new Error(`Unknown backend: ${config.backend}`);
}

/**
 * The main SyncEngine class.
 *
 * Manages sync state and orchestrates the pull → merge → push cycle.
 */
export class SyncEngine {
  private state: SyncState = "not_configured";
  private lastSyncAt: string | null = null;
  private errorMessage: string | null = null;

  constructor() {
    // Initialize state from persisted config
    const config = loadConfig();
    if (config && config.backend !== "off") {
      this.state = config.lastSyncTimestamp ? "synced" : "not_configured";
      this.lastSyncAt = config.lastSyncTimestamp;
    }
  }

  /**
   * Get the current sync status.
   */
  getStatus(): SyncStatus {
    return {
      state: this.state,
      lastSyncAt: this.lastSyncAt,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Trigger a full sync cycle: pull → validate → merge → push.
   * Enforces a 30-second timeout on the entire operation.
   */
  async triggerSync(): Promise<SyncResult> {
    const config = loadConfig();

    // If not configured, return early
    if (!config || config.backend === "off") {
      this.state = "not_configured";
      this.errorMessage = null;
      return { success: false, recordsMerged: 0, conflicts: 0, error: "Sync not configured" };
    }

    // Prevent concurrent syncs
    if (this.state === "syncing") {
      return { success: false, recordsMerged: 0, conflicts: 0, error: "Sync already in progress" };
    }

    this.state = "syncing";
    this.errorMessage = null;

    try {
      const result = await withTimeout(
        this.performSync(config),
        SYNC_TIMEOUT_MS,
        "Sync operation",
      );
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.state = "error";
      this.errorMessage = errorMsg;
      return { success: false, recordsMerged: 0, conflicts: 0, error: errorMsg };
    }
  }

  /**
   * Internal sync logic without timeout handling.
   */
  private async performSync(config: SyncConfig): Promise<SyncResult> {
    // 1. Pull remote payload
    const remotePayload = await pullRemote(config);

    // 2. Validate remote payload if present
    if (remotePayload) {
      const validation = validatePayload(remotePayload);
      if (!validation.valid) {
        throw new Error(`Invalid sync data: ${validation.error}`);
      }

      // 3. Check schema version: refuse merge if remote > current
      if (remotePayload.schema_version > CURRENT_SCHEMA_VERSION) {
        throw new Error(
          "Update required: sync data is from a newer version of D2R Tracker",
        );
      }
    }

    // 4. Build local payload from DB
    const localPayload = await buildPayloadFromDb();

    // 5. Merge local + remote
    let mergedPayload: SyncPayload;
    if (remotePayload) {
      mergedPayload = merge(localPayload, remotePayload, config.lastSyncTimestamp);
    } else {
      // No remote data — just use local
      mergedPayload = localPayload;
    }

    // 6. Serialize merged payload
    const serialized = serializePayload(mergedPayload);

    // 7. Push to backend
    await pushPayload(config, serialized);

    // 8. Update lastSyncTimestamp
    const now = new Date().toISOString();
    config.lastSyncTimestamp = now;
    saveConfig(config);

    // 9. Update status
    this.state = "synced";
    this.lastSyncAt = now;
    this.errorMessage = null;

    // Count records in merged payload for reporting
    const recordsMerged =
      mergedPayload.profiles.length +
      mergedPayload.runs.length +
      mergedPayload.items.length +
      mergedPayload.herald_encounters.length +
      mergedPayload.colossal_ancient_attempts.length +
      mergedPayload.anni_logs.length +
      mergedPayload.xp_entries.length +
      mergedPayload.keybind_profiles.length +
      mergedPayload.routes.length +
      mergedPayload.custom_areas.length +
      mergedPayload.rune_inventory.length +
      mergedPayload.runeword_targets.length;

    return { success: true, recordsMerged, conflicts: 0 };
  }

  /**
   * Test the connection to the configured backend without performing a full sync.
   */
  async testConnection(): Promise<TestConnectionResult> {
    const config = loadConfig();

    if (!config || config.backend === "off") {
      return { success: false, error: "Sync not configured" };
    }

    try {
      if (config.backend === "github_gist") {
        const result = await githubGistTest();
        if (result.success) {
          return { success: true };
        }
        return { success: false, error: result.error ?? "Connection test failed" };
      }

      if (config.backend === "local_folder") {
        if (!config.localFolderPath) {
          return { success: false, error: "Local folder path not configured" };
        }
        // For local folder, try to pull to verify accessibility
        // The Rust backend validates the folder exists and is writable
        const { localFolderValidate } = await import("../api");
        const valid = await localFolderValidate(config.localFolderPath);
        if (valid) {
          return { success: true };
        }
        return { success: false, error: `Cannot access folder: ${config.localFolderPath}` };
      }

      return { success: false, error: `Unknown backend: ${config.backend}` };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Push data on app close. Uses a shorter 10-second timeout.
   * Does not show error UI — just logs failures.
   */
  async pushOnClose(): Promise<void> {
    const config = loadConfig();

    if (!config || config.backend === "off" || !config.autoSyncOnClose) {
      return;
    }

    try {
      await withTimeout(this.performPushOnClose(config), CLOSE_TIMEOUT_MS, "Close sync");
    } catch (err) {
      // Log but don't show UI — app is closing
      console.error("[cloud-sync] pushOnClose failed:", err);
    }
  }

  /**
   * Internal push-on-close logic: build local payload and push.
   */
  private async performPushOnClose(config: SyncConfig): Promise<void> {
    const localPayload = await buildPayloadFromDb();
    const serialized = serializePayload(localPayload);
    await pushPayload(config, serialized);

    // Update timestamp
    const now = new Date().toISOString();
    config.lastSyncTimestamp = now;
    saveConfig(config);
  }
}

/** Singleton sync engine instance. */
export const syncEngine = new SyncEngine();
