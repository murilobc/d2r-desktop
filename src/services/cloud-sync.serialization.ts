/**
 * Cloud Sync serialization module.
 *
 * Provides deterministic JSON serialization (lexicographic key ordering),
 * deserialization, and payload construction from the local database.
 */

import type {
  SyncPayload,
  SyncRecord,
  ProfileData,
  RunData,
  ItemData,
  HeraldEncounterData,
  ColossalAncientAttemptData,
  AnniLogData,
  XpEntryData,
  KeybindProfileData,
  RouteData,
  CustomAreaData,
  RuneInventoryData,
  RunewordTargetData,
} from "./cloud-sync.types";

import {
  getProfiles,
  getRuns,
  getAllItems,
  getHeraldEncounters,
  getAncientAttempts,
  getAnniLogs,
  getXpEntries,
  getKeybindProfiles,
  getRoutes,
  getCustomAreas,
  getRuneInventory,
  getRunewordTargets,
} from "../api";

// ===== SERIALIZATION =====

/**
 * Recursively sort all object keys lexicographically at every nesting level.
 * Arrays are preserved in their original order; only object keys are sorted.
 */
function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    for (const key of keys) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Serialize a SyncPayload to JSON with lexicographic key ordering at every
 * nesting level. Null-valued optional fields are preserved as JSON `null`.
 */
export function serializePayload(payload: SyncPayload): string {
  const sorted = sortKeysDeep(payload);
  return JSON.stringify(sorted);
}

/**
 * Deserialize a JSON string into a SyncPayload object.
 */
export function deserializePayload(json: string): SyncPayload {
  return JSON.parse(json) as SyncPayload;
}

// ===== PAYLOAD CONSTRUCTION =====

/**
 * Collect all entities for a single profile and push wrapped records into
 * the provided accumulator arrays.
 */
async function collectProfileEntities(
  profileId: string,
  allRuns: SyncRecord<RunData>[],
  allItems: SyncRecord<ItemData>[],
  allHeraldEncounters: SyncRecord<HeraldEncounterData>[],
  allColossalAttempts: SyncRecord<ColossalAncientAttemptData>[],
  allAnniLogs: SyncRecord<AnniLogData>[],
  allXpEntries: SyncRecord<XpEntryData>[],
  allRoutes: SyncRecord<RouteData>[],
  allCustomAreas: SyncRecord<CustomAreaData>[],
  allRuneInventory: SyncRecord<RuneInventoryData>[],
  allRunewordTargets: SyncRecord<RunewordTargetData>[],
): Promise<void> {
  const [runs, items, heralds, ancients, annis, xpEntries, routes, customAreas, runeInventory, runewordTargets] =
    await Promise.all([
      getRuns(profileId),
      getAllItems(profileId),
      getHeraldEncounters(profileId),
      getAncientAttempts(profileId),
      getAnniLogs(profileId),
      getXpEntries(profileId),
      getRoutes(profileId),
      getCustomAreas(profileId),
      getRuneInventory(profileId),
      getRunewordTargets(profileId),
    ]);

  for (const run of runs) {
    allRuns.push(wrapRun(run));
  }
  for (const item of items) {
    allItems.push(wrapItem(item));
  }
  for (const herald of heralds) {
    allHeraldEncounters.push(wrapHeraldEncounter(herald));
  }
  for (const attempt of ancients) {
    allColossalAttempts.push(wrapColossalAttempt(attempt));
  }
  for (const anni of annis) {
    allAnniLogs.push(wrapAnniLog(anni));
  }
  for (const entry of xpEntries) {
    allXpEntries.push(wrapXpEntry(entry));
  }
  for (const route of routes) {
    allRoutes.push(wrapRoute(route));
  }
  for (const area of customAreas) {
    allCustomAreas.push(wrapCustomArea(area));
  }
  for (const rune of runeInventory) {
    allRuneInventory.push(wrapRuneInventory(rune));
  }
  for (const target of runewordTargets) {
    allRunewordTargets.push(wrapRunewordTarget(target));
  }
}

/**
 * Build a SyncPayload from the local database by querying all entity tables.
 * Each record is wrapped in a SyncRecord with `updated_at` and `deleted_at`.
 */
export async function buildPayloadFromDb(): Promise<SyncPayload> {
  const profiles = await getProfiles();
  const keybindProfiles = await getKeybindProfiles();

  // For profile-scoped entities, we need to query per profile
  const allRuns: SyncRecord<RunData>[] = [];
  const allItems: SyncRecord<ItemData>[] = [];
  const allHeraldEncounters: SyncRecord<HeraldEncounterData>[] = [];
  const allColossalAttempts: SyncRecord<ColossalAncientAttemptData>[] = [];
  const allAnniLogs: SyncRecord<AnniLogData>[] = [];
  const allXpEntries: SyncRecord<XpEntryData>[] = [];
  const allRoutes: SyncRecord<RouteData>[] = [];
  const allCustomAreas: SyncRecord<CustomAreaData>[] = [];
  const allRuneInventory: SyncRecord<RuneInventoryData>[] = [];
  const allRunewordTargets: SyncRecord<RunewordTargetData>[] = [];

  for (const profile of profiles) {
    await collectProfileEntities(
      profile.id,
      allRuns,
      allItems,
      allHeraldEncounters,
      allColossalAttempts,
      allAnniLogs,
      allXpEntries,
      allRoutes,
      allCustomAreas,
      allRuneInventory,
      allRunewordTargets,
    );
  }

  const now = new Date().toISOString();

  return {
    schema_version: 1,
    timestamp: now,
    profiles: profiles.map(wrapProfile),
    runs: allRuns,
    items: allItems,
    herald_encounters: allHeraldEncounters,
    colossal_ancient_attempts: allColossalAttempts,
    anni_logs: allAnniLogs,
    xp_entries: allXpEntries,
    keybind_profiles: keybindProfiles.map(wrapKeybindProfile),
    routes: allRoutes,
    custom_areas: allCustomAreas,
    rune_inventory: allRuneInventory,
    runeword_targets: allRunewordTargets,
  };
}

