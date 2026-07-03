/**
 * D2R Experience requirements per level (1-99).
 * Index 0 = total XP needed to reach level 2, etc.
 * Based on official D2R data.
 */
export const XP_TABLE: number[] = [
  // Level 2-10
  500, 1500, 3750, 7875, 14175, 22680, 32886, 44396, 57715,
  // Level 11-20
  72144, 90180, 112725, 140906, 176132, 220165, 275207, 344008, 430010, 537513,
  // Level 21-30
  671891, 839864, 1049830, 1312287, 1640359, 2050449, 2563061, 3203826, 3902260, 4663553,
  // Level 31-40
  5493363, 6397855, 7383752, 8458379, 9629723, 10906488, 12298162, 13815086, 15468534, 17270791,
  // Level 41-50
  19235252, 21376515, 23710491, 26254525, 29027522, 32050112, 35344686, 38935798, 42850109, 47116709,
  // Level 51-60
  51767934, 56836449, 62357505, 68368421, 74909040, 82021370, 89749816, 98141835, 107247677, 117120895,
  // Level 61-70
  127819372, 139405834, 151948052, 165518016, 180192560, 196054384, 213193206, 231705712, 251696752, 273280784,
  // Level 71-80
  296582880, 321740160, 348903072, 378236736, 409921248, 444152960, 481146432, 521136576, 564281856, 610764416,
  // Level 81-90
  660802048, 714639040, 772558720, 834884992, 901884096, 973866432, 1051191424, 1134267648, 1223556736, 1319576320,
  // Level 91-99
  1422903168, 1534180992, 1654114688, 1783473280, 1923094656, 2073886336, 2236830592, 2412987136, 2603496192,
];

/**
 * Get the total XP required to reach a given level.
 * @param level - Target level (2-99)
 * @returns Total cumulative XP required, or 0 if level is invalid
 */
export function getXpForLevel(level: number): number {
  if (level < 2 || level > 99) return 0;
  return XP_TABLE[level - 2];
}

/**
 * Get the XP required to go from one level to the next.
 * @param currentLevel - Current level (1-98)
 * @returns XP needed for the next level up
 */
export function getXpToNextLevel(currentLevel: number): number {
  if (currentLevel < 1 || currentLevel >= 99) return 0;
  if (currentLevel === 1) return XP_TABLE[0];
  return XP_TABLE[currentLevel - 1] - XP_TABLE[currentLevel - 2];
}

/**
 * Estimate time to reach next level based on current XP rate.
 * @param currentLevel - Current character level
 * @param currentXpInLevel - XP already earned toward next level
 * @param xpPerHour - Current XP/hour rate
 * @returns Estimated seconds until next level, or null if rate is 0
 */
export function estimateTimeToLevel(
  currentLevel: number,
  currentXpInLevel: number,
  xpPerHour: number
): number | null {
  if (xpPerHour <= 0) return null;
  const xpNeeded = getXpToNextLevel(currentLevel) - currentXpInLevel;
  if (xpNeeded <= 0) return 0;
  return Math.ceil((xpNeeded / xpPerHour) * 3600);
}

/**
 * Format large XP numbers in a human-readable way.
 */
export function formatXp(xp: number): string {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(2)}B`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
  return xp.toString();
}
