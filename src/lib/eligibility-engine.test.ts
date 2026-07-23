import { describe, it, expect } from "vitest";
import {
  calculateEligibility,
  calculateProgress,
  type RuneInventory,
} from "./eligibility-engine";
import type { RunewordRecipe } from "../data/runewords";

const enigma: RunewordRecipe = {
  name: "Enigma",
  runes: ["Jah", "Ith", "Ber"],
  bases: ["armor"],
  sockets: 3,
};

const infinity: RunewordRecipe = {
  name: "Infinity",
  runes: ["Ber", "Mal", "Ber", "Ist"],
  bases: ["weapon"],
  sockets: 4,
};

const leaf: RunewordRecipe = {
  name: "Leaf",
  runes: ["Tir", "Ral"],
  bases: ["weapon"],
  sockets: 2,
};

describe("calculateProgress", () => {
  it("returns craftable=true when all runes are available", () => {
    const inventory: RuneInventory = { Jah: 1, Ith: 2, Ber: 1 };
    const result = calculateProgress(inventory, enigma);

    expect(result.craftable).toBe(true);
    expect(result.percentComplete).toBe(100);
    expect(result.missingRunes).toEqual([]);
    expect(result.runeword).toBe(enigma);
  });

  it("returns craftable=false when some runes are missing", () => {
    const inventory: RuneInventory = { Jah: 1, Ith: 0 };
    const result = calculateProgress(inventory, enigma);

    expect(result.craftable).toBe(false);
    expect(result.missingRunes).toContainEqual({
      rune: "Ith",
      needed: 1,
      have: 0,
    });
    expect(result.missingRunes).toContainEqual({
      rune: "Ber",
      needed: 1,
      have: 0,
    });
  });

  it("accounts for duplicate runes in a recipe", () => {
    // Infinity needs 2x Ber
    const inventory: RuneInventory = { Ber: 1, Mal: 1, Ist: 1 };
    const result = calculateProgress(inventory, infinity);

    expect(result.craftable).toBe(false);
    expect(result.missingRunes).toContainEqual({
      rune: "Ber",
      needed: 2,
      have: 1,
    });
  });

  it("marks craftable when duplicate runes are fully met", () => {
    const inventory: RuneInventory = { Ber: 2, Mal: 1, Ist: 1 };
    const result = calculateProgress(inventory, infinity);

    expect(result.craftable).toBe(true);
    expect(result.missingRunes).toEqual([]);
  });

  it("calculates percentComplete correctly for partial progress", () => {
    // Enigma needs Jah(1), Ith(1), Ber(1) — total 3 needed
    // Have Jah(1), Ith(0), Ber(0) — total min(have,needed) = 1
    const inventory: RuneInventory = { Jah: 1 };
    const result = calculateProgress(inventory, enigma);

    // 1/3 * 100 = 33.33...
    expect(result.percentComplete).toBeCloseTo(33.33, 1);
  });

  it("returns 0% for empty inventory", () => {
    const inventory: RuneInventory = {};
    const result = calculateProgress(inventory, enigma);

    expect(result.percentComplete).toBe(0);
    expect(result.craftable).toBe(false);
    expect(result.missingRunes).toHaveLength(3);
  });

  it("does not count excess runes beyond what is needed", () => {
    // Having 10 Tir and 5 Ral still = 100%
    const inventory: RuneInventory = { Tir: 10, Ral: 5 };
    const result = calculateProgress(inventory, leaf);

    expect(result.percentComplete).toBe(100);
    expect(result.craftable).toBe(true);
  });
});

describe("calculateEligibility", () => {
  it("returns results for all recipes", () => {
    const recipes = [enigma, infinity, leaf];
    const inventory: RuneInventory = { Tir: 1, Ral: 1 };
    const results = calculateEligibility(inventory, recipes);

    expect(results).toHaveLength(3);
  });

  it("correctly identifies craftable vs non-craftable runewords", () => {
    const recipes = [enigma, leaf];
    const inventory: RuneInventory = { Tir: 1, Ral: 1 };
    const results = calculateEligibility(inventory, recipes);

    const leafResult = results.find((r) => r.runeword.name === "Leaf");
    const enigmaResult = results.find((r) => r.runeword.name === "Enigma");

    expect(leafResult?.craftable).toBe(true);
    expect(enigmaResult?.craftable).toBe(false);
  });

  it("handles empty recipe list", () => {
    const inventory: RuneInventory = { Ber: 5 };
    const results = calculateEligibility(inventory, []);

    expect(results).toEqual([]);
  });

  it("handles empty inventory against all recipes", () => {
    const recipes = [enigma, infinity, leaf];
    const inventory: RuneInventory = {};
    const results = calculateEligibility(inventory, recipes);

    expect(results.every((r) => !r.craftable)).toBe(true);
  });
});
