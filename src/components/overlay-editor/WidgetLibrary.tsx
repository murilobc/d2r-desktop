import { useDraggable } from "@dnd-kit/core";
import { WIDGET_TYPES } from "../../types";
import type { WidgetType } from "../../types";

const WIDGET_LABELS: Record<WidgetType, string> = {
  timer: "Session Timer",
  run_timer: "Run Timer",
  run_count: "Run Count",
  items_found: "Items Found",
  last_item: "Last Item",
  dry_streak: "Dry Streak",
  goal_progress: "Goal Progress",
  xp_per_hour: "XP/Hour",
  route_step: "Route Step",
};

const WIDGET_ICONS: Record<WidgetType, string> = {
  timer: "⏱️",
  run_timer: "⏲️",
  run_count: "🔢",
  items_found: "🎒",
  last_item: "💎",
  dry_streak: "🏜️",
  goal_progress: "🎯",
  xp_per_hour: "📈",
  route_step: "🗺️",
};

interface WidgetLibraryProps {
  readonly placedWidgetTypes: WidgetType[];
}

interface DraggableWidgetItemProps {
  readonly type: WidgetType;
  readonly isPlaced: boolean;
}

function DraggableWidgetItem({ type, isPlaced }: DraggableWidgetItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `widget-library-${type}`,
    data: { type, fromLibrary: true },
  });

  return (
    <div
      ref={setNodeRef}
      className={`widget-library-item${isPlaced ? " widget-library-item--placed" : ""}${isDragging ? " widget-library-item--dragging" : ""}`}
      {...listeners}
      {...attributes}
      aria-label={`${WIDGET_LABELS[type]}${isPlaced ? " (placed)" : ""}`}
    >
      <span className="widget-library-item-icon">{WIDGET_ICONS[type]}</span>
      <span className="widget-library-item-name">{WIDGET_LABELS[type]}</span>
      {isPlaced && <span className="widget-library-item-badge">Placed</span>}
    </div>
  );
}

export default function WidgetLibrary({ placedWidgetTypes }: WidgetLibraryProps) {
  return (
    <div className="widget-library">
      <h3 className="widget-library-title">Widgets</h3>
      <div className="widget-library-list">
        {WIDGET_TYPES.map((type) => (
          <DraggableWidgetItem
            key={type}
            type={type}
            isPlaced={placedWidgetTypes.includes(type)}
          />
        ))}
      </div>
    </div>
  );
}
