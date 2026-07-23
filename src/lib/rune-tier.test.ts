import { describe, it, expect } from "vitest";
import { classifyRuneCell } from "./rune-tier";

describe("classifyRuneCell", () => {
  describe("normal tier (level < 21)", () => {
    it("returns normal tier with empty classes for level 1, count > 0", () => {
      const result = classifyRuneCell(1, 5);
      expect(result.tier).toBe("normal");
      expect(result.borderClass).toBe("");
      expect(result.countColorClass).toBe("");
      expect(result.isZero).toBe(false);
    });

    it("returns normal tier with isZero true for count 0", () => {
      const result = classifyRuneCell(20, 0);
      expect(result.tier).toBe("normal");
      expect(result.borderClass).toBe("");
      expect(result.countColorClass).toBe("");
      expect(result.isZero).toBe(true);
    });
  });

  describe("mid-high tier (level 21-29)", () => {
    it("returns mid-high tier with high border and success color for count > 0", () => {
      const result = classifyRuneCell(21, 3);
      expect(result.tier).toBe("mid-high");
      expect(result.borderClass).toBe("rune-cell--high");
      expect(result.countColorClass).toBe("rune-cell__count--success");
      expect(result.isZero).toBe(false);
    });

    it("returns mid-high tier with high border and empty color for count 0", () => {
      const result = classifyRuneCell(29, 0);
      expect(result.tier).toBe("mid-high");
      expect(result.borderClass).toBe("rune-cell--high");
      expect(result.countColorClass).toBe("");
      expect(result.isZero).toBe(true);
    });
  });

  describe("ultra-high tier (level >= 30)", () => {
    it("returns ultra-high tier with high border and unique color for count > 0", () => {
      const result = classifyRuneCell(30, 1);
      expect(result.tier).toBe("ultra-high");
      expect(result.borderClass).toBe("rune-cell--high");
      expect(result.countColorClass).toBe("rune-cell__count--unique");
      expect(result.isZero).toBe(false);
    });

    it("returns ultra-high tier with high border and empty color for count 0", () => {
      const result = classifyRuneCell(33, 0);
      expect(result.tier).toBe("ultra-high");
      expect(result.borderClass).toBe("rune-cell--high");
      expect(result.countColorClass).toBe("");
      expect(result.isZero).toBe(true);
    });
  });

  describe("boundary cases", () => {
    it("level 20 is normal tier (boundary below mid-high)", () => {
      const result = classifyRuneCell(20, 5);
      expect(result.tier).toBe("normal");
      expect(result.borderClass).toBe("");
    });

    it("level 21 is mid-high tier (boundary at mid-high)", () => {
      const result = classifyRuneCell(21, 5);
      expect(result.tier).toBe("mid-high");
      expect(result.borderClass).toBe("rune-cell--high");
      expect(result.countColorClass).toBe("rune-cell__count--success");
    });

    it("level 29 is mid-high tier (boundary below ultra-high)", () => {
      const result = classifyRuneCell(29, 5);
      expect(result.tier).toBe("mid-high");
      expect(result.countColorClass).toBe("rune-cell__count--success");
    });

    it("level 30 is ultra-high tier (boundary at ultra-high)", () => {
      const result = classifyRuneCell(30, 5);
      expect(result.tier).toBe("ultra-high");
      expect(result.countColorClass).toBe("rune-cell__count--unique");
    });
  });
});
