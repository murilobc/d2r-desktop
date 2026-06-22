import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
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
}

export default function Overlay() {
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

  // Listen for state updates from main window
  useEffect(() => {
    const unlisten = listen<OverlayState>("overlay-state-update", (event) => {
      setState(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const formatTime = (tenths: number) => {
    const totalSecs = Math.floor(tenths / 10);
    const t = tenths % 10;
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${t}`;
  };

  const handleAction = async (action: string) => {
    await invoke("overlay_action", { action });
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
          <span className="overlay-title">D2R Tracker</span>
          <button className="overlay-close" onClick={() => getCurrentWindow().hide()}>×</button>
        </div>
        <p className="overlay-msg">Start a session from the main window</p>
      </div>
    );
  }

  return (
    <div className="overlay-container" onMouseDown={startDrag}>
      <div className="overlay-header">
        <span className={`rec-dot ${state.paused ? "paused" : ""}`}>●</span>
        <span className="overlay-session-label">Session:</span>
        <span className="overlay-session-time">{formatTime(state.sessionElapsed)}</span>
        <span className="overlay-area">{state.area}</span>
        <button className="overlay-close" onClick={() => getCurrentWindow().hide()}>×</button>
      </div>

      <div className="overlay-run-timer">{formatTime(state.runElapsed)}</div>

      <div className="overlay-stats">
        Run: {state.sessionRunCount} ({state.totalRunCount})
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
      </div>

      {showItemSearch && (
        <div className="overlay-item-search">
          <ItemSearch
            onSelect={handleAddItem}
            placeholder="Search D2R item..."
          />
        </div>
      )}
    </div>
  );
}
