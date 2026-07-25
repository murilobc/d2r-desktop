import { useState, useCallback, useRef, useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DetectionResult, MatchCandidate, Run } from "../types";
import {
  createItem,
  getRuns,
  updateRuneCount,
  detectFromClipboard,
  detectLatestFolderFile,
} from "../api";

const AUTO_DISMISS_MS = 30_000;

export interface UseScreenshotDetection {
  detection: DetectionResult | null;
  dismiss: () => void;
  confirm: (item: MatchCandidate) => void;
  triggerManual: () => void;
}

export function useScreenshotDetection(
  profileId: string | null,
  onError?: (message: string) => void,
  sessionActive?: boolean
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
        // Find an active run for this profile
        const runId = await getActiveRunId(profileId);

        if (runId === null) {
          // No active session — block confirm and notify user
          if (onError) {
            onError("Start a session first to detect items");
          }
          return;
        }

        // Log the item
        await createItem({
          run_id: runId,
          profile_id: profileId,
          name: item.item_name,
          item_type: item.subcategory,  // subcategory = physical type (Armor, Weapon, Shield...)
          rarity: item.category,         // category = rarity (Unique, Set, Rune...)
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
    [profileId, clearTimer, onError]
  );

  // Manual trigger: clipboard + latest folder file
  const triggerManual = useCallback(() => {
    if (!profileId) {
      if (onError) onError("Start a session first to detect items");
      return;
    }

    // Session guard: use sessionActive prop (from App.tsx via overlay-state-update)
    // Fall back to backend check only when sessionActive is undefined (not yet received)
    if (sessionActive === false) {
      if (onError) onError("Start a session first to detect items");
      return;
    }

    if (sessionActive === undefined) {
      // Haven't received session state yet — check backend
      getRuns(profileId).then((runs) => {
        if (Array.isArray(runs) && runs.filter((r) => r.finished_at === null).length === 0) {
          if (onError) onError("Start a session first to detect items");
          return;
        }
        _runDetection(onError);
      }).catch(() => _runDetection(onError));
      return;
    }

    _runDetection(onError);
  }, [profileId, onError, sessionActive]);

  return { detection, dismiss, confirm, triggerManual };
}

function _runDetection(_onError?: (message: string) => void) {
  // 1. Always try clipboard first
  detectFromClipboard().catch((error) => {
    console.error("Clipboard detection failed:", error);
  });

  // 2. Also try the latest file in the screenshots folder (for Print Screen saves)
  detectLatestFolderFile().catch((error) => {
    console.error("Folder detection failed:", error);
  });
}

/**
 * Finds an active run (one with no finished_at) for the given profile.
 * Returns null when no active run exists (no auto-creation of standalone runs).
 */
async function getActiveRunId(profileId: string): Promise<string | null> {
  const runs: Run[] = await getRuns(profileId);
  const activeRun = runs.find((r) => r.finished_at === null);

  if (activeRun) {
    return activeRun.id;
  }

  return null;
}
