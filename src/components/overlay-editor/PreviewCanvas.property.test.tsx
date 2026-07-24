/**
 * Property-based tests for the PreviewCanvas component.
 *
 * Uses fast-check + vitest + @testing-library/react to verify
 * canvas background rendering across randomly generated inputs.
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { render } from "@testing-library/react";
import PreviewCanvas from "./PreviewCanvas";
import type { OverlayProfileLayout, WidgetType, WidgetPlacement } from "../../types";

// ===== MOCKS =====

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
    transform: null,
  }),
}));

// ===== GENERATORS =====

/** Generate a valid 6-digit hex color string (e.g., "#a3f2c1"). */
const hexColorArb = fc
  .array(
    fc.integer({ min: 0, max: 255 }).map((n) => n.toString(16).padStart(2, "0")),
    { minLength: 3, maxLength: 3 }
  )
  .map((parts) => `#${parts.join("")}`);

/** Generate an opacity value between 0 and 1. */
const opacityArb = fc.double({ min: 0, max: 1, noNaN: true });

/** Generate a valid canvas width. */
const widthArb = fc.integer({ min: 200, max: 800 });

/** Generate a valid canvas height. */
const heightArb = fc.integer({ min: 100, max: 600 });

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

/** Generate a single WidgetPlacement with a unique id. */
function widgetPlacementArb(index: number): fc.Arbitrary<WidgetPlacement> {
  return fc.record({
    id: fc.constant(`widget-${index}`),
    type: fc.constantFrom(...WIDGET_TYPES),
    x: fc.integer({ min: 0, max: 380 }),
    y: fc.integer({ min: 0, max: 280 }),
    size: fc.constantFrom("small" as const, "medium" as const, "large" as const),
    opacity: fc.double({ min: 0.1, max: 1, noNaN: true }),
  });
}

/** Generate a list of 1-5 widget placements. */
const widgetListArb: fc.Arbitrary<WidgetPlacement[]> = fc
  .integer({ min: 1, max: 5 })
  .chain((count) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => widgetPlacementArb(i)))
  )
  .map((tuple) => [...tuple]);

// ===== HELPERS =====

/**
 * Convert a hex color string (e.g., "#a3f2c1") to the rgb() format
 * that jsdom normalizes inline styles to.
 */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function buildLayout(overrides: Partial<OverlayProfileLayout> = {}): OverlayProfileLayout {
  return {
    widgets: [],
    background_color: "#000000",
    background_opacity: 1,
    width: 400,
    height: 300,
    ...overrides,
  };
}

function renderCanvas(layout: OverlayProfileLayout, selectedWidgetId: string | null = null) {
  return render(
    <PreviewCanvas
      layout={layout}
      selectedWidgetId={selectedWidgetId}
      onWidgetSelect={vi.fn()}
      onWidgetMove={vi.fn()}
      onWidgetAdd={vi.fn()}
    />
  );
}

// ===== PROPERTY TESTS =====

describe("Property 1: Canvas background reflects configured values", () => {
  /**
   * Property 1: Canvas background reflects configured values
   *
   * For any valid hex color string and opacity value between 0 and 1,
   * the Preview Canvas background layer SHALL render with those exact
   * color and opacity values applied as inline styles.
   *
   * **Validates: Requirements 4.3**
   */
  it("background div has correct backgroundColor and opacity for any valid hex color and opacity", () => {
    fc.assert(
      fc.property(hexColorArb, opacityArb, widthArb, heightArb, (color, opacity, width, height) => {
        const layout = buildLayout({
          background_color: color,
          background_opacity: opacity,
          width,
          height,
        });

        const { container, unmount } = renderCanvas(layout);

        // The background div is the first child of the canvas section, with aria-hidden="true"
        const backgroundDiv = container.querySelector("[aria-hidden='true']");
        expect(backgroundDiv).toBeInTheDocument();

        const style = (backgroundDiv as HTMLElement).style;
        // jsdom normalizes hex colors to rgb() format
        expect(style.backgroundColor).toBe(hexToRgb(color));
        expect(Number(style.opacity)).toBeCloseTo(opacity, 10);

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});


describe("Property 2: Selected widget gets visual distinction", () => {
  /**
   * Property 2: Selected widget gets visual distinction
   *
   * For any widget placed on the canvas, when that widget's ID matches the
   * selectedWidgetId, the widget element SHALL have a selection indicator
   * (distinct border/outline) applied, and no other widget SHALL have that indicator.
   *
   * **Validates: Requirements 4.4**
   */
  it("only the selected widget has the selection border, all others have transparent border", () => {
    fc.assert(
      fc.property(
        widgetListArb.chain((widgets) =>
          fc.record({
            widgets: fc.constant(widgets),
            selectedIndex: fc.integer({ min: 0, max: widgets.length - 1 }),
          })
        ),
        ({ widgets, selectedIndex }) => {
          const selectedId = widgets[selectedIndex].id;

          const layout = buildLayout({ widgets });

          const { container, unmount } = renderCanvas(layout, selectedId);

          // Check each widget button
          for (const widget of widgets) {
            const el = container.querySelector(
              `[data-widget-id="${widget.id}"]`
            ) as HTMLElement;
            expect(el).toBeInTheDocument();

            if (widget.id === selectedId) {
              // Selected widget must have the blue selection border
              // jsdom normalizes #4a9eff to rgb(74, 158, 255)
              expect(el.style.border).toBe("2px solid rgb(74, 158, 255)");
            } else {
              // Non-selected widgets must have transparent border
              expect(el.style.border).toBe("2px solid transparent");
            }
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
