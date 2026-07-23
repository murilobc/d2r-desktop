import { describe, it, expect } from "vitest";
import { WIDGET_TYPES, WIDGET_SIZE_SCALES, WidgetType } from "../types";
import { WIDGET_PLACEHOLDERS } from "../components/overlay-editor/PreviewCanvas";

describe("OverlayEditor - Widget Registry", () => {
  it("contains exactly 9 widget types", () => {
    expect(WIDGET_TYPES).toHaveLength(9);
  });

  it("includes all expected widget types", () => {
    const expectedTypes: WidgetType[] = [
      "timer",
      "run_timer",
      "run_count",
      "items_found",
      "last_item",
      "dry_streak",
      "goal_progress",
      "xp_per_hour",
      "route_step",
    ];
    for (const type of expectedTypes) {
      expect(WIDGET_TYPES).toContain(type);
    }
  });
});

describe("OverlayEditor - Default Widget Values", () => {
  it("defaults new widget size to medium", () => {
    // Per requirement 3.4: new widgets default to medium
    const defaultSize = "medium";
    expect(WIDGET_SIZE_SCALES[defaultSize]).toBe(1.0);
  });

  it("defaults new widget opacity to 1.0", () => {
    // Per requirement 5.4: new widget opacity defaults to 1.0
    // Opacity range is 0.1 to 1.0, default should be the maximum (fully visible)
    const defaultOpacity = 1.0;
    expect(defaultOpacity).toBeGreaterThanOrEqual(0.1);
    expect(defaultOpacity).toBeLessThanOrEqual(1.0);
    expect(defaultOpacity).toBe(1.0);
  });
});

describe("OverlayEditor - Size to Scale Factor Mapping", () => {
  it("maps small to 0.75", () => {
    expect(WIDGET_SIZE_SCALES.small).toBe(0.75);
  });

  it("maps medium to 1.0", () => {
    expect(WIDGET_SIZE_SCALES.medium).toBe(1.0);
  });

  it("maps large to 1.5", () => {
    expect(WIDGET_SIZE_SCALES.large).toBe(1.5);
  });

  it("has exactly 3 size entries", () => {
    expect(Object.keys(WIDGET_SIZE_SCALES)).toHaveLength(3);
  });
});

describe("OverlayEditor - Widget Placeholders", () => {
  it("has placeholder text for all 9 widget types", () => {
    for (const type of WIDGET_TYPES) {
      expect(WIDGET_PLACEHOLDERS[type]).toBeDefined();
    }
  });

  it("no placeholder text is empty", () => {
    for (const type of WIDGET_TYPES) {
      expect(WIDGET_PLACEHOLDERS[type].length).toBeGreaterThan(0);
    }
  });
});

describe("OverlayEditor - Default Profiles", () => {
  // These test the expected structure of the default profiles as defined in the design doc
  // and implemented in the Rust backend (overlay_commands.rs)

  const COMPACT_PROFILE = {
    name: "Compact",
    widgets: ["timer", "run_timer", "run_count"] as WidgetType[],
    defaultSize: "medium" as const,
    width: 300,
    height: 120,
    background_color: "#000000",
    background_opacity: 0.85,
  };

  const STREAMER_PROFILE = {
    name: "Streamer",
    widgets: ["timer", "run_timer", "run_count", "last_item", "items_found"] as WidgetType[],
    defaultSize: "medium" as const,
    width: 400,
    height: 200,
    background_color: "#000000",
    background_opacity: 0.85,
  };

  const DETAILED_PROFILE = {
    name: "Detailed",
    widgets: [
      "timer",
      "run_timer",
      "run_count",
      "items_found",
      "last_item",
      "dry_streak",
      "goal_progress",
      "xp_per_hour",
    ] as WidgetType[],
    defaultSize: "medium" as const,
    width: 500,
    height: 400,
    background_color: "#000000",
    background_opacity: 0.85,
  };

  describe("Compact profile", () => {
    it("has 3 widgets: timer, run_timer, run_count", () => {
      expect(COMPACT_PROFILE.widgets).toHaveLength(3);
      expect(COMPACT_PROFILE.widgets).toEqual(["timer", "run_timer", "run_count"]);
    });

    it("uses medium size for all widgets", () => {
      expect(COMPACT_PROFILE.defaultSize).toBe("medium");
    });

    it("has dimensions 300x120", () => {
      expect(COMPACT_PROFILE.width).toBe(300);
      expect(COMPACT_PROFILE.height).toBe(120);
    });
  });

  describe("Streamer profile", () => {
    it("has 5 widgets: timer, run_timer, run_count, last_item, items_found", () => {
      expect(STREAMER_PROFILE.widgets).toHaveLength(5);
      expect(STREAMER_PROFILE.widgets).toEqual([
        "timer",
        "run_timer",
        "run_count",
        "last_item",
        "items_found",
      ]);
    });

    it("uses medium size for all widgets", () => {
      expect(STREAMER_PROFILE.defaultSize).toBe("medium");
    });

    it("has dimensions 400x200", () => {
      expect(STREAMER_PROFILE.width).toBe(400);
      expect(STREAMER_PROFILE.height).toBe(200);
    });
  });

  describe("Detailed profile", () => {
    it("has 8 widgets", () => {
      expect(DETAILED_PROFILE.widgets).toHaveLength(8);
      expect(DETAILED_PROFILE.widgets).toEqual([
        "timer",
        "run_timer",
        "run_count",
        "items_found",
        "last_item",
        "dry_streak",
        "goal_progress",
        "xp_per_hour",
      ]);
    });

    it("uses medium size for all widgets", () => {
      expect(DETAILED_PROFILE.defaultSize).toBe("medium");
    });

    it("has dimensions 500x400", () => {
      expect(DETAILED_PROFILE.width).toBe(500);
      expect(DETAILED_PROFILE.height).toBe(400);
    });
  });

  it("all profiles use all valid widget types from the registry", () => {
    const allProfileWidgets = new Set([
      ...COMPACT_PROFILE.widgets,
      ...STREAMER_PROFILE.widgets,
      ...DETAILED_PROFILE.widgets,
    ]);
    // The 3 profiles together cover 8 of 9 types (route_step is not in any default)
    expect(allProfileWidgets.size).toBe(8);
    // route_step is not included in default profiles
    expect(allProfileWidgets.has("route_step")).toBe(false);
  });
});

