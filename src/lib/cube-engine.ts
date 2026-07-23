// Horadric Cube upgrade path calculator
// Computes tier-by-tier rune requirements to reach a target rune
// Upgrade ratios: 3:1 for levels 1-20 (El through Lem), 2:1 for levels 21-33 (Pul through Zod)

import { RUNE_DEFINITIONS } from "../data/runes";
import type { RuneInventory } from "./eligibility-engine";

export interface UpgradeStep {
  rune: string;
  level: number;
  needed: number; // Total needed at this tier
  have: number; // Currently in inventory
  remaining: number; // needed - have (min 0)
}

export interface UpgradePath {
  targetRune: string;
  steps: UpgradeStep[]; // From lowest needed tier up to target
  alreadyOwned: boolean; // True if user already has target rune
  totalBaseRunes: number; // Total El-equivalent runes needed
}

/**
 * Calculate the upgrade path from lower-tier runes to a target rune,
 * accounting for runes already in the player's inventory.
 *
 * Algorithm:
 * 1. Find the target rune's level in RUNE_DEFINITIONS
 * 2. Work backwards from the target: to produce 1 of rune at level N,
 *    you need `upgradeRatio` of the rune at level N-1
 * 3. At each tier, subtract inventory runes from the needed count
 * 4. Only propagate the `remaining` amount to lower tiers
 * 5. If remaining is 0 at a tier, no lower-tier runes are needed for that portion
 */
export function calculateUpgradePath(
  targetRune: string,
  inventory: RuneInventory
): UpgradePath {
  const targetDef = RUNE_DEFINITIONS.find((r) => r.name === targetRune);

  if (!targetDef) {
    return {
      targetRune,
      steps: [],
      alreadyOwned: false,
      totalBaseRunes: 0,
    };
  }

  const targetCount = inventory[targetRune] ?? 0;
  const alreadyOwned = targetCount >= 1;

  // If target is level 1 (El), no upgrade path exists
  if (targetDef.level === 1) {
    return {
      targetRune,
      steps: [],
      alreadyOwned,
      totalBaseRunes: 0,
    };
  }

  // Build steps from target down to the lowest needed tier
  // We need 1 of the target rune. Work backwards computing how many
  // of each lower rune are needed.
  const stepsDescending: UpgradeStep[] = [];

  // Start: we need 1 of the target rune
  const targetHave = inventory[targetRune] ?? 0;
  const targetRemaining = Math.max(0, 1 - targetHave);

  stepsDescending.push({
    rune: targetDef.name,
    level: targetDef.level,
    needed: 1,
    have: targetHave,
    remaining: targetRemaining,
  });

  // Work backwards through tiers
  let neededFromBelow = targetRemaining;

  for (let level = targetDef.level - 1; level >= 1 && neededFromBelow > 0; level--) {
    const runeDef = RUNE_DEFINITIONS[level - 1]; // level is 1-indexed, array is 0-indexed
    // The ratio to upgrade FROM this rune TO the next one is this rune's upgradeRatio
    const ratio = runeDef.upgradeRatio;
    const needed = neededFromBelow * ratio;
    const have = inventory[runeDef.name] ?? 0;
    const remaining = Math.max(0, needed - have);

    stepsDescending.push({
      rune: runeDef.name,
      level: runeDef.level,
      needed,
      have,
      remaining,
    });

    neededFromBelow = remaining;
  }

  // Reverse to get steps from lowest tier up to target
  stepsDescending.reverse();
  const steps = stepsDescending;

  // Calculate totalBaseRunes: the El-equivalent cost
  // This is the `remaining` at the lowest tier (El level, or wherever the path bottoms out)
  // If the path doesn't go all the way to El, we compute how many El would be needed
  // to produce the remaining at the lowest step
  const totalBaseRunes = computeElEquivalent(steps);

  return {
    targetRune,
    steps,
    alreadyOwned,
    totalBaseRunes,
  };
}

/**
 * Compute the El-equivalent cost from the lowest step in the path.
 * If the lowest step is El (level 1), totalBaseRunes = remaining at that step.
 * If the lowest step is higher, we multiply down through the ratios to get El-equivalent.
 */
function computeElEquivalent(steps: UpgradeStep[]): number {
  if (steps.length === 0) {
    return 0;
  }

  const lowestStep = steps[0];

  if (lowestStep.level === 1) {
    return lowestStep.remaining;
  }

  // Multiply the remaining at the lowest step by all ratios below it
  let elEquivalent = lowestStep.remaining;
  for (let level = lowestStep.level - 1; level >= 1; level--) {
    const runeDef = RUNE_DEFINITIONS[level - 1];
    elEquivalent *= runeDef.upgradeRatio;
  }

  return elEquivalent;
}
