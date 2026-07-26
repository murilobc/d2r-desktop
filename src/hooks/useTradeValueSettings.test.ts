import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useTradeValueSettings } from "./useTradeValueSettings";

const STORAGE_KEY = "show_trade_values";

describe("useTradeValueSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to true when localStorage key is absent", () => {
    const { result } = renderHook(() => useTradeValueSettings());
    expect(result.current.showTradeValues).toBe(true);
  });

  it("reads false correctly when key is 'false' in storage", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    const { result } = renderHook(() => useTradeValueSettings());
    expect(result.current.showTradeValues).toBe(false);
  });

  it("reads true correctly when key is 'true' in storage", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    const { result } = renderHook(() => useTradeValueSettings());
    expect(result.current.showTradeValues).toBe(true);
  });

  it("toggle once → showTradeValues is false, localStorage updated to 'false'", () => {
    // Default starts as true (key absent)
    const { result } = renderHook(() => useTradeValueSettings());
    expect(result.current.showTradeValues).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.showTradeValues).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
  });

  it("toggle twice → showTradeValues is true, localStorage updated to 'true'", () => {
    // Default starts as true (key absent)
    const { result } = renderHook(() => useTradeValueSettings());

    act(() => {
      result.current.toggle();
    });
    expect(result.current.showTradeValues).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.showTradeValues).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });
});
