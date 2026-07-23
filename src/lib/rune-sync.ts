import { RUNE_ORDER } from "../data/runes";
import { updateRuneCount } from "../api";

/**
 * Parses a rune name from an item name by stripping the " Rune" suffix.
 * Returns the rune name if it's a valid D2R rune, null otherwise.
 *
 * Example: "Ber Rune" → "Ber", "Shako" → null
 */
export function parseRuneName(itemName: string): string | null {
  if (!itemName.endsWith(" Rune")) {
    return null;
  }
  const name = itemName.slice(0, -5); // Strip " Rune" (5 chars)
  if (RUNE_ORDER.includes(name)) {
    return name;
  }
  return null;
}

/**
 * Checks if a created item is a rune and auto-increments the rune inventory.
 * Should be called AFTER a successful createItem call.
 */
export async function syncRuneOnCreate(
  profileId: string,
  itemName: string,
  itemType: string,
  rarity: string,
): Promise<void> {
  if (itemType !== "Rune" || rarity !== "Rune") {
    return;
  }
  const runeName = parseRuneName(itemName);
  if (runeName) {
    await updateRuneCount(profileId, runeName, 1);
  }
}

/**
 * Checks if a deleted item is a rune and auto-decrements the rune inventory.
 * Should be called AFTER a successful deleteItem call.
 */
export async function syncRuneOnDelete(
  profileId: string,
  itemName: string,
  itemType: string,
  rarity: string,
): Promise<void> {
  if (itemType !== "Rune" || rarity !== "Rune") {
    return;
  }
  const runeName = parseRuneName(itemName);
  if (runeName) {
    await updateRuneCount(profileId, runeName, -1);
  }
}
