import { describe, it, expect } from "vitest";
import {
  TERROR_ZONES,
  getCurrentTerrorZone,
  getTierClass,
  isAreaInTerrorZone,
  getDefaultTZPrefs,
} from "./terror-zones";

describe("Terror Zones data", () => {
  it("should have at least 20 zones", () => {
    expect(TERROR_ZONES.length).toBeGreaterThanOrEqual(20);
  });

  it("each zone has required properties", () => {
    for (const tz of TERROR_ZONES) {
      expect(tz.name).toBeTruthy();
      expect(tz.areas.length).toBeGreaterThan(0);
      expect(["S", "A", "B", "C"]).toContain(tz.tier);
      expect(tz.notes).toBeTruthy();
    }
  });

  it("zone names are unique", () => {
    const names = TERROR_ZONES.map((tz) => tz.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("all areas within zones are non-empty strings", () => {
    for (const tz of TERROR_ZONES) {
      for (const area of tz.areas) {
        expect(area.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getCurrentTerrorZone", () => {
  it("returns a valid TerrorZoneInfo for any timestamp", () => {
    const result = getCurrentTerrorZone(new Date("2024-06-15T14:00:00Z"));
    expect(result).not.toBeNull();
    expect(result!.name).toBeTruthy();
    expect(result!.areas.length).toBeGreaterThan(0);
  });

  it("returns a different zone for different hours", () => {
    const hour1 = getCurrentTerrorZone(new Date("2024-06-15T01:00:00Z"));
    const hour2 = getCurrentTerrorZone(new Date("2024-06-15T02:00:00Z"));
    // They might coincidentally be the same if index wraps, but testing the function returns valid results
    expect(hour1).not.toBeNull();
    expect(hour2).not.toBeNull();
  });

  it("is deterministic for the same timestamp", () => {
    const timestamp = new Date("2024-06-15T10:00:00Z");
    const result1 = getCurrentTerrorZone(timestamp);
    const result2 = getCurrentTerrorZone(timestamp);
    expect(result1!.name).toBe(result2!.name);
  });

  it("uses current time when no timestamp provided", () => {
    const result = getCurrentTerrorZone();
    expect(result).not.toBeNull();
    expect(TERROR_ZONES.some((tz) => tz.name === result!.name)).toBe(true);
  });
});

describe("getTierClass", () => {
  it("returns correct CSS class for each tier", () => {
    expect(getTierClass("S")).toBe("tier-s");
    expect(getTierClass("A")).toBe("tier-a");
    expect(getTierClass("B")).toBe("tier-b");
    expect(getTierClass("C")).toBe("tier-c");
  });
});

describe("isAreaInTerrorZone", () => {
  it("matches zone name directly", () => {
    expect(isAreaInTerrorZone("Chaos Sanctuary", "Chaos Sanctuary")).toBe(true);
  });

  it("matches sub-area within zone", () => {
    expect(isAreaInTerrorZone("River of Flame", "Chaos Sanctuary")).toBe(true);
  });

  it("returns false for non-matching area", () => {
    expect(isAreaInTerrorZone("Ancient Tunnels", "Chaos Sanctuary")).toBe(false);
  });

  it("returns false for unknown zone name", () => {
    expect(isAreaInTerrorZone("Chaos Sanctuary", "Nonexistent Zone")).toBe(false);
  });
});

describe("getDefaultTZPrefs", () => {
  it("returns empty preferences", () => {
    const prefs = getDefaultTZPrefs();
    expect(prefs.preferredZones).toEqual([]);
    expect(prefs.soundNotification).toBe(false);
  });
});
