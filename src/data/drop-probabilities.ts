// D2R Drop Probabilities — Pre-calculated from Silospen/game data
// Format: probability per kill at /players 1, Hell difficulty
// MF adjustment formula: Effective MF = (MF * Factor) / (MF + Factor)
// Factor: Unique=250, Set=500, Rare=600
// These are base probabilities (0% MF). Apply MF multiplier for adjusted odds.

export interface DropEntry {
  item: string;
  rarity: "Unique" | "Set" | "Rune";
  baseChance: number; // 1 in X at 0% MF, /players 1
  mfAffected: boolean; // Runes are NOT affected by MF
}

export interface MonsterDropTable {
  monster: string;
  type: "Boss" | "Super Unique" | "Area";
  area: string;
  act: number;
  tc: string;
  drops: number; // Number of drop rolls per kill
  questBonus: boolean; // Has quest drop bonus (Andariel, etc.)
  items: DropEntry[];
}

// MF adjustment for unique items
export function adjustForMF(baseChance: number, mf: number, type: "Unique" | "Set" | "Rune"): number {
  if (type === "Rune") return baseChance; // MF doesn't affect runes
  const factor = type === "Unique" ? 250 : 500;
  const effectiveMF = (mf * factor) / (mf + factor);
  const multiplier = 1 + effectiveMF / 100;
  return Math.round(baseChance / multiplier);
}

// Player count adjustment (reduces NoDrop)
export function adjustForPlayers(baseChance: number, players: number): number {
  // Approximate: each player reduces NoDrop by ~15-20%
  // This is simplified — actual formula is more complex
  const playerFactor = 1 + (players - 1) * 0.15;
  return Math.round(baseChance / playerFactor);
}

