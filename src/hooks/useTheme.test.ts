import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark theme when no localStorage value", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("applies data-theme attribute to document element", () => {
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("persists theme to localStorage", () => {
    renderHook(() => useTheme());
    expect(localStorage.getItem("d2r-theme")).toBe("dark");
  });

  it("reads saved theme from localStorage", () => {
    localStorage.setItem("d2r-theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("toggles from dark to light", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("d2r-theme")).toBe("light");
  });

  it("toggles from light to dark", () => {
    localStorage.setItem("d2r-theme", "light");
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("d2r-theme")).toBe("dark");
  });

  it("ignores invalid localStorage value and defaults to dark", () => {
    localStorage.setItem("d2r-theme", "invalid-value");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });
});
