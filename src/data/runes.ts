// D2R Rune Definitions - All 33 runes with cube upgrade data
// Upgrade ratios: 3:1 for levels 1-20, 2:1 for levels 21-33
// Gem required for upgrades from level 11+ (Amn and above)

export interface RuneDefinition {
  name: string;
  level: number;
  upgradeRatio: number;
  requiresGem: boolean;
}

export const RUNE_DEFINITIONS: RuneDefinition[] = [
  { name: "El", level: 1, upgradeRatio: 3, requiresGem: false },
  { name: "Eld", level: 2, upgradeRatio: 3, requiresGem: false },
  { name: "Tir", level: 3, upgradeRatio: 3, requiresGem: false },
  { name: "Nef", level: 4, upgradeRatio: 3, requiresGem: false },
  { name: "Eth", level: 5, upgradeRatio: 3, requiresGem: false },
  { name: "Ith", level: 6, upgradeRatio: 3, requiresGem: false },
  { name: "Tal", level: 7, upgradeRatio: 3, requiresGem: false },
  { name: "Ral", level: 8, upgradeRatio: 3, requiresGem: false },
  { name: "Ort", level: 9, upgradeRatio: 3, requiresGem: false },
  { name: "Thul", level: 10, upgradeRatio: 3, requiresGem: false },
  { name: "Amn", level: 11, upgradeRatio: 3, requiresGem: true },
  { name: "Sol", level: 12, upgradeRatio: 3, requiresGem: true },
  { name: "Shael", level: 13, upgradeRatio: 3, requiresGem: true },
  { name: "Dol", level: 14, upgradeRatio: 3, requiresGem: true },
  { name: "Hel", level: 15, upgradeRatio: 3, requiresGem: true },
  { name: "Io", level: 16, upgradeRatio: 3, requiresGem: true },
  { name: "Lum", level: 17, upgradeRatio: 3, requiresGem: true },
  { name: "Ko", level: 18, upgradeRatio: 3, requiresGem: true },
  { name: "Fal", level: 19, upgradeRatio: 3, requiresGem: true },
  { name: "Lem", level: 20, upgradeRatio: 3, requiresGem: true },
  { name: "Pul", level: 21, upgradeRatio: 2, requiresGem: true },
  { name: "Um", level: 22, upgradeRatio: 2, requiresGem: true },
  { name: "Mal", level: 23, upgradeRatio: 2, requiresGem: true },
  { name: "Ist", level: 24, upgradeRatio: 2, requiresGem: true },
  { name: "Gul", level: 25, upgradeRatio: 2, requiresGem: true },
  { name: "Vex", level: 26, upgradeRatio: 2, requiresGem: true },
  { name: "Ohm", level: 27, upgradeRatio: 2, requiresGem: true },
  { name: "Lo", level: 28, upgradeRatio: 2, requiresGem: true },
  { name: "Sur", level: 29, upgradeRatio: 2, requiresGem: true },
  { name: "Ber", level: 30, upgradeRatio: 2, requiresGem: true },
  { name: "Jah", level: 31, upgradeRatio: 2, requiresGem: true },
  { name: "Cham", level: 32, upgradeRatio: 2, requiresGem: true },
  { name: "Zod", level: 33, upgradeRatio: 2, requiresGem: true },
];

export const RUNE_ORDER: string[] = RUNE_DEFINITIONS.map((r) => r.name);
