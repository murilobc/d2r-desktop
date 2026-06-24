import type { Profile, Run, Item, Stats } from "../types";

export const mockProfile: Profile = {
  id: "profile-1",
  name: "TestSorc",
  class: "Sorceress",
  mode: "Ladder",
  magic_find: 300,
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
};

export const mockProfiles: Profile[] = [
  mockProfile,
  {
    id: "profile-2",
    name: "HammerPally",
    class: "Paladin",
    mode: "Non-Ladder",
    magic_find: null,
    created_at: "2026-06-02T10:00:00Z",
    updated_at: "2026-06-02T10:00:00Z",
  },
];

export const mockRun: Run = {
  id: "run-1",
  profile_id: "profile-1",
  area: "Mephisto",
  duration_secs: 120,
  started_at: "2026-06-15T14:00:00Z",
  finished_at: "2026-06-15T14:02:00Z",
  status: "completed",
  notes: null,
  player_count: 1,
  route_id: null,
  route_step_index: null,
};

export const mockRuns: Run[] = [
  mockRun,
  {
    id: "run-2",
    profile_id: "profile-1",
    area: "Mephisto",
    duration_secs: 95,
    started_at: "2026-06-15T14:05:00Z",
    finished_at: "2026-06-15T14:06:35Z",
    status: "completed",
    notes: null,
    player_count: 1,
    route_id: null,
    route_step_index: null,
  },
  {
    id: "run-3",
    profile_id: "profile-1",
    area: "Ancient Tunnels",
    duration_secs: 210,
    started_at: "2026-06-15T14:10:00Z",
    finished_at: "2026-06-15T14:13:30Z",
    status: "completed",
    notes: "Good loot session",
    player_count: 3,
    route_id: null,
    route_step_index: null,
  },
];

export const mockItems: Item[] = [
  {
    id: "item-1",
    run_id: "run-1",
    profile_id: "profile-1",
    name: "Harlequin Crest",
    item_type: "Armor",
    rarity: "Unique",
    found_at: "2026-06-15T14:01:30Z",
    notes: null,
  },
  {
    id: "item-2",
    run_id: "run-1",
    profile_id: "profile-1",
    name: "Ist Rune",
    item_type: "Rune",
    rarity: "Rune",
    found_at: "2026-06-15T14:01:45Z",
    notes: null,
  },
];

export const mockStats: Stats = {
  total_runs: 50,
  total_items: 12,
  total_time_secs: 6000,
  avg_run_duration_secs: 120,
  items_per_run: 0.24,
  items_by_rarity: [
    { rarity: "Unique", count: 5 },
    { rarity: "Set", count: 3 },
    { rarity: "Rune", count: 4 },
  ],
  runs_by_area: [
    { area: "Mephisto", count: 30 },
    { area: "Ancient Tunnels", count: 20 },
  ],
};
