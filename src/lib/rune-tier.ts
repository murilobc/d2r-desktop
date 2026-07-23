// Rune tier classification utility
// Computes visual styling based on rune level and count

export type RuneTier = "normal" | "mid-high" | "ultra-high";

export interface RuneCellStyle {
  tier: RuneTier;
  borderClass: string; // "" | "rune-cell--high"
  countColorClass: string; // "" | "rune-cell__count--success" | "rune-cell__count--unique"
  isZero: boolean;
}

/**
 * Pure function: given a rune level and count, compute the styling classification.
 * - level < 21: normal (default border, default text color)
 * - level 21-29: mid-high (accent border at 40%, count in --success when count > 0)
 * - level >= 30: ultra-high (accent border at 40%, count in --unique when count > 0)
 * - count === 0: opacity 0.35 regardless of tier
 */
export function classifyRuneCell(level: number, count: number): RuneCellStyle {
  const isZero = count === 0;

  if (level >= 30) {
    return {
      tier: "ultra-high",
      borderClass: "rune-cell--high",
      countColorClass: isZero ? "" : "rune-cell__count--unique",
      isZero,
    };
  }

  if (level >= 21) {
    return {
      tier: "mid-high",
      borderClass: "rune-cell--high",
      countColorClass: isZero ? "" : "rune-cell__count--success",
      isZero,
    };
  }

  return {
    tier: "normal",
    borderClass: "",
    countColorClass: "",
    isZero,
  };
}
