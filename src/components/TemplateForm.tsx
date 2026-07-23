import { useState, useCallback, useMemo } from "react";
import type { Template, Route } from "../types";
import { AREAS } from "../types";
import { createTemplate, updateTemplate } from "../api";
import { PREDEFINED_TAGS } from "./QuickTags";

interface TemplateFormProps {
  readonly mode: "create" | "edit";
  readonly initialValues?: Partial<Template>;
  readonly profileId: string;
  readonly routes: Route[];
  readonly customAreas: string[];
  readonly availableTags: string[];
  readonly onSave: (template: Template) => void;
  readonly onCancel: () => void;
}

interface FormErrors {
  name?: string;
  area?: string;
  playerCount?: string;
  goalValue?: string;
  tags?: string;
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function TemplateForm({
  mode,
  initialValues,
  profileId,
  routes,
  customAreas,
  availableTags,
  onSave,
  onCancel,
}: TemplateFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [area, setArea] = useState(initialValues?.area ?? AREAS[0]);
  const [playerCount, setPlayerCount] = useState(initialValues?.player_count ?? 1);
  const [routeId, setRouteId] = useState<string>(initialValues?.route_id ?? "");
  const [goalType, setGoalType] = useState<string>(initialValues?.session_goal_type ?? "none");
  const [goalValue, setGoalValue] = useState<number>(initialValues?.session_goal_value ?? 50);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    parseTags(initialValues?.tags)
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const allAreas = useMemo(
    () => [...AREAS.filter((a) => a !== "Other"), ...customAreas, "Other"],
    [customAreas]
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>([
      ...PREDEFINED_TAGS.map((t) => t.value),
      ...availableTags,
    ]);
    return Array.from(tagSet);
  }, [availableTags]);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};

    // Name validation: required, 1–100 chars, at least 1 non-whitespace
    const trimmedName = name.trim();
    if (!trimmedName) {
      errs.name = "Template name is required";
    } else if (name.length > 100) {
      errs.name = "Name must be 100 characters or less";
    }

    // Area validation: must be in AREAS or customAreas
    if (!allAreas.includes(area)) {
      errs.area = "Please select a valid area";
    }

    // Player count validation: 1–8
    if (playerCount < 1 || playerCount > 8) {
      errs.playerCount = "Player count must be between 1 and 8";
    }

    // Goal value validation: if goal type is "runs" or "time", value must be 1–9999
    if (goalType === "runs" || goalType === "time") {
      if (goalValue < 1 || goalValue > 9999) {
        errs.goalValue = "Goal value must be between 1 and 9999";
      }
    }

    // Tags: max 10
    if (selectedTags.length > 10) {
      errs.tags = "Maximum 10 tags allowed";
    }

    return errs;
  }, [name, area, allAreas, playerCount, goalType, goalValue, selectedTags]);

  const isValid = useMemo(() => {
    const errs = validate();
    return Object.keys(errs).length === 0;
  }, [validate]);

  const buildInput = useCallback(() => {
    const base = {
      name: name.trim(),
      area,
      player_count: playerCount,
      session_goal_type: goalType,
      ...(routeId ? { route_id: routeId } : {}),
      ...(goalType !== "none" ? { session_goal_value: goalValue } : {}),
      ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
    };
    return base;
  }, [name, area, playerCount, goalType, routeId, goalValue, selectedTags]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const errs = validate();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }

      setErrors({});
      setSaving(true);

      try {
        const fields = buildInput();
        let result: Template;

        if (mode === "create") {
          result = await createTemplate({ ...fields, profile_id: profileId });
        } else {
          result = await updateTemplate(initialValues!.id!, fields);
        }

        onSave(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : (typeof err === "string" ? err : "Unknown error");
        setErrors((prev) => ({ ...prev, name: message }));
      } finally {
        setSaving(false);
      }
    },
    [mode, profileId, initialValues, validate, buildInput, onSave]
  );

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= 10) return prev;
      return [...prev, tag];
    });
  }, []);

  const getTagLabel = useCallback((tagValue: string): string => {
    const predefined = PREDEFINED_TAGS.find((t) => t.value === tagValue);
    return predefined ? predefined.label : tagValue;
  }, []);

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
  );

  const goalLabel = goalType === "runs" ? "Goal Value (runs)" : "Goal Value (minutes)";

  const submitLabel = saving ? "Saving..." : (mode === "create" ? "Create" : "Save");

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="template-form-overlay"
      onClick={onCancel}
      onKeyDown={handleOverlayKeyDown}
    >
      <dialog
        className="template-form-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={mode === "create" ? "Create template" : "Edit template"}
        open
      >
        <div className="template-form-header">
          <h3>{mode === "create" ? "Create Template" : "Edit Template"}</h3>
          <button className="btn btn-sm" onClick={onCancel} type="button">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="template-form" noValidate>
          {/* Name field */}
          <div className="form-group">
            <label htmlFor="template-name">Name</label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Pit MF Runs"
              autoFocus
            />
            {errors.name && (
              <span className="template-form-error">{errors.name}</span>
            )}
          </div>

          {/* Area dropdown */}
          <div className="form-group">
            <label htmlFor="template-area">Area</label>
            <select
              id="template-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              {allAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            {errors.area && (
              <span className="template-form-error">{errors.area}</span>
            )}
          </div>

          {/* Player count dropdown */}
          <div className="form-group">
            <label htmlFor="template-player-count">Player Count</label>
            <select
              id="template-player-count"
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {errors.playerCount && (
              <span className="template-form-error">{errors.playerCount}</span>
            )}
          </div>

          {/* Route dropdown (optional) */}
          <div className="form-group">
            <label htmlFor="template-route">Route (optional)</label>
            <select
              id="template-route"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
            >
              <option value="">None</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Goal type dropdown */}
          <div className="form-group">
            <label htmlFor="template-goal-type">Session Goal</label>
            <select
              id="template-goal-type"
              value={goalType}
              onChange={(e) => setGoalType(e.target.value)}
            >
              <option value="none">None</option>
              <option value="runs">Runs</option>
              <option value="time">Time (minutes)</option>
            </select>
          </div>

          {/* Goal value (conditional) */}
          {(goalType === "runs" || goalType === "time") && (
            <div className="form-group">
              <label htmlFor="template-goal-value">
                {goalLabel}
              </label>
              <input
                id="template-goal-value"
                type="number"
                min={1}
                max={9999}
                value={goalValue}
                onChange={(e) => setGoalValue(Number(e.target.value))}
              />
              {errors.goalValue && (
                <span className="template-form-error">{errors.goalValue}</span>
              )}
            </div>
          )}

          {/* Tags multi-select */}
          <fieldset className="form-group template-form-fieldset">
            <legend className="template-form-legend">Tags (max 10)</legend>
            <div className="template-form-tags">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`quick-tag-btn ${selectedTags.includes(tag) ? "active" : ""}`}
                  onClick={() => handleTagToggle(tag)}
                  aria-pressed={selectedTags.includes(tag)}
                >
                  {getTagLabel(tag)}
                </button>
              ))}
            </div>
            {errors.tags && (
              <span className="template-form-error">{errors.tags}</span>
            )}
          </fieldset>

          {/* Actions */}
          <div className="template-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isValid || saving}
            >
              {submitLabel}
            </button>
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
