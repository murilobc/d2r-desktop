import { describe, it, expect } from "vitest";
import { ALL_ITEMS, ITEM_CATEGORIES } from "./items";
import type { GameItem } from "./items";

describe("Item Database", () => {
  it("should have items loaded", () => {
    expect(ALL_ITEMS.length).toBeGreaterThan(400);
  });

  it("should have no empty names", () => {
    const emptyNames = ALL_ITEMS.filter((item) => !item.name || item.name.trim() === "");
    expect(emptyNames).toHaveLength(0);
  });

  it("should have valid categories for all items", () => {
    const validCategories = ITEM_CATEGORIES.filter((c) => c !== "All");
    const invalidItems = ALL_ITEMS.filter(
      (item) => !validCategories.includes(item.category)
    );
    expect(invalidItems).toHaveLength(0);
  });

  it("should have no duplicate item names within the same category", () => {
    const seen = new Map<string, GameItem>();
    const duplicates: string[] = [];

    for (const item of ALL_ITEMS) {
      const key = `${item.category}:${item.name}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.set(key, item);
    }

    expect(duplicates).toHaveLength(0);
  });

  it("should contain all 33 runes", () => {
    const runes = ALL_ITEMS.filter((item) => item.category === "Rune");
    expect(runes).toHaveLength(33);
  });

  it("should contain Reign of the Warlock runewords", () => {
    const rotwRunewords = ["Authority", "Coven", "Void", "Vigilance", "Ritual"];
    for (const name of rotwRunewords) {
      const found = ALL_ITEMS.find((item) => item.name === name && item.category === "Runeword");
      expect(found, `Missing RotW runeword: ${name}`).toBeDefined();
    }
  });

  it("should contain Warlock unique grimoires", () => {
    const grimoires = ALL_ITEMS.filter((item) => item.subcategory === "Grimoire");
    expect(grimoires.length).toBeGreaterThanOrEqual(4);
  });

  it("should contain Colossal Ancient unique jewels", () => {
    const ancientJewels = ALL_ITEMS.filter(
      (item) => item.category === "Unique" && item.subcategory === "Jewel"
    );
    expect(ancientJewels.length).toBe(6);
  });

  it("should have all category values in ITEM_CATEGORIES", () => {
    const usedCategories = new Set(ALL_ITEMS.map((item) => item.category));
    const validCategories = new Set(ITEM_CATEGORIES.filter((c) => c !== "All"));
    for (const cat of usedCategories) {
      expect(validCategories.has(cat), `Category "${cat}" not in ITEM_CATEGORIES`).toBe(true);
    }
  });
});
