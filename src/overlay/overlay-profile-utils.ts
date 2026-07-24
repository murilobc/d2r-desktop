import {
  WidgetType,
  WidgetSize,
  OverlayProfileLayout,
  WidgetPlacement,
  WIDGET_TYPES,
} from "../types";

/**
 * Clamps widget opacity to the valid range [0.1, 1.0].
 */
export function clampWidgetOpacity(value: number): number {
  return Math.min(1.0, Math.max(0.1, value));
}

/**
 * Clamps background opacity to the valid range [0.0, 1.0].
 */
export function clampBackgroundOpacity(value: number): number {
  return Math.min(1.0, Math.max(0.0, value));
}

/**
 * Clamps overlay dimensions to valid ranges:
 * width: [200, 800], height: [100, 600].
 */
export function clampDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  return {
    width: Math.min(800, Math.max(200, width)),
    height: Math.min(600, Math.max(100, height)),
  };
}

/**
 * Clamps widget position so its bounding box stays within the canvas.
 * x is clamped to [0, canvasWidth - widgetWidth]
 * y is clamped to [0, canvasHeight - widgetHeight]
 */
export function clampWidgetPosition(
  x: number,
  y: number,
  widgetWidth: number,
  widgetHeight: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const maxX = Math.max(0, canvasWidth - widgetWidth);
  const maxY = Math.max(0, canvasHeight - widgetHeight);
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  };
}

/**
 * Validates a profile name:
 * - Must be 1–50 characters after trimming
 * - Must be unique among existing names (case-sensitive)
 */
export function validateProfileName(
  name: string,
  existingNames: string[]
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Profile name cannot be empty" };
  }
  if (trimmed.length > 50) {
    return {
      valid: false,
      error: "Profile name must be 50 characters or fewer",
    };
  }
  if (existingNames.includes(trimmed)) {
    return { valid: false, error: "Profile name already in use" };
  }
  return { valid: true };
}

/**
 * Type guard: checks if a string is a valid WidgetSize.
 */
export function isValidWidgetSize(size: string): size is WidgetSize {
  return size === "small" || size === "medium" || size === "large";
}

/**
 * Type guard: checks if a string is a valid WidgetType.
 */
export function isValidWidgetType(type: string): type is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(type);
}

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function validateWidget(
  widget: unknown,
  index: number,
  canvasWidth: number,
  canvasHeight: number
): { valid: boolean; placement?: WidgetPlacement; error?: string } {
  if (widget === null || typeof widget !== "object") {
    return { valid: false, error: `widgets[${index}] must be an object` };
  }

  const w = widget as Record<string, unknown>;

  if (typeof w.id !== "string" || w.id.length === 0) {
    return { valid: false, error: `widgets[${index}].id must be a non-empty string` };
  }

  if (typeof w.type !== "string" || !isValidWidgetType(w.type)) {
    return { valid: false, error: `widgets[${index}].type must be a valid widget type` };
  }

  if (typeof w.x !== "number" || !Number.isFinite(w.x)) {
    return { valid: false, error: `widgets[${index}].x must be a number` };
  }
  if (w.x < 0 || w.x > canvasWidth) {
    return { valid: false, error: `widgets[${index}].x must be within canvas dimensions` };
  }

  if (typeof w.y !== "number" || !Number.isFinite(w.y)) {
    return { valid: false, error: `widgets[${index}].y must be a number` };
  }
  if (w.y < 0 || w.y > canvasHeight) {
    return { valid: false, error: `widgets[${index}].y must be within canvas dimensions` };
  }

  if (typeof w.size !== "string" || !isValidWidgetSize(w.size)) {
    return { valid: false, error: `widgets[${index}].size must be "small", "medium", or "large"` };
  }

  if (typeof w.opacity !== "number" || !Number.isFinite(w.opacity)) {
    return { valid: false, error: `widgets[${index}].opacity must be a number` };
  }
  if (w.opacity < 0.1 || w.opacity > 1.0) {
    return { valid: false, error: `widgets[${index}].opacity must be between 0.1 and 1.0` };
  }

  return {
    valid: true,
    placement: {
      id: w.id,
      type: w.type as WidgetType,
      x: w.x,
      y: w.y,
      size: w.size as WidgetSize,
      opacity: w.opacity,
    },
  };
}

/**
 * Validates a full profile layout JSON object.
 * Checks all required fields, types, and value ranges.
 */
export function validateProfileLayout(
  json: unknown
): { valid: boolean; layout?: OverlayProfileLayout; error?: string } {
  if (json === null || typeof json !== "object") {
    return { valid: false, error: "Layout must be an object" };
  }

  const obj = json as Record<string, unknown>;

  // Validate width
  if (typeof obj.width !== "number" || !Number.isFinite(obj.width)) {
    return { valid: false, error: "width must be a number" };
  }
  if (obj.width < 200 || obj.width > 800) {
    return { valid: false, error: "width must be between 200 and 800" };
  }

  // Validate height
  if (typeof obj.height !== "number" || !Number.isFinite(obj.height)) {
    return { valid: false, error: "height must be a number" };
  }
  if (obj.height < 100 || obj.height > 600) {
    return { valid: false, error: "height must be between 100 and 600" };
  }

  // Validate background_color
  if (typeof obj.background_color !== "string") {
    return { valid: false, error: "background_color must be a string" };
  }
  if (!HEX_COLOR_REGEX.test(obj.background_color)) {
    return { valid: false, error: "background_color must be a hex color (#RRGGBB)" };
  }

  // Validate background_opacity
  if (typeof obj.background_opacity !== "number" || !Number.isFinite(obj.background_opacity)) {
    return { valid: false, error: "background_opacity must be a number" };
  }
  if (obj.background_opacity < 0.0 || obj.background_opacity > 1.0) {
    return { valid: false, error: "background_opacity must be between 0.0 and 1.0" };
  }

  // Validate widgets array
  if (!Array.isArray(obj.widgets)) {
    return { valid: false, error: "widgets must be an array" };
  }

  const widgets: WidgetPlacement[] = [];
  for (let i = 0; i < obj.widgets.length; i++) {
    const result = validateWidget(obj.widgets[i], i, obj.width, obj.height);
    if (!result.valid) {
      return { valid: false, error: result.error };
    }
    widgets.push(result.placement!);
  }

  const layout: OverlayProfileLayout = {
    widgets,
    background_color: obj.background_color,
    background_opacity: obj.background_opacity,
    width: obj.width,
    height: obj.height,
  };

  return { valid: true, layout };
}
