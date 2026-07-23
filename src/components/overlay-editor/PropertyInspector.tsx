import type { WidgetPlacement, WidgetSize, WidgetType } from "../../types";

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

const SIZE_OPTIONS: { value: WidgetSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

interface PropertyInspectorProps {
  readonly widget: WidgetPlacement | null;
  readonly onSizeChange: (id: string, size: WidgetSize) => void;
  readonly onOpacityChange: (id: string, opacity: number) => void;
  readonly onRemoveWidget: (id: string) => void;
}

export default function PropertyInspector({
  widget,
  onSizeChange,
  onOpacityChange,
  onRemoveWidget,
}: PropertyInspectorProps) {
  if (!widget) {
    return (
      <div className="property-inspector property-inspector--empty">
        <p className="property-inspector-placeholder">
          Select a widget to edit its properties
        </p>
      </div>
    );
  }

  return (
    <div className="property-inspector">
      <h3 className="property-inspector-title">
        {WIDGET_LABELS[widget.type]}
      </h3>

      <fieldset className="property-inspector-field">
        <legend className="property-inspector-label">Size</legend>
        <div className="property-inspector-size-group" role="radiogroup">
          {SIZE_OPTIONS.map((option) => (
            <label key={option.value} className="property-inspector-size-option">
              <input
                type="radio"
                name={`widget-size-${widget.id}`}
                value={option.value}
                checked={widget.size === option.value}
                onChange={() => onSizeChange(widget.id, option.value)}
              />
              <span className="property-inspector-size-label">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="property-inspector-field">
        <label
          className="property-inspector-label"
          htmlFor={`widget-opacity-${widget.id}`}
        >
          Opacity: {widget.opacity.toFixed(2)}
        </label>
        <input
          id={`widget-opacity-${widget.id}`}
          type="range"
          className="property-inspector-slider"
          min={0.1}
          max={1.0}
          step={0.01}
          value={widget.opacity}
          onChange={(e) =>
            onOpacityChange(widget.id, Number.parseFloat(e.target.value))
          }
        />
      </div>

      <div className="property-inspector-field">
        <button
          className="btn btn-danger property-inspector-remove-btn"
          onClick={() => onRemoveWidget(widget.id)}
        >
          Remove Widget
        </button>
      </div>
    </div>
  );
}
