import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, CreateProfileInput, UpdateProfileInput } from "../types";
import { D2R_CLASSES, GAME_MODES } from "../types";
import { createProfile, getProfiles, deleteProfile, updateProfile } from "../api";

interface Props {
  onSelectProfile: (profile: Profile) => void;
}

export default function Profiles({ onSelectProfile }: Props) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<CreateProfileInput>({
    name: "",
    class: D2R_CLASSES[0],
    mode: GAME_MODES[0],
  });

  const loadProfiles = async () => {
    const data = await getProfiles();
    setProfiles(data);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProfile(form);
    setForm({ name: "", class: D2R_CLASSES[0], mode: GAME_MODES[0] });
    setShowForm(false);
    loadProfiles();
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setShowForm(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    const input: UpdateProfileInput = {
      name: editingProfile.name,
      class: editingProfile.class,
      mode: editingProfile.mode,
      magic_find: editingProfile.magic_find ?? undefined,
    };

    await updateProfile(editingProfile.id, input);
    setEditingProfile(null);
    loadProfiles();
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('profiles.deleteConfirm'))) {
      await deleteProfile(id);
      loadProfiles();
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('profiles.title')}</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingProfile(null); }}>
          {showForm ? t('profiles.cancel') : t('profiles.newProfile')}
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>{t('profiles.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Character name"
              />
            </div>
            <div className="form-group">
              <label>{t('profiles.class')}</label>
              <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
                {D2R_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('profiles.mode')}</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {GAME_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('profiles.magicFind')}</label>
              <input
                type="number"
                min={0}
                max={9999}
                value={form.magic_find ?? ""}
                onChange={(e) => setForm({ ...form, magic_find: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Optional"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">{t('profiles.create')}</button>
        </form>
      )}

      {editingProfile && (
        <form className="form-card" onSubmit={handleSaveEdit}>
          <h3 style={{ marginBottom: "0.75rem" }}>{t('profiles.edit')}</h3>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>{t('profiles.name')}</label>
              <input
                type="text"
                value={editingProfile.name}
                onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('profiles.class')}</label>
              <select value={editingProfile.class} onChange={(e) => setEditingProfile({ ...editingProfile, class: e.target.value })}>
                {D2R_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('profiles.mode')}</label>
              <select value={editingProfile.mode} onChange={(e) => setEditingProfile({ ...editingProfile, mode: e.target.value })}>
                {GAME_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('profiles.magicFind')}</label>
              <input
                type="number"
                min={0}
                max={9999}
                value={editingProfile.magic_find ?? ""}
                onChange={(e) => setEditingProfile({ ...editingProfile, magic_find: e.target.value ? Number(e.target.value) : null })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary">{t('profiles.save')}</button>
            <button type="button" className="btn" onClick={() => setEditingProfile(null)}>{t('profiles.cancel')}</button>
          </div>
        </form>
      )}

      <div className="profiles-grid">
        {profiles.map((profile) => (
          <div key={profile.id} className="profile-card">
            <div className="profile-card-header">
              <h3>{profile.name}</h3>
              <span className="badge">{profile.class}</span>
            </div>
            <div className="profile-card-body">
              <p>{profile.mode}{profile.magic_find ? ` • ${profile.magic_find}% MF` : ""}</p>
            </div>
            <div className="profile-card-actions">
              <button className="btn btn-sm" onClick={() => onSelectProfile(profile)}>
                {t('profiles.select')}
              </button>
              <button className="btn btn-sm" onClick={() => handleEdit(profile)}>
                {t('profiles.edit')}
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(profile.id)}>
                {t('profiles.delete')}
              </button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && !showForm && (
          <p className="empty-state">No profiles created. Create one to get started!</p>
        )}
      </div>
    </div>
  );
}
