import { describe, it, expect } from "vitest";
import { calculateUpgradePath } from "./cube-engine";
import type { RuneInventory } from "./eligibility-engine";

describe("cube-engine", () => {
  describe("calculateUpgradePath", () => {
    it("returns empty steps for El (level 1 rune)", () => {
      const result = calculateUpgradePath("El", {});
      expect(result.targetRune).toBe("El");
      expect(result.steps).toHaveLength(0);
      expect(result.totalBaseRunes).toBe(0);
    });

    it("returns empty steps for an invalid rune name", () => {
      const result = calculateUpgradePath("InvalidRune", {});
      expect(result.steps).toHaveLength(0);
      expect(result.alreadyOwned).toBe(false);
      expect(result.totalBaseRunes).toBe(0);
    });

    it("marks alreadyOwned when target rune is in inventory", () => {
      const inventory: RuneInventory = { Ber: 1 };
      const result = calculateUpgradePath("Ber", inventory);
      expect(result.alreadyOwned).toBe(true);
    });

    it("marks alreadyOwned=false when target rune not in inventory", () => {
      const inventory: RuneInventory = {};
      const result = calculateUpgradePath("Ber", inventory);
      expect(result.alreadyOwned).toBe(false);
    });

    it("computes correct path for Eld (level 2) with empty inventory", () => {
      // Eld is level 2, El is level 1 with ratio 3:1
      // Need 1 Eld → need 3 El
      const result = calculateUpgradePath("Eld", {});
      expect(result.steps).toHaveLength(2);

      // Steps are from lowest to target
      expect(result.steps[0].rune).toBe("El");
      expect(result.steps[0].needed).toBe(3);
      expect(result.steps[0].remaining).toBe(3);

      expect(result.steps[1].rune).toBe("Eld");
      expect(result.steps[1].needed).toBe(1);
      expect(result.steps[1].remaining).toBe(1);

      expect(result.totalBaseRunes).toBe(3);
    });

    it("computes correct path for Tir (level 3) with empty inventory", () => {
      // Tir is level 3
      // Need 1 Tir → 3 Eld → 9 El (3 * 3)
      const result = calculateUpgradePath("Tir", {});
      expect(result.steps).toHaveLength(3);

      expect(result.steps[0].rune).toBe("El");
      expect(result.steps[0].needed).toBe(9);
      expect(result.steps[0].remaining).toBe(9);

      expect(result.steps[1].rune).toBe("Eld");
      expect(result.steps[1].needed).toBe(3);
      expect(result.steps[1].remaining).toBe(3);

      expect(result.steps[2].rune).toBe("Tir");
      expect(result.steps[2].needed).toBe(1);
      expect(result.steps[2].remaining).toBe(1);

      expect(result.totalBaseRunes).toBe(9);
    });

    it("accounts for inventory runes at intermediate tiers", () => {
      // Target: Tir (level 3). Need 1 Tir → 3 Eld → 9 El
      // Inventory has 2 Eld. So remaining Eld = 3 - 2 = 1 → need 1*3 = 3 El
      const inventory: RuneInventory = { Eld: 2 };
      const result = calculateUpgradePath("Tir", inventory);

      expect(result.steps[0].rune).toBe("El");
      expect(result.steps[0].needed).toBe(3); // Only 1 Eld remaining * 3
      expect(result.steps[0].remaining).toBe(3);

      expect(result.steps[1].rune).toBe("Eld");
      expect(result.steps[1].needed).toBe(3);
      expect(result.steps[1].have).toBe(2);
      expect(result.steps[1].remaining).toBe(1);

      expect(result.totalBaseRunes).toBe(3);
    });

    it("stops propagation when inventory fully covers a tier", () => {
      // Target: Tir (level 3). Inventory has 3+ Eld → remaining Eld = 0 → no El needed
      const inventory: RuneInventory = { Eld: 3 };
      const result = calculateUpgradePath("Tir", inventory);

      // Steps still include Eld and Tir, but El should not be needed
      // Because remaining at Eld = 0, the loop stops
      const elStep = result.steps.find((s) => s.rune === "El");
      expect(elStep).toBeUndefined(); // Loop exits when neededFromBelow = 0

      expect(result.totalBaseRunes).toBe(0);
    });

    it("uses 2:1 ratio for high-tier runes (Pul and above)", () => {
      // Pul is level 21 (ratio 2:1 to upgrade FROM Lem)
      // Wait — the ratio stored on a rune is for upgrading FROM that rune.
      // Lem (level 20) has ratio 3. So 3 Lem → 1 Pul
      // Um (level 22): Pul (level 21) has ratio 2. So 2 Pul → 1 Um
      const result = calculateUpgradePath("Um", {});

      // Find Pul step
      const pulStep = result.steps.find((s) => s.rune === "Pul");
      expect(pulStep).toBeDefined();
      expect(pulStep!.needed).toBe(2); // 2 Pul to make 1 Um

      // Find Lem step
      const lemStep = result.steps.find((s) => s.rune === "Lem");
      expect(lemStep).toBeDefined();
      expect(lemStep!.needed).toBe(6); // 2 Pul needed, each needs 3 Lem = 6
    });

    it("returns zero totalBaseRunes when target already owned", () => {
      const inventory: RuneInventory = { Tir: 1 };
      const result = calculateUpgradePath("Tir", inventory);
      expect(result.alreadyOwned).toBe(true);
      expect(result.totalBaseRunes).toBe(0);
    });

    it("correctly handles partial inventory at target level", () => {
      // Target: Eld. User has 1 Eld (already owned).
      // remaining at target = max(0, 1 - 1) = 0, no lower runes needed
      const inventory: RuneInventory = { Eld: 1 };
      const result = calculateUpgradePath("Eld", inventory);
      expect(result.alreadyOwned).toBe(true);
      expect(result.totalBaseRunes).toBe(0);
    });
  });
});
