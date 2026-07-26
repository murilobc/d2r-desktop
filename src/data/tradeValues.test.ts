import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { TRADE_VALUES, getTradeValue, SOURCE_ATTRIBUTION } from "./tradeValues";
import type { TradeValueCategory } from "./tradeValues";
import { ALL_ITEMS } from "./items";

const VALID_CATEGORIES = new Set<TradeValueCategory>(["HR+", "Mid", "Low", "Self-use"]);

describe("tradeValues", () => {
  describe("SOURCE_ATTRIBUTION", () => {
    it("matches the expected format", () => {
      expect(SOURCE_ATTRIBUTION).toMatch(
        /^Values based on diablo2\.io price data as of \d{4}-\d{2}-\d{2}$/
      );
    });
  });

  describe("getTradeValue", () => {
    it("returns null for empty string", () => {
      expect(getTradeValue("")).toBeNull();
    });

    it("returns null for an unknown item name", () => {
      expect(getTradeValue("Not A Real Item XYZ")).toBeNull();
    });

    it("returns HR+ for Enigma", () => {
      expect(getTradeValue("Enigma")?.category).toBe("HR+");
    });

    it("returns HR+ for Sur Rune", () => {
      expect(getTradeValue("Sur Rune")?.category).toBe("HR+");
    });

    it("returns Mid for Heart of the Oak", () => {
      expect(getTradeValue("Heart of the Oak")?.category).toBe("Mid");
    });

    it("returns Low for Spirit", () => {
      expect(getTradeValue("Spirit")?.category).toBe("Low");
    });

    it("returns Self-use for Peasant Crown", () => {
      expect(getTradeValue("Peasant Crown")?.category).toBe("Self-use");
    });
  });

  // Feature: trade-values, Property 1: Valid Category Invariant
  it("every entry in TRADE_VALUES has a valid category (Property 1)", () => {
    for (const [key, entry] of Object.entries(TRADE_VALUES)) {
      expect(
        VALID_CATEGORIES.has(entry.category),
        `Entry "${key}" has invalid category: "${entry.category}"`
      ).toBe(true);
    }
  });

  // Feature: trade-values, Property 2: Lookup Determinism
  it("getTradeValue is deterministic for any string input (Property 2)", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const a = getTradeValue(s);
        const b = getTradeValue(s);
        expect(a).toEqual(b);
      }),
      { numRuns: 200 }
    );
  });

  // Feature: trade-values, Property 3: Null for Absent Keys
  it("getTradeValue returns null for strings not in TRADE_VALUES (Property 3)", () => {
    const knownKeys = new Set(Object.keys(TRADE_VALUES));
    fc.assert(
      fc.property(
        fc.string().filter((s) => !knownKeys.has(s)),
        (s) => {
          expect(getTradeValue(s)).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: trade-values, Property 4: Item DB Coverage Consistency
  it("every key in TRADE_VALUES matches a GameItem.name in ALL_ITEMS (Property 4)", () => {
    const itemNames = new Set(ALL_ITEMS.map((i) => i.name));
    for (const key of Object.keys(TRADE_VALUES)) {
      expect(
        itemNames.has(key),
        `Trade value key "${key}" not found in ALL_ITEMS`
      ).toBe(true);
    }
  });
});
