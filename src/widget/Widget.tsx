import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  profileName?: string;
  fastestTime?: number | null;
}

function getWidgetPrefs(): { stats: string[] } {
  try {
    const raw = localStorage.getItem("d2r_widget_prefs");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { stats: ["sessionRunCount", "sessionTime"] };
}

export default function Widget() {
  const { t } = useTranslation();
  const [state, setState] = useState<OverlayState>({
    sessionActive: false,
    paused: false,
    sessionElapsed: 0,
    runElapsed: 0,
    sessionRunCount: 0,
    totalRunCount: 0,
    area: "",
  });
  const [prefs] = useState(() => getWidgetPrefs());

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

  const renderStat = (key: string): string => {
    switch (key) {
      case "sessionRunCount": return String(state.sessionRunCount);
      case "sessionTime": return formatTime(state.sessionElapsed);
      case "runTimer": return formatTime(state.runElapsed);
      case "area": return state.area || "—";
      case "fastestTime": return state.fastestTime != null ? formatTime(state.fastestTime * 10) : "--:--:--";
      case "averageTime": return "--:--:--"; // No average available in event payload
      case "totalRuns": return String(state.totalRunCount);
      default: return "";
    }
  };

  if (!state.sessionActive) {
    return (
      <div className="widget-container widget-idle" onMouseDown={startDrag}>
        <span className="widget-profile">{state.profileName || "D2R"}</span>
        <span className="widget-separator">•</span>
        <span className="widget-total">{state.totalRunCount} {t("widget.runCount")}</span>
      </div>
    );
  }

  return (
    <div className="widget-container" onMouseDown={startDrag}>
      {prefs.stats.map((key, idx) => (
        <React.Fragment key={key}>
          {idx > 0 && <span className="widget-separator">|</span>}
          <span className="widget-stat">{renderStat(key)}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
