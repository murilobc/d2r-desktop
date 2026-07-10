import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Widget from "./Widget";

// Capture the event listener for overlay-state-update
let stateListener: ((event: { payload: unknown }) => void) | null = null;

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
    startDragging: vi.fn(),
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
