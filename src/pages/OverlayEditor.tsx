import { useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import ProfileManager from "../components/overlay-editor/ProfileManager";
import WidgetLibrary from "../components/overlay-editor/WidgetLibrary";
import PreviewCanvas from "../components/overlay-editor/PreviewCanvas";
import PropertyInspector from "../components/overlay-editor/PropertyInspector";
import BackgroundSettings from "../components/overlay-editor/BackgroundSettings";
import DimensionControls from "../components/overlay-editor/DimensionControls";
import { useOverlayProfiles } from "../hooks/useOverlayProfiles";
import { clampWidgetPosition } from "../overlay/overlay-profile-utils";
import type {
  WidgetType,
  WidgetSize,
  WidgetPlacement,
  OverlayProfileLayout,
} from "../types";

/** Approximate widget bounding box dimensions by size for clamping */
const WIDGET_DIMENSIONS: Record<WidgetSize, { width: number; height: number }> = {
  small: { width: 80, height: 20 },
  medium: { width: 100, height: 24 },
  large: { width: 140, height: 32 },
};

export default function OverlayEditor() {
  const {
    profiles,
    activeProfile,
    loading,
    error,
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    switchProfile,
  } = useOverlayProfiles();

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const layout = activeProfile?.layout ?? null;

  // --- Layout update helper ---
  const updateLayout = useCallback(
    (newLayout: OverlayProfileLayout) => {
      if (!activeProfile) return;
      updateProfile(activeProfile.id, { layout: newLayout });
    },
    [activeProfile, updateProfile]
  );

  // --- Widget operations ---
  const addWidget = useCallback(
    (type: WidgetType, x: number, y: number) => {
      if (!layout) return;
      const dims = WIDGET_DIMENSIONS["medium"];
      const clamped = clampWidgetPosition(
        x,
        y,
        dims.width,
        dims.height,
        layout.width,
        layout.height
      );
      const newWidget: WidgetPlacement = {
        id: crypto.randomUUID(),
        type,
        x: clamped.x,
        y: clamped.y,
        size: "medium",
        opacity: 1.0,
      };
      updateLayout({
        ...layout,
        widgets: [...layout.widgets, newWidget],
      });
    },
    [layout, updateLayout]
  );

  const moveWidget = useCallback(
    (id: string, x: number, y: number) => {
      if (!layout) return;
      updateLayout({
        ...layout,
        widgets: layout.widgets.map((w) => {
          if (w.id !== id) return w;
          const dims = WIDGET_DIMENSIONS[w.size];
          const clamped = clampWidgetPosition(
            x,
            y,
            dims.width,
            dims.height,
            layout.width,
            layout.height
          );
          return { ...w, x: clamped.x, y: clamped.y };
        }),
      });
    },
    [layout, updateLayout]
  );

  const changeWidgetSize = useCallback(
    (id: string, size: WidgetSize) => {
      if (!layout) return;
      updateLayout({
        ...layout,
        widgets: layout.widgets.map((w) => {
          if (w.id !== id) return w;
          // Re-clamp position with new size dimensions
          const dims = WIDGET_DIMENSIONS[size];
          const clamped = clampWidgetPosition(
            w.x,
            w.y,
            dims.width,
            dims.height,
            layout.width,
            layout.height
          );
          return { ...w, size, x: clamped.x, y: clamped.y };
        }),
      });
    },
    [layout, updateLayout]
  );

  const changeWidgetOpacity = useCallback(
    (id: string, opacity: number) => {
      if (!layout) return;
      updateLayout({
        ...layout,
        widgets: layout.widgets.map((w) =>
          w.id === id ? { ...w, opacity } : w
        ),
      });
    },
    [layout, updateLayout]
  );

  const removeWidget = useCallback(
    (id: string) => {
      if (!layout) return;
      if (selectedWidgetId === id) {
        setSelectedWidgetId(null);
      }
      updateLayout({
        ...layout,
        widgets: layout.widgets.filter((w) => w.id !== id),
      });
    },
    [layout, updateLayout, selectedWidgetId]
  );

  const changeBackgroundColor = useCallback(
    (color: string) => {
      if (!layout) return;
      updateLayout({ ...layout, background_color: color });
    },
    [layout, updateLayout]
  );

  const changeBackgroundOpacity = useCallback(
    (opacity: number) => {
      if (!layout) return;
      updateLayout({ ...layout, background_opacity: opacity });
    },
    [layout, updateLayout]
  );

  const changeDimensions = useCallback(
    (width: number, height: number) => {
      if (!layout) return;
      // Clamp widgets that fall outside the new bounds
      const widgets = layout.widgets.map((w) => {
        const dims = WIDGET_DIMENSIONS[w.size];
        const clamped = clampWidgetPosition(
          w.x,
          w.y,
          dims.width,
          dims.height,
          width,
          height
        );
        return { ...w, x: clamped.x, y: clamped.y };
      });
      updateLayout({ ...layout, width, height, widgets });
    },
    [layout, updateLayout]
  );

  // --- DnD handler ---
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta } = event;
      if (!over || !layout) return;

      // Only handle drops on the canvas
      if (over.id !== "preview-canvas") return;

      const data = active.data.current;

      if (data?.fromLibrary) {
        // New widget from library: place at center of canvas as a default
        const dropX = layout.width / 2;
        const dropY = layout.height / 2;
        addWidget(data.type as WidgetType, dropX, dropY);
      } else if (data?.fromCanvas && data?.widgetId) {
        // Existing widget repositioned on canvas
        const widget = layout.widgets.find((w) => w.id === data.widgetId);
        if (widget) {
          moveWidget(widget.id, widget.x + delta.x, widget.y + delta.y);
        }
      }
    },
    [layout, addWidget, moveWidget]
  );

  // --- ProfileManager callbacks ---
  const handleCreateProfile = useCallback(
    async (name: string, profileLayout: OverlayProfileLayout) => {
      await createProfile(name, profileLayout);
    },
    [createProfile]
  );

  const handleDeleteProfile = useCallback(
    async (id: string) => {
      await deleteProfile(id);
    },
    [deleteProfile]
  );

  const handleRenameProfile = useCallback(
    async (id: string, name: string) => {
      await updateProfile(id, { name });
    },
    [updateProfile]
  );

  const handleSwitchProfile = useCallback(
    async (id: string) => {
      setSelectedWidgetId(null);
      await switchProfile(id);
    },
    [switchProfile]
  );

  // Determine selected widget for the inspector
  const selectedWidget =
    layout?.widgets.find((w) => w.id === selectedWidgetId) ?? null;

  // Determine which widget types are placed on the canvas
  const placedWidgetTypes = layout?.widgets.map((w) => w.type) ?? [];

  if (loading) {
    return (
      <div className="overlay-editor overlay-editor--loading">
        <p>Loading overlay profiles…</p>
      </div>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overlay-editor">
        {error && (
          <div className="overlay-editor-error" role="alert">
            {error}
          </div>
        )}

        <div className="overlay-editor-layout">
          {/* Sidebar */}
          <aside className="overlay-editor-sidebar">
            <ProfileManager
              profiles={profiles}
              activeProfile={activeProfile}
              onCreateProfile={handleCreateProfile}
              onDeleteProfile={handleDeleteProfile}
              onRenameProfile={handleRenameProfile}
              onSwitchProfile={handleSwitchProfile}
            />

            <WidgetLibrary placedWidgetTypes={placedWidgetTypes} />

            <PropertyInspector
              widget={selectedWidget}
              onSizeChange={changeWidgetSize}
              onOpacityChange={changeWidgetOpacity}
              onRemoveWidget={removeWidget}
            />

            <BackgroundSettings
              backgroundColor={layout?.background_color ?? "#000000"}
              backgroundOpacity={layout?.background_opacity ?? 0.85}
              onColorChange={changeBackgroundColor}
              onOpacityChange={changeBackgroundOpacity}
            />

            <DimensionControls
              width={layout?.width ?? 400}
              height={layout?.height ?? 300}
              onDimensionsChange={changeDimensions}
            />
          </aside>

          {/* Main canvas area */}
          <main className="overlay-editor-main">
            {layout ? (
              <PreviewCanvas
                layout={layout}
                selectedWidgetId={selectedWidgetId}
                onWidgetSelect={setSelectedWidgetId}
                onWidgetMove={moveWidget}
                onWidgetAdd={addWidget}
              />
            ) : (
              <p className="overlay-editor-no-profile">
                No active profile. Create or select a profile to start editing.
              </p>
            )}
          </main>
        </div>
      </div>
    </DndContext>
  );
}