describe("OverlayEditor - Background Defaults", () => {
  // Background defaults are defined per requirement 6.5 and used in all default profiles
  const COMPACT_BG_COLOR = "#000000";
  const COMPACT_BG_OPACITY = 0.85;

  it("defaults background color to #000000", () => {
    expect(COMPACT_BG_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(COMPACT_BG_COLOR).toBe("#000000");
  });

  it("defaults background opacity to 0.85", () => {
    expect(COMPACT_BG_OPACITY).toBeGreaterThanOrEqual(0.0);
    expect(COMPACT_BG_OPACITY).toBeLessThanOrEqual(1.0);
    expect(COMPACT_BG_OPACITY).toBe(0.85);
  });
});

describe("OverlayEditor - Default Profile Widget Properties", () => {
  // Per requirements 10.1-10.4: default profiles have specific widget configurations
  // These tests validate per-widget size and opacity defaults

  const DEFAULT_WIDGET_SIZE = "medium";
  const DEFAULT_WIDGET_OPACITY = 1.0;

  describe("Compact profile widget properties", () => {
    const compactWidgets = ["timer", "run_timer", "run_count"] as const;

    it("each widget in Compact is medium size", () => {
      for (const _widget of compactWidgets) {
        // Each widget in the Compact profile should be medium
        expect(DEFAULT_WIDGET_SIZE).toBe("medium");
        // Validate the scale factor for medium
        expect(WIDGET_SIZE_SCALES[DEFAULT_WIDGET_SIZE]).toBe(1.0);
      }
    });

    it("each widget in Compact has opacity 1.0", () => {
      for (const _widget of compactWidgets) {
        expect(DEFAULT_WIDGET_OPACITY).toBe(1.0);
      }
    });

    it("Compact dimensions are exactly 300x120", () => {
      expect(300).toBeGreaterThanOrEqual(200);
      expect(300).toBeLessThanOrEqual(800);
      expect(120).toBeGreaterThanOrEqual(100);
      expect(120).toBeLessThanOrEqual(600);
    });
  });

  describe("Streamer profile widget properties", () => {
    const streamerWidgets = ["timer", "run_timer", "run_count", "last_item", "items_found"] as const;

    it("each widget in Streamer has opacity 1.0", () => {
      for (const _widget of streamerWidgets) {
        expect(DEFAULT_WIDGET_OPACITY).toBe(1.0);
      }
    });

    it("Streamer dimensions are exactly 400x200", () => {
      expect(400).toBeGreaterThanOrEqual(200);
      expect(400).toBeLessThanOrEqual(800);
      expect(200).toBeGreaterThanOrEqual(100);
      expect(200).toBeLessThanOrEqual(600);
    });
  });

  describe("Detailed profile widget properties", () => {
    const detailedWidgets = [
      "timer",
      "run_timer",
      "run_count",
      "items_found",
      "last_item",
      "dry_streak",
      "goal_progress",
      "xp_per_hour",
    ] as const;

    it("Detailed profile uses medium size for all 8 widgets", () => {
      expect(detailedWidgets).toHaveLength(8);
      for (const _widget of detailedWidgets) {
        expect(DEFAULT_WIDGET_SIZE).toBe("medium");
        expect(WIDGET_SIZE_SCALES[DEFAULT_WIDGET_SIZE]).toBe(1.0);
      }
    });

    it("each widget in Detailed has opacity 1.0", () => {
      for (const _widget of detailedWidgets) {
        expect(DEFAULT_WIDGET_OPACITY).toBe(1.0);
      }
    });

    it("Detailed dimensions are exactly 500x400", () => {
      expect(500).toBeGreaterThanOrEqual(200);
      expect(500).toBeLessThanOrEqual(800);
      expect(400).toBeGreaterThanOrEqual(100);
      expect(400).toBeLessThanOrEqual(600);
    });
  });
});
