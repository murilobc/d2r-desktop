import { useState, useCallback, useRef, useEffect } from "react";
import type { AchievementUnlock } from "../types";

const AUTO_DISMISS_MS = 4000;
const TOAST_GAP_MS = 300;

export interface UseAchievementToasts {
  currentToast: AchievementUnlock | null;
  enqueue: (unlocks: AchievementUnlock[]) => void;
  dismiss: () => void;
}

export function useAchievementToasts(): UseAchievementToasts {
  const [queue, setQueue] = useState<AchievementUnlock[]>([]);
  const [currentToast, setCurrentToast] = useState<AchievementUnlock | null>(null);

  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (autoDismissTimer.current !== null) clearTimeout(autoDismissTimer.current);
      if (gapTimer.current !== null) clearTimeout(gapTimer.current);
    };
  }, []);

  // Start auto-dismiss timer whenever a toast becomes active
  useEffect(() => {
    if (currentToast === null) return;

    autoDismissTimer.current = setTimeout(() => {
      autoDismissTimer.current = null;
      setCurrentToast(null);
    }, AUTO_DISMISS_MS);

    return () => {
      if (autoDismissTimer.current !== null) {
        clearTimeout(autoDismissTimer.current);
        autoDismissTimer.current = null;
      }
    };
  }, [currentToast]);

  // When currentToast becomes null and there are items in queue, schedule next after gap
  useEffect(() => {
    if (currentToast !== null || queue.length === 0) return;

    gapTimer.current = setTimeout(() => {
      gapTimer.current = null;
      setQueue((prev) => {
        if (prev.length === 0) return prev;
        const [next, ...rest] = prev;
        setCurrentToast(next);
        return rest;
      });
    }, TOAST_GAP_MS);

    return () => {
      if (gapTimer.current !== null) {
        clearTimeout(gapTimer.current);
        gapTimer.current = null;
      }
    };
  }, [currentToast, queue.length]);

  const enqueue = useCallback(
    (unlocks: AchievementUnlock[]) => {
      if (unlocks.length === 0) return;

      if (currentToast === null) {
        const [first, ...rest] = unlocks;
        setCurrentToast(first);
        if (rest.length > 0) {
          setQueue((prev) => [...prev, ...rest]);
        }
      } else {
        setQueue((prev) => [...prev, ...unlocks]);
      }
    },
    [currentToast]
  );

  const dismiss = useCallback(() => {
    if (autoDismissTimer.current !== null) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    setCurrentToast(null);
  }, []);

  return { currentToast, enqueue, dismiss };
}
