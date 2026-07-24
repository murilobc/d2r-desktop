/**
 * Property-based tests for the PropertyInspector component.
 *
 * Uses fast-check + vitest + @testing-library/react to verify
 * that the property inspector displays the correct widget type label
 * across all widget types.
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { render, screen } from "@testing-library/react";
import PropertyInspector from "./PropertyInspector";
import type { WidgetPlacement, WidgetType } from "../../types";

// ===== CONSTANTS =====

/** All valid widget types. */
const WIDGET_TYPES: WidgetType[] = [
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

/** Expected labels for each widget type (mirrors the component's WIDGET_LABELS). */
const EXPECTED_LABELS: Record<WidgetType, string> = {
  timer: "Session Timer",
  run_timer: "Run Timer",
  run_count: "Run Count",
  items_found: "Items Found",
  last_item: "Last Item",
  dry_streak: "Dry Streak",
  goal_progress: "Goal Progress",
  xp_per_hour: "XP/Hour",
  route_step: "Route Step",
};

// ===== GENERATORS =====

/** Generate a widget type from all valid widget types. */
const widgetTypeArb = fc.constantFrom(...WIDGET_TYPES);

/** Generate a valid widget size. */
const widgetSizeArb = fc.constantFrom("small" as const, "medium" as const, "large" as const);

/** Generate a valid opacity value. */
const opacityArb = fc.double({ min: 0.1, max: 1, noNaN: true });

/** Generate a WidgetPlacement with a given type. */
function widgetPlacementArb(type: fc.Arbitrary<WidgetType>): fc.Arbitrary<WidgetPlacement> {
  return fc.record({
    id: fc.uuid(),
    type,
    x: fc.integer({ min: 0, max: 800 }),
    y: fc.integer({ min: 0, max: 600 }),
    size: widgetSizeArb,
    opacity: opacityArb,
  });
}

// ===== PROPERTY TESTS =====

describe("Property 5: Property Inspector shows correct widget type label", () => {
  /**
   * Property 5: Property Inspector shows correct widget type label
   *
   * For any widget type, when a widget of that type is selected,
   * the Property Inspector title SHALL display the corresponding
   * human-readable label from the WIDGET_LABELS mapping.
   *
   * **Validates: Requirements 5.3**
   */
  it("displays the correct human-readable label for any widget type", () => {
    fc.assert(
      fc.property(widgetPlacementArb(widgetTypeArb), (widget) => {
        const { unmount } = render(
          <PropertyInspector
            widget={widget}
            onSizeChange={vi.fn()}
            onOpacityChange={vi.fn()}
            onRemoveWidget={vi.fn()}
          />
        );

        const title = screen.getByRole("heading", { level: 3 });
        expect(title).toHaveTextContent(EXPECTED_LABELS[widget.type]);
        expect(title).toHaveClass("property-inspector-title");

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
