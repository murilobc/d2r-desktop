/**
 * Validates a string as a rune count input.
 * Returns the parsed integer if valid (0-99 inclusive, non-negative integer),
 * or null if invalid (empty, non-numeric, negative, > 99, decimal).
 */
export function validateRuneCountInput(value: string): number | null {
  // Reject empty strings
  if (value === "") {
    return null;
  }

  // Only accept strings that are purely digits (no whitespace, signs, decimals, etc.)
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  // Reject values outside the valid range
  if (parsed > 99) {
    return null;
  }

  return parsed;
}
