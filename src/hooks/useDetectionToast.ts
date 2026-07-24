import { useState, useCallback, useRef, useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const AUTO_DISMISS_MS = 4000;

export interface ToastState {
  message: string;
  visible: boolean;
}

export interface UseDetectionToast {
  toast: ToastState | null;
  showToast: (message: string) => void;
  dismissToast: () => void;
}

interface DetectionFailedPayload {
  reason: string;
  message: string;
}

const REASON_MESSAGES: Record<string, string> = {
  no_image: "No image found in clipboard",
  no_text: "No text detected in screenshot",
  no_match: "No item detected in screenshot",
};

function mapReasonToMessage(reason: string): string {
  return REASON_MESSAGES[reason] || "Screenshot detection failed";
}

export function useDetectionToast(): UseDetectionToast {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string) => {
      clearTimer();
      setToast({ message, visible: true });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setToast(null);
      }, AUTO_DISMISS_MS);
    },
    [clearTimer]
  );

  const dismissToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  // Listen for screenshot:detection-failed events from the backend
  useEffect(() => {
    let unlistenFailed: UnlistenFn | null = null;
    let unlistenNoProfile: UnlistenFn | null = null;

    const setup = async () => {
      unlistenFailed = await listen<DetectionFailedPayload>(
        "screenshot:detection-failed",
        (event) => {
          const message = mapReasonToMessage(event.payload.reason);
          showToast(message);
        }
      );

      unlistenNoProfile = await listen<void>(
        "screenshot:no-profile",
        () => {
          showToast("Select a profile first to log items");
        }
      );
    };

    setup();

    return () => {
      if (unlistenFailed) unlistenFailed();
      if (unlistenNoProfile) unlistenNoProfile();
      clearTimer();
    };
  }, [showToast, clearTimer]);

  return { toast, showToast, dismissToast };
}
