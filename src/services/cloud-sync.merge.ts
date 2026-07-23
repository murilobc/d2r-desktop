/**
 * Cloud Sync merge logic.
 *
 * Implements per-collection, field-level merging with last-write-wins
 * semantics and deterministic tiebreakers for conflict resolution.
 */

import type { SyncPayload, SyncRecord } from "./cloud-sync.types";

/**
 * Collection keys in SyncPayload that hold SyncRecord arrays.
 */
const COLLECTION_KEYS: ReadonlyArray<keyof Omit<SyncPayload, "schema_version" | "timestamp">> = [
  "profiles",
  "runs",
  "items",
  "herald_encounters",
  "colossal_ancient_attempts",
  "anni_logs",
  "xp_entries",
  "keybind_profiles",
  "routes",
  "custom_areas",
  "rune_inventory",
  "runeword_targets",
];

/**
 * Merge two SyncPayloads (local and remote) into a single merged payload.
 *
 * The merge algorithm operates per-collection:
 * - Local-only records are included as-is.
 * - Remote-only records without `deleted_at` are included as-is.
 * - Remote-only records with `deleted_at` propagate the deletion.
 * - Records present on both sides use field-level merge with last-write-wins.
 *
 * @param local - The local SyncPayload (current machine's data)
 * @param remote - The remote SyncPayload (pulled from backend)
 * @param lastSyncTimestamp - ISO 8601 timestamp of last successful sync, or null for first sync
 * @returns The merged SyncPayload
 */
export function merge(
  local: SyncPayload,
  remote: SyncPayload,
  lastSyncTimestamp: string | null
): SyncPayload {
  const merged: SyncPayload = {
    schema_version: local.schema_version,
    timestamp: new Date().toISOString(),
    profiles: [],
    runs: [],
    items: [],
    herald_encounters: [],
    colossal_ancient_attempts: [],
    anni_logs: [],
    xp_entries: [],
    keybind_profiles: [],
    routes: [],
    custom_areas: [],
    rune_inventory: [],
    runeword_targets: [],
  };

  for (const key of COLLECTION_KEYS) {
    const localRecords = local[key] as SyncRecord<unknown>[];
    const remoteRecords = remote[key] as SyncRecord<unknown>[];
    (merged[key] as SyncRecord<unknown>[]) = mergeCollection(
      localRecords,
      remoteRecords,
      lastSyncTimestamp
    );
  }

  return merged;
}

/**
 * Merge a single collection of SyncRecords from local and remote sides.
 */
function mergeCollection<T>(
  localRecords: SyncRecord<T>[],
  remoteRecords: SyncRecord<T>[],
  lastSyncTimestamp: string | null
): SyncRecord<T>[] {
  const localMap = new Map<string, SyncRecord<T>>();
  const remoteMap = new Map<string, SyncRecord<T>>();

  for (const record of localRecords) {
    localMap.set(record.id, record);
  }
  for (const record of remoteRecords) {
    remoteMap.set(record.id, record);
  }

  // Collect all unique IDs from both sides
  const allIds = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
  const result: SyncRecord<T>[] = [];

  for (const id of allIds) {
    const localRecord = localMap.get(id);
    const remoteRecord = remoteMap.get(id);

    if (localRecord && !remoteRecord) {
      // Local only: include as-is (Req 4.3)
      result.push(localRecord);
    } else if (!localRecord && remoteRecord) {
      // Remote only: include (propagate deletion if deleted_at is set) (Req 4.4, 4.5)
      result.push(remoteRecord);
    } else if (localRecord && remoteRecord) {
      // Both sides: apply merge logic
      result.push(mergeRecord(localRecord, remoteRecord, lastSyncTimestamp));
    }
  }

  return result;
}

/**
 * Merge two versions of the same record present on both sides.
 *
 * Handles:
 * - Deletion conflict resolution (Req 4.5, 4.8)
 * - Conflict detection (Req 4.1)
 * - Field-level merge for conflicted records (Req 4.2, 4.6, 4.7)
 * - Non-conflicted records (only one side modified)
 */
function mergeRecord<T>(
  localRecord: SyncRecord<T>,
  remoteRecord: SyncRecord<T>,
  lastSyncTimestamp: string | null
): SyncRecord<T> {
  // Handle deletion conflicts (Req 4.5, 4.8)
  const deletionResult = resolveDeletionConflict(localRecord, remoteRecord);
  if (deletionResult) {
    return deletionResult;
  }

  // Neither is deleted — check if conflicted
  const isConflicted = isRecordConflicted(localRecord, remoteRecord, lastSyncTimestamp);

  if (!isConflicted) {
    // Not conflicted: only one side modified since last sync, take the one with later updated_at
    return localRecord.updated_at >= remoteRecord.updated_at ? localRecord : remoteRecord;
  }

  // Conflicted: apply field-level merge (Req 4.2, 4.6, 4.7)
  return fieldLevelMerge(localRecord, remoteRecord);
}

