import { useState, useCallback, useRef, useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DetectionResult, MatchCandidate, Run } from "../types";
import {
  createItem,
  getRuns,
  updateRuneCount,
  detectFromClipboard,
  detectFromFolder,
  getScreenshotSettings,
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
  _sessionActive?: boolean
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
    [profileId, clearTimer, onError]
  );

  // Manual trigger: invoke the backend clipboard detection
  const triggerManual = useCallback(() => {
    // Session guard: check for active runs in the backend
    // If profileId is not set, we can't check — block
    if (!profileId) {
      if (onError) {
        onError("Start a session first to detect items");
      }
      return;
    }

    getRuns(profileId)
      .then((runs) => {
        // If runs is a valid array with no active runs, block detection
        if (Array.isArray(runs) && runs.filter((r) => r.finished_at === null).length === 0) {
          if (onError) {
            onError("Start a session first to detect items");
          }
          return;
        }

        // Session is active — proceed with detection
        detectFromClipboard().catch((error) => {
          console.error("Manual detection failed:", error);
          if (onError) {
            const msg = String(error);
            if (msg.includes("no_image")) {
              onError("No image found in clipboard");
            } else {
              onError("Screenshot detection failed");
            }
          }
        });

        // Also check folder source if folder monitoring is enabled
        getScreenshotSettings()
          .then((settings) => {
            if (settings.folder_monitoring_enabled) {
              return detectFromFolder();
            }
          })
          .catch((error) => {
            console.error("Folder detection failed:", error);
          });
      })
      .catch(() => {
        // If we can't check runs, proceed with detection anyway (fail-open)
        detectFromClipboard().catch((error) => {
          console.error("Manual detection failed:", error);
          if (onError) {
            const msg = String(error);
            if (msg.includes("no_image")) {
              onError("No image found in clipboard");
            } else {
              onError("Screenshot detection failed");
            }
          }
        });

        getScreenshotSettings()
          .then((settings) => {
            if (settings.folder_monitoring_enabled) {
              return detectFromFolder();
            }
          })
          .catch((error) => {
            console.error("Folder detection failed:", error);
          });
      });
  }, [onError, profileId]);

  return { detection, dismiss, confirm, triggerManual };
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
