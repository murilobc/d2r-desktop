/**
 * Property-based test: Drag-drop from library adds widget to layout.
 *
 * **Validates: Requirements 9.1**
 *
 * Property 3: For any widget type from the Widget Library, when a drag-end
 * event completes over the canvas droppable area, the layout's widget array
 * SHALL contain a new widget of that type with valid coordinates within
 * the canvas bounds.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { render, cleanup } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { WidgetType, OverlayProfile, OverlayProfileLayout } from "../types";

// ===== MOCKS =====

// Capture the onDragEnd handler passed to DndContext
let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: (event: DragEndEvent) => void }) => {
    capturedOnDragEnd = onDragEnd ?? null;
    return <div data-testid="dnd-context">{children}</div>;
  },
  closestCenter: vi.fn(),
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

const mockUpdateProfile = vi.fn().mockResolvedValue(null);
const mockLoadProfiles = vi.fn().mockResolvedValue(undefined);

let mockActiveProfile: OverlayProfile | null = null;

vi.mock("../hooks/useOverlayProfiles", () => ({
  useOverlayProfiles: () => ({
    profiles: mockActiveProfile ? [mockActiveProfile] : [],
    activeProfile: mockActiveProfile,
    loading: false,
    error: null,
    loadProfiles: mockLoadProfiles,
    createProfile: vi.fn(),
    updateProfile: mockUpdateProfile,
    deleteProfile: vi.fn(),
    switchProfile: vi.fn(),
  }),
}));

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-1234",
});

// Import component AFTER mocks are set up (vi.mock is hoisted)
import OverlayEditor from "./OverlayEditor";

// ===== GENERATORS =====

const WIDGET_TYPES_LIST: WidgetType[] = [
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

/** Generate any valid widget type. */
const widgetTypeArb = fc.constantFrom(...WIDGET_TYPES_LIST);

/** Generate a valid canvas width (200-800). */
const canvasWidthArb = fc.integer({ min: 200, max: 800 });

/** Generate a valid canvas height (100-600). */
const canvasHeightArb = fc.integer({ min: 100, max: 600 });

// ===== HELPERS =====

