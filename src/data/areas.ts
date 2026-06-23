// D2R v3.2 Area Data — Area Levels, Treasure Classes, and Notable Drops
// Sources: maxroll.gg, diablo2.io, game data files

export interface AreaInfo {
  name: string;
  act: number;
  alvl: number; // Area level (Hell difficulty)
  tc: string; // Max Treasure Class that can drop
  canDropAll: boolean; // TC85+ = can drop every item in game
  monsterTypes: string[];
  notableDrops: string[];
  tips: string;
}

export const AREA_DATA: AreaInfo[] = [
  // === TC87 Areas (alvl 85) — Can drop EVERY item ===
  {
    name: "Ancient Tunnels",
    act: 2,
    alvl: 85,
    tc: "TC87",
    canDropAll: true,
    monsterTypes: ["Undead", "Demon"],
    notableDrops: ["Tyrael's Might", "Arachnid Mesh", "Death's Web", "Death's Fathom", "Griffon's Eye"],
    tips: "No cold immunes. Best area for Blizzard Sorceress.",
  },
  {
    name: "Pit",
    act: 1,
    alvl: 85,
    tc: "TC87",
    canDropAll: true,
    monsterTypes: ["Demon", "Undead"],
    notableDrops: ["Tyrael's Might", "Windforce", "Crown of Ages", "The Grandfather"],
    tips: "Easy access from Outer Cloister. Two levels, compact layout.",
  },
  {
    name: "Chaos Sanctuary",
    act: 4,
    alvl: 85,
    tc: "TC87",
    canDropAll: true,
    monsterTypes: ["Demon", "Undead", "Oblivion Knight"],
    notableDrops: ["Tyrael's Might", "Death's Fathom", "Griffon's Eye", "Arachnid Mesh"],
    tips: "High density. Seal popping clears all monsters. Diablo at the end.",
  },
  {
    name: "Worldstone Keep",
    act: 5,
    alvl: 85,
    tc: "TC87",
    canDropAll: true,
    monsterTypes: ["Demon", "Undead", "Various"],
    notableDrops: ["Tyrael's Might", "Crown of Ages", "Death's Web"],
    tips: "Levels 1-3. High density, many elite packs. Leads to Baal.",
  },
  {
    name: "Stony Tomb",
    act: 2,
    alvl: 85,
    tc: "TC87",
    canDropAll: true,
    monsterTypes: ["Undead", "Skeleton"],
    notableDrops: ["Tyrael's Might", "Arachnid Mesh", "Death's Fathom"],
    tips: "Compact 2-level zone. Quick clears. Near Ancient Tunnels.",
  },
  {
    name: "Durance of Hate",
    act: 3,
    alvl: 83,
    tc: "TC84",
    canDropAll: false,
    monsterTypes: ["Undead", "Council"],
    notableDrops: ["Harlequin Crest", "War Traveler", "Arachnid Mesh", "Stormshield"],
    tips: "Level 3 has Mephisto. Council members on level 3 drop high runes.",
  },
  // === Boss Areas ===
  {
    name: "Mephisto",
    act: 3,
    alvl: 87,
    tc: "TC78",
    canDropAll: false,
    monsterTypes: ["Super Unique Boss"],
    notableDrops: ["Harlequin Crest", "War Traveler", "Arachnid Mesh", "Mara's Kaleidoscope", "Stormshield", "Skin of the Vipermagi"],
    tips: "Fast kills with moat trick. Drops limited to TC78 max. Best for mid-tier uniques.",
  },
  {
    name: "Andariel",
    act: 1,
    alvl: 75,
    tc: "TC66",
    canDropAll: false,
    monsterTypes: ["Super Unique Boss"],
    notableDrops: ["Stone of Jordan", "Harlequin Crest", "Skin of the Vipermagi", "Titan's Revenge"],
    tips: "Quest bug doubles unique drop rate. Very fast runs. Limited TC.",
  },
  {
    name: "Diablo",
    act: 4,
    alvl: 94,
    tc: "TC84",
    canDropAll: false,
    monsterTypes: ["Super Unique Boss"],
    notableDrops: ["Mang Song's Lesson", "Griffon's Eye", "Crown of Ages", "Arachnid Mesh"],
    tips: "High TC boss. Longer kill but better drops than Mephisto.",
  },
  {
    name: "Baal",
    act: 5,
    alvl: 99,
    tc: "TC87",
    canDropAll: true,
    monsterTypes: ["Super Unique Boss"],
    notableDrops: ["Tyrael's Might", "Crown of Ages", "Death's Fathom", "Griffon's Eye", "Arachnid Mesh"],
    tips: "Can drop every item. Long runs due to waves. Best boss for TC87 items.",
  },
  // === Popular Farm Areas ===
  {
    name: "Travincal",
    act: 3,
    alvl: 83,
    tc: "TC78",
    canDropAll: false,
    monsterTypes: ["Council Members"],
    notableDrops: ["High Runes (Ber, Jah, Sur, Lo)", "Harlequin Crest", "War Traveler"],
    tips: "Best area for high rune farming. Council drops lots of gold too.",
  },
  {
    name: "Countess",
    act: 1,
    alvl: 82,
    tc: "TC66 + Rune TC",
    canDropAll: false,
    monsterTypes: ["Super Unique"],
    notableDrops: ["Runes up to Lo (Hell)", "Ist Rune", "Key of Terror"],
    tips: "Guaranteed rune drops. Best source for mid runes (Ist, Mal, Um).",
  },
  {
    name: "Lower Kurast",
    act: 3,
    alvl: 80,
    tc: "Chest TC",
    canDropAll: false,
    monsterTypes: ["Chests (super chests)"],
    notableDrops: ["High Runes (Ber, Jah, Vex, Ohm)", "Skiller Grand Charms"],
    tips: "Super chests only. /players 7+ for best odds. No killing needed.",
  },
  {
    name: "Cow Level",
    act: 1,
    alvl: 81,
    tc: "TC66",
    canDropAll: false,
    monsterTypes: ["Hell Bovine"],
    notableDrops: ["High Runes", "Ethereal Bases", "Runeword Bases"],
    tips: "Extremely high density. Best for rune farming and base hunting.",
  },
  {
    name: "Pindleskin",
    act: 5,
    alvl: 86,
    tc: "TC87",
    canDropAll: true,
    monsterTypes: ["Super Unique"],
    notableDrops: ["Tyrael's Might", "Crown of Ages", "Death's Fathom", "Griffon's Eye"],
    tips: "Fastest TC87 farm. Cannot drop Arachnid Mesh or Azurewrath (specific exclusions).",
  },
  {
    name: "Nihlathak",
    act: 5,
    alvl: 83,
    tc: "TC84",
    canDropAll: false,
    monsterTypes: ["Super Unique"],
    notableDrops: ["Key of Destruction", "Griffon's Eye", "Death's Fathom"],
    tips: "Drops Key of Destruction for Ubers. CE danger from corpses.",
  },
  {
    name: "Summoner",
    act: 2,
    alvl: 80,
    tc: "TC66",
    canDropAll: false,
    monsterTypes: ["Super Unique"],
    notableDrops: ["Key of Hate", "Harlequin Crest", "Oculus"],
    tips: "Drops Key of Hate for Ubers. Quick teleport runs.",
  },
  {
    name: "Eldritch",
    act: 5,
    alvl: 84,
    tc: "TC84",
    canDropAll: false,
    monsterTypes: ["Super Unique"],
    notableDrops: ["Griffon's Eye", "Crown of Ages", "Arachnid Mesh"],
    tips: "Right next to Frigid Highlands WP. Very fast kills.",
  },
  {
    name: "Arcane Sanctuary",
    act: 2,
    alvl: 79,
    tc: "TC72",
    canDropAll: false,
    monsterTypes: ["Ghost", "Spectre"],
    notableDrops: ["High Runes", "Ghosts have no body = forced rune/jewelry drops"],
    tips: "Ghosts can only drop runes, jewelry, and essences. Great for rune hunting.",
  },
  {
    name: "Colossal Ancients",
    act: 5,
    alvl: 90,
    tc: "TC87+",
    canDropAll: true,
    monsterTypes: ["Colossal Ancient Bosses"],
    notableDrops: ["Unique Jewels (Defender's Fire, Guardian's Thunder, etc.)", "All TC87 items"],
    tips: "RotW endgame content. Control which Ancient dies last for targeted jewel drops.",
  },
  {
    name: "Terror Zone",
    act: 0,
    alvl: 96,
    tc: "TC87",
    canDropAll: true,
    monsterTypes: ["Varies by terrorized zone"],
    notableDrops: ["All items in the game", "Higher XP"],
    tips: "Any terrorized zone becomes alvl 96+. Farm any area you enjoy.",
  },
  {
    name: "Council",
    act: 3,
    alvl: 83,
    tc: "TC78",
    canDropAll: false,
    monsterTypes: ["Council Members"],
    notableDrops: ["High Runes", "Harlequin Crest", "War Traveler"],
    tips: "Same as Travincal. 6 council members with high rune drop chance.",
  },
  {
    name: "Uber Tristram",
    act: 1,
    alvl: 110,
    tc: "Special",
    canDropAll: false,
    monsterTypes: ["Uber Bosses (Mephisto, Diablo, Baal)"],
    notableDrops: ["Hellfire Torch (guaranteed)", "Standard of Heroes"],
    tips: "Requires 3 keys. Guaranteed Torch. Need heavy gear and life tap.",
  },
  {
    name: "Tristram",
    act: 1,
    alvl: 76,
    tc: "TC66",
    canDropAll: false,
    monsterTypes: ["Various"],
    notableDrops: ["Standard drops", "Early farming"],
    tips: "Quick access. Good for early Hell farming.",
  },
];

// Helper: get area info by name
export function getAreaInfo(name: string): AreaInfo | undefined {
  return AREA_DATA.find((a) => a.name === name);
}

// Get all TC85+ areas
export function getTC85Areas(): AreaInfo[] {
  return AREA_DATA.filter((a) => a.canDropAll);
}
