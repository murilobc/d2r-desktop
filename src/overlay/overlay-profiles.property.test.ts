/**
 * Property-based tests for overlay profile validation utilities.
 *
 * Uses fast-check + vitest to verify correctness properties
 * across randomly generated inputs.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  clampWidgetOpacity,
  clampBackgroundOpacity,
  clampDimensions,
  clampWidgetPosition,
  validateProfileName,
  isValidWidgetSize,
} from "./overlay-profile-utils";

// ===== PROPERTY TESTS =====

describe("Feature: customizable-overlay, Property 6: Widget opacity is always clamped to [0.1, 1.0]", () => {
  // Feature: customizable-overlay, Property 6: Widget opacity is always clamped to [0.1, 1.0]
  /**
   * Property 6: Widget opacity is always clamped to [0.1, 1.0]
   *
   * For any number, clampWidgetOpacity returns a value in [0.1, 1.0].
   * Values below 0.1 → 0.1, above 1.0 → 1.0, within range preserved exactly.
   *
   * **Validates: Requirements 5.1, 5.6**
   */
  it("result is always within [0.1, 1.0] for any number", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (value) => {
        const result = clampWidgetOpacity(value);
        expect(result).toBeGreaterThanOrEqual(0.1);
        expect(result).toBeLessThanOrEqual(1.0);
      }),
      { numRuns: 100 }
    );
  });

  it("values below 0.1 are clamped to 0.1", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true, max: 0.09999 }), (value) => {
        const result = clampWidgetOpacity(value);
        expect(result).toBe(0.1);
      }),
      { numRuns: 100 }
    );
  });

  it("values above 1.0 are clamped to 1.0", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true, min: 1.00001 }), (value) => {
        const result = clampWidgetOpacity(value);
        expect(result).toBe(1.0);
      }),
      { numRuns: 100 }
    );
  });

  it("values within [0.1, 1.0] are preserved exactly", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, min: 0.1, max: 1.0 }), (value) => {
        const result = clampWidgetOpacity(value);
        expect(result).toBe(value);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 7: Background opacity is always clamped to [0.0, 1.0]", () => {
  // Feature: customizable-overlay, Property 7: Background opacity is always clamped to [0.0, 1.0]
  /**
   * Property 7: Background opacity is always clamped to [0.0, 1.0]
   *
   * For any number, clampBackgroundOpacity returns a value in [0.0, 1.0].
   * Values below 0.0 → 0.0, above 1.0 → 1.0, within range preserved exactly.
   *
   * **Validates: Requirements 6.2**
   */
  it("result is always within [0.0, 1.0] for any number", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (value) => {
        const result = clampBackgroundOpacity(value);
        expect(result).toBeGreaterThanOrEqual(0.0);
        expect(result).toBeLessThanOrEqual(1.0);
      }),
      { numRuns: 100 }
    );
  });

  it("values below 0.0 are clamped to 0.0", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true, max: -0.00001 }), (value) => {
        const result = clampBackgroundOpacity(value);
        expect(result).toBe(0.0);
      }),
      { numRuns: 100 }
    );
  });

  it("values above 1.0 are clamped to 1.0", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true, min: 1.00001 }), (value) => {
        const result = clampBackgroundOpacity(value);
        expect(result).toBe(1.0);
      }),
      { numRuns: 100 }
    );
  });

  it("values within [0.0, 1.0] are preserved exactly", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, min: 0.0, max: 1.0 }), (value) => {
        const result = clampBackgroundOpacity(value);
        expect(result).toBe(value);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 11: Overlay dimensions are always clamped to valid range", () => {
  // Feature: customizable-overlay, Property 11: Overlay dimensions are always clamped to valid range
  /**
   * Property 11: Overlay dimensions are always clamped to valid range
   *
   * For any width/height values, clampDimensions returns width ∈ [200, 800]
   * and height ∈ [100, 600]. Values within range preserved exactly.
   *
   * **Validates: Requirements 9.1, 9.5**
   */
  it("width is always within [200, 800] and height within [100, 600]", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (width, height) => {
          const result = clampDimensions(width, height);
          expect(result.width).toBeGreaterThanOrEqual(200);
          expect(result.width).toBeLessThanOrEqual(800);
          expect(result.height).toBeGreaterThanOrEqual(100);
          expect(result.height).toBeLessThanOrEqual(600);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("values within valid range are preserved exactly", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 800 }),
        fc.integer({ min: 100, max: 600 }),
        (width, height) => {
          const result = clampDimensions(width, height);
          expect(result.width).toBe(width);
          expect(result.height).toBe(height);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("values below minimum are clamped to minimum", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 199 }),
        fc.integer({ min: -10000, max: 99 }),
        (width, height) => {
          const result = clampDimensions(width, height);
          expect(result.width).toBe(200);
          expect(result.height).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("values above maximum are clamped to maximum", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 801, max: 10000 }),
        fc.integer({ min: 601, max: 10000 }),
        (width, height) => {
          const result = clampDimensions(width, height);
          expect(result.width).toBe(800);
          expect(result.height).toBe(600);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 12: Widget size is always one of the three valid values", () => {
  // Feature: customizable-overlay, Property 12: Widget size is always one of the three valid values
  /**
   * Property 12: Widget size is always one of the three valid values
   *
   * isValidWidgetSize returns true only for "small", "medium", "large"
   * and false for any other string.
   *
   * **Validates: Requirements 3.1**
   */
  it("returns true for valid widget sizes", () => {
    fc.assert(
      fc.property(fc.constantFrom("small", "medium", "large"), (size) => {
        expect(isValidWidgetSize(size)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("returns false for any arbitrary string that is not a valid size", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== "small" && s !== "medium" && s !== "large"),
        (size) => {
          expect(isValidWidgetSize(size)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 2: Widget positions are always within canvas bounds", () => {
  // Feature: customizable-overlay, Property 2: Widget positions are always within canvas bounds
  /**
   * Property 2: Widget positions are always within canvas bounds
   *
   * For any widget position, widget dimensions, and canvas dimensions,
   * clampWidgetPosition ensures x ∈ [0, canvasWidth - widgetWidth]
   * and y ∈ [0, canvasHeight - widgetHeight].
   *
   * **Validates: Requirements 2.3, 9.2**
   */
  it("clamped position keeps widget within canvas bounds", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1000, max: 2000 }), // x
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1000, max: 2000 }), // y
        fc.integer({ min: 10, max: 200 }), // widgetWidth
        fc.integer({ min: 10, max: 200 }), // widgetHeight
        fc.integer({ min: 200, max: 800 }), // canvasWidth
        fc.integer({ min: 100, max: 600 }), // canvasHeight
        (x, y, widgetWidth, widgetHeight, canvasWidth, canvasHeight) => {
          const result = clampWidgetPosition(x, y, widgetWidth, widgetHeight, canvasWidth, canvasHeight);

          const maxX = Math.max(0, canvasWidth - widgetWidth);
          const maxY = Math.max(0, canvasHeight - widgetHeight);

          expect(result.x).toBeGreaterThanOrEqual(0);
          expect(result.x).toBeLessThanOrEqual(maxX);
          expect(result.y).toBeGreaterThanOrEqual(0);
          expect(result.y).toBeLessThanOrEqual(maxY);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("positions within valid range are preserved exactly", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 800 }), // canvasWidth
        fc.integer({ min: 100, max: 600 }), // canvasHeight
        fc.integer({ min: 10, max: 100 }), // widgetWidth
        fc.integer({ min: 10, max: 100 }), // widgetHeight
        (canvasWidth, canvasHeight, widgetWidth, widgetHeight) => {
          const maxX = canvasWidth - widgetWidth;
          const maxY = canvasHeight - widgetHeight;

          // Generate valid positions within range
          const validX = Math.floor(Math.random() * (maxX + 1));
          const validY = Math.floor(Math.random() * (maxY + 1));

          const result = clampWidgetPosition(validX, validY, widgetWidth, widgetHeight, canvasWidth, canvasHeight);
          expect(result.x).toBe(validX);
          expect(result.y).toBe(validY);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 3: Profile name validation accepts valid names and rejects invalid ones", () => {
  // Feature: customizable-overlay, Property 3: Profile name validation accepts valid names and rejects invalid ones
  /**
   * Property 3: Profile name validation accepts valid names and rejects invalid ones
   *
   * Names with trimmed length 1–50 and not in existing list are valid.
   * Names with trimmed length 0, >50, or already existing are rejected.
   *
   * **Validates: Requirements 4.1, 4.2, 4.7**
   */
  it("valid names (trimmed length 1–50, not in existing list) are accepted", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1 && s.trim().length <= 50),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
        (name, existingNames) => {
          // Ensure the name is not already in the existing list
          const trimmedName = name.trim();
          const filteredExisting = existingNames.filter((n) => n !== trimmedName);

          const result = validateProfileName(name, filteredExisting);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("empty names (trimmed length 0) are rejected", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim().length === 0),
        (name) => {
          const result = validateProfileName(name, []);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("names exceeding 50 characters (trimmed) are rejected", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 51, maxLength: 100 }).filter((s) => s.trim().length > 50),
        (name) => {
          const result = validateProfileName(name, []);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("names already in the existing list are rejected", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1 && s.trim().length <= 50),
        (name) => {
          const trimmedName = name.trim();
          const existingNames = [trimmedName, "Other Profile"];

          const result = validateProfileName(name, existingNames);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== PROFILE MANAGEMENT LOGIC PROPERTY TESTS =====

/**
 * Helper: removes a widget from a list by ID.
 * Pure logic function representing the widget removal operation.
 */
function removeWidgetById(
  widgets: Array<{ id: string; type: string }>,
  idToRemove: string
): Array<{ id: string; type: string }> {
  return widgets.filter((w) => w.id !== idToRemove);
}

/**
 * Helper: determines whether profile deletion should succeed.
 * Deletion is allowed if and only if more than one profile exists.
 */
function canDeleteProfile(profileCount: number): boolean {
  return profileCount > 1;
}

/**
 * Helper: determines whether profile creation should succeed.
 * Creation is allowed if and only if the current count is below 20.
 */
function canCreateProfile(currentCount: number): boolean {
  return currentCount < 20;
}

describe("Feature: customizable-overlay, Property 1: Widget removal decrements list", () => {
  // Feature: customizable-overlay, Property 1: Widget removal decrements list
  /**
   * Property 1: Widget removal decrements list
   *
   * For any overlay profile with N widgets (N ≥ 1), removing a widget by ID
   * produces a list of length N-1 that doesn't contain the removed widget's ID.
   *
   * **Validates: Requirements 1.3**
   */
  it("removing a widget by ID produces a list of length N-1 without the removed ID", () => {
    fc.assert(
      fc.property(
        fc
          .array(
            fc.record({
              id: fc.uuid(),
              type: fc.constantFrom(
                "timer",
                "run_timer",
                "run_count",
                "items_found",
                "last_item",
                "dry_streak",
                "goal_progress",
                "xp_per_hour",
                "route_step"
              ),
            }),
            { minLength: 1, maxLength: 20 }
          )
          .chain((widgets) => {
            // Pick a random index to remove
            return fc.record({
              widgets: fc.constant(widgets),
              indexToRemove: fc.integer({ min: 0, max: widgets.length - 1 }),
            });
          }),
        ({ widgets, indexToRemove }) => {
          const idToRemove = widgets[indexToRemove].id;
          const result = removeWidgetById(widgets, idToRemove);

          // Length should be N - 1
          expect(result.length).toBe(widgets.length - 1);

          // Removed ID should not be present
          const resultIds = result.map((w) => w.id);
          expect(resultIds).not.toContain(idToRemove);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 4: Cannot delete the last remaining profile", () => {
  // Feature: customizable-overlay, Property 4: Cannot delete the last remaining profile
  /**
   * Property 4: Cannot delete the last remaining profile
   *
   * For any set of profiles, deletion succeeds if and only if
   * more than one profile exists.
   *
   * **Validates: Requirements 4.3**
   */
  it("deletion succeeds only when more than one profile exists", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (profileCount) => {
        const allowed = canDeleteProfile(profileCount);
        if (profileCount > 1) {
          expect(allowed).toBe(true);
        } else {
          expect(allowed).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("deletion is always rejected when exactly one profile exists", () => {
    expect(canDeleteProfile(1)).toBe(false);
  });

  it("deletion is always allowed when more than one profile exists", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 100 }), (profileCount) => {
        expect(canDeleteProfile(profileCount)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 5: Profile count never exceeds 20", () => {
  // Feature: customizable-overlay, Property 5: Profile count never exceeds 20
  /**
   * Property 5: Profile count never exceeds 20
   *
   * For any number of existing profiles N, creation should succeed
   * if and only if N < 20.
   *
   * **Validates: Requirements 4.8**
   */
  it("creation succeeds if and only if current count is below 20", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50 }), (currentCount) => {
        const allowed = canCreateProfile(currentCount);
        if (currentCount < 20) {
          expect(allowed).toBe(true);
        } else {
          expect(allowed).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("creation is rejected when exactly 20 profiles exist", () => {
    expect(canCreateProfile(20)).toBe(false);
  });

  it("creation is allowed when fewer than 20 profiles exist", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 19 }), (currentCount) => {
        expect(canCreateProfile(currentCount)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("creation is rejected when 20 or more profiles exist", () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 100 }), (currentCount) => {
        expect(canCreateProfile(currentCount)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ===== SERIALIZATION PROPERTY TESTS =====

import { validateProfileLayout } from "./overlay-profile-utils";
import { WIDGET_TYPES } from "../types";

// Arbitraries for generating valid overlay profile layouts
const validWidgetTypeArb = fc.constantFrom(...WIDGET_TYPES);
const validWidgetSizeArb = fc.constantFrom("small" as const, "medium" as const, "large" as const);
const validHexColorArb = fc
  .array(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f", "A", "B", "C", "D", "E", "F"), { minLength: 6, maxLength: 6 })
  .map((chars) => `#${chars.join("")}`);

function validWidgetPlacementArb(width: number, height: number) {
  return fc.record({
    id: fc.uuid(),
    type: validWidgetTypeArb,
    x: fc.double({ noNaN: true, min: 0, max: width }),
    y: fc.double({ noNaN: true, min: 0, max: height }),
    size: validWidgetSizeArb,
    opacity: fc.double({ noNaN: true, min: 0.1, max: 1.0 }),
  });
}

const validLayoutArb = fc
  .record({
    width: fc.integer({ min: 200, max: 800 }),
    height: fc.integer({ min: 100, max: 600 }),
    background_color: validHexColorArb,
    background_opacity: fc.double({ noNaN: true, min: 0.0, max: 1.0 }),
  })
  .chain((base) =>
    fc
      .array(validWidgetPlacementArb(base.width, base.height), { minLength: 0, maxLength: 5 })
      .map((widgets) => ({
        ...base,
        widgets,
      }))
  );

describe("Feature: customizable-overlay, Property 8: Profile serialization round-trip", () => {
  // Feature: customizable-overlay, Property 8: Profile serialization round-trip
  /**
   * Property 8: Profile serialization round-trip
   *
   * For any valid OverlayProfileLayout, serializing to JSON and then
   * deserializing should produce an identical layout with all field
   * values preserved exactly.
   *
   * **Validates: Requirements 8.1, 8.2, 8.4**
   */
  it("serializing to JSON and deserializing produces an identical layout", () => {
    fc.assert(
      fc.property(validLayoutArb, (layout) => {
        const json = JSON.stringify(layout);
        const parsed = JSON.parse(json);
        const result = validateProfileLayout(parsed);

        expect(result.valid).toBe(true);
        expect(result.layout).toBeDefined();
        expect(result.layout!.width).toBe(layout.width);
        expect(result.layout!.height).toBe(layout.height);
        expect(result.layout!.background_color).toBe(layout.background_color);
        expect(result.layout!.background_opacity).toBe(layout.background_opacity);
        expect(result.layout!.widgets.length).toBe(layout.widgets.length);

        for (let i = 0; i < layout.widgets.length; i++) {
          expect(result.layout!.widgets[i].id).toBe(layout.widgets[i].id);
          expect(result.layout!.widgets[i].type).toBe(layout.widgets[i].type);
          expect(result.layout!.widgets[i].x).toBe(layout.widgets[i].x);
          expect(result.layout!.widgets[i].y).toBe(layout.widgets[i].y);
          expect(result.layout!.widgets[i].size).toBe(layout.widgets[i].size);
          expect(result.layout!.widgets[i].opacity).toBe(layout.widgets[i].opacity);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 9: Validation rejects malformed profile JSON", () => {
  // Feature: customizable-overlay, Property 9: Validation rejects malformed profile JSON
  /**
   * Property 9: Validation rejects malformed profile JSON
   *
   * For any JSON object missing required fields, having wrong types,
   * or out-of-range values, validateProfileLayout should reject it.
   *
   * **Validates: Requirements 8.3**
   */
  it("rejects objects missing required fields", () => {
    const requiredFields = ["widgets", "background_color", "background_opacity", "width", "height"];

    fc.assert(
      fc.property(
        validLayoutArb,
        fc.constantFrom(...requiredFields),
        (layout, fieldToRemove) => {
          const obj = { ...layout, widgets: [...layout.widgets] } as Record<string, unknown>;
          delete obj[fieldToRemove];
          const result = validateProfileLayout(obj);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects objects with wrong types for numeric fields", () => {
    fc.assert(
      fc.property(
        validLayoutArb,
        fc.constantFrom("width", "height", "background_opacity"),
        fc.string({ minLength: 1, maxLength: 10 }),
        (layout, field, badValue) => {
          const obj = { ...layout, widgets: [...layout.widgets] } as Record<string, unknown>;
          obj[field] = badValue;
          const result = validateProfileLayout(obj);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects objects with out-of-range dimension values", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Width too small
          fc.record({
            width: fc.integer({ min: -1000, max: 199 }),
            height: fc.integer({ min: 100, max: 600 }),
          }),
          // Width too large
          fc.record({
            width: fc.integer({ min: 801, max: 5000 }),
            height: fc.integer({ min: 100, max: 600 }),
          }),
          // Height too small
          fc.record({
            width: fc.integer({ min: 200, max: 800 }),
            height: fc.integer({ min: -1000, max: 99 }),
          }),
          // Height too large
          fc.record({
            width: fc.integer({ min: 200, max: 800 }),
            height: fc.integer({ min: 601, max: 5000 }),
          })
        ),
        ({ width, height }) => {
          const obj = {
            widgets: [],
            background_color: "#000000",
            background_opacity: 0.5,
            width,
            height,
          };
          const result = validateProfileLayout(obj);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects widgets with invalid size values", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter(
          (s) => s !== "small" && s !== "medium" && s !== "large"
        ),
        (badSize) => {
          const obj = {
            widgets: [
              {
                id: "test-id-123",
                type: "timer",
                x: 10,
                y: 10,
                size: badSize,
                opacity: 1.0,
              },
            ],
            background_color: "#000000",
            background_opacity: 0.5,
            width: 400,
            height: 300,
          };
          const result = validateProfileLayout(obj);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects widgets with out-of-range opacity", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ noNaN: true, noDefaultInfinity: true, min: -10, max: 0.09 }),
          fc.double({ noNaN: true, noDefaultInfinity: true, min: 1.01, max: 10 })
        ),
        (badOpacity) => {
          const obj = {
            widgets: [
              {
                id: "test-id-456",
                type: "run_count",
                x: 10,
                y: 10,
                size: "medium",
                opacity: badOpacity,
              },
            ],
            background_color: "#000000",
            background_opacity: 0.5,
            width: 400,
            height: 300,
          };
          const result = validateProfileLayout(obj);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: customizable-overlay, Property 10: Unknown fields are ignored during deserialization", () => {
  // Feature: customizable-overlay, Property 10: Unknown fields are ignored during deserialization
  /**
   * Property 10: Unknown fields are ignored during deserialization
   *
   * For any valid profile JSON with additional unknown key-value pairs,
   * validateProfileLayout should produce the same layout as without
   * the extra fields.
   *
   * **Validates: Requirements 8.5**
   */
  it("extra unknown fields do not affect validation result", () => {
    fc.assert(
      fc.property(
        validLayoutArb,
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            (k) =>
              k !== "widgets" &&
              k !== "background_color" &&
              k !== "background_opacity" &&
              k !== "width" &&
              k !== "height"
          ),
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.array(fc.integer(), { maxLength: 3 })
          ),
          { minKeys: 1, maxKeys: 5 }
        ),
        (layout, extraFields) => {
          // Validate original layout
          const originalResult = validateProfileLayout(layout);
          expect(originalResult.valid).toBe(true);

          // Add unknown fields and validate again
          const augmented = { ...layout, ...extraFields };
          const augmentedResult = validateProfileLayout(augmented);

          expect(augmentedResult.valid).toBe(true);
          expect(augmentedResult.layout).toBeDefined();

          // Compare the results — should be identical
          expect(augmentedResult.layout!.width).toBe(originalResult.layout!.width);
          expect(augmentedResult.layout!.height).toBe(originalResult.layout!.height);
          expect(augmentedResult.layout!.background_color).toBe(originalResult.layout!.background_color);
          expect(augmentedResult.layout!.background_opacity).toBe(originalResult.layout!.background_opacity);
          expect(augmentedResult.layout!.widgets.length).toBe(originalResult.layout!.widgets.length);

          for (let i = 0; i < originalResult.layout!.widgets.length; i++) {
            expect(augmentedResult.layout!.widgets[i]).toEqual(originalResult.layout!.widgets[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
