import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, Route } from "../types";
import { AREAS } from "../types";
import { createRoute, getRoutes, updateRoute, deleteRoute, getCustomAreas } from "../api";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  readonly profile: Profile;
}

interface SortableAreaItemProps {
  readonly id: string;
  readonly area: string;
  readonly index: number;
  readonly onRemove: (index: number) => void;
}

function SortableAreaItem({ id, area, index, onRemove }: SortableAreaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-area-item">
      <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
      <span className="area-step-index">{index + 1}.</span>
      <span className="area-step-name">{area}</span>
      <button
        type="button"
        className="btn-icon"
        onClick={() => onRemove(index)}
        aria-label={`Remove ${area}`}
      >
        ✕
      </button>
    </div>
  );
}

export default function RouteEditor({ profile }: Props) {
  const { t } = useTranslation();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [customAreas, setCustomAreas] = useState<string[]>([]);

  // Form state
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState("");

  const allAreas = [...AREAS.filter(a => a !== "Other"), ...customAreas, "Other"];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadRoutes = useCallback(async () => {
    const data = await getRoutes(profile.id);
    setRoutes(data);
  }, [profile.id]);

  useEffect(() => {
    loadRoutes();
    getCustomAreas(profile.id).then((cas) => {
      setCustomAreas(cas.map((a) => a.name));
    });
  }, [profile.id, loadRoutes]);

  const resetForm = () => {
    setEditingRouteId(null);
    setName("");
    setAreas([]);
    setSelectedArea("");
  };

  const handleEdit = (route: Route) => {
    setEditingRouteId(route.id);
    setName(route.name);
    setAreas([...route.areas]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this route? Existing run history will be preserved.")) return;
    try {
      await deleteRoute(id);
      await loadRoutes();
      if (editingRouteId === id) resetForm();
    } catch (e) {
      alert("Error: " + e);
    }
  };

  const handleAddArea = () => {
    if (selectedArea) {
      setAreas([...areas, selectedArea]);
      setSelectedArea("");
    }
  };

  const handleRemoveArea = (index: number) => {
    setAreas(areas.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = areas.findIndex((_, i) => `area-${i}` === active.id);
      const newIndex = areas.findIndex((_, i) => `area-${i}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setAreas(arrayMove(areas, oldIndex, newIndex));
      }
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editingRouteId) {
        await updateRoute(editingRouteId, { name, areas });
      } else {
        await createRoute({ profile_id: profile.id, name, areas });
      }
      resetForm();
      await loadRoutes();
    } catch (e) {
      alert("Error saving route: " + e);
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim() !== "" && areas.length >= 2;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('app.sidebar.routes')}</h1>
        <span className="badge">{profile.name}</span>
      </div>

      <div className="route-editor-layout">
        {/* Route Form */}
        <div className="route-form-card">
          <h2>{editingRouteId ? "Edit Route" : "Create Route"}</h2>

          <div className="form-group">
            <label htmlFor="route-name-input">Route Name <span style={{ color: "var(--accent)" }}>*</span></label>
            <input
              id="route-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., MF Route A (required)"
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="area-select">Add Area to Sequence</label>
            <div className="add-area-row">
              <select
                id="area-select"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
              >
                <option value="">Select area...</option>
                {allAreas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleAddArea}
                disabled={!selectedArea}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Area Sequence with drag-to-reorder */}
          <div className="route-area-sequence">
            <h3>Area Sequence ({areas.length})</h3>
            {areas.length === 0 ? (
              <p className="empty-state">Add at least 2 areas to create a route.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={areas.map((_, i) => `area-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {areas.map((area, i) => (
                    <SortableAreaItem
                      key={`area-${i}`}
                      id={`area-${i}`}
                      area={area}
                      index={i}
                      onRemove={handleRemoveArea}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="route-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!canSave || saving}
            >
              {saving ? t('common.loading') : editingRouteId ? t('common.save') : t('common.save')}
            </button>
            {editingRouteId && (
              <button type="button" className="btn" onClick={resetForm}>
                {t('common.cancel')}
              </button>
            )}
            {!canSave && name.trim() === "" && areas.length >= 2 && (
              <small className="text-muted">Enter a route name</small>
            )}
            {!canSave && areas.length < 2 && (
              <small className="text-muted">Add at least 2 areas</small>
            )}
          </div>
        </div>

        {/* Route List */}
        <div className="route-list-card">
          <h2>Your Routes ({routes.length})</h2>
          {routes.length === 0 ? (
            <p className="empty-state">No routes yet. Create one to get started.</p>
          ) : (
            <div className="route-list">
              {routes.map((route) => (
                <div key={route.id} className="route-list-item">
                  <div className="route-list-item-info">
                    <strong>{route.name}</strong>
                    <span className="route-areas-preview">
                      {route.areas.join(" → ")}
                    </span>
                    <small>{route.areas.length} areas</small>
                  </div>
                  <div className="route-list-item-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleEdit(route)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(route.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
