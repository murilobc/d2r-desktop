import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { listen } from "@tauri-apps/api/event";
import { useDetectionToast } from "./useDetectionToast";

const mockListen = vi.mocked(listen);

describe("useDetectionToast", () => {
  // Store the event callbacks registered by the hook
  let eventCallbacks: Record<string, (event: { payload: unknown }) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    eventCallbacks = {};

    // Mock listen to capture callbacks for each event type
    mockListen.mockImplementation((eventName: string, callback: unknown) => {
      eventCallbacks[eventName] = callback as (event: { payload: unknown }) => void;
      return Promise.resolve(() => {});
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("event listening and reason mapping", () => {
    it("listens for screenshot:detection-failed events and maps 'no_image' to message", async () => {
      const { result } = renderHook(() => useDetectionToast());

      // Wait for the async listen setup
      await act(async () => {});

      expect(mockListen).toHaveBeenCalledWith(
        "screenshot:detection-failed",
        expect.any(Function)
      );

      // Simulate a detection-failed event with reason "no_image"
      act(() => {
        eventCallbacks["screenshot:detection-failed"]({
          payload: { reason: "no_image", message: "" },
        });
      });

      expect(result.current.toast).toEqual({
        message: "No image found in clipboard",
        visible: true,
      });
    });

    it("maps 'no_text' reason to 'No text detected in screenshot'", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        eventCallbacks["screenshot:detection-failed"]({
          payload: { reason: "no_text", message: "" },
        });
      });

      expect(result.current.toast).toEqual({
        message: "No text detected in screenshot",
        visible: true,
      });
    });

    it("maps 'no_match' reason to 'No item detected in screenshot'", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        eventCallbacks["screenshot:detection-failed"]({
          payload: { reason: "no_match", message: "" },
        });
      });

      expect(result.current.toast).toEqual({
        message: "No item detected in screenshot",
        visible: true,
      });
    });

    it("maps unknown reason to fallback generic message", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        eventCallbacks["screenshot:detection-failed"]({
          payload: { reason: "some_unknown_reason", message: "" },
        });
      });

      expect(result.current.toast).toEqual({
        message: "Screenshot detection failed",
        visible: true,
      });
    });
  });

  describe("no-profile event listening", () => {
    it("listens for screenshot:no-profile events and shows profile toast", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      expect(mockListen).toHaveBeenCalledWith(
        "screenshot:no-profile",
        expect.any(Function)
      );

      // Simulate a no-profile event (emitted by the hotkey handler)
      act(() => {
        eventCallbacks["screenshot:no-profile"]({ payload: undefined });
      });

      expect(result.current.toast).toEqual({
        message: "Select a profile first to log items",
        visible: true,
      });
    });

    it("no-profile toast auto-dismisses after 4s like other toasts", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        eventCallbacks["screenshot:no-profile"]({ payload: undefined });
      });

      expect(result.current.toast).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(result.current.toast).toBeNull();
    });

    it("no-profile toast is replaceable by other toasts", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        eventCallbacks["screenshot:no-profile"]({ payload: undefined });
      });

      expect(result.current.toast?.message).toBe("Select a profile first to log items");

      // Replace with a detection-failed event
      act(() => {
        eventCallbacks["screenshot:detection-failed"]({
          payload: { reason: "no_image", message: "" },
        });
      });

      expect(result.current.toast?.message).toBe("No image found in clipboard");
    });

    it("no-profile toast is dismissable via dismissToast", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        eventCallbacks["screenshot:no-profile"]({ payload: undefined });
      });

      expect(result.current.toast).not.toBeNull();

      act(() => {
        result.current.dismissToast();
      });

      expect(result.current.toast).toBeNull();
    });
  });

  describe("showToast", () => {
    it("sets message state when called imperatively", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        result.current.showToast("Select a profile first to log items");
      });

      expect(result.current.toast).toEqual({
        message: "Select a profile first to log items",
        visible: true,
      });
    });
  });

  describe("auto-dismiss", () => {
    it("auto-dismisses after 4000ms", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        result.current.showToast("Test message");
      });

      expect(result.current.toast).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(3999);
      });

      // Still visible just before 4000ms
      expect(result.current.toast).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      // Dismissed at 4000ms
      expect(result.current.toast).toBeNull();
    });
  });

  describe("replacing a toast resets the timer", () => {
    it("resets auto-dismiss timer when a new toast replaces the previous one", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        result.current.showToast("First message");
      });

      // Advance 3000ms (first toast still showing)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.toast?.message).toBe("First message");

      // Replace with a new toast - timer should reset
      act(() => {
        result.current.showToast("Second message");
      });

      expect(result.current.toast?.message).toBe("Second message");

      // Advance 3000ms from replacement (total 6000ms from first toast)
      // The first toast would have been dismissed by now, but the second should still be visible
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.toast).not.toBeNull();
      expect(result.current.toast?.message).toBe("Second message");

      // Advance remaining 1000ms to hit 4000ms from second toast
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.toast).toBeNull();
    });
  });

  describe("dismissToast", () => {
    it("clears state immediately", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        result.current.showToast("Test message");
      });

      expect(result.current.toast).not.toBeNull();

      act(() => {
        result.current.dismissToast();
      });

      expect(result.current.toast).toBeNull();
    });

    it("cancels the auto-dismiss timer", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      act(() => {
        result.current.showToast("Test message");
      });

      act(() => {
        result.current.dismissToast();
      });

      // Advance past the 4000ms — should not cause any state update issues
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.toast).toBeNull();
    });
  });
});
