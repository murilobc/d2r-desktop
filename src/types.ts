export interface Profile {
  id: string;
  name: string;
  class: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileInput {
  name: string;
  class: string;
  mode: string;
}

export interface UpdateProfileInput {
  name?: string;
  class?: string;
  mode?: string;
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
}

export interface CreateRunInput {
  profile_id: string;
  area: string;
  notes?: string;
}

export interface FinishRunInput {
  duration_secs: number;
  notes?: string;
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

export const DIFFICULTIES = ["Normal", "Nightmare", "Hell"];

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
