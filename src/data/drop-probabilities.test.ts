import { describe, it, expect } from "vitest";
import { DROP_TABLES, adjustForMF, adjustForPlayers } from "./drop-probabilities";

describe("Drop Probabilities", () => {
  describe("adjustForMF", () => {
    it("does not adjust rune drops", () => {
      expect(adjustForMF(1000, 300, "Rune")).toBe(1000);
      expect(adjustForMF(1000, 999, "Rune")).toBe(1000);
    });

    it("adjusts unique drops correctly (factor 250)", () => {
      // 300 MF: effective = 300*250/(300+250) = 136.36
      // multiplier = 1 + 136.36/100 = 2.3636
      // adjusted = 1000 / 2.3636 ≈ 423
      const result = adjustForMF(1000, 300, "Unique");
      expect(result).toBeGreaterThan(400);
      expect(result).toBeLessThan(450);
    });

    it("adjusts set drops correctly (factor 500)", () => {
      // 300 MF: effective = 300*500/(300+500) = 187.5
      // multiplier = 1 + 187.5/100 = 2.875
      // adjusted = 1000 / 2.875 ≈ 348
      const result = adjustForMF(1000, 300, "Set");
      expect(result).toBeGreaterThan(330);
      expect(result).toBeLessThan(360);
    });

    it("0 MF returns base chance", () => {
      expect(adjustForMF(1000, 0, "Unique")).toBe(1000);
      expect(adjustForMF(1000, 0, "Set")).toBe(1000);
    });
  });

  describe("adjustForPlayers", () => {
    it("players 1 returns base chance", () => {
      expect(adjustForPlayers(1000, 1)).toBe(1000);
    });

    it("more players reduces chance (better odds)", () => {
      const base = adjustForPlayers(1000, 1);
      const p3 = adjustForPlayers(1000, 3);
      const p7 = adjustForPlayers(1000, 7);
      expect(p3).toBeLessThan(base);
      expect(p7).toBeLessThan(p3);
    });
  });

  describe("DROP_TABLES data", () => {
    it("has tables defined", () => {
      expect(DROP_TABLES.length).toBeGreaterThan(10);
    });

    it("all tables have required fields", () => {
      for (const table of DROP_TABLES) {
        expect(table.monster).toBeTruthy();
        expect(table.type).toMatch(/Boss|Super Unique|Area/);
        expect(table.area).toBeTruthy();
        expect(table.drops).toBeGreaterThan(0);
        expect(table.items.length).toBeGreaterThan(0);
      }
    });

    it("all items have valid base chances", () => {
      for (const table of DROP_TABLES) {
        for (const item of table.items) {
          expect(item.baseChance).toBeGreaterThan(0);
          expect(item.item).toBeTruthy();
          expect(item.rarity).toMatch(/Unique|Set|Rune/);
        }
      }
    });

    it("rune items are marked as not MF affected", () => {
      for (const table of DROP_TABLES) {
        for (const item of table.items) {
          if (item.rarity === "Rune") {
            expect(item.mfAffected).toBe(false);
          }
        }
      }
    });

    it("includes Mephisto", () => {
      const meph = DROP_TABLES.find((t) => t.monster === "Mephisto");
      expect(meph).toBeDefined();
      expect(meph!.items.find((i) => i.item.includes("Shako"))).toBeDefined();
    });

    it("includes Lower Kurast super chests", () => {
      const lk = DROP_TABLES.find((t) => t.monster.includes("Lower Kurast"));
      expect(lk).toBeDefined();
      expect(lk!.items.find((i) => i.item === "Ber Rune")).toBeDefined();
    });
  });
});
