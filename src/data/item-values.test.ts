import { describe, it, expect } from "vitest";
import {
  getItemTier,
  getItemTierName,
  calculateTotalValue,
  getTierBreakdown,
  TIERS,
  TIER_NAMES,
} from "./item-values";

describe("Item Value Estimation", () => {
  describe("Tier definitions", () => {
    it("should have 5 tiers with correct point values", () => {
      expect(TIERS.worthless.points).toBe(0);
      expect(TIERS.low.points).toBe(1);
      expect(TIERS.mid.points).toBe(3);
      expect(TIERS.high.points).toBe(8);
      expect(TIERS.gg.points).toBe(20);
    });

    it("should have correct colors", () => {
      expect(TIERS.worthless.color).toBe("#6b7280");
      expect(TIERS.low.color).toBe("#22c55e");
      expect(TIERS.mid.color).toBe("#3b82f6");
      expect(TIERS.high.color).toBe("#a855f7");
      expect(TIERS.gg.color).toBe("#f59e0b");
    });

    it("should have 5 tier names in order", () => {
      expect(TIER_NAMES).toEqual(["worthless", "low", "mid", "high", "gg"]);
    });
  });

  describe("Rune tiers", () => {
    it("should classify El-Dol runes as worthless", () => {
      expect(getItemTierName("El Rune", "Rune")).toBe("worthless");
      expect(getItemTierName("Eld Rune", "Rune")).toBe("worthless");
      expect(getItemTierName("Dol Rune", "Rune")).toBe("worthless");
      expect(getItemTierName("Thul Rune", "Rune")).toBe("worthless");
      expect(getItemTierName("Amn Rune", "Rune")).toBe("worthless");
    });

    it("should classify Hel-Lem runes as low", () => {
      expect(getItemTierName("Hel Rune", "Rune")).toBe("low");
      expect(getItemTierName("Io Rune", "Rune")).toBe("low");
      expect(getItemTierName("Lem Rune", "Rune")).toBe("low");
    });

    it("should classify Pul-Ist runes as mid", () => {
      expect(getItemTierName("Pul Rune", "Rune")).toBe("mid");
      expect(getItemTierName("Um Rune", "Rune")).toBe("mid");
      expect(getItemTierName("Mal Rune", "Rune")).toBe("mid");
      expect(getItemTierName("Ist Rune", "Rune")).toBe("mid");
    });

    it("should classify Gul-Lo runes as high", () => {
      expect(getItemTierName("Gul Rune", "Rune")).toBe("high");
      expect(getItemTierName("Vex Rune", "Rune")).toBe("high");
      expect(getItemTierName("Ohm Rune", "Rune")).toBe("high");
      expect(getItemTierName("Lo Rune", "Rune")).toBe("high");
    });

    it("should classify Sur-Zod runes as gg", () => {
      expect(getItemTierName("Sur Rune", "Rune")).toBe("gg");
      expect(getItemTierName("Ber Rune", "Rune")).toBe("gg");
      expect(getItemTierName("Jah Rune", "Rune")).toBe("gg");
      expect(getItemTierName("Cham Rune", "Rune")).toBe("gg");
      expect(getItemTierName("Zod Rune", "Rune")).toBe("gg");
    });

    it("should follow ascending progression from worthless to gg", () => {
      const runes = ["El Rune", "Hel Rune", "Pul Rune", "Gul Rune", "Ber Rune"];
      const tiers = runes.map((r) => getItemTier(r, "Rune").points);
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
      }
    });
  });

  describe("Runeword tiers", () => {
    it("should classify GG runewords correctly", () => {
      expect(getItemTierName("Enigma", "Runeword")).toBe("gg");
      expect(getItemTierName("Infinity", "Runeword")).toBe("gg");
      expect(getItemTierName("Last Wish", "Runeword")).toBe("gg");
      expect(getItemTierName("Grief", "Runeword")).toBe("gg");
    });

    it("should classify high runewords correctly", () => {
      expect(getItemTierName("Heart of the Oak", "Runeword")).toBe("high");
      expect(getItemTierName("Call to Arms", "Runeword")).toBe("high");
      expect(getItemTierName("Fortitude", "Runeword")).toBe("high");
    });

    it("should classify mid runewords correctly", () => {
      expect(getItemTierName("Spirit", "Runeword")).toBe("mid");
      expect(getItemTierName("Insight", "Runeword")).toBe("mid");
      expect(getItemTierName("Treachery", "Runeword")).toBe("mid");
    });

    it("should classify low runewords correctly", () => {
      expect(getItemTierName("Stealth", "Runeword")).toBe("low");
      expect(getItemTierName("Lore", "Runeword")).toBe("low");
      expect(getItemTierName("Ancient's Pledge", "Runeword")).toBe("low");
    });
  });

  describe("Unique item tiers", () => {
    it("should classify GG uniques correctly", () => {
      expect(getItemTierName("Tyrael's Might", "Unique")).toBe("gg");
      expect(getItemTierName("Griffon's Eye", "Unique")).toBe("gg");
      expect(getItemTierName("Death's Fathom", "Unique")).toBe("gg");
      expect(getItemTierName("Windforce", "Unique")).toBe("gg");
    });

    it("should classify high uniques correctly", () => {
      expect(getItemTierName("Harlequin Crest", "Unique")).toBe("high");
      expect(getItemTierName("Arachnid Mesh", "Unique")).toBe("high");
      expect(getItemTierName("War Traveler", "Unique")).toBe("high");
      expect(getItemTierName("Stone of Jordan", "Unique")).toBe("high");
      expect(getItemTierName("Mara's Kaleidoscope", "Unique")).toBe("high");
    });

    it("should classify mid uniques correctly", () => {
      expect(getItemTierName("Skin of the Vipermagi", "Unique")).toBe("mid");
      expect(getItemTierName("Goldwrap", "Unique")).toBe("mid");
      expect(getItemTierName("Magefist", "Unique")).toBe("mid");
      expect(getItemTierName("Chance Guards", "Unique")).toBe("mid");
    });

    it("should default unknown uniques to worthless", () => {
      expect(getItemTierName("The Gnasher", "Unique")).toBe("worthless");
      expect(getItemTierName("Biggin's Bonnet", "Unique")).toBe("worthless");
    });
  });

  describe("Set item tiers", () => {
    it("should classify high set items correctly", () => {
      expect(getItemTierName("Tal Rasha's Guardianship", "Set")).toBe("high");
      expect(getItemTierName("Immortal King's Stone Crusher", "Set")).toBe("high");
    });

    it("should classify mid set items correctly", () => {
      expect(getItemTierName("Guillaume's Face", "Set")).toBe("mid");
      expect(getItemTierName("Tal Rasha's Adjudication", "Set")).toBe("mid");
    });

    it("should default unknown set items to worthless", () => {
      expect(getItemTierName("Arctic Horn", "Set")).toBe("worthless");
      expect(getItemTierName("Cathan's Rule", "Set")).toBe("worthless");
    });
  });

  describe("Charm tiers", () => {
    it("should classify Annihilus and Torch as GG", () => {
      expect(getItemTierName("Annihilus", "Charm")).toBe("gg");
      expect(getItemTierName("Hellfire Torch", "Charm")).toBe("gg");
    });

    it("should classify skillers as mid", () => {
      expect(getItemTierName("Grand Charm +1 Sorceress Skills", "Charm")).toBe("mid");
      expect(getItemTierName("Grand Charm +1 Paladin Skills", "Charm")).toBe("mid");
    });

    it("should classify sunder charms as high", () => {
      expect(getItemTierName("Cold Rupture (Cold Sunder)", "Charm")).toBe("high");
      expect(getItemTierName("Crack of the Heavens (Lightning Sunder)", "Charm")).toBe("high");
    });
  });

  describe("Jewel tiers", () => {
    it("should classify 15/40 jewel as GG", () => {
      expect(getItemTierName("Jewel 15% IAS / 40 ED", "Jewel")).toBe("gg");
    });

    it("should classify facets as high", () => {
      expect(getItemTierName("Jewel -5/+5 Lightning Facet (Die)", "Jewel")).toBe("high");
      expect(getItemTierName("Jewel -5/+5 Cold Facet (Level)", "Jewel")).toBe("high");
    });
  });

  describe("getItemTier function", () => {
    it("should return full tier object", () => {
      const tier = getItemTier("Ber Rune", "Rune");
      expect(tier.name).toBe("gg");
      expect(tier.points).toBe(20);
      expect(tier.color).toBe("#f59e0b");
      expect(tier.cssClass).toBe("tier-gg");
      expect(tier.label).toBe("GG");
    });

    it("should work without explicit category (using name detection)", () => {
      expect(getItemTier("Zod Rune").name).toBe("gg");
      expect(getItemTier("Enigma").name).toBe("gg");
    });

    it("should default truly unknown items to worthless", () => {
      expect(getItemTier("Some Random Item Nobody Knows").name).toBe("worthless");
    });
  });

  describe("calculateTotalValue", () => {
    it("should sum points correctly", () => {
      const items = [
        { name: "Ber Rune", rarity: "Rune" },      // 20
        { name: "Ist Rune", rarity: "Rune" },      // 3
        { name: "El Rune", rarity: "Rune" },       // 0
      ];
      expect(calculateTotalValue(items)).toBe(23);
    });

    it("should return 0 for empty array", () => {
      expect(calculateTotalValue([])).toBe(0);
    });

    it("should return 0 for all worthless items", () => {
      const items = [
        { name: "El Rune", rarity: "Rune" },
        { name: "The Gnasher", rarity: "Unique" },
      ];
      expect(calculateTotalValue(items)).toBe(0);
    });
  });

  describe("getTierBreakdown", () => {
    it("should count items per tier correctly", () => {
      const items = [
        { name: "Ber Rune", rarity: "Rune" },         // gg
        { name: "Jah Rune", rarity: "Rune" },         // gg
        { name: "Vex Rune", rarity: "Rune" },         // high
        { name: "Ist Rune", rarity: "Rune" },         // mid
        { name: "Hel Rune", rarity: "Rune" },         // low
        { name: "El Rune", rarity: "Rune" },          // worthless
      ];
      const breakdown = getTierBreakdown(items);
      expect(breakdown.gg).toBe(2);
      expect(breakdown.high).toBe(1);
      expect(breakdown.mid).toBe(1);
      expect(breakdown.low).toBe(1);
      expect(breakdown.worthless).toBe(1);
    });

    it("should return all zeros for empty array", () => {
      const breakdown = getTierBreakdown([]);
      expect(breakdown).toEqual({ worthless: 0, low: 0, mid: 0, high: 0, gg: 0 });
    });
  });
});
