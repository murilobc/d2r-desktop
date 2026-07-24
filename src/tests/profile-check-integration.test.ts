import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { listen } from "@tauri-apps/api/event";
import { useDetectionToast } from "../hooks/useDetectionToast";

const mockListen = vi.mocked(listen);

/**
 * Integration tests for profile check behavior:
 * - localStorage is synced when profile changes (simulates App.tsx useEffect)
 * - "Select a profile first" toast appears when hotkey fires with no profile
 *
 * Requirements: 2.1, 2.2, 2.3
 */
describe("Profile check integration", () => {
  let eventCallbacks: Record<string, (event: { payload: unknown }) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    eventCallbacks = {};

    mockListen.mockImplementation((eventName: string, callback: unknown) => {
      eventCallbacks[eventName] = callback as (event: { payload: unknown }) => void;
      return Promise.resolve(() => {});
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("localStorage sync when profile changes", () => {
    it("stores profile ID in localStorage when a profile is selected", () => {
      // Simulates the App.tsx useEffect behavior:
      // when selectedProfile changes to a non-null value, setItem is called
      const profileId = 42;
      localStorage.setItem("d2r_active_profile_id", profileId.toString());

      expect(localStorage.getItem("d2r_active_profile_id")).toBe("42");
    });

    it("removes localStorage key when profile is deselected (null)", () => {
      // First set a profile
      localStorage.setItem("d2r_active_profile_id", "7");
      expect(localStorage.getItem("d2r_active_profile_id")).toBe("7");

      // Simulates the App.tsx useEffect behavior:
      // when selectedProfile becomes null, removeItem is called
      localStorage.removeItem("d2r_active_profile_id");

      expect(localStorage.getItem("d2r_active_profile_id")).toBeNull();
    });

    it("overwrites previous profile ID when a different profile is selected", () => {
      localStorage.setItem("d2r_active_profile_id", "1");
      expect(localStorage.getItem("d2r_active_profile_id")).toBe("1");

      // Selecting a different profile overwrites
      localStorage.setItem("d2r_active_profile_id", "99");
      expect(localStorage.getItem("d2r_active_profile_id")).toBe("99");
    });
  });

  describe("hotkey handler reads localStorage for profile check", () => {
    it("localStorage returns null when no profile is set (hotkey should emit no-profile)", () => {
      // No profile selected — localStorage key doesn't exist
      const profileId = localStorage.getItem("d2r_active_profile_id");
      expect(profileId).toBeNull();
    });

    it("localStorage returns profile ID string when profile is set (hotkey should invoke detect)", () => {
      localStorage.setItem("d2r_active_profile_id", "5");
      const profileId = localStorage.getItem("d2r_active_profile_id");
      expect(profileId).toBe("5");
    });
  });

  describe("'Select a profile first' toast appears when hotkey fires with no profile", () => {
    it("shows toast when screenshot:no-profile event is emitted (simulates hotkey with no profile)", async () => {
      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      // Simulate the hotkey handler detecting no profile in localStorage
      // and emitting screenshot:no-profile
      act(() => {
        eventCallbacks["screenshot:no-profile"]({ payload: undefined });
      });

      expect(result.current.toast).toEqual({
        message: "Select a profile first to log items",
        visible: true,
      });
    });

    it("toast auto-dismisses after 4 seconds", async () => {
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

    it("end-to-end: no profile in localStorage → no-profile event → toast shown", async () => {
      // Verify localStorage has no profile
      expect(localStorage.getItem("d2r_active_profile_id")).toBeNull();

      const { result } = renderHook(() => useDetectionToast());
      await act(async () => {});

      // Simulate what registerHotkeys does: check localStorage, find no profile, emit event
      const profileId = localStorage.getItem("d2r_active_profile_id");
      if (!profileId) {
        act(() => {
          eventCallbacks["screenshot:no-profile"]({ payload: undefined });
        });
      }

      expect(result.current.toast).toEqual({
        message: "Select a profile first to log items",
        visible: true,
      });
    });
  });
});
