import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import Widget from "./Widget";
import { listen } from "@tauri-apps/api/event";
// getCurrentWindow is mocked via vi.mock below
// import { getCurrentWindow } from "@tauri-apps/api/window";

// Capture the event listener for overlay-state-update
let stateListener: ((event: { payload: unknown }) => void) | null = null;

const { mockStartDragging } = vi.hoisted(() => ({
  mockStartDragging: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((eventName: string, callback: (event: { payload: unknown }) => void) => {
    if (eventName === "overlay-state-update") {
      stateListener = callback;
    }
    return Promise.resolve(() => { stateListener = null; });
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    startDragging: mockStartDragging,
  }),
}));

describe("Widget", () => {
  beforeEach(() => {
    stateListener = null;
  });

  it("renders idle state with D2R text", () => {
    render(<Widget />);
    expect(screen.getByText("D2R")).toBeInTheDocument();
  });

  it("shows run count and session time when active", async () => {
    render(<Widget />);

    await act(async () => {
      stateListener?.({
        payload: {
          sessionActive: true,
          paused: false,
          sessionElapsed: 36010, // 1h 0m 1s (in tenths)
          runElapsed: 500,
          sessionRunCount: 12,
          totalRunCount: 50,
          area: "Mephisto",
        },
      });
    });

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("01:00:01")).toBeInTheDocument();
  });

  it("shows separator between stats", async () => {
    render(<Widget />);

    await act(async () => {
      stateListener?.({
        payload: {
          sessionActive: true,
          paused: false,
          sessionElapsed: 100,
          runElapsed: 50,
          sessionRunCount: 3,
          totalRunCount: 10,
          area: "Pit",
        },
      });
    });

    expect(screen.getByText("|")).toBeInTheDocument();
  });
});

/**
 * Preservation Property Tests
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * These tests capture the EXISTING infrastructure behavior that must remain
 * unchanged after the widget mode fix is implemented. They verify:
 * - Theme application from localStorage
 * - Event subscription to overlay-state-update
 * - State transitions (idle ↔ active via sessionActive flag)
 * - Drag behavior on non-button elements
 * - Button drag guard (no drag on button elements)
 */
