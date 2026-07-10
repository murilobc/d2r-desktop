import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface OverlayState {
  sessionActive: boolean;
  paused: boolean;
  sessionElapsed: number;
  runElapsed: number;
  sessionRunCount: number;
  totalRunCount: number;
  area: string;
}

export default function Widget() {
  const [state, setState] = useState<OverlayState>({
    sessionActive: false,
    paused: false,
    sessionElapsed: 0,
    runElapsed: 0,
    sessionRunCount: 0,
    totalRunCount: 0,
    area: "",
  });

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

  const formatTime = (tenths: number) => {
    const totalSecs = Math.floor(tenths / 10);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startDrag = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    await getCurrentWindow().startDragging();
  };

  if (!state.sessionActive) {
    return (
      <div className="widget-container widget-idle" onMouseDown={startDrag}>
        <span className="widget-logo">D2R</span>
      </div>
    );
  }

  return (
    <div className="widget-container" onMouseDown={startDrag}>
      <span className="widget-runs">{state.sessionRunCount}</span>
      <span className="widget-separator">|</span>
      <span className="widget-time">{formatTime(state.sessionElapsed)}</span>
    </div>
  );
}
