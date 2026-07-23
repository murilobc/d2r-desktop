import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import ItemSearch from "../components/ItemSearch";
import { OverlayWidget } from "./OverlayWidget";
import type { OverlaySessionData } from "./OverlayWidget";
import type { OverlayProfile, OverlayProfileLayout } from "../types";
import type { GameItem } from "../data/items";
import "./overlay.css";

interface OverlayState {
  sessionActive: boolean;
  paused: boolean;
  sessionElapsed: number;
  runElapsed: number;
  sessionRunCount: number;
  totalRunCount: number;
  area: string;
}

export default function OverlayRenderer() {
  const { t } = useTranslation();
  const [layout, setLayout] = useState<OverlayProfileLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<OverlayState>({
    sessionActive: false,
    paused: false,
    sessionElapsed: 0,
    runElapsed: 0,
    sessionRunCount: 0,
    totalRunCount: 0,
    area: "",
  });
  const [showItemSearch, setShowItemSearch] = useState(false);

  // Apply theme from localStorage on mount
  useEffect(() => {
    const theme = localStorage.getItem("d2r-theme") || "dark";
    document.documentElement.dataset.theme = theme;
  }, []);

  // Fetch active profile on mount
  useEffect(() => {
    invoke<OverlayProfile>("get_active_overlay_profile")
      .then((profile) => {
        setLayout(profile.layout);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Listen for profile updates from the editor
  useEffect(() => {
    const unlisten = listen<OverlayProfileLayout>("overlay-profile-update", (event) => {
      setLayout(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for session state updates
  useEffect(() => {
    const unlisten = listen<OverlayState>("overlay-state-update", (event) => {
      setState(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Set window size from profile dimensions
  useEffect(() => {
    if (layout) {
      getCurrentWindow().setSize(new LogicalSize(layout.width, layout.height));
    }
  }, [layout?.width, layout?.height]);

  // Apply migrated overlay position from legacy storage (Requirement 10.5)
  useEffect(() => {
    try {
      const migrated = localStorage.getItem("d2r-overlay-migrated-position");
      if (migrated) {
        const pos = JSON.parse(migrated);
        if (typeof pos.x === "number" && typeof pos.y === "number") {
          getCurrentWindow().setPosition(new LogicalPosition(pos.x, pos.y));
        }
        localStorage.removeItem("d2r-overlay-migrated-position");
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const formatTime = (tenths: number) => {
    const totalSecs = Math.floor(tenths / 10);
    const frac = tenths % 10;
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${frac}`;
  };

  const handleAction = async (action: string) => {
    await invoke("overlay_action", { action });
  };

  const handleAddItem = async (gameItem: GameItem) => {
    await invoke("overlay_add_item", { name: gameItem.name });
    setShowItemSearch(false);
  };

  const startDrag = async (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(".overlay-controls") ||
      (e.target as HTMLElement).closest(".overlay-item-search")
    ) {
      return;
    }
    await getCurrentWindow().startDragging();
  };

  // Map OverlayState to OverlaySessionData for widgets
  const sessionData: OverlaySessionData = {
    sessionElapsed: formatTime(state.sessionElapsed),
    runElapsed: formatTime(state.runElapsed),
    runCount: state.sessionRunCount,
    totalRuns: state.totalRunCount,
  };

  // Loading state
  if (loading) {
    return (
      <div className="overlay-container overlay-idle" onMouseDown={startDrag}>
        <div className="overlay-header">
          <span className="overlay-title">{t("overlay.title")}</span>
          <button className="overlay-close" onClick={() => getCurrentWindow().hide()}>×</button>
        </div>
        <p className="overlay-msg">Loading profile...</p>
      </div>
    );
  }

  // Idle state (no active session)
  if (!state.sessionActive) {
    return (
      <div className="overlay-container overlay-idle" onMouseDown={startDrag}>
        <div className="overlay-header">
          <span className="overlay-title">{t("overlay.title")}</span>
          <button className="overlay-close" onClick={() => getCurrentWindow().hide()}>×</button>
        </div>
        <p className="overlay-msg">{t("overlay.noSession")}</p>
      </div>
    );
  }

  // Compute background style from profile
  const backgroundStyle = layout
    ? {
        backgroundColor: layout.background_color,
        opacity: layout.background_opacity,
      }
    : undefined;

  return (
    <div
      className="overlay-container"
      onMouseDown={startDrag}
      style={backgroundStyle ? { background: "none" } : undefined}
    >
      {/* Background layer with profile-driven color and opacity */}
      {backgroundStyle && (
        <div
          className="overlay-renderer-bg"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: backgroundStyle.backgroundColor,
            opacity: backgroundStyle.opacity,
            borderRadius: "inherit",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Widget area */}
      <div
        className="overlay-renderer-widgets"
        style={{
          position: "relative",
          flex: 1,
          zIndex: 1,
        }}
      >
        {layout?.widgets.map((widget) => (
          <OverlayWidget
            key={widget.id}
            widget={widget}
            sessionData={sessionData}
          />
        ))}
      </div>

      {/* Overlay controls bar */}
      <div className="overlay-controls" style={{ position: "relative", zIndex: 1 }}>
        <button
          className="ov-btn ov-split"
          onClick={() => handleAction("split")}
          disabled={state.paused}
        >
          ⏭
        </button>
        <button className="ov-btn ov-pause" onClick={() => handleAction("pause")}>
          {state.paused ? "▶" : "⏸"}
        </button>
        <button className="ov-btn ov-stop" onClick={() => handleAction("end")}>
          ⏹
        </button>
        <button
          className="ov-btn ov-item"
          onClick={() => setShowItemSearch(!showItemSearch)}
        >
          +
        </button>
      </div>

      {showItemSearch && (
        <div className="overlay-item-search" style={{ position: "relative", zIndex: 1 }}>
          <ItemSearch
            onSelect={handleAddItem}
            placeholder={t("tracker.searchItem")}
          />
        </div>
      )}
    </div>
  );
}
