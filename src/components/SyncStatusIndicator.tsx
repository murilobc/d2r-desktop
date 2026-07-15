import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { SyncStatus, SyncState } from "../services/cloud-sync.types";
import type { SyncEngine } from "../services/cloud-sync";

/**
 * Format a relative time string from an ISO 8601 timestamp.
 * Returns a translated relative time string using i18next.
 */
export function formatRelativeTime(isoTimestamp: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return t("sync.justNow");

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return t("sync.justNow");

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return t("sync.minuteAgo");
  if (minutes < 60) return t("sync.minutesAgo", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return t("sync.hourAgo");
  if (hours < 24) return t("sync.hoursAgo", { count: hours });

  const days = Math.floor(hours / 24);
  if (days === 1) return t("sync.dayAgo");
  return t("sync.daysAgo", { count: days });
}

/**
 * Build the display text for the current sync state.
 */
function getStatusText(status: SyncStatus, t: (key: string, opts?: Record<string, unknown>) => string): string {
  switch (status.state) {
    case "not_configured":
      return t("sync.notConfigured");
    case "syncing":
      return t("sync.syncing");
    case "synced":
      if (status.lastSyncAt) {
        return t("sync.syncedAgo", { time: formatRelativeTime(status.lastSyncAt, t) });
      }
      return t("sync.synced");
    case "error":
      if (status.errorMessage) {
        const truncated =
          status.errorMessage.length > 80
            ? status.errorMessage.slice(0, 77) + "..."
            : status.errorMessage;
        return t("sync.errorMessage", { message: truncated });
      }
      return t("sync.error");
    default:
      return "";
  }
}

/**
 * Build an aria-label describing the current sync state and timestamp.
 */
function getAriaLabel(status: SyncStatus, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const stateLabel = getStatusText(status, t);
  return `Sync status: ${stateLabel}`;
}

interface SyncStatusIndicatorProps {
  readonly syncEngine: SyncEngine;
}

/**
 * Compact sync status indicator for the sidebar footer.
 * Displays current sync state, relative time since last sync,
 * manual sync button, and dismiss button for errors.
 */
export default function SyncStatusIndicator({ syncEngine }: SyncStatusIndicatorProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const [errorDismissed, setErrorDismissed] = useState(false);

  // Poll status periodically to update relative time and detect state changes
  useEffect(() => {
    const update = () => {
      const newStatus = syncEngine.getStatus();
      setStatus(newStatus);
      // Reset dismiss when error clears
      if (newStatus.state !== "error") {
        setErrorDismissed(false);
      }
    };

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [syncEngine]);

  const handleSync = useCallback(async () => {
    if (status.state === "not_configured") {
      // Show inline error for unconfigured state
      setStatus((prev) => ({
        ...prev,
        state: "error" as SyncState,
        errorMessage: t("sync.notConfiguredError"),
      }));
      setErrorDismissed(false);
      return;
    }

    if (status.state === "syncing") return;

    // Optimistically transition to syncing state
    setStatus((prev) => ({ ...prev, state: "syncing" as SyncState, errorMessage: null }));
    setErrorDismissed(false);

    await syncEngine.triggerSync();
    setStatus(syncEngine.getStatus());
  }, [syncEngine, status.state, t]);

  const handleDismiss = useCallback(() => {
    setErrorDismissed(true);
  }, []);

  const isSyncing = status.state === "syncing";
  const showError = status.state === "error" && !errorDismissed;
  const displayStatus: SyncStatus = errorDismissed
    ? { ...status, state: status.lastSyncAt ? "synced" : "not_configured", errorMessage: null }
    : status;

  return (
    <output
      className="sync-status-indicator"
      aria-label={getAriaLabel(displayStatus, t)}
      tabIndex={0}
    >
      <div className="sync-status-row">
        <span className="sync-status-text">
          {showError ? getStatusText(status, t) : getStatusText(displayStatus, t)}
        </span>
        <div className="sync-status-actions">
          <button
            className="sync-btn"
            onClick={handleSync}
            disabled={isSyncing}
            aria-label={t("sync.syncNow")}
            title={t("sync.syncNow")}
          >
            🔄
          </button>
          {showError && (
            <button
              className="sync-dismiss-btn"
              onClick={handleDismiss}
              aria-label={t("sync.dismissError")}
              title={t("sync.dismissError")}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </output>
  );
}
