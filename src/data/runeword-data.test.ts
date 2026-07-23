import { describe, it, expect } from "vitest";
import { RUNE_DEFINITIONS, RUNE_ORDER } from "./runes";
import { RUNEWORD_RECIPES } from "./runewords";

describe("Rune Definitions", () => {
  it("should contain all 33 runes", () => {
    expect(RUNE_DEFINITIONS).toHaveLength(33);
  });

  it("should have levels 1 through 33 in order", () => {
    for (let i = 0; i < RUNE_DEFINITIONS.length; i++) {
      expect(RUNE_DEFINITIONS[i].level).toBe(i + 1);
    }
  });

  it("should start with El (level 1) and end with Zod (level 33)", () => {
    expect(RUNE_DEFINITIONS[0].name).toBe("El");
    expect(RUNE_DEFINITIONS[32].name).toBe("Zod");
  });

  it("should have RUNE_ORDER match RUNE_DEFINITIONS names", () => {
    expect(RUNE_ORDER).toHaveLength(33);
    for (let i = 0; i < RUNE_DEFINITIONS.length; i++) {
      expect(RUNE_ORDER[i]).toBe(RUNE_DEFINITIONS[i].name);
    }
  });

  it("should have no duplicate rune names", () => {
    const names = RUNE_DEFINITIONS.map((r) => r.name);
    expect(new Set(names).size).toBe(33);
  });
});

describe("Runeword Recipes", () => {
  it("should contain approximately 99 runeword recipes", () => {
    expect(RUNEWORD_RECIPES.length).toBeGreaterThanOrEqual(95);
    expect(RUNEWORD_RECIPES.length).toBeLessThanOrEqual(110);
  });

  it("should have socket count matching rune array length for each recipe", () => {
    const mismatches = RUNEWORD_RECIPES.filter(
      (rw) => rw.runes.length !== rw.sockets
    );
    expect(
      mismatches,
      `Mismatched recipes: ${mismatches.map((r) => `${r.name} (runes: ${r.runes.length}, sockets: ${r.sockets})`).join(", ")}`
    ).toHaveLength(0);
  });

  it("should include all 5 Reign of the Warlock runewords", () => {
    const rotwNames = ["Authority", "Coven", "Void", "Vigilance", "Ritual"];
    for (const name of rotwNames) {
      const found = RUNEWORD_RECIPES.find((rw) => rw.name === name);
      expect(found, `Missing RotW runeword: ${name}`).toBeDefined();
    }
  });

  it("should have no duplicate runeword names", () => {
    const names = RUNEWORD_RECIPES.map((rw) => rw.name);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    expect(duplicates, `Duplicate runewords: ${duplicates.join(", ")}`).toHaveLength(0);
  });

  it("should only reference runes that exist in RUNE_DEFINITIONS", () => {
    const validRuneNames = new Set(RUNE_DEFINITIONS.map((r) => r.name));
    const invalidRefs: string[] = [];

    for (const recipe of RUNEWORD_RECIPES) {
      for (const rune of recipe.runes) {
        if (!validRuneNames.has(rune)) {
          invalidRefs.push(`${recipe.name} references unknown rune "${rune}"`);
        }
      }
    }

    expect(invalidRefs, invalidRefs.join("\n")).toHaveLength(0);
  });

  it("should have at least one valid base type for each recipe", () => {
    const invalid = RUNEWORD_RECIPES.filter(
      (rw) => !rw.bases || rw.bases.length === 0
    );
    expect(invalid, `Recipes with no bases: ${invalid.map((r) => r.name).join(", ")}`).toHaveLength(0);
  });
});
