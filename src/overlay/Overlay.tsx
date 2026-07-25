import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import ItemSearch from "../components/ItemSearch";
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
  runItemCount: number;
}

export default function Overlay() {
  const { t } = useTranslation();
  const [state, setState] = useState<OverlayState>({
    sessionActive: false,
    paused: false,
    sessionElapsed: 0,
    runElapsed: 0,
    sessionRunCount: 0,
    totalRunCount: 0,
    area: "",
    runItemCount: 0,
  });
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string | null>(null);

  // Apply theme from localStorage on mount
  useEffect(() => {
    const theme = localStorage.getItem("d2r-theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  // Listen for state updates from main window
  useEffect(() => {
    const unlisten = listen<OverlayState>("overlay-state-update", (event) => {
      setState(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen for detection results to show status indicators
  useEffect(() => {
    const unlistenDetected = listen("screenshot:item-detected", () => {
      setDetectionStatus("✓ Item detected");
      // Emit event so main window can bring itself to focus
      emit("screenshot:overlay-detected");
      // Auto-dismiss after 3 seconds
      setTimeout(() => setDetectionStatus(null), 3000);
    });

    const unlistenFailed = listen("screenshot:detection-failed", () => {
      setDetectionStatus("✗ Detection failed");
      // Auto-dismiss after 3 seconds
      setTimeout(() => setDetectionStatus(null), 3000);
    });

    return () => {
      unlistenDetected.then((fn) => fn());
      unlistenFailed.then((fn) => fn());
    };
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

  const handleDetect = async () => {
    // Guard: require active session before invoking detection
    if (!state.sessionActive) {
      setDetectionStatus("Start a session first");
      setTimeout(() => setDetectionStatus(null), 3000);
      return;
    }
    try {
      await invoke("detect_from_clipboard");
    } catch (error) {
      // Error contains "no_image" → the main window hook handles toasts
      // via the event system; overlay doesn't show its own toast
    }
  };

  const handleAddItem = async (gameItem: GameItem) => {
    await invoke("overlay_add_item", { name: gameItem.name });
    setShowItemSearch(false);
  };

  const startDrag = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".overlay-controls") || (e.target as HTMLElement).closest(".overlay-item-search")) return;
    await getCurrentWindow().startDragging();
  };

  if (!state.sessionActive) {
    return (
      <div className="overlay-container overlay-idle" onMouseDown={startDrag}>
        <div className="overlay-header">
          <span className="overlay-title">{t("overlay.title")}</span>
          <button className="ov-btn ov-detect" onClick={handleDetect}>◫</button>
          <button className="overlay-close" onClick={() => getCurrentWindow().hide()}>×</button>
        </div>
        <p className="overlay-msg">{t("overlay.noSession")}</p>
        {detectionStatus && (
          <div className="overlay-detection-status">{detectionStatus}</div>
        )}
      </div>
    );
  }

  return (
    <div className="overlay-container" onMouseDown={startDrag}>
      <div className="overlay-header">
        <span className={`rec-dot ${state.paused ? "paused" : ""}`}>●</span>
        <span className="overlay-session-label">{t("overlay.sessionTime")}</span>
        <span className="overlay-session-time">{formatTime(state.sessionElapsed)}</span>
        <span className="overlay-area">{state.area}</span>
        <button className="overlay-close" onClick={() => getCurrentWindow().hide()}>×</button>
      </div>

      <div className="overlay-run-timer">{formatTime(state.runElapsed)}</div>

      <div className="overlay-stats">
        {t("overlay.runCount")} {state.sessionRunCount} ({state.totalRunCount}) · Items: {state.runItemCount}
      </div>

      <div className="overlay-controls">
        <button className="ov-btn ov-split" onClick={() => handleAction("split")} disabled={state.paused}>
          ⏭
        </button>
        <button className="ov-btn ov-pause" onClick={() => handleAction("pause")}>
          {state.paused ? "▶" : "⏸"}
        </button>
        <button className="ov-btn ov-stop" onClick={() => handleAction("end")}>
          ⏹
        </button>
        <button className="ov-btn ov-item" onClick={() => setShowItemSearch(!showItemSearch)}>
          +
        </button>
        <button className="ov-btn ov-detect" onClick={handleDetect}>◫</button>
      </div>

      {showItemSearch && (
        <div className="overlay-item-search">
          <ItemSearch
            onSelect={handleAddItem}
            placeholder={t("tracker.searchItem")}
          />
        </div>
      )}

      {detectionStatus && (
        <div className="overlay-detection-status">{detectionStatus}</div>
      )}
    </div>
  );
}
