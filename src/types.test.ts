import { describe, it, expect } from "vitest";
import { D2R_CLASSES, GAME_MODES, AREAS, RARITIES, ITEM_TYPES } from "./types";

describe("Type Constants", () => {
  it("should have 8 classes including Warlock", () => {
    expect(D2R_CLASSES).toHaveLength(8);
    expect(D2R_CLASSES).toContain("Warlock");
  });

  it("should have all original D2 classes", () => {
    const expected = ["Amazon", "Necromancer", "Barbarian", "Sorceress", "Paladin", "Druid", "Assassin"];
    for (const cls of expected) {
      expect(D2R_CLASSES).toContain(cls);
    }
  });

  it("should have 3 game modes", () => {
    expect(GAME_MODES).toHaveLength(3);
    expect(GAME_MODES).toContain("Ladder");
    expect(GAME_MODES).toContain("Non-Ladder");
    expect(GAME_MODES).toContain("Single Player");
  });

  it("should have farming areas", () => {
    expect(AREAS.length).toBeGreaterThan(10);
    expect(AREAS).toContain("Mephisto");
    expect(AREAS).toContain("Ancient Tunnels");
    expect(AREAS).toContain("Chaos Sanctuary");
    expect(AREAS).toContain("Baal");
    expect(AREAS).toContain("Other");
  });

  it("should have rarities", () => {
    expect(RARITIES).toContain("Unique");
    expect(RARITIES).toContain("Set");
    expect(RARITIES).toContain("Rune");
    expect(RARITIES).toContain("Runeword");
  });

  it("should have item types", () => {
    expect(ITEM_TYPES).toContain("Weapon");
    expect(ITEM_TYPES).toContain("Armor");
    expect(ITEM_TYPES).toContain("Ring");
    expect(ITEM_TYPES).toContain("Amulet");
  });

  it("should have no duplicate entries in any constant array", () => {
    const checkDuplicates = (arr: string[], name: string) => {
      const set = new Set(arr);
      expect(set.size, `Duplicates in ${name}`).toBe(arr.length);
    };

    checkDuplicates(D2R_CLASSES, "D2R_CLASSES");
    checkDuplicates(GAME_MODES, "GAME_MODES");
    checkDuplicates(AREAS, "AREAS");
    checkDuplicates(RARITIES, "RARITIES");
    checkDuplicates(ITEM_TYPES, "ITEM_TYPES");
  });
});
