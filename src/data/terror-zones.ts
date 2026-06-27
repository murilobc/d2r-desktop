export interface TerrorZoneInfo {
  name: string;
  areas: string[];
  tier: "S" | "A" | "B" | "C";
  notes: string;
}

export const TERROR_ZONES: TerrorZoneInfo[] = [
  { name: "Chaos Sanctuary", areas: ["Chaos Sanctuary", "River of Flame"], tier: "S", notes: "Best for XP and items" },
  { name: "Worldstone Keep", areas: ["Worldstone Keep Level 1", "Worldstone Keep Level 2", "Worldstone Keep Level 3", "Throne of Destruction"], tier: "S", notes: "Dense packs, high XP" },
  { name: "Pit", areas: ["Pit Level 1", "Pit Level 2"], tier: "A", notes: "Easy access TC85" },
  { name: "Ancient Tunnels", areas: ["Ancient Tunnels"], tier: "A", notes: "No cold immunes, great for Blizzard Sorc" },
  { name: "Stony Tomb", areas: ["Stony Tomb Level 1", "Stony Tomb Level 2"], tier: "A", notes: "TC85, relatively safe" },
  { name: "Maggot Lair", areas: ["Maggot Lair Level 1", "Maggot Lair Level 2", "Maggot Lair Level 3"], tier: "C", notes: "Narrow corridors, poor layout" },
  { name: "Arcane Sanctuary", areas: ["Arcane Sanctuary"], tier: "B", notes: "Good density but dangerous" },
  { name: "Travincal", areas: ["Travincal"], tier: "A", notes: "Council members, high rune drops" },
  { name: "Nihlathak's Temple", areas: ["Halls of Anguish", "Halls of Pain", "Halls of Vaught"], tier: "B", notes: "Nihlathak + packs" },
  { name: "Cow Level", areas: ["Moo Moo Farm"], tier: "A", notes: "High density, rune farming" },
  { name: "Tal Rasha's Tombs", areas: ["Tal Rasha's Tomb"], tier: "B", notes: "Multiple tombs, good density" },
  { name: "Flayer Jungle", areas: ["Flayer Jungle", "Flayer Dungeon Level 1", "Flayer Dungeon Level 2", "Flayer Dungeon Level 3"], tier: "C", notes: "Annoying mobs, low reward" },
  { name: "Spider Forest", areas: ["Spider Forest", "Spider Cavern"], tier: "B", notes: "Dense spider packs" },
  { name: "Frigid Highlands", areas: ["Frigid Highlands"], tier: "B", notes: "Open area, fast clear" },
  { name: "Bloody Foothills", areas: ["Bloody Foothills"], tier: "B", notes: "Linear, fast" },
  { name: "Crystalline Passage", areas: ["Crystalline Passage", "Glacial Trail"], tier: "C", notes: "Cold immunes, maze-like" },
  { name: "Durance of Hate", areas: ["Durance of Hate Level 1", "Durance of Hate Level 2", "Durance of Hate Level 3"], tier: "A", notes: "Mephisto + packs" },
  { name: "Catacombs", areas: ["Catacombs Level 1", "Catacombs Level 2", "Catacombs Level 3", "Catacombs Level 4"], tier: "B", notes: "Andariel + undead" },
  { name: "Forgotten Tower", areas: ["Forgotten Tower", "Tower Cellar Level 1", "Tower Cellar Level 2", "Tower Cellar Level 3", "Tower Cellar Level 4", "Tower Cellar Level 5"], tier: "B", notes: "Countess + runes" },
  { name: "Arreat Plateau", areas: ["Arreat Plateau"], tier: "B", notes: "Open, good density" },
];

/** Storage keys for TZ preferences */
export const TZ_STORAGE_KEY = "d2r_current_tz";
export const TZ_PREFS_KEY = "d2r_tz_prefs";

export interface TerrorZonePrefs {
  preferredZones: string[];
  soundNotification: boolean;
}

export function getDefaultTZPrefs(): TerrorZonePrefs {
  return {
    preferredZones: [],
    soundNotification: false,
  };
}

export function loadTZPrefs(): TerrorZonePrefs {
  const stored = localStorage.getItem(TZ_PREFS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return getDefaultTZPrefs();
    }
  }
  return getDefaultTZPrefs();
}

export function saveTZPrefs(prefs: TerrorZonePrefs): void {
  localStorage.setItem(TZ_PREFS_KEY, JSON.stringify(prefs));
}

export function loadCurrentTZ(): string | null {
  return localStorage.getItem(TZ_STORAGE_KEY);
}

export function saveCurrentTZ(tzName: string | null): void {
  if (tzName) {
    localStorage.setItem(TZ_STORAGE_KEY, tzName);
  } else {
    localStorage.removeItem(TZ_STORAGE_KEY);
  }
}

/**
 * Get the current Terror Zone based on a deterministic rotation for Single Player.
 * In online mode, TZ is manually selected by the user.
 * For SP, the rotation follows a fixed hourly schedule based on game time.
 */
export function getCurrentTerrorZone(timestamp?: Date): TerrorZoneInfo | null {
  const now = timestamp || new Date();
  // Deterministic rotation: use the hour of the day + day of year as index
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hourOfDay = now.getHours();
  const rotationIndex = (dayOfYear * 24 + hourOfDay) % TERROR_ZONES.length;
  return TERROR_ZONES[rotationIndex];
}

/**
 * Get the tier CSS class for styling
 */
export function getTierClass(tier: "S" | "A" | "B" | "C"): string {
  switch (tier) {
    case "S": return "tier-s";
    case "A": return "tier-a";
    case "B": return "tier-b";
    case "C": return "tier-c";
  }
}

/**
 * Check if a given area name matches the currently active Terror Zone
 */
export function isAreaInTerrorZone(areaName: string, tzName: string): boolean {
  const tz = TERROR_ZONES.find((z) => z.name === tzName);
  if (!tz) return false;
  // Check if area name matches TZ name or any sub-area
  return tz.name === areaName || tz.areas.some((a) => a === areaName);
}