function buildActiveProfile(width: number, height: number): OverlayProfile {
  return {
    id: "profile-1",
    name: "Test Profile",
    layout: {
      widgets: [],
      background_color: "#000000",
      background_opacity: 0.85,
      width,
      height,
    },
    is_active: true,
    is_default: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

function buildDragEndEvent(widgetType: WidgetType): DragEndEvent {
  return {
    active: {
      id: `library-${widgetType}`,
      data: {
        current: {
          fromLibrary: true,
          type: widgetType,
        },
      },
      rect: { current: { initial: null, translated: null } },
    },
    over: {
      id: "preview-canvas",
      rect: { width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300 },
      disabled: false,
      data: { current: undefined },
    },
    delta: { x: 0, y: 0 },
    collisions: [],
    activatorEvent: new Event("pointer"),
  } as unknown as DragEndEvent;
}

// ===== PROPERTY TESTS =====

describe("Property 3: Drag-drop from library adds widget to layout", () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
    mockUpdateProfile.mockClear();
    mockLoadProfiles.mockClear();
  });

  /**
   * **Validates: Requirements 9.1**
   *
   * For any widget type from the Widget Library, when a drag-end event
   * completes over the canvas droppable area, the layout's widget array
   * SHALL contain a new widget of that type with valid coordinates within
   * the canvas bounds.
   */
  it("for any widget type and canvas size, drag-drop adds widget at valid clamped coordinates", () => {
    fc.assert(
      fc.property(
        widgetTypeArb,
        canvasWidthArb,
        canvasHeightArb,
        (widgetType, canvasWidth, canvasHeight) => {
          // Setup mock active profile with the generated canvas dimensions
          mockActiveProfile = buildActiveProfile(canvasWidth, canvasHeight);
          mockUpdateProfile.mockClear();

          // Render OverlayEditor (mocks are hoisted, so they're active)
          const { unmount } = render(<OverlayEditor />);

          // Ensure the DndContext captured the onDragEnd handler
          expect(capturedOnDragEnd).not.toBeNull();

          // Simulate a drag-end event from library
          const event = buildDragEndEvent(widgetType);
          capturedOnDragEnd!(event);

          // Verify updateProfile was called
          expect(mockUpdateProfile).toHaveBeenCalledTimes(1);

          const [profileId, updateInput] = mockUpdateProfile.mock.calls[0];
          expect(profileId).toBe("profile-1");

          const newLayout: OverlayProfileLayout = updateInput.layout;
          expect(newLayout).toBeDefined();
          expect(newLayout.widgets).toHaveLength(1);

          const addedWidget = newLayout.widgets[0];

          // Verify the widget has the correct type
          expect(addedWidget.type).toBe(widgetType);

          // Verify the widget has a valid ID
          expect(addedWidget.id).toBe("test-uuid-1234");

          // Verify default size is "medium"
          expect(addedWidget.size).toBe("medium");

          // Verify opacity is 1.0
          expect(addedWidget.opacity).toBe(1.0);

          // Medium widget dimensions: width=100, height=24
          const widgetWidth = 100;
          const widgetHeight = 24;

          // Verify x is within valid bounds [0, canvasWidth - widgetWidth]
          expect(addedWidget.x).toBeGreaterThanOrEqual(0);
          expect(addedWidget.x).toBeLessThanOrEqual(canvasWidth - widgetWidth);

          // Verify y is within valid bounds [0, canvasHeight - widgetHeight]
          expect(addedWidget.y).toBeGreaterThanOrEqual(0);
          expect(addedWidget.y).toBeLessThanOrEqual(canvasHeight - widgetHeight);

          unmount();
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ===== PROPERTY 4: Widget Repositioning =====

/**
 * Property-based test: Widget repositioning updates coordinates.
 *
 * **Validates: Requirements 9.2**
 *
 * Property 4: For any widget at position (x, y) on the canvas and any drag
 * delta (dx, dy), after a successful drag-end event, the widget's position
 * SHALL be updated to clamped(x + dx, y + dy) where clamping ensures the
 * widget stays within canvas bounds.
 */

const WIDGET_SIZES: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];

const WIDGET_DIMS: Record<string, { width: number; height: number }> = {
  small: { width: 80, height: 20 },
  medium: { width: 100, height: 24 },
  large: { width: 140, height: 32 },
};

/** Generate a valid widget size. */
const widgetSizeArb = fc.constantFrom(...WIDGET_SIZES);

/** Generate drag deltas (can be large positive or negative to test clamping). */
const dragDeltaArb = fc.integer({ min: -1000, max: 1000 });

describe("Property 4: Widget repositioning updates coordinates", () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
    mockUpdateProfile.mockClear();
    mockLoadProfiles.mockClear();
  });

  /**
   * **Validates: Requirements 9.2**
   *
   * For any widget at position (x, y) on the canvas and any drag delta (dx, dy),
   * after a successful drag-end event, the widget's position SHALL be updated to
   * clamped(x + dx, y + dy) where clamping ensures the widget stays within canvas bounds.
   */
  it("for any widget position, size, and drag delta, repositioning clamps to canvas bounds", () => {
    fc.assert(
      fc.property(
        canvasWidthArb,
        canvasHeightArb,
        widgetSizeArb,
        widgetTypeArb,
        dragDeltaArb,
        dragDeltaArb,
        (canvasWidth, canvasHeight, widgetSize, widgetType, dx, dy) => {
          const dims = WIDGET_DIMS[widgetSize];

          // Generate a valid starting position within bounds for this widget size
          const maxStartX = Math.max(0, canvasWidth - dims.width);
          const maxStartY = Math.max(0, canvasHeight - dims.height);
          // Use deterministic positions based on canvas size (center)
          const startX = Math.min(Math.floor(canvasWidth / 3), maxStartX);
          const startY = Math.min(Math.floor(canvasHeight / 3), maxStartY);

          const widgetId = "widget-reposition-test";

          // Build a profile with an existing widget on the canvas
          const profile: OverlayProfile = {
            id: "profile-1",
            name: "Test Profile",
            layout: {
              widgets: [
                {
                  id: widgetId,
                  type: widgetType,
                  x: startX,
                  y: startY,
                  size: widgetSize,
                  opacity: 1.0,
                },
              ],
              background_color: "#000000",
              background_opacity: 0.85,
              width: canvasWidth,
              height: canvasHeight,
            },
            is_active: true,
            is_default: false,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          };

          mockActiveProfile = profile;
          mockUpdateProfile.mockClear();

          // Render OverlayEditor
          const { unmount } = render(<OverlayEditor />);

          expect(capturedOnDragEnd).not.toBeNull();

          // Simulate a drag-end event for repositioning an existing canvas widget
          const event: DragEndEvent = {
            active: {
              id: `canvas-widget-${widgetId}`,
              data: {
                current: {
                  fromCanvas: true,
                  widgetId: widgetId,
                },
              },
              rect: { current: { initial: null, translated: null } },
            },
            over: {
              id: "preview-canvas",
              rect: { width: canvasWidth, height: canvasHeight, top: 0, left: 0, right: canvasWidth, bottom: canvasHeight },
              disabled: false,
              data: { current: undefined },
            },
            delta: { x: dx, y: dy },
            collisions: [],
            activatorEvent: new Event("pointer"),
          } as unknown as DragEndEvent;

          capturedOnDragEnd!(event);

          // Verify updateProfile was called
          expect(mockUpdateProfile).toHaveBeenCalledTimes(1);

          const [profileId, updateInput] = mockUpdateProfile.mock.calls[0];
          expect(profileId).toBe("profile-1");

          const newLayout: OverlayProfileLayout = updateInput.layout;
          expect(newLayout).toBeDefined();
          expect(newLayout.widgets).toHaveLength(1);

          const movedWidget = newLayout.widgets[0];
          expect(movedWidget.id).toBe(widgetId);

          // Calculate expected clamped position
          const rawX = startX + dx;
          const rawY = startY + dy;
          const expectedX = Math.min(Math.max(0, canvasWidth - dims.width), Math.max(0, rawX));
          const expectedY = Math.min(Math.max(0, canvasHeight - dims.height), Math.max(0, rawY));

          // Verify the widget position matches the expected clamped coordinates
          expect(movedWidget.x).toBe(expectedX);
          expect(movedWidget.y).toBe(expectedY);

          // Verify position is within canvas bounds
          expect(movedWidget.x).toBeGreaterThanOrEqual(0);
          expect(movedWidget.x).toBeLessThanOrEqual(canvasWidth - dims.width);
          expect(movedWidget.y).toBeGreaterThanOrEqual(0);
          expect(movedWidget.y).toBeLessThanOrEqual(canvasHeight - dims.height);

          unmount();
          cleanup();
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);
});