// ===== RECORD WRAPPERS =====

import type {
  Profile,
  Run,
  Item,
  HeraldEncounter,
  ColossalAncientAttempt,
  AnniLog,
  XpEntry,
  KeybindProfile,
  Route,
  CustomArea,
  RuneCount,
  RunewordTarget,
} from "../types";

function wrapProfile(p: Profile): SyncRecord<ProfileData> {
  return {
    id: p.id,
    updated_at: p.updated_at,
    deleted_at: null,
    data: {
      name: p.name,
      class: p.class,
      mode: p.mode,
      magic_find: p.magic_find,
      created_at: p.created_at,
      updated_at: p.updated_at,
    },
  };
}

function wrapRun(r: Run): SyncRecord<RunData> {
  return {
    id: r.id,
    updated_at: r.started_at,
    deleted_at: null,
    data: {
      profile_id: r.profile_id,
      area: r.area,
      duration_secs: r.duration_secs,
      started_at: r.started_at,
      finished_at: r.finished_at,
      status: r.status,
      notes: r.notes,
      player_count: r.player_count,
      route_id: r.route_id,
      route_step_index: r.route_step_index,
      tags: r.tags,
    },
  };
}

function wrapItem(i: Item): SyncRecord<ItemData> {
  return {
    id: i.id,
    updated_at: i.found_at,
    deleted_at: null,
    data: {
      run_id: i.run_id,
      profile_id: i.profile_id,
      name: i.name,
      item_type: i.item_type,
      rarity: i.rarity,
      found_at: i.found_at,
      notes: i.notes,
    },
  };
}

function wrapHeraldEncounter(h: HeraldEncounter): SyncRecord<HeraldEncounterData> {
  return {
    id: h.id,
    updated_at: h.encountered_at,
    deleted_at: null,
    data: {
      profile_id: h.profile_id,
      tier: h.tier,
      area: h.area,
      result: h.result,
      sunder_charm: h.sunder_charm,
      notes: h.notes,
      encountered_at: h.encountered_at,
    },
  };
}

function wrapColossalAttempt(a: ColossalAncientAttempt): SyncRecord<ColossalAncientAttemptData> {
  return {
    id: a.id,
    updated_at: a.attempted_at,
    deleted_at: null,
    data: {
      profile_id: a.profile_id,
      boss_name: a.boss_name,
      attempt_number: a.attempt_number,
      result: a.result,
      drops: a.drops,
      duration_secs: a.duration_secs,
      notes: a.notes,
      attempted_at: a.attempted_at,
    },
  };
}

function wrapAnniLog(a: AnniLog): SyncRecord<AnniLogData> {
  return {
    id: a.id,
    updated_at: a.obtained_at,
    deleted_at: null,
    data: {
      profile_id: a.profile_id,
      stats: a.stats,
      notes: a.notes,
      obtained_at: a.obtained_at,
    },
  };
}

function wrapXpEntry(x: XpEntry): SyncRecord<XpEntryData> {
  return {
    id: x.id,
    updated_at: x.recorded_at,
    deleted_at: null,
    data: {
      profile_id: x.profile_id,
      run_id: x.run_id,
      level: x.level,
      xp_gained: x.xp_gained,
      duration_secs: x.duration_secs,
      area: x.area,
      notes: x.notes,
      recorded_at: x.recorded_at,
    },
  };
}

function wrapKeybindProfile(k: KeybindProfile): SyncRecord<KeybindProfileData> {
  return {
    id: k.id,
    updated_at: k.created_at,
    deleted_at: null,
    data: {
      name: k.name,
      bindings: k.bindings,
      created_at: k.created_at,
    },
  };
}

function wrapRoute(r: Route): SyncRecord<RouteData> {
  return {
    id: r.id,
    updated_at: r.created_at,
    deleted_at: null,
    data: {
      profile_id: r.profile_id,
      name: r.name,
      areas: r.areas,
      created_at: r.created_at,
    },
  };
}

function wrapCustomArea(c: CustomArea): SyncRecord<CustomAreaData> {
  return {
    id: c.id,
    updated_at: c.created_at,
    deleted_at: null,
    data: {
      profile_id: c.profile_id,
      name: c.name,
      created_at: c.created_at,
    },
  };
}

function wrapRuneInventory(r: RuneCount): SyncRecord<RuneInventoryData> {
  return {
    id: `${r.profile_id}:${r.rune_name}`,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    data: {
      profile_id: r.profile_id,
      rune_name: r.rune_name,
      count: r.count,
    },
  };
}

function wrapRunewordTarget(t: RunewordTarget): SyncRecord<RunewordTargetData> {
  return {
    id: t.id,
    updated_at: t.created_at,
    deleted_at: null,
    data: {
      profile_id: t.profile_id,
      runeword_name: t.runeword_name,
      created_at: t.created_at,
    },
  };
}