describe("Widget Preservation Properties", () => {
  beforeEach(() => {
    stateListener = null;
    mockStartDragging.mockClear();
    (listen as ReturnType<typeof vi.fn>).mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Theme preservation", () => {
    it("reads d2r-theme from localStorage and sets data-theme attribute to 'dark'", () => {
      localStorage.setItem("d2r-theme", "dark");
      render(<Widget />);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("reads d2r-theme from localStorage and sets data-theme attribute to 'light'", () => {
      localStorage.setItem("d2r-theme", "light");
      render(<Widget />);
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("defaults to 'dark' when localStorage has no d2r-theme", () => {
      // Ensure no theme is set
      localStorage.removeItem("d2r-theme");
      render(<Widget />);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });

  describe("Event subscription preservation", () => {
    it("subscribes to overlay-state-update on mount via listen()", () => {
      render(<Widget />);
      expect(listen).toHaveBeenCalledWith(
        "overlay-state-update",
        expect.any(Function)
      );
    });

    it("calls listen with overlay-state-update as the first argument", () => {
      render(<Widget />);
      const calls = (listen as ReturnType<typeof vi.fn>).mock.calls;
      const overlayCall = calls.find(
        (call: unknown[]) => call[0] === "overlay-state-update"
      );
      expect(overlayCall).toBeDefined();
      expect(overlayCall![0]).toBe("overlay-state-update");
    });
  });

  describe("State transitions", () => {
    it("renders idle mode (widget-idle class) when sessionActive is false", () => {
      const { container } = render(<Widget />);
      const widgetContainer = container.querySelector(".widget-container");
      expect(widgetContainer).toHaveClass("widget-idle");
    });

    it("renders active mode (no widget-idle class) when sessionActive is true", async () => {
      const { container } = render(<Widget />);

      await act(async () => {
        stateListener?.({
          payload: {
            sessionActive: true,
            paused: false,
            sessionElapsed: 100,
            runElapsed: 50,
            sessionRunCount: 5,
            totalRunCount: 20,
            area: "Chaos Sanctuary",
          },
        });
      });

      const widgetContainer = container.querySelector(".widget-container");
      expect(widgetContainer).not.toHaveClass("widget-idle");
    });

    it("transitions from idle to active when event fires with sessionActive: true", async () => {
      const { container } = render(<Widget />);

      // Initially idle
      let widgetContainer = container.querySelector(".widget-container");
      expect(widgetContainer).toHaveClass("widget-idle");

      // Fire event with sessionActive: true
      await act(async () => {
        stateListener?.({
          payload: {
            sessionActive: true,
            paused: false,
            sessionElapsed: 200,
            runElapsed: 100,
            sessionRunCount: 1,
            totalRunCount: 10,
            area: "Pit",
          },
        });
      });

      widgetContainer = container.querySelector(".widget-container");
      expect(widgetContainer).not.toHaveClass("widget-idle");
    });

    it("transitions from active back to idle when event fires with sessionActive: false", async () => {
      const { container } = render(<Widget />);

      // First go active
      await act(async () => {
        stateListener?.({
          payload: {
            sessionActive: true,
            paused: false,
            sessionElapsed: 500,
            runElapsed: 100,
            sessionRunCount: 3,
            totalRunCount: 15,
            area: "Mephisto",
          },
        });
      });

      let widgetContainer = container.querySelector(".widget-container");
      expect(widgetContainer).not.toHaveClass("widget-idle");

      // Then go back to idle
      await act(async () => {
        stateListener?.({
          payload: {
            sessionActive: false,
            paused: false,
            sessionElapsed: 0,
            runElapsed: 0,
            sessionRunCount: 0,
            totalRunCount: 15,
            area: "",
          },
        });
      });

      widgetContainer = container.querySelector(".widget-container");
      expect(widgetContainer).toHaveClass("widget-idle");
    });
  });

  describe("Drag preservation", () => {
    it("calls startDragging when mouseDown on widget container (non-button element)", () => {
      const { container } = render(<Widget />);
      const widgetContainer = container.querySelector(".widget-container")!;

      fireEvent.mouseDown(widgetContainer);

      expect(mockStartDragging).toHaveBeenCalled();
    });

    it("calls startDragging when mouseDown on a span inside the widget", () => {
      const { container } = render(<Widget />);
      const innerSpan = container.querySelector(".widget-profile") || container.querySelector(".widget-logo");

      fireEvent.mouseDown(innerSpan!);

      expect(mockStartDragging).toHaveBeenCalled();
    });
  });

  describe("Button drag guard", () => {
    it("does NOT call startDragging when mouseDown on a button element", async () => {
      const { container } = render(<Widget />);

      // Transition to active state to have more elements
      await act(async () => {
        stateListener?.({
          payload: {
            sessionActive: true,
            paused: false,
            sessionElapsed: 100,
            runElapsed: 50,
            sessionRunCount: 1,
            totalRunCount: 5,
            area: "Pit",
          },
        });
      });

      // Create and append a button to simulate a button inside the widget
      const widgetContainer = container.querySelector(".widget-container")!;
      const button = document.createElement("button");
      button.textContent = "Test Button";
      widgetContainer.appendChild(button);

      // Fire mouseDown on the button - the startDrag handler checks tagName === "BUTTON"
      fireEvent.mouseDown(button);

      expect(mockStartDragging).not.toHaveBeenCalled();
    });
  });
});

/**
 * Bug Condition Exploration Tests
 *
 * These tests encode the EXPECTED (fixed) behavior. They are expected to FAIL
 * on the unfixed code, which confirms the bug exists.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
 */
describe("Bug Condition Exploration: Widget displays only hardcoded minimal content", () => {
  beforeEach(() => {
    stateListener = null;
    localStorage.clear();
  });

  it("idle state should display profile name and total run count (not just 'D2R' logo)", async () => {
    render(<Widget />);

    // Simulate overlay-state-update event with idle state payload containing profile info
    await act(async () => {
      stateListener?.({
        payload: {
          sessionActive: false,
          paused: false,
          sessionElapsed: 0,
          runElapsed: 0,
          sessionRunCount: 0,
          totalRunCount: 142,
          area: "",
          profileName: "Blizzard Sorc",
          fastestTime: null,
        },
      });
    });

    // Expected behavior: idle widget shows profile name and total run count
    // Bug condition: widget shows only "D2R" text with no useful information
    expect(screen.getByText(/Blizzard Sorc/)).toBeInTheDocument();
    expect(screen.getByText(/142/)).toBeInTheDocument();
  });

  it("active state should display user-configured stats from preferences (not just hardcoded run count + session time)", async () => {
    // Set widget preferences to show run timer, area, and fastest time
    localStorage.setItem(
      "d2r_widget_prefs",
      JSON.stringify({ stats: ["runTimer", "area", "fastestTime"] })
    );

    render(<Widget />);

    // Simulate overlay-state-update event with rich active state payload
    await act(async () => {
      stateListener?.({
        payload: {
          sessionActive: true,
          paused: false,
          sessionElapsed: 1230, // 2m 3s in tenths
          runElapsed: 450, // 45s in tenths
          sessionRunCount: 5,
          totalRunCount: 142,
          area: "Chaos Sanctuary",
          profileName: "Blizzard Sorc",
          fastestTime: 65, // 65 seconds
        },
      });
    });

    // Expected behavior: widget reads preferences and shows the configured stats
    // Bug condition: widget only shows sessionRunCount and sessionElapsed regardless of preferences

    // Should show run timer (formatted from runElapsed: 450 tenths = 45s = 00:00:45)
    expect(screen.getByText(/00:00:45/)).toBeInTheDocument();

    // Should show area
    expect(screen.getByText(/Chaos Sanctuary/)).toBeInTheDocument();

    // Should show fastest time (65 seconds = 00:01:05 when formatted from 65*10 tenths)
    expect(screen.getByText(/00:01:05/)).toBeInTheDocument();
  });
});
