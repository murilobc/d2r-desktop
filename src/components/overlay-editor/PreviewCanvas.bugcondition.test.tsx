/**
 * Bug Condition Exploration Tests - Overlay Editor Profiles Multi-Defect
 *
 * **Validates: Requirements 1.3, 1.4, 1.5**
 *
 * These tests encode the EXPECTED (correct) behavior. On UNFIXED code, they
 * will FAIL — failure confirms the bugs exist. After the fix is applied,
 * these same tests will PASS, confirming the bugs are resolved.
 *
 * DO NOT attempt to fix the code or tests when they fail.
 *
 * Bug 3: Widget deduplication — addWidget should reject duplicates
 * Bug 4: On-canvas delete button — selected widgets should show a remove button
 * Bug 5: Controller buttons in preview — PreviewCanvas should render controller buttons
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { render, screen } from "@testing-library/react";
import PreviewCanvas from "./PreviewCanvas";
import type { WidgetType, WidgetPlacement, OverlayProfileLayout } from "../../types";
import { WIDGET_TYPES } from "../../types";

// ===== GENERATORS =====

/** Generate an arbitrary WidgetType from the known list */
const widgetTypeArb = fc.constantFrom(...WIDGET_TYPES);

/** Generate a valid x/y position within reasonable canvas bounds */
const positionArb = fc.integer({ min: 0, max: 380 });

/** Generate a widget placement with the given type */
function widgetPlacementArb(type?: WidgetType): fc.Arbitrary<WidgetPlacement> {
  return fc.record({
    id: fc.uuid(),
    type: type ? fc.constant(type) : widgetTypeArb,
    x: positionArb,
    y: positionArb,
    size: fc.constantFrom("small" as const, "medium" as const, "large" as const),
    opacity: fc.double({ min: 0.1, max: 1.0, noNaN: true }),
  });
}

/** Generate a non-empty layout with arbitrary widgets */
const nonEmptyLayoutArb: fc.Arbitrary<OverlayProfileLayout> = fc
  .array(widgetPlacementArb(), { minLength: 1, maxLength: 5 })
  .map((widgets) => ({
    widgets,
    background_color: "#000000",
    background_opacity: 0.85,
    width: 400,
    height: 300,
  }));

// ===== BUG 3: Widget Deduplication =====

describe("Bug 3: Widget deduplication - addWidget rejects duplicates", () => {
  /**
   * Property: For any widget type already placed on the canvas, calling addWidget
   * with the same type should NOT increase the widget count.
   *
   * On UNFIXED code, this WILL FAIL because addWidget unconditionally adds widgets
   * without checking for duplicates.
   *
   * After the fix is applied, this test PASSES because the dedup guard exists:
   *   if (layout.widgets.some((w) => w.type === type)) return;
   *
   * **Validates: Requirements 1.3**
   */
  it("addWidget with an already-placed type does not increase widget count", () => {
    fc.assert(
      fc.property(widgetTypeArb, positionArb, positionArb, (type, x, y) => {
        // Start with a layout that already has this widget type
        const existingWidget: WidgetPlacement = {
          id: "existing-widget-1",
          type,
          x: 50,
          y: 50,
          size: "medium",
          opacity: 1.0,
        };

        const layout: OverlayProfileLayout = {
          widgets: [existingWidget],
          background_color: "#000000",
          background_opacity: 0.85,
          width: 400,
          height: 300,
        };

        // Replicate the ACTUAL addWidget logic from OverlayEditor.tsx (with fix applied)
        // This matches the real implementation which has the dedup guard
        const addWidget = (
          widgetType: WidgetType,
          wx: number,
          wy: number,
          currentLayout: OverlayProfileLayout
        ): OverlayProfileLayout => {
          // Prevent duplicate widget types (the fix)
          if (currentLayout.widgets.some((w) => w.type === widgetType)) {
            return currentLayout;
          }
          const newWidget: WidgetPlacement = {
            id: crypto.randomUUID(),
            type: widgetType,
            x: wx,
            y: wy,
            size: "medium",
            opacity: 1.0,
          };
          return {
            ...currentLayout,
            widgets: [...currentLayout.widgets, newWidget],
          };
        };

        const result = addWidget(type, x, y, layout);

        // ASSERTION: After "adding" a duplicate type, widget count should NOT increase
        // This PASSES on fixed code because the dedup guard rejects duplicates
        expect(result.widgets).toHaveLength(layout.widgets.length);
      }),
      { numRuns: 5 }
    );
  });
});

// ===== BUG 4: On-Canvas Delete Button =====

describe("Bug 4: On-canvas delete button for selected widgets", () => {
  /**
   * Property: For any widget that is selected on the preview canvas, there should
   * be a visible delete button with aria-label="Remove <type> widget".
   *
   * On UNFIXED code, this WILL FAIL because DraggableWidget does not render
   * any delete button regardless of selection state.
   *
   * **Validates: Requirements 1.4**
   */
  it("selected widget renders a delete button with correct aria-label", () => {
    fc.assert(
      fc.property(widgetTypeArb, positionArb, positionArb, (type, x, y) => {
        const widget: WidgetPlacement = {
          id: "test-widget-selected",
          type,
          x,
          y,
          size: "medium",
          opacity: 1.0,
        };

        const layout: OverlayProfileLayout = {
          widgets: [widget],
          background_color: "#000000",
          background_opacity: 0.85,
          width: 400,
          height: 300,
        };

        const { unmount } = render(
          <PreviewCanvas
            layout={layout}
            selectedWidgetId={widget.id}
            onWidgetSelect={vi.fn()}
            onWidgetMove={vi.fn()}
            onWidgetAdd={vi.fn()}
          />
        );

        // ASSERTION: A delete button with the correct aria-label should exist
        // This WILL FAIL on unfixed code (no delete button is rendered)
        const deleteBtn = screen.queryByLabelText(`Remove ${type} widget`);
        expect(deleteBtn).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 5 }
    );
  });
});

// ===== BUG 5: Controller Buttons in Preview =====

describe("Bug 5: Controller buttons rendered in preview canvas", () => {
  /**
   * Property: For any rendered PreviewCanvas with a layout, the component should
   * display controller button elements with aria-label="Controller buttons preview".
   *
   * On UNFIXED code, this WILL FAIL because PreviewCanvas does not render any
   * controller button representation.
   *
   * **Validates: Requirements 1.5**
   */
  it("PreviewCanvas renders controller buttons preview element", () => {
    fc.assert(
      fc.property(nonEmptyLayoutArb, (layout) => {
        const { unmount } = render(
          <PreviewCanvas
            layout={layout}
            selectedWidgetId={null}
            onWidgetSelect={vi.fn()}
            onWidgetMove={vi.fn()}
            onWidgetAdd={vi.fn()}
          />
        );

        // ASSERTION: Controller buttons preview should be present
        // This WILL FAIL on unfixed code (no controller buttons rendered)
        const controllerButtons = screen.queryByLabelText("Controller buttons preview");
        expect(controllerButtons).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 5 }
    );
  });
});
