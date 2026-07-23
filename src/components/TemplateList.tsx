import { useState, useEffect, useCallback } from "react";
import type { Template } from "../types";
import { getTemplates, touchTemplate, deleteTemplate } from "../api";

interface TemplateListProps {
  readonly profileId: string;
  readonly onStartFromTemplate: (template: Template) => void;
  readonly onEditTemplate: (template: Template) => void;
  readonly sessionActive: boolean;
}

export default function TemplateList({
  profileId,
  onStartFromTemplate,
  onEditTemplate,
  sessionActive,
}: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const result = await getTemplates(profileId);
      setTemplates(result);
    } catch {
      // Silently fail — empty list is acceptable
    }
  }, [profileId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCardClick = useCallback(
    async (template: Template) => {
      try {
        await touchTemplate(template.id);
      } catch {
        // Non-critical — proceed with start
      }
      onStartFromTemplate(template);
    },
    [onStartFromTemplate]
  );

  const handleEditClick = useCallback(
    (e: React.MouseEvent, template: Template) => {
      e.stopPropagation();
      onEditTemplate(template);
    },
    [onEditTemplate]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, template: Template) => {
      e.stopPropagation();
      setDeleteTarget(template);
    },
    []
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    } catch {
      // Silently fail
    }
    setDeleteTarget(null);
  }, [deleteTarget]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // Hide when session is active or no templates exist
  if (sessionActive || templates.length === 0) {
    return null;
  }

  // Split into MRU (up to 3) and remaining
  const mruTemplates = templates.slice(0, 3);
  const remainingTemplates = templates.slice(3);

  const renderCard = (template: Template, isMru: boolean) => (
    <div
      key={template.id}
      className={`template-card${isMru ? " template-card--mru" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => handleCardClick(template)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick(template);
        }
      }}
      aria-label={`Start session from template: ${template.name}`}
    >
      <div className="template-card-info">
        <span className="template-card-name">{template.name}</span>
        <span className="template-card-details">
          {template.area} · P{template.player_count}
        </span>
      </div>
      <div className="template-card-actions">
        <button
          className="template-card-action"
          onClick={(e) => handleEditClick(e, template)}
          aria-label={`Edit template: ${template.name}`}
          title="Edit"
          type="button"
        >
          ✏️
        </button>
        <button
          className="template-card-action"
          onClick={(e) => handleDeleteClick(e, template)}
          aria-label={`Delete template: ${template.name}`}
          title="Delete"
          type="button"
        >
          🗑️
        </button>
      </div>
    </div>
  );

  return (
    <div className="template-list">
      <h4 className="template-list-title">Quick Start</h4>

      <div className="template-list-mru">
        {mruTemplates.map((template) => renderCard(template, true))}
      </div>

      {remainingTemplates.length > 0 && (
        <div className="template-list-remaining">
          {remainingTemplates.map((template) => renderCard(template, false))}
        </div>
      )}

      {deleteTarget && (
        <div
          className="template-delete-overlay"
          role="dialog"
          aria-label="Confirm delete"
          aria-modal="true"
        >
          <div className="template-delete-dialog">
            <p className="template-delete-message">
              Delete template <strong>&quot;{deleteTarget.name}&quot;</strong>?
            </p>
            <div className="template-delete-actions">
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                type="button"
              >
                Delete
              </button>
              <button
                className="btn"
                onClick={handleCancelDelete}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