/**
 * Resolve deletion conflicts between local and remote records.
 * Returns the resolved record if a deletion is involved, or null if neither side is deleted.
 */
function resolveDeletionConflict<T>(
  localRecord: SyncRecord<T>,
  remoteRecord: SyncRecord<T>
): SyncRecord<T> | null {
  if (remoteRecord.deleted_at && !localRecord.deleted_at) {
    // Remote deleted, local modified
    if (remoteRecord.deleted_at > localRecord.updated_at) {
      // Remote deletion is more recent → apply deletion
      return {
        id: localRecord.id,
        updated_at: remoteRecord.updated_at,
        deleted_at: remoteRecord.deleted_at,
        data: remoteRecord.data,
      };
    }
    // Local modification is more recent → preserve local, clear deletion
    return {
      id: localRecord.id,
      updated_at: localRecord.updated_at,
      deleted_at: null,
      data: localRecord.data,
    };
  }

  if (localRecord.deleted_at && !remoteRecord.deleted_at) {
    // Local deleted, remote modified
    if (localRecord.deleted_at > remoteRecord.updated_at) {
      // Local deletion is more recent → apply deletion
      return {
        id: localRecord.id,
        updated_at: localRecord.updated_at,
        deleted_at: localRecord.deleted_at,
        data: localRecord.data,
      };
    }
    // Remote modification is more recent → preserve remote, clear deletion
    return {
      id: remoteRecord.id,
      updated_at: remoteRecord.updated_at,
      deleted_at: null,
      data: remoteRecord.data,
    };
  }

  // Both deleted — keep the one with more recent deleted_at
  if (localRecord.deleted_at && remoteRecord.deleted_at) {
    return localRecord.deleted_at >= remoteRecord.deleted_at ? localRecord : remoteRecord;
  }

  // No deletion involved
  return null;
}

/**
 * Determine if a record is conflicted.
 *
 * A record is conflicted if both local and remote versions have
 * `updated_at` timestamps strictly more recent than `lastSyncTimestamp`.
 * If lastSyncTimestamp is null (first sync), all records with both sides
 * are treated as conflicted.
 */
function isRecordConflicted<T>(
  localRecord: SyncRecord<T>,
  remoteRecord: SyncRecord<T>,
  lastSyncTimestamp: string | null
): boolean {
  if (lastSyncTimestamp === null) {
    // First sync: treat as conflicted if both sides differ
    return true;
  }

  const localModified = localRecord.updated_at > lastSyncTimestamp;
  const remoteModified = remoteRecord.updated_at > lastSyncTimestamp;

  return localModified && remoteModified;
}

/**
 * Perform field-level merge for conflicted records.
 *
 * For each field in `data`:
 * - Keep the value from the version with more recent `updated_at` (Req 4.6)
 * - If `updated_at` is identical, use lexicographically greater `id` as tiebreaker (Req 4.7)
 *
 * Since we don't track per-field timestamps, the entire record's `updated_at`
 * determines which side's fields win for conflicting values.
 */
function fieldLevelMerge<T>(
  localRecord: SyncRecord<T>,
  remoteRecord: SyncRecord<T>
): SyncRecord<T> {
  // Determine winner for conflicting fields
  let winner: SyncRecord<T>;
  let loser: SyncRecord<T>;

  if (localRecord.updated_at > remoteRecord.updated_at) {
    winner = localRecord;
    loser = remoteRecord;
  } else if (remoteRecord.updated_at > localRecord.updated_at) {
    winner = remoteRecord;
    loser = localRecord;
  } else if (localRecord.id >= remoteRecord.id) {
    // Identical timestamps: tiebreaker is lexicographically greater id (Req 4.7)
    winner = localRecord;
    loser = remoteRecord;
  } else {
    winner = remoteRecord;
    loser = localRecord;
  }

  // Field-level merge: for fields that differ, keep the winner's value.
  // For fields that are the same on both sides, the value is unchanged.
  const mergedData = { ...loser.data, ...winner.data } as T;

  // The merged record uses the winner's metadata
  return {
    id: winner.id,
    updated_at: winner.updated_at,
    deleted_at: null,
    data: mergedData,
  };
}
