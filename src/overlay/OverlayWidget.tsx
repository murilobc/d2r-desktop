import type { WidgetPlacement, WidgetType } from "../types";
import { WIDGET_SIZE_SCALES } from "../types";

/**
 * Session data that the overlay receives from the main window.
 * Each field corresponds to a widget type's display value.
 */
export interface OverlaySessionData {
  sessionElapsed?: string;    // formatted time "00:12:34"
  runElapsed?: string;        // formatted time "0:45"
  runCount?: number;          // current run number
  totalRuns?: number;         // total runs across sessions
  itemsFound?: number;        // items found this session
  lastItem?: string;          // most recent item name
  dryStreak?: number;         // runs since last item
  goalCurrent?: number;       // current progress toward goal
  goalTarget?: number;        // total goal target
  xpPerHour?: string;         // formatted XP rate
  routeStep?: string;         // current step text
}

interface OverlayWidgetProps {
  widget: WidgetPlacement;
  sessionData?: OverlaySessionData;
}

function getWidgetContent(type: WidgetType, data?: OverlaySessionData): string {
  switch (type) {
    case "timer":
      return data?.sessionElapsed ?? "00:00:00";
    case "run_timer":
      return data?.runElapsed ?? "0:00";
    case "run_count":
      return `Run #${data?.runCount ?? 0} (Total: ${data?.totalRuns ?? 0})`;
    case "items_found":
      return `Items: ${data?.itemsFound ?? 0}`;
    case "last_item":
      return data?.lastItem ?? "No items yet";
    case "dry_streak":
      return `Dry: ${data?.dryStreak ?? 0} runs`;
    case "goal_progress":
      return `${data?.goalCurrent ?? 0}/${data?.goalTarget ?? 0} runs`;
    case "xp_per_hour":
      return data?.xpPerHour ?? "0 XP/hr";
    case "route_step":
      return data?.routeStep ?? "No route active";
  }
}

export function OverlayWidget({ widget, sessionData }: Readonly<OverlayWidgetProps>) {
  const scale = WIDGET_SIZE_SCALES[widget.size];
  const content = getWidgetContent(widget.type, sessionData);

  return (
    <div
      data-widget-id={widget.id}
      data-widget-type={widget.type}
      style={{
        position: "absolute",
        left: widget.x,
        top: widget.y,
        opacity: widget.opacity,
        fontSize: `${scale}em`,
        whiteSpace: "nowrap",
      }}
    >
      {content}
    </div>
  );
}