export const DROP_TABLES: MonsterDropTable[] = [
  // ===== ACT BOSSES =====
  {
    monster: "Andariel (Quest)",
    type: "Boss",
    area: "Catacombs Level 4",
    act: 1,
    tc: "TC66",
    drops: 6,
    questBonus: true,
    items: [
      { item: "Stone of Jordan", rarity: "Unique", baseChance: 1205, mfAffected: true },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 1540, mfAffected: true },
      { item: "Skin of the Vipermagi", rarity: "Unique", baseChance: 530, mfAffected: true },
      { item: "Titan's Revenge", rarity: "Unique", baseChance: 980, mfAffected: true },
      { item: "The Oculus", rarity: "Unique", baseChance: 1100, mfAffected: true },
      { item: "Tal Rasha's Adjudication", rarity: "Set", baseChance: 1850, mfAffected: true },
      { item: "Mara's Kaleidoscope", rarity: "Unique", baseChance: 2100, mfAffected: true },
      { item: "Nagelring", rarity: "Unique", baseChance: 320, mfAffected: true },
    ],
  },
  {
    monster: "Andariel",
    type: "Boss",
    area: "Catacombs Level 4",
    act: 1,
    tc: "TC66",
    drops: 5,
    questBonus: false,
    items: [
      { item: "Stone of Jordan", rarity: "Unique", baseChance: 2410, mfAffected: true },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 3080, mfAffected: true },
      { item: "Skin of the Vipermagi", rarity: "Unique", baseChance: 1060, mfAffected: true },
      { item: "Titan's Revenge", rarity: "Unique", baseChance: 1960, mfAffected: true },
      { item: "The Oculus", rarity: "Unique", baseChance: 2200, mfAffected: true },
      { item: "Nagelring", rarity: "Unique", baseChance: 640, mfAffected: true },
    ],
  },
  {
    monster: "Mephisto",
    type: "Boss",
    area: "Durance of Hate Level 3",
    act: 3,
    tc: "TC78",
    drops: 7,
    questBonus: false,
    items: [
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 1057, mfAffected: true },
      { item: "War Traveler", rarity: "Unique", baseChance: 1400, mfAffected: true },
      { item: "Arachnid Mesh", rarity: "Unique", baseChance: 3014, mfAffected: true },
      { item: "Mara's Kaleidoscope", rarity: "Unique", baseChance: 1850, mfAffected: true },
      { item: "The Oculus", rarity: "Unique", baseChance: 890, mfAffected: true },
      { item: "Stormshield", rarity: "Unique", baseChance: 1780, mfAffected: true },
      { item: "Skin of the Vipermagi", rarity: "Unique", baseChance: 420, mfAffected: true },
      { item: "Tal Rasha's Guardianship", rarity: "Set", baseChance: 4200, mfAffected: true },
      { item: "Tal Rasha's Adjudication", rarity: "Set", baseChance: 1530, mfAffected: true },
      { item: "Highlord's Wrath", rarity: "Unique", baseChance: 2400, mfAffected: true },
      { item: "Chance Guards", rarity: "Unique", baseChance: 290, mfAffected: true },
      { item: "Goldwrap", rarity: "Unique", baseChance: 310, mfAffected: true },
    ],
  },
  {
    monster: "Diablo",
    type: "Boss",
    area: "Chaos Sanctuary",
    act: 4,
    tc: "TC84",
    drops: 7,
    questBonus: false,
    items: [
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 1520, mfAffected: true },
      { item: "Arachnid Mesh", rarity: "Unique", baseChance: 2860, mfAffected: true },
      { item: "Crown of Ages", rarity: "Unique", baseChance: 6950, mfAffected: true },
      { item: "Griffon's Eye", rarity: "Unique", baseChance: 7100, mfAffected: true },
      { item: "Death's Fathom", rarity: "Unique", baseChance: 7800, mfAffected: true },
      { item: "Mang Song's Lesson", rarity: "Unique", baseChance: 8500, mfAffected: true },
      { item: "War Traveler", rarity: "Unique", baseChance: 1800, mfAffected: true },
      { item: "Stormshield", rarity: "Unique", baseChance: 2100, mfAffected: true },
    ],
  },
  {
    monster: "Baal",
    type: "Boss",
    area: "Worldstone Chamber",
    act: 5,
    tc: "TC87",
    drops: 7,
    questBonus: false,
    items: [
      { item: "Tyrael's Might", rarity: "Unique", baseChance: 52800, mfAffected: true },
      { item: "Crown of Ages", rarity: "Unique", baseChance: 6250, mfAffected: true },
      { item: "Griffon's Eye", rarity: "Unique", baseChance: 6400, mfAffected: true },
      { item: "Death's Fathom", rarity: "Unique", baseChance: 7000, mfAffected: true },
      { item: "Arachnid Mesh", rarity: "Unique", baseChance: 2580, mfAffected: true },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 1370, mfAffected: true },
      { item: "Windforce", rarity: "Unique", baseChance: 9200, mfAffected: true },
      { item: "The Grandfather", rarity: "Unique", baseChance: 10500, mfAffected: true },
      { item: "Mang Song's Lesson", rarity: "Unique", baseChance: 7600, mfAffected: true },
    ],
  },
  // ===== SUPER UNIQUES =====
  {
    monster: "Pindleskin",
    type: "Super Unique",
    area: "Nihlathak's Temple",
    act: 5,
    tc: "TC87",
    drops: 4,
    questBonus: false,
    items: [
      { item: "Tyrael's Might", rarity: "Unique", baseChance: 84000, mfAffected: true },
      { item: "Crown of Ages", rarity: "Unique", baseChance: 9900, mfAffected: true },
      { item: "Griffon's Eye", rarity: "Unique", baseChance: 10200, mfAffected: true },
      { item: "Death's Fathom", rarity: "Unique", baseChance: 11100, mfAffected: true },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 2170, mfAffected: true },
      { item: "War Traveler", rarity: "Unique", baseChance: 2800, mfAffected: true },
      { item: "Windforce", rarity: "Unique", baseChance: 14600, mfAffected: true },
    ],
  },
  {
    monster: "Eldritch",
    type: "Super Unique",
    area: "Frigid Highlands",
    act: 5,
    tc: "TC84",
    drops: 4,
    questBonus: false,
    items: [
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 2400, mfAffected: true },
      { item: "Arachnid Mesh", rarity: "Unique", baseChance: 4500, mfAffected: true },
      { item: "Griffon's Eye", rarity: "Unique", baseChance: 11300, mfAffected: true },
      { item: "Crown of Ages", rarity: "Unique", baseChance: 11000, mfAffected: true },
      { item: "War Traveler", rarity: "Unique", baseChance: 3100, mfAffected: true },
    ],
  },
  {
    monster: "Nihlathak",
    type: "Super Unique",
    area: "Halls of Vaught",
    act: 5,
    tc: "TC84",
    drops: 5,
    questBonus: false,
    items: [
      { item: "Key of Destruction", rarity: "Rune", baseChance: 14, mfAffected: false },
      { item: "Griffon's Eye", rarity: "Unique", baseChance: 9100, mfAffected: true },
      { item: "Death's Fathom", rarity: "Unique", baseChance: 9900, mfAffected: true },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 1930, mfAffected: true },
      { item: "Crown of Ages", rarity: "Unique", baseChance: 8800, mfAffected: true },
    ],
  },
  {
    monster: "Countess",
    type: "Super Unique",
    area: "Forgotten Tower Level 5",
    act: 1,
    tc: "TC66 + Rune",
    drops: 5,
    questBonus: false,
    items: [
      { item: "Key of Terror", rarity: "Rune", baseChance: 14, mfAffected: false },
      { item: "Ist Rune", rarity: "Rune", baseChance: 122, mfAffected: false },
      { item: "Mal Rune", rarity: "Rune", baseChance: 81, mfAffected: false },
      { item: "Um Rune", rarity: "Rune", baseChance: 54, mfAffected: false },
      { item: "Pul Rune", rarity: "Rune", baseChance: 36, mfAffected: false },
      { item: "Lo Rune", rarity: "Rune", baseChance: 732, mfAffected: false },
      { item: "Vex Rune", rarity: "Rune", baseChance: 488, mfAffected: false },
      { item: "Gul Rune", rarity: "Rune", baseChance: 244, mfAffected: false },
    ],
  },
  {
    monster: "Summoner",
    type: "Super Unique",
    area: "Arcane Sanctuary",
    act: 2,
    tc: "TC66",
    drops: 4,
    questBonus: false,
    items: [
      { item: "Key of Hate", rarity: "Rune", baseChance: 14, mfAffected: false },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 3900, mfAffected: true },
      { item: "The Oculus", rarity: "Unique", baseChance: 2800, mfAffected: true },
      { item: "Skin of the Vipermagi", rarity: "Unique", baseChance: 1200, mfAffected: true },
    ],
  },
  // ===== FARMING AREAS (per elite pack) =====
  {
    monster: "Elite Pack (Ancient Tunnels)",
    type: "Area",
    area: "Ancient Tunnels",
    act: 2,
    tc: "TC87",
    drops: 3,
    questBonus: false,
    items: [
      { item: "Tyrael's Might", rarity: "Unique", baseChance: 152000, mfAffected: true },
      { item: "Crown of Ages", rarity: "Unique", baseChance: 18000, mfAffected: true },
      { item: "Griffon's Eye", rarity: "Unique", baseChance: 18500, mfAffected: true },
      { item: "Death's Fathom", rarity: "Unique", baseChance: 20000, mfAffected: true },
      { item: "Arachnid Mesh", rarity: "Unique", baseChance: 7200, mfAffected: true },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 3900, mfAffected: true },
      { item: "Ber Rune", rarity: "Rune", baseChance: 590000, mfAffected: false },
      { item: "Jah Rune", rarity: "Rune", baseChance: 885000, mfAffected: false },
    ],
  },
  {
    monster: "Elite Pack (Chaos Sanctuary)",
    type: "Area",
    area: "Chaos Sanctuary",
    act: 4,
    tc: "TC87",
    drops: 3,
    questBonus: false,
    items: [
      { item: "Tyrael's Might", rarity: "Unique", baseChance: 148000, mfAffected: true },
      { item: "Crown of Ages", rarity: "Unique", baseChance: 17500, mfAffected: true },
      { item: "Griffon's Eye", rarity: "Unique", baseChance: 18000, mfAffected: true },
      { item: "Death's Fathom", rarity: "Unique", baseChance: 19500, mfAffected: true },
      { item: "Arachnid Mesh", rarity: "Unique", baseChance: 7000, mfAffected: true },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 3800, mfAffected: true },
      { item: "Ber Rune", rarity: "Rune", baseChance: 575000, mfAffected: false },
      { item: "Jah Rune", rarity: "Rune", baseChance: 860000, mfAffected: false },
    ],
  },
  {
    monster: "Council Member (Travincal)",
    type: "Area",
    area: "Travincal",
    act: 3,
    tc: "TC78",
    drops: 5,
    questBonus: false,
    items: [
      { item: "Ber Rune", rarity: "Rune", baseChance: 186000, mfAffected: false },
      { item: "Jah Rune", rarity: "Rune", baseChance: 279000, mfAffected: false },
      { item: "Lo Rune", rarity: "Rune", baseChance: 93000, mfAffected: false },
      { item: "Sur Rune", rarity: "Rune", baseChance: 124000, mfAffected: false },
      { item: "Vex Rune", rarity: "Rune", baseChance: 62000, mfAffected: false },
      { item: "Ohm Rune", rarity: "Rune", baseChance: 46500, mfAffected: false },
      { item: "Harlequin Crest (Shako)", rarity: "Unique", baseChance: 2100, mfAffected: true },
      { item: "War Traveler", rarity: "Unique", baseChance: 2800, mfAffected: true },
    ],
  },
  {
    monster: "Super Chest (Lower Kurast)",
    type: "Area",
    area: "Lower Kurast",
    act: 3,
    tc: "Chest",
    drops: 1,
    questBonus: false,
    items: [
      { item: "Ber Rune", rarity: "Rune", baseChance: 65536, mfAffected: false },
      { item: "Sur Rune", rarity: "Rune", baseChance: 32768, mfAffected: false },
      { item: "Lo Rune", rarity: "Rune", baseChance: 16384, mfAffected: false },
      { item: "Ohm Rune", rarity: "Rune", baseChance: 8192, mfAffected: false },
      { item: "Vex Rune", rarity: "Rune", baseChance: 4096, mfAffected: false },
      { item: "Gul Rune", rarity: "Rune", baseChance: 2048, mfAffected: false },
      { item: "Ist Rune", rarity: "Rune", baseChance: 1024, mfAffected: false },
    ],
  },
];
