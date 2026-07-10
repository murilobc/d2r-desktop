import { useRef, useState } from "react";
import type { Run, Item } from "../types";
import { getItemTierName } from "../data/item-values";
import html2canvas from "html2canvas";

interface Props {
  runs: Run[];
  items: Item[];
  sessionStartTime: string;
  sessionEndTime: string;
}

interface TimelineEvent {
  type: "split" | "item";
  time: string;
  offsetMs: number;
  label: string;
  detail: string;
  color: string;
}

function getItemColor(item: Item): string {
  const tier = getItemTierName(item.name, item.rarity);
  switch (tier) {
    case "gg": return "#ffd700";
    case "high": return "#a855f7";
    case "mid": return "#3b82f6";
    case "low": return "#22c55e";
    default:
      // Fallback by rarity
      switch (item.rarity.toLowerCase()) {
        case "unique": return "#c4a000";
        case "set": return "#00c400";
        case "rare": return "#ffff00";
        case "magic": return "#6060ff";
        case "rune": return "#ff8c00";
        case "runeword": return "#c4a000";
        default: return "#888";
      }
  }
}

function formatTimeOffset(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function SessionTimeline({ runs, items, sessionStartTime, sessionEndTime }: Props) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ event: TimelineEvent; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [exporting, setExporting] = useState(false);

  const startMs = new Date(sessionStartTime).getTime();
  const endMs = new Date(sessionEndTime).getTime();
  const durationMs = endMs - startMs;

  if (durationMs <= 0) {
    return <div className="session-timeline"><p className="empty-state-sm">Invalid session duration.</p></div>;
  }

  // Build timeline events
  const events: TimelineEvent[] = [];

  // Add run splits (each run start except the first)
  for (let i = 1; i < runs.length; i++) {
    const run = runs[i];
    const offsetMs = new Date(run.started_at).getTime() - startMs;
    events.push({
      type: "split",
      time: run.started_at,
      offsetMs,
      label: `Split #${i}`,
      detail: `${run.area} — ${formatTimeOffset(offsetMs)}`,
      color: "#666",
    });
  }

  // Add items
  for (const item of items) {
    const offsetMs = new Date(item.found_at).getTime() - startMs;
    events.push({
      type: "item",
      time: item.found_at,
      offsetMs,
      label: item.name,
      detail: `${item.rarity} ${item.item_type} — ${formatTimeOffset(offsetMs)}`,
      color: getItemColor(item),
    });
  }

  // Time markers every 5 minutes
  const markerInterval = 5 * 60 * 1000;
  const timeMarkers: number[] = [];
  for (let ms = markerInterval; ms < durationMs; ms += markerInterval) {
    timeMarkers.push(ms);
  }

  const baseWidth = 800;
  const timelineWidth = baseWidth * zoom;

  const handleEventClick = (event: TimelineEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({ event, x: rect.left, y: rect.top - 60 });
  };

  const handleExportPng = async () => {
    if (!timelineRef.current) return;
    setExporting(true);
    setTooltip(null);
    try {
      const canvas = await html2canvas(timelineRef.current, {
        backgroundColor: "#1a1a2e",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `session-timeline-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
    setExporting(false);
  };

  return (
    <div className="session-timeline" onClick={() => setTooltip(null)}>
      <div className="timeline-controls">
        <button className="btn btn-sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}>−</button>
        <span className="timeline-zoom-label">{zoom}x</span>
        <button className="btn btn-sm" onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>+</button>
        <button className="btn btn-sm btn-export" onClick={handleExportPng} disabled={exporting}>
          {exporting ? "Exporting..." : "📷 Export PNG"}
        </button>
      </div>

      <div className="timeline-scroll-container">
        <div className="timeline-content" ref={timelineRef} style={{ width: `${timelineWidth}px` }}>
          {/* Time markers */}
          <div className="timeline-markers">
            <span className="timeline-time-marker" style={{ left: 0 }}>0:00</span>
            {timeMarkers.map((ms) => (
              <span
                key={ms}
                className="timeline-time-marker"
                style={{ left: `${(ms / durationMs) * 100}%` }}
              >
                {Math.floor(ms / 60000)}m
              </span>
            ))}
            <span className="timeline-time-marker" style={{ left: "100%" }}>
              {formatTimeOffset(durationMs)}
            </span>
          </div>

          {/* Main bar */}
          <div className="timeline-bar">
            {/* Split tick marks */}
            {events
              .filter((ev) => ev.type === "split")
              .map((ev, i) => (
                <div
                  key={`split-${i}`}
                  className="timeline-event timeline-split"
                  style={{ left: `${(ev.offsetMs / durationMs) * 100}%` }}
                  onClick={(e) => handleEventClick(ev, e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleEventClick(ev, e as unknown as React.MouseEvent); }}
                  title={ev.label}
                />
              ))}

            {/* Item dots */}
            {events
              .filter((ev) => ev.type === "item")
              .map((ev, i) => (
                <div
                  key={`item-${i}`}
                  className="timeline-event timeline-item-dot"
                  style={{
                    left: `${(ev.offsetMs / durationMs) * 100}%`,
                    backgroundColor: ev.color,
                  }}
                  onClick={(e) => handleEventClick(ev, e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleEventClick(ev, e as unknown as React.MouseEvent); }}
                  title={ev.label}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="timeline-tooltip">
          <strong>{tooltip.event.label}</strong>
          <span>{tooltip.event.detail}</span>
        </div>
      )}
    </div>
  );
}
