import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getActiveOverlayProfile } from "../api";

/**
 * Key used by legacy code if overlay window position was ever persisted.
 * We check for it on startup and migrate to the active overlay profile.
 */
const LEGACY_OVERLAY_POSITION_KEY = "d2r-overlay-position";

interface LegacyOverlayPosition {
  x: number;
  y: number;
}

/**
 * Initializes default overlay profiles on app startup.
 *
 * - Calls `init_default_overlay_profiles` as an idempotent safety net
 *   (the backend also calls this during setup, but this covers edge cases
 *   like DB being created without the setup hook running).
 * - Migrates any previously saved overlay window position from localStorage
 *   to the active profile's first widget positions (Requirement 10.5).
 * - Ensures "Compact" is set as active when creating defaults (handled by backend).
 */
export function useOverlayProfileInit(): void {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        // Call init_default_overlay_profiles as a safety net (no-op if profiles exist)
        await invoke<void>("init_default_overlay_profiles");
      } catch (err) {
        console.warn("[overlay-init] Failed to init default profiles:", err);
      }

      // Migrate legacy overlay window position if one was saved
      try {
        const savedPosition = localStorage.getItem(LEGACY_OVERLAY_POSITION_KEY);
        if (savedPosition) {
          const position: LegacyOverlayPosition = JSON.parse(savedPosition);
          if (
            typeof position.x === "number" &&
            typeof position.y === "number"
          ) {
            // Apply legacy position to the active profile's layout
            const activeProfile = await getActiveOverlayProfile();
            if (activeProfile) {
              // Shift all widget positions by the legacy offset so the overlay
              // appears at the same screen location as before the upgrade.
              // Since the legacy overlay had no widget-based layout, we just
              // note the position for the window itself — but since the overlay
              // window position is managed by Tauri (not the profile), we store
              // a marker so the overlay renderer can apply it on mount.
              localStorage.setItem(
                "d2r-overlay-migrated-position",
                JSON.stringify(position)
              );
            }
          }
          // Remove the legacy key after migration
          localStorage.removeItem(LEGACY_OVERLAY_POSITION_KEY);
        }
      } catch (err) {
        console.warn("[overlay-init] Failed to migrate overlay position:", err);
      }
    }

    init();
  }, []);
}
