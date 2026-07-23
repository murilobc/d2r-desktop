import { describe, it, expect } from "vitest";
import { validateRuneCountInput } from "./rune-input-validation";

describe("validateRuneCountInput", () => {
  it("returns parsed integer for valid inputs in range 0-99", () => {
    expect(validateRuneCountInput("0")).toBe(0);
    expect(validateRuneCountInput("1")).toBe(1);
    expect(validateRuneCountInput("50")).toBe(50);
    expect(validateRuneCountInput("99")).toBe(99);
  });

  it("returns null for empty string", () => {
    expect(validateRuneCountInput("")).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(validateRuneCountInput("abc")).toBeNull();
    expect(validateRuneCountInput("12a")).toBeNull();
    expect(validateRuneCountInput("a12")).toBeNull();
    expect(validateRuneCountInput("!@#")).toBeNull();
  });

  it("returns null for negative numbers", () => {
    expect(validateRuneCountInput("-1")).toBeNull();
    expect(validateRuneCountInput("-50")).toBeNull();
  });

  it("returns null for decimal numbers", () => {
    expect(validateRuneCountInput("1.5")).toBeNull();
    expect(validateRuneCountInput("0.1")).toBeNull();
    expect(validateRuneCountInput("99.9")).toBeNull();
  });

  it("returns null for integers greater than 99", () => {
    expect(validateRuneCountInput("100")).toBeNull();
    expect(validateRuneCountInput("999")).toBeNull();
    expect(validateRuneCountInput("1000")).toBeNull();
  });

  it("returns null for strings with whitespace", () => {
    expect(validateRuneCountInput(" 5")).toBeNull();
    expect(validateRuneCountInput("5 ")).toBeNull();
    expect(validateRuneCountInput(" 5 ")).toBeNull();
  });

  it("returns null for strings with special numeric formats", () => {
    expect(validateRuneCountInput("1e2")).toBeNull();
    expect(validateRuneCountInput("0x10")).toBeNull();
    expect(validateRuneCountInput("+5")).toBeNull();
  });
});
