import { useState, useCallback, useRef, useEffect } from "react";
import type { OverlayProfile, OverlayProfileLayout } from "../../types";
import { validateProfileName } from "../../overlay/overlay-profile-utils";

const MAX_PROFILES = 20;

const DEFAULT_LAYOUT: OverlayProfileLayout = {
  widgets: [],
  background_color: "#000000",
  background_opacity: 0.85,
  width: 400,
  height: 300,
};

interface ProfileManagerProps {
  readonly profiles: OverlayProfile[];
  readonly activeProfile: OverlayProfile | null;
  readonly onCreateProfile: (name: string, layout: OverlayProfileLayout) => Promise<void>;
  readonly onDeleteProfile: (id: string) => Promise<void>;
  readonly onRenameProfile: (id: string, name: string) => Promise<void>;
  readonly onSwitchProfile: (id: string) => Promise<void>;
}

export default function ProfileManager({
  profiles,
  activeProfile,
  onCreateProfile,
  onDeleteProfile,
  onRenameProfile,
  onSwitchProfile,
}: ProfileManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingId]);

  const existingNames = profiles.map((p) => p.name);

  const handleStartCreate = useCallback(() => {
    if (profiles.length >= MAX_PROFILES) {
      setCreateError("Maximum number of profiles reached (20)");
      return;
    }
    setIsCreating(true);
    setNewName("");
    setCreateError(null);
  }, [profiles.length]);

  const handleConfirmCreate = useCallback(async () => {
    const validation = validateProfileName(newName, existingNames);
    if (!validation.valid) {
      setCreateError(validation.error ?? "Invalid name");
      return;
    }
    const templateLayout = activeProfile?.layout ?? DEFAULT_LAYOUT;
    try {
      await onCreateProfile(newName.trim(), templateLayout);
      setIsCreating(false);
      setNewName("");
      setCreateError(null);
    } catch {
      setCreateError("Failed to create profile");
    }
  }, [newName, existingNames, activeProfile, onCreateProfile]);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setNewName("");
    setCreateError(null);
  }, []);

  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmCreate();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelCreate();
      }
    },
    [handleConfirmCreate, handleCancelCreate]
  );

  const handleStartRename = useCallback(
    (profile: OverlayProfile) => {
      setRenamingId(profile.id);
      setRenameValue(profile.name);
      setRenameError(null);
    },
    []
  );

  const handleConfirmRename = useCallback(async () => {
    if (!renamingId) return;
    const otherNames = existingNames.filter(
      (n) => n !== profiles.find((p) => p.id === renamingId)?.name
    );
    const validation = validateProfileName(renameValue, otherNames);
    if (!validation.valid) {
      setRenameError(validation.error ?? "Invalid name");
      return;
    }
    try {
      await onRenameProfile(renamingId, renameValue.trim());
      setRenamingId(null);
      setRenameValue("");
      setRenameError(null);
    } catch {
      setRenameError("Failed to rename profile");
    }
  }, [renamingId, renameValue, existingNames, profiles, onRenameProfile]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue("");
    setRenameError(null);
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelRename();
      }
    },
    [handleConfirmRename, handleCancelRename]
  );

  const handleDeleteClick = useCallback((id: string) => {
    setDeletingId(id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingId) return;
    try {
      await onDeleteProfile(deletingId);
    } catch {
      // Error handling is delegated to parent
    }
    setDeletingId(null);
  }, [deletingId, onDeleteProfile]);

  const handleCancelDelete = useCallback(() => {
    setDeletingId(null);
  }, []);

  const handleSwitchProfile = useCallback(
    async (id: string) => {
      if (activeProfile?.id === id) return;
      await onSwitchProfile(id);
    },
    [activeProfile, onSwitchProfile]
  );

  const handleProfileKeyDown = useCallback(
    (id: string) => (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSwitchProfile(id);
      }
    },
    [handleSwitchProfile]
  );

  const canDelete = profiles.length > 1;

  return (
    <div className="profile-manager">
      <div className="profile-manager-header">
        <h3 className="profile-manager-title">Profiles</h3>
        <button
          className="btn profile-manager-new-btn"
          onClick={handleStartCreate}
          disabled={profiles.length >= MAX_PROFILES}
          title={
            profiles.length >= MAX_PROFILES
              ? "Maximum number of profiles reached (20)"
              : "Create new profile"
          }
        >
          + New Profile
        </button>
      </div>

      {profiles.length >= MAX_PROFILES && !isCreating && (
        <div className="profile-manager-error" role="alert">
          Maximum number of profiles reached (20)
        </div>
      )}

      {isCreating && (
        <div className="profile-manager-create">
          <input
            ref={createInputRef}
            type="text"
            className="profile-manager-input"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setCreateError(null);
            }}
            onKeyDown={handleCreateKeyDown}
            placeholder="Profile name"
            maxLength={50}
            aria-label="New profile name"
            aria-invalid={!!createError}
            aria-describedby={createError ? "create-error" : undefined}
          />
          <div className="profile-manager-create-actions">
            <button
              className="btn btn-primary profile-manager-action-btn"
              onClick={handleConfirmCreate}
            >
              Create
            </button>
            <button
              className="btn profile-manager-action-btn"
              onClick={handleCancelCreate}
            >
              Cancel
            </button>
          </div>
          {createError && (
            <div className="profile-manager-error" id="create-error" role="alert">
              {createError}
            </div>
          )}
        </div>
      )}

      <ul className="profile-manager-list" aria-label="Overlay profiles">
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className={`profile-manager-item ${
              activeProfile?.id === profile.id ? "profile-manager-item--active" : ""
            }`}
          >
            {renamingId === profile.id ? (
              <div className="profile-manager-rename">
                <input
                  ref={renameInputRef}
                  type="text"
                  className="profile-manager-input"
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    setRenameError(null);
                  }}
                  onKeyDown={handleRenameKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={50}
                  aria-label="Rename profile"
                  aria-invalid={!!renameError}
                  aria-describedby={renameError ? `rename-error-${profile.id}` : undefined}
                />
                <div className="profile-manager-rename-actions">
                  <button
                    className="btn btn-primary profile-manager-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirmRename();
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="btn profile-manager-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelRename();
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {renameError && (
                  <div
                    className="profile-manager-error"
                    id={`rename-error-${profile.id}`}
                    role="alert"
                  >
                    {renameError}
                  </div>
                )}
              </div>
            ) : (
              <div className="profile-manager-item-content">
                <button
                  className="profile-manager-item-select-btn"
                  onClick={() => handleSwitchProfile(profile.id)}
                  onKeyDown={handleProfileKeyDown(profile.id)}
                  aria-pressed={activeProfile?.id === profile.id}
                  title={`Switch to ${profile.name}`}
                >
                  {activeProfile?.id === profile.id && (
                    <span className="profile-manager-active-indicator" aria-label="Active">
                      ●{" "}
                    </span>
                  )}
                  {profile.name}
                </button>
                <div className="profile-manager-item-actions">
                  <button
                    className="btn profile-manager-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(profile);
                    }}
                    title="Rename profile"
                    aria-label={`Rename ${profile.name}`}
                  >
                    ✏️
                  </button>
                  {deletingId === profile.id ? (
                    <span className="profile-manager-delete-confirm">
                      <button
                        className="btn btn-danger profile-manager-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmDelete();
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn profile-manager-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelDelete();
                        }}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      className="btn profile-manager-icon-btn profile-manager-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(profile.id);
                      }}
                      disabled={!canDelete}
                      title={
                        canDelete
                          ? "Delete profile"
                          : "Cannot delete the last profile"
                      }
                      aria-label={`Delete ${profile.name}`}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
