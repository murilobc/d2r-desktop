import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { WidgetType, WidgetPlacement, OverlayProfileLayout } from "../../types";
import { WIDGET_SIZE_SCALES } from "../../types";

const WIDGET_PLACEHOLDERS: Record<WidgetType, string> = {
  timer: "00:00:00",
  run_timer: "0:00",
  run_count: "Run #1 (Total: 1)",
  items_found: "Items: 0",
  last_item: "Shako",
  dry_streak: "Dry: 0 runs",
  goal_progress: "3/10 runs",
  xp_per_hour: "1.2M XP/hr",
  route_step: "Step 1: Waypoint",
};

interface PreviewCanvasProps {
  readonly layout: OverlayProfileLayout;
  readonly selectedWidgetId: string | null;
  readonly onWidgetSelect: (id: string | null) => void;
  // Called by the parent DndContext onDragEnd handler when a placed widget is repositioned
  readonly onWidgetMove: (id: string, x: number, y: number) => void;
  // Called by the parent DndContext onDragEnd handler when a new widget is dropped on the canvas
  readonly onWidgetAdd: (type: WidgetType, x: number, y: number) => void;
}

interface DraggableWidgetProps {
  readonly widget: WidgetPlacement;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}

function DraggableWidget({ widget, isSelected, onSelect }: DraggableWidgetProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `canvas-widget-${widget.id}`,
    data: { widgetId: widget.id, fromCanvas: true },
  });

  const scale = WIDGET_SIZE_SCALES[widget.size];

  const style: React.CSSProperties = {
    position: "absolute",
    left: widget.x,
    top: widget.y,
    opacity: widget.opacity,
    fontSize: `${scale}em`,
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none",
    padding: "2px 6px",
    borderRadius: "3px",
    whiteSpace: "nowrap",
    border: isSelected ? "2px solid #4a9eff" : "2px solid transparent",
    outline: isSelected ? "1px solid rgba(74, 158, 255, 0.4)" : "none",
    backgroundColor: isSelected ? "rgba(74, 158, 255, 0.1)" : "transparent",
    color: "#ffffff",
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    zIndex: isDragging ? 1000 : 1,
    // Reset button defaults
    font: "inherit",
    lineHeight: "inherit",
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(widget.id);
      }}
      aria-label={`Widget: ${widget.type}${isSelected ? " (selected)" : ""}`}
      data-widget-id={widget.id}
    >
      {WIDGET_PLACEHOLDERS[widget.type]}
    </button>
  );
}

export default function PreviewCanvas(props: PreviewCanvasProps) {
  const { layout, selectedWidgetId, onWidgetSelect } = props;
  // onWidgetMove and onWidgetAdd are part of the interface so the parent OverlayEditor
  // can pass them through and call them in the DndContext onDragEnd handler.
  // PreviewCanvas provides the droppable area and draggable widgets.

  const { setNodeRef, isOver } = useDroppable({
    id: "preview-canvas",
  });

  const backgroundStyle: React.CSSProperties = {
    backgroundColor: layout.background_color,
    opacity: layout.background_opacity,
    position: "absolute",
    inset: 0,
    borderRadius: "4px",
  };

  const canvasStyle: React.CSSProperties = {
    position: "relative",
    width: layout.width,
    height: layout.height,
    border: isOver ? "2px dashed #4a9eff" : "2px dashed #555",
    borderRadius: "4px",
    overflow: "hidden",
  };

  return (
    <div className="preview-canvas-container">
      <section
        ref={setNodeRef}
        className="preview-canvas"
        style={canvasStyle}
        aria-label="Overlay preview canvas"
        data-testid="preview-canvas"
      >
        <div style={backgroundStyle} aria-hidden="true" />
        <button
          type="button"
          className="preview-canvas-deselect"
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
            border: "none",
            cursor: "default",
            zIndex: 0,
          }}
          onClick={() => onWidgetSelect(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onWidgetSelect(null);
            }
          }}
          aria-label="Click to deselect widget"
          tabIndex={-1}
        />
        {layout.widgets.map((widget) => (
          <DraggableWidget
            key={widget.id}
            widget={widget}
            isSelected={selectedWidgetId === widget.id}
            onSelect={onWidgetSelect}
          />
        ))}
      </section>
    </div>
  );
}

export { WIDGET_PLACEHOLDERS };
export type { PreviewCanvasProps };
