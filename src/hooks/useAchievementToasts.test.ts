import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useAchievementToasts } from "./useAchievementToasts";
import type { AchievementUnlock } from "../types";

function makeUnlock(id: string): AchievementUnlock {
  return {
    id,
    profile_id: "profile-1",
    definition_id: `def-${id}`,
    unlocked_at: new Date().toISOString(),
    definition: {
      id: `def-${id}`,
      category: "milestone",
      name_key: `milestone_${id}`,
      description_key: `milestone_${id}_desc`,
      icon: "🏆",
      condition_type: "total_runs",
      condition_target: null,
      threshold: 100,
      sort_order: 0,
    },
  };
}

describe("useAchievementToasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Property 7: Toast Queue Sequential Display
   * Validates: Requirements 3.2, 3.4, 3.5
   */
  describe("Property 7: Toast Queue Sequential Display — FIFO ordering and one-at-a-time display", () => {
    it("displays the first enqueued toast immediately", () => {
      const { result } = renderHook(() => useAchievementToasts());

      const unlock = makeUnlock("1");
      act(() => {
        result.current.enqueue([unlock]);
      });

      expect(result.current.currentToast).toEqual(unlock);
    });

    it("shows only one toast at a time when multiple are enqueued", () => {
      const { result } = renderHook(() => useAchievementToasts());

      const unlocks = [makeUnlock("1"), makeUnlock("2"), makeUnlock("3")];
      act(() => {
        result.current.enqueue(unlocks);
      });

      // Only the first item is shown
      expect(result.current.currentToast).toEqual(unlocks[0]);
    });

    it("displays toasts in FIFO order after each dismissal", () => {
      const { result } = renderHook(() => useAchievementToasts());

      const unlocks = [makeUnlock("1"), makeUnlock("2"), makeUnlock("3")];
      act(() => {
        result.current.enqueue(unlocks);
      });

      // First toast is shown
      expect(result.current.currentToast?.id).toBe("1");

      // Dismiss first toast
      act(() => {
        result.current.dismiss();
      });

      // After gap timer (300ms), second toast appears
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("2");

      // Dismiss second toast
      act(() => {
        result.current.dismiss();
      });

      // After gap timer, third toast appears
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("3");
    });

    it("shows no toast when queue is empty and last toast is dismissed", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([makeUnlock("1")]);
      });
      expect(result.current.currentToast).not.toBeNull();

      act(() => {
        result.current.dismiss();
      });

      // Even after gap timer, no toast since queue is empty
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast).toBeNull();
    });

    it("does nothing when enqueueing an empty array", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([]);
      });

      expect(result.current.currentToast).toBeNull();
    });

    it("appends to existing queue when a toast is already showing", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([makeUnlock("1")]);
      });
      expect(result.current.currentToast?.id).toBe("1");

      // Enqueue more while first is active
      act(() => {
        result.current.enqueue([makeUnlock("2"), makeUnlock("3")]);
      });

      // Still showing the first
      expect(result.current.currentToast?.id).toBe("1");

      // Dismiss and advance through the queue
      act(() => {
        result.current.dismiss();
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("2");

      act(() => {
        result.current.dismiss();
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("3");
    });
  });

  describe("Auto-dismiss timer behavior", () => {
    it("auto-dismisses the current toast after 4000ms", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([makeUnlock("1")]);
      });
      expect(result.current.currentToast).not.toBeNull();

      // Advance just before the auto-dismiss time
      act(() => {
        vi.advanceTimersByTime(3999);
      });
      expect(result.current.currentToast).not.toBeNull();

      // Advance past auto-dismiss threshold
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.currentToast).toBeNull();
    });

    it("shows the next queued toast after auto-dismiss + 300ms gap", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([makeUnlock("1"), makeUnlock("2")]);
      });
      expect(result.current.currentToast?.id).toBe("1");

      // Auto-dismiss fires at 4000ms
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(result.current.currentToast).toBeNull();

      // After 300ms gap, the next toast appears
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("2");
    });

    it("auto-dismisses multiple toasts sequentially with correct timing", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([makeUnlock("1"), makeUnlock("2"), makeUnlock("3")]);
      });

      // First toast auto-dismissed at 4000ms
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(result.current.currentToast).toBeNull();

      // After 300ms gap, second toast appears
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("2");

      // Second toast auto-dismissed at 4000ms
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(result.current.currentToast).toBeNull();

      // After 300ms gap, third toast appears
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("3");

      // Third toast auto-dismissed at 4000ms → no more toasts
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(result.current.currentToast).toBeNull();
    });
  });

  describe("Manual dismiss advances queue", () => {
    it("dismiss() clears the current toast immediately", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([makeUnlock("1")]);
      });
      expect(result.current.currentToast).not.toBeNull();

      act(() => {
        result.current.dismiss();
      });
      expect(result.current.currentToast).toBeNull();
    });

    it("dismiss() cancels the auto-dismiss timer", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([makeUnlock("1"), makeUnlock("2")]);
      });

      // Dismiss manually before auto-dismiss
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      act(() => {
        result.current.dismiss();
      });

      // After gap, next toast appears
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("2");

      // The old 4000ms timer should NOT fire and mess with anything
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      // Toast 2 should still be showing (it has its own 4000ms)
      expect(result.current.currentToast?.id).toBe("2");
    });

    it("dismiss() followed by gap shows the next toast in queue", () => {
      const { result } = renderHook(() => useAchievementToasts());

      act(() => {
        result.current.enqueue([makeUnlock("1"), makeUnlock("2")]);
      });

      act(() => {
        result.current.dismiss();
      });

      // Not yet — gap hasn't elapsed
      expect(result.current.currentToast).toBeNull();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.currentToast?.id).toBe("2");
    });

    it("dismiss() when no toast is showing does nothing", () => {
      const { result } = renderHook(() => useAchievementToasts());

      // Should not throw
      act(() => {
        result.current.dismiss();
      });
      expect(result.current.currentToast).toBeNull();
    });
  });
});
