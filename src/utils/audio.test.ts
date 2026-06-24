import { describe, it, expect, beforeEach } from "vitest";
import { getSoundPrefs, setSoundPrefs } from "./audio";

describe("Audio Utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default prefs when nothing stored", () => {
    const prefs = getSoundPrefs();
    expect(prefs.enabled).toBe(true);
    expect(prefs.volume).toBe(50);
  });

  it("saves and retrieves prefs", () => {
    setSoundPrefs({ enabled: false, volume: 80 });
    const prefs = getSoundPrefs();
    expect(prefs.enabled).toBe(false);
    expect(prefs.volume).toBe(80);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("d2r_sound_prefs", "invalid json{{{");
    const prefs = getSoundPrefs();
    expect(prefs.enabled).toBe(true); // falls back to default
    expect(prefs.volume).toBe(50);
  });
});
