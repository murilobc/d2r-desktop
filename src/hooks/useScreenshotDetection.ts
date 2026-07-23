import { useState, useCallback, useRef, useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DetectionResult, MatchCandidate, Run } from "../types";
import {
  createItem,
  createRun,
  getRuns,
  updateRuneCount,
  detectFromClipboard,
} from "../api";

const AUTO_DISMISS_MS = 30_000;

export interface UseScreenshotDetection {
  detection: DetectionResult | null;
  dismiss: () => void;
  confirm: (item: MatchCandidate) => void;
  triggerManual: () => void;
}

export function useScreenshotDetection(
  profileId: string | null
): UseScreenshotDetection {
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the auto-dismiss timer
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start (or restart) the 30-second auto-dismiss timer
  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setDetection(null);
    }, AUTO_DISMISS_MS);
  }, [clearTimer]);

  // Listen for Tauri detection events
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      unlisten = await listen<DetectionResult>(
        "screenshot:item-detected",
        (event) => {
          setDetection(event.payload);
          startTimer();
        }
      );
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
      clearTimer();
    };
  }, [startTimer, clearTimer]);

  // Dismiss: clear detection and cancel timer
  const dismiss = useCallback(() => {
    clearTimer();
    setDetection(null);
  }, [clearTimer]);

  // Confirm: log the item, handle rune sync, then clear state
  const confirm = useCallback(
    async (item: MatchCandidate) => {
      if (!profileId) return;

      try {
        // Find or create a run for this profile
        const runId = await getOrCreateRunId(profileId);

        // Log the item
        await createItem({
          run_id: runId,
          profile_id: profileId,
          name: item.item_name,
          item_type: item.category,
          rarity: item.subcategory,
        });

        // If it's a Rune, also sync rune inventory
        if (item.category === "Rune") {
          await updateRuneCount(profileId, item.item_name, 1);
        }
      } catch (error) {
        // Error handling is surfaced to the caller via thrown error
        // The UI layer (ConfirmationDialog) should catch and show toast
        console.error("Failed to confirm detected item:", error);
        throw error;
      } finally {
        // Always clear the detection state after confirm attempt
        clearTimer();
        setDetection(null);
      }
    },
    [profileId, clearTimer]
  );

  // Manual trigger: invoke the backend clipboard detection
  const triggerManual = useCallback(() => {
    detectFromClipboard().catch((error) => {
      console.error("Manual detection failed:", error);
    });
  }, []);

  return { detection, dismiss, confirm, triggerManual };
}

/**
 * Finds an active run (one with no finished_at) for the given profile,
 * or creates a standalone run if none exists.
 */
async function getOrCreateRunId(profileId: string): Promise<string> {
  const runs: Run[] = await getRuns(profileId);
  const activeRun = runs.find((r) => r.finished_at === null);

  if (activeRun) {
    return activeRun.id;
  }

  // No active run — create a standalone run
  const newRun = await createRun({
    profile_id: profileId,
    area: "Screenshot Detection",
  });

  return newRun.id;
}
