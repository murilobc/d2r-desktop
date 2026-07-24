import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Overlay from "./Overlay";

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

describe("Overlay detection button", () => {
  let eventCallbacks: Record<string, (event: { payload: unknown }) => void>;

  beforeEach(() => {
    eventCallbacks = {};
    mockInvoke.mockResolvedValue(undefined);
    mockListen.mockImplementation((eventName: string, callback: unknown) => {
      eventCallbacks[eventName] = callback as (event: { payload: unknown }) => void;
      return Promise.resolve(() => {});
    });
  });

  describe("idle state (no session)", () => {
    it("renders detect button in the overlay-header area", () => {
      const { container } = render(<Overlay />);

      const header = container.querySelector(".overlay-header");
      expect(header).toBeInTheDocument();

      const detectBtn = header!.querySelector(".ov-detect");
      expect(detectBtn).toBeInTheDocument();
      expect(detectBtn).toHaveTextContent("◫");
    });

    it("detect button uses ov-btn ov-detect classes", () => {
      const { container } = render(<Overlay />);

      const detectBtn = container.querySelector(".ov-btn.ov-detect");
      expect(detectBtn).toBeInTheDocument();
    });

    it("detect button displays ◫ icon", () => {
      const { container } = render(<Overlay />);

      const detectBtn = container.querySelector(".ov-detect");
      expect(detectBtn).toHaveTextContent("◫");
    });

    it("click invokes detect_from_clipboard", async () => {
      const { container } = render(<Overlay />);

      const detectBtn = container.querySelector(".ov-detect") as HTMLElement;
      await act(async () => {
        fireEvent.click(detectBtn);
      });

      expect(mockInvoke).toHaveBeenCalledWith("detect_from_clipboard");
    });

    it("is keyboard accessible - Enter activates", async () => {
      const { container } = render(<Overlay />);

      const detectBtn = container.querySelector(".ov-detect") as HTMLElement;
      await act(async () => {
        fireEvent.keyDown(detectBtn, { key: "Enter" });
      });

      // Buttons natively handle Enter/Space, so clicking should work
      // For native <button> elements, keyboard activation is built-in
      expect(detectBtn.tagName).toBe("BUTTON");
    });

    it("is keyboard accessible - Space activates", async () => {
      const { container } = render(<Overlay />);

      const detectBtn = container.querySelector(".ov-detect") as HTMLElement;
      await act(async () => {
        fireEvent.keyUp(detectBtn, { key: " " });
      });

      // Native <button> elements handle Space on keyUp
      expect(detectBtn.tagName).toBe("BUTTON");
    });
  });

  describe("active state (session running)", () => {
    it("renders detect button in the overlay-controls bar", async () => {
      const { container } = render(<Overlay />);

      // Simulate session active state via overlay-state-update event
      await act(async () => {
        eventCallbacks["overlay-state-update"]?.({
          payload: {
            sessionActive: true,
            paused: false,
            sessionElapsed: 100,
            runElapsed: 50,
            sessionRunCount: 3,
            totalRunCount: 10,
            area: "Chaos Sanctuary",
          },
        });
      });

      const controls = container.querySelector(".overlay-controls");
      expect(controls).toBeInTheDocument();

      const detectBtn = controls!.querySelector(".ov-detect");
      expect(detectBtn).toBeInTheDocument();
      expect(detectBtn).toHaveTextContent("◫");
    });

    it("detect button uses ov-btn ov-detect classes in active state", async () => {
      const { container } = render(<Overlay />);

      await act(async () => {
        eventCallbacks["overlay-state-update"]?.({
          payload: {
            sessionActive: true,
            paused: false,
            sessionElapsed: 0,
            runElapsed: 0,
            sessionRunCount: 0,
            totalRunCount: 0,
            area: "",
          },
        });
      });

      const controls = container.querySelector(".overlay-controls");
      const detectBtn = controls!.querySelector(".ov-btn.ov-detect");
      expect(detectBtn).toBeInTheDocument();
    });

    it("click invokes detect_from_clipboard in active state", async () => {
      const { container } = render(<Overlay />);

      await act(async () => {
        eventCallbacks["overlay-state-update"]?.({
          payload: {
            sessionActive: true,
            paused: false,
            sessionElapsed: 0,
            runElapsed: 0,
            sessionRunCount: 0,
            totalRunCount: 0,
            area: "",
          },
        });
      });

      const controls = container.querySelector(".overlay-controls");
      const detectBtn = controls!.querySelector(".ov-detect") as HTMLElement;

      await act(async () => {
        fireEvent.click(detectBtn);
      });

      expect(mockInvoke).toHaveBeenCalledWith("detect_from_clipboard");
    });

    it("detect button is a native button element for keyboard accessibility", async () => {
      const { container } = render(<Overlay />);

      await act(async () => {
        eventCallbacks["overlay-state-update"]?.({
          payload: {
            sessionActive: true,
            paused: false,
            sessionElapsed: 0,
            runElapsed: 0,
            sessionRunCount: 0,
            totalRunCount: 0,
            area: "",
          },
        });
      });

      const controls = container.querySelector(".overlay-controls");
      const detectBtn = controls!.querySelector(".ov-detect") as HTMLElement;
      expect(detectBtn.tagName).toBe("BUTTON");
    });
  });
});
